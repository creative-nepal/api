import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import { NotificationsService } from '../../../../modules/notifications/notifications.service';
import { RecipesService } from '../menu/recipes.service';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../../../database';
import type { KitchenStatus, KitchenTicket } from '../../../../database/schema';
import type { KitchenTicketLine } from './dto/kitchen.dto';

const NEXT_STATUS: Record<KitchenStatus, KitchenStatus[]> = {
  in_kitchen: ['preparing'],
  preparing: ['ready'],
  ready: ['served'],
  served: [],
};

const ORDER_STATUS_BY_KITCHEN: Record<KitchenStatus, string> = {
  in_kitchen: 'in_kitchen',
  preparing: 'preparing',
  ready: 'ready',
  served: 'served',
};

const KITCHEN_RANK: Record<KitchenStatus, number> = {
  in_kitchen: 0,
  preparing: 1,
  ready: 2,
  served: 3,
};

@Injectable()
export class KitchenService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly recipes: RecipesService,
    private readonly notifications: NotificationsService,
  ) {}

  async confirmOrder(
    businessId: string,
    orderId: string,
    actorUserId: string | null = null,
  ): Promise<KitchenTicket[]> {
    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.businessId, businessId),
            eq(schema.orders.id, orderId),
          ),
        )
        .limit(1);

      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      if (order.status !== 'placed') {
        throw new BadRequestException(
          `Order ${orderId} is ${order.status}; only a placed order can be confirmed`,
        );
      }

      const lines = await tx
        .select({
          item: schema.orderItems,
          station: schema.menuItems.station,
        })
        .from(schema.orderItems)
        .innerJoin(
          schema.menuItems,
          eq(schema.menuItems.id, schema.orderItems.menuItemId),
        )
        .where(
          and(
            eq(schema.orderItems.businessId, businessId),
            eq(schema.orderItems.orderId, orderId),
          ),
        );

      if (lines.length === 0) {
        throw new BadRequestException(
          `Order ${orderId} has no kitchen-routable lines`,
        );
      }

      const byStation = new Map<string, typeof lines>();

      for (const line of lines) {
        const bucket = byStation.get(line.station) ?? [];
        bucket.push(line);
        byStation.set(line.station, bucket);
      }

      const tickets: KitchenTicket[] = [];

      for (const [station, stationLines] of byStation) {
        const [ticket] = await tx
          .insert(schema.kitchenTickets)
          .values({
            id: randomUUID(),
            businessId,
            orderId,
            tableId: order.tableId,
            station,
            status: 'in_kitchen',
          })
          .returning();

        await tx.insert(schema.kitchenTicketItems).values(
          stationLines.map((line) => ({
            id: randomUUID(),
            businessId,
            ticketId: ticket.id,
            orderItemId: line.item.id,
            status: 'in_kitchen',
          })),
        );

        tickets.push(ticket);
      }

      const depletion = await this.recipes.depleteForOrder(
        tx,
        businessId,
        order.branchId,
        orderId,
        actorUserId,
      );

      if (depletion.shortfalls.length > 0) {
        await this.notifications.raise({
          businessId,
          type: 'stock.shortfall',
          severity: 'warning',
          titleKey: 'ui.web.notifications.shortfallTitle',
          bodyKey: 'ui.web.notifications.shortfallBody',
          params: { items: depletion.shortfalls.join(', ') },
          href: '/products',
          dedupeKey: `stock.shortfall:${orderId}`,
        });
      }

      await tx
        .update(schema.orders)
        .set({ status: 'in_kitchen' })
        .where(eq(schema.orders.id, orderId));

      return tickets;
    });
  }

  async listTickets(
    businessId: string,
    filters: { status?: KitchenStatus; station?: string; openOnly?: boolean },
  ): Promise<Array<{ ticket: KitchenTicket; items: KitchenTicketLine[] }>> {
    const conditions = [eq(schema.kitchenTickets.businessId, businessId)];

    if (filters.status) {
      conditions.push(eq(schema.kitchenTickets.status, filters.status));
    }

    if (filters.station) {
      conditions.push(eq(schema.kitchenTickets.station, filters.station));
    }

    if (filters.openOnly) {
      conditions.push(ne(schema.kitchenTickets.status, 'served'));
    }

    const tickets = await this.db
      .select()
      .from(schema.kitchenTickets)
      .where(and(...conditions))
      .orderBy(asc(schema.kitchenTickets.createdAt));

    if (tickets.length === 0) {
      return [];
    }

    const lines = await this.db
      .select({
        ticketId: schema.kitchenTicketItems.ticketId,
        orderItemId: schema.kitchenTicketItems.orderItemId,
        status: schema.kitchenTicketItems.status,
        name: schema.orderItems.productName,
        quantity: schema.orderItems.quantity,
        modifiers: schema.orderItems.modifiers,
      })
      .from(schema.kitchenTicketItems)
      .innerJoin(
        schema.orderItems,
        eq(schema.orderItems.id, schema.kitchenTicketItems.orderItemId),
      )
      .where(
        and(
          eq(schema.kitchenTicketItems.businessId, businessId),
          inArray(
            schema.kitchenTicketItems.ticketId,
            tickets.map((ticket) => ticket.id),
          ),
        ),
      );

    return tickets.map((ticket) => ({
      ticket,
      items: lines
        .filter((line) => line.ticketId === ticket.id)
        .map((line) => ({
          orderItemId: line.orderItemId,
          name: line.name,
          quantity: Number(line.quantity),
          modifiers: line.modifiers.map((modifier) => ({
            name: modifier.name,
            label: modifier.label,
          })),
          status: line.status,
        })),
    }));
  }

  async updateTicketStatus(
    businessId: string,
    ticketId: string,
    status: KitchenStatus,
  ): Promise<KitchenTicket> {
    return this.db.transaction(async (tx) => {
      const [ticket] = await tx
        .select()
        .from(schema.kitchenTickets)
        .where(
          and(
            eq(schema.kitchenTickets.businessId, businessId),
            eq(schema.kitchenTickets.id, ticketId),
          ),
        )
        .limit(1);

      if (!ticket) {
        throw new NotFoundException(`Ticket ${ticketId} not found`);
      }

      const allowed = NEXT_STATUS[ticket.status as KitchenStatus] ?? [];

      if (!allowed.includes(status)) {
        throw new BadRequestException(
          `A ticket cannot move from ${ticket.status} to ${status}`,
        );
      }

      const [updated] = await tx
        .update(schema.kitchenTickets)
        .set({ status })
        .where(eq(schema.kitchenTickets.id, ticketId))
        .returning();

      await tx
        .update(schema.kitchenTicketItems)
        .set({ status })
        .where(eq(schema.kitchenTicketItems.ticketId, ticketId));

      await this.syncOrderStatus(tx, businessId, ticket.orderId);

      return updated;
    });
  }

  private async syncOrderStatus(
    executor: DatabaseExecutor,
    businessId: string,
    orderId: string,
  ): Promise<void> {
    const tickets = await executor
      .select({ status: schema.kitchenTickets.status })
      .from(schema.kitchenTickets)
      .where(
        and(
          eq(schema.kitchenTickets.businessId, businessId),
          eq(schema.kitchenTickets.orderId, orderId),
        ),
      );

    if (tickets.length === 0) {
      return;
    }

    const least = tickets.reduce((lowest, ticket) => {
      const rank = KITCHEN_RANK[ticket.status as KitchenStatus] ?? 0;
      return rank < lowest ? rank : lowest;
    }, Number.POSITIVE_INFINITY);

    const status = (Object.keys(KITCHEN_RANK) as KitchenStatus[]).find(
      (key) => KITCHEN_RANK[key] === least,
    );

    if (!status) {
      return;
    }

    await executor
      .update(schema.orders)
      .set({ status: ORDER_STATUS_BY_KITCHEN[status] })
      .where(eq(schema.orders.id, orderId));
  }
}
