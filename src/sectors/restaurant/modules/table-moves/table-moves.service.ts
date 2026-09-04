import { BadRequestException, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../../../database';
import type { Business, RestaurantTable } from '../../../../database/schema';
import { TableSessionsService } from '../table-sessions/table-sessions.service';
import { TablesService } from '../tables/tables.service';

export interface TableMoveResult {
  table: RestaurantTable;
  ordersMoved: number;
  fromTableNos: string[];
}

@Injectable()
export class TableMovesService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly tablesService: TablesService,
    private readonly tableSessionsService: TableSessionsService,
  ) {}

  async transfer(
    business: Business,
    fromTableId: string,
    toTableId: string,
  ): Promise<TableMoveResult> {
    if (fromTableId === toTableId) {
      throw new BadRequestException('A table cannot be transferred to itself');
    }

    return this.move(business, toTableId, [fromTableId]);
  }

  async merge(
    business: Business,
    targetTableId: string,
    sourceTableIds: string[],
  ): Promise<TableMoveResult> {
    const sources = [...new Set(sourceTableIds)];

    if (sources.includes(targetTableId)) {
      throw new BadRequestException('A table cannot be merged into itself');
    }

    return this.move(business, targetTableId, sources);
  }

  private async move(
    business: Business,
    targetTableId: string,
    sourceTableIds: string[],
  ): Promise<TableMoveResult> {
    const target = await this.tablesService.getById(business.id, targetTableId);

    if (target.status === 'billed') {
      throw new BadRequestException(
        `Table ${target.tableNo} is already billed; close it before moving orders onto it`,
      );
    }

    const sources = await Promise.all(
      sourceTableIds.map((id) => this.tablesService.getById(business.id, id)),
    );

    for (const source of sources) {
      if (source.branchId !== target.branchId) {
        throw new BadRequestException(
          `Table ${source.tableNo} is in another branch than ${target.tableNo}`,
        );
      }

      if (source.status === 'billed') {
        throw new BadRequestException(
          `Table ${source.tableNo} is already billed; its orders cannot be moved`,
        );
      }
    }

    return this.db.transaction(async (tx) => {
      const moved = await tx
        .update(schema.orders)
        .set({ tableId: target.id })
        .where(
          and(
            eq(schema.orders.businessId, business.id),
            inArray(
              schema.orders.tableId,
              sources.map((source) => source.id),
            ),
            sql`EXISTS (
              SELECT 1 FROM ${schema.orderItems}
              WHERE ${schema.orderItems.orderId} = ${schema.orders.id}
                AND ${schema.orderItems.invoiceId} IS NULL
            )`,
          ),
        )
        .returning({ id: schema.orders.id });

      if (moved.length === 0) {
        throw new BadRequestException(
          sources.length === 1
            ? `Table ${sources[0].tableNo} has no open orders to move`
            : 'None of those tables have open orders to move',
        );
      }

      await tx
        .update(schema.kitchenTickets)
        .set({ tableId: target.id })
        .where(
          and(
            eq(schema.kitchenTickets.businessId, business.id),
            inArray(
              schema.kitchenTickets.orderId,
              moved.map((order) => order.id),
            ),
          ),
        );

      await tx
        .update(schema.restaurantTables)
        .set({ status: 'empty', assignedWaiterId: null })
        .where(
          and(
            eq(schema.restaurantTables.businessId, business.id),
            inArray(
              schema.restaurantTables.id,
              sources.map((source) => source.id),
            ),
          ),
        );

      const [updated] = await tx
        .update(schema.restaurantTables)
        .set({ status: 'occupied' })
        .where(
          and(
            eq(schema.restaurantTables.businessId, business.id),
            eq(schema.restaurantTables.id, target.id),
          ),
        )
        .returning();

      for (const source of sources) {
        await this.tableSessionsService.revokeForTable(
          tx,
          business.id,
          source.id,
        );
      }

      return {
        table: updated,
        ordersMoved: moved.length,
        fromTableNos: sources.map((source) => source.tableNo),
      };
    });
  }
}
