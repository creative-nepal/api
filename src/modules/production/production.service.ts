import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, sql, type SQL } from 'drizzle-orm';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase, schema } from '../../database';
import type { Business, ProductionRun } from '../../database/schema';
import type {
  CreateProductionRunDto,
  ListProductionQueryDto,
  UpdateProductionRunDto,
} from './dto/production.dto';

@Injectable()
export class ProductionService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async getById(businessId: string, id: string): Promise<ProductionRun> {
    const [row] = await this.db
      .select()
      .from(schema.productionRuns)
      .where(
        and(
          eq(schema.productionRuns.businessId, businessId),
          eq(schema.productionRuns.id, id),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Production run ${id} not found`);
    }

    return row;
  }

  async list(
    businessId: string,
    branchId: string,
    query: ListProductionQueryDto,
  ): Promise<PaginatedResult<ProductionRun>> {
    const conditions: SQL[] = [
      eq(schema.productionRuns.businessId, businessId),
      eq(schema.productionRuns.branchId, branchId),
    ];

    if (query.status) {
      conditions.push(eq(schema.productionRuns.status, query.status));
    }

    if (query.plannedFor) {
      conditions.push(
        eq(schema.productionRuns.plannedFor, query.plannedFor.slice(0, 10)),
      );
    }

    const where = and(...conditions);

    const [data, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.productionRuns)
        .where(where)
        .orderBy(
          asc(schema.productionRuns.plannedFor),
          asc(schema.productionRuns.itemName),
        )
        .limit(query.limit)
        .offset(query.offset),
      this.db
        .select({ value: count() })
        .from(schema.productionRuns)
        .where(where),
    ]);

    return {
      data,
      total: total?.value ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async create(
    business: Business,
    branchId: string,
    dto: CreateProductionRunDto,
    actorUserId: string,
  ): Promise<ProductionRun> {
    const resolved = await this.resolveItem(business.id, dto);

    const [row] = await this.db
      .insert(schema.productionRuns)
      .values({
        id: randomUUID(),
        businessId: business.id,
        branchId,
        productId: dto.productId ?? null,
        menuItemId: dto.menuItemId ?? null,
        itemName: resolved.name,
        plannedFor: dto.plannedFor.slice(0, 10),
        plannedQty: dto.plannedQty.toFixed(3),
        unitCostCents: resolved.unitCostCents,
        status: 'planned',
        note: dto.note ?? null,
        createdByUserId: actorUserId,
      })
      .returning();

    return row;
  }

  async update(
    business: Business,
    id: string,
    dto: UpdateProductionRunDto,
  ): Promise<ProductionRun> {
    const run = await this.getById(business.id, id);

    if (run.status === 'cancelled' && dto.status !== 'planned') {
      throw new BadRequestException(
        'A cancelled production run cannot be changed',
      );
    }

    const producedQty = dto.producedQty ?? Number(run.producedQty);
    const status = dto.status ?? run.status;
    const done = status === 'done';

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schema.productionRuns)
        .set({
          ...(dto.producedQty !== undefined && {
            producedQty: dto.producedQty.toFixed(3),
          }),
          ...(dto.wastedQty !== undefined && {
            wastedQty: dto.wastedQty.toFixed(3),
          }),
          ...(dto.unitCostCents !== undefined && {
            unitCostCents: dto.unitCostCents,
          }),
          ...(dto.note !== undefined && { note: dto.note }),
          status,
          completedAt: done ? (run.completedAt ?? new Date()) : null,
        })
        .where(
          and(
            eq(schema.productionRuns.businessId, business.id),
            eq(schema.productionRuns.id, id),
          ),
        )
        .returning();

      const alreadyStocked =
        run.status === 'done' ? Number(run.producedQty) : 0;
      const toStock = (done ? producedQty : 0) - alreadyStocked;

      if (updated.productId && toStock !== 0) {
        await this.moveStock(tx, business.id, updated.productId, toStock);
      }

      return updated;
    });
  }

  private async moveStock(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    businessId: string,
    productId: string,
    delta: number,
  ): Promise<void> {
    await tx
      .update(schema.products)
      .set({
        stockQty: sql`${schema.products.stockQty} + ${delta.toFixed(3)}`,
      })
      .where(
        and(
          eq(schema.products.businessId, businessId),
          eq(schema.products.id, productId),
        ),
      );
  }

  private async resolveItem(
    businessId: string,
    dto: CreateProductionRunDto,
  ): Promise<{ name: string; unitCostCents: number }> {
    if (dto.productId) {
      const [product] = await this.db
        .select()
        .from(schema.products)
        .where(
          and(
            eq(schema.products.businessId, businessId),
            eq(schema.products.id, dto.productId),
          ),
        )
        .limit(1);

      if (!product) {
        throw new NotFoundException(`Product ${dto.productId} not found`);
      }

      return {
        name: product.name,
        unitCostCents: Math.round(
          product.costPriceCents / Math.max(product.unitsPerPack, 1),
        ),
      };
    }

    if (dto.menuItemId) {
      const [menuItem] = await this.db
        .select()
        .from(schema.menuItems)
        .where(
          and(
            eq(schema.menuItems.businessId, businessId),
            eq(schema.menuItems.id, dto.menuItemId),
          ),
        )
        .limit(1);

      if (!menuItem) {
        throw new NotFoundException(`Menu item ${dto.menuItemId} not found`);
      }

      return { name: menuItem.name, unitCostCents: 0 };
    }

    if (!dto.itemName) {
      throw new BadRequestException(
        'A production run needs a product, a menu item or an item name',
      );
    }

    return { name: dto.itemName, unitCostCents: 0 };
  }
}
