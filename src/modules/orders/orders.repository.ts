import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, type SQL } from 'drizzle-orm';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../database';
import type {
  BusinessInvoice,
  Customer,
  NewCustomer,
  NewOrder,
  NewOrderItem,
  Order,
  OrderItem,
} from '../../database/schema';

export interface ListOrdersFilters {
  businessId: string;
  limit: number;
  offset: number;
  status?: string;
}

@Injectable()
export class OrdersRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async insertOrder(
    executor: DatabaseExecutor,
    values: NewOrder,
  ): Promise<Order> {
    const [row] = await executor
      .insert(schema.orders)
      .values(values)
      .returning();
    return row;
  }

  async insertOrderItems(
    executor: DatabaseExecutor,
    values: NewOrderItem[],
  ): Promise<OrderItem[]> {
    return executor.insert(schema.orderItems).values(values).returning();
  }

  async findById(businessId: string, id: string): Promise<Order | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.orders)
      .where(
        and(eq(schema.orders.businessId, businessId), eq(schema.orders.id, id)),
      )
      .limit(1);
    return row;
  }

  async findItems(businessId: string, orderId: string): Promise<OrderItem[]> {
    return this.db
      .select()
      .from(schema.orderItems)
      .where(
        and(
          eq(schema.orderItems.businessId, businessId),
          eq(schema.orderItems.orderId, orderId),
        ),
      )
      .orderBy(asc(schema.orderItems.createdAt));
  }

  async findInvoiceForOrder(
    businessId: string,
    orderId: string,
  ): Promise<BusinessInvoice | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.businessInvoices)
      .where(
        and(
          eq(schema.businessInvoices.businessId, businessId),
          eq(schema.businessInvoices.orderId, orderId),
          eq(schema.businessInvoices.status, 'issued'),
        ),
      )
      .limit(1);
    return row;
  }

  async findByClientRequestId(
    businessId: string,
    clientRequestId: string,
  ): Promise<Order | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.businessId, businessId),
          eq(schema.orders.clientRequestId, clientRequestId),
        ),
      )
      .limit(1);
    return row;
  }

  async findByTable(businessId: string, tableId: string): Promise<Order[]> {
    return this.db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.businessId, businessId),
          eq(schema.orders.tableId, tableId),
        ),
      )
      .orderBy(asc(schema.orders.createdAt));
  }

  async findMany(filters: ListOrdersFilters): Promise<Order[]> {
    return this.db
      .select()
      .from(schema.orders)
      .where(this.buildWhere(filters))
      .orderBy(desc(schema.orders.createdAt))
      .limit(filters.limit)
      .offset(filters.offset);
  }

  async countMany(filters: ListOrdersFilters): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.orders)
      .where(this.buildWhere(filters));
    return row?.value ?? 0;
  }

  async findCustomerById(
    businessId: string,
    id: string,
  ): Promise<Customer | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.customers)
      .where(
        and(
          eq(schema.customers.businessId, businessId),
          eq(schema.customers.id, id),
        ),
      )
      .limit(1);
    return row;
  }

  async insertCustomer(
    executor: DatabaseExecutor,
    values: NewCustomer,
  ): Promise<Customer> {
    const [row] = await executor
      .insert(schema.customers)
      .values(values)
      .returning();
    return row;
  }

  private buildWhere(filters: ListOrdersFilters): SQL | undefined {
    const conditions: SQL[] = [
      eq(schema.orders.businessId, filters.businessId),
    ];

    if (filters.status) {
      conditions.push(eq(schema.orders.status, filters.status));
    }

    return and(...conditions);
  }
}
