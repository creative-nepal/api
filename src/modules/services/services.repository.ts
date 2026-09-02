import { Injectable } from '@nestjs/common';
import { and, count, eq, ilike, type SQL } from 'drizzle-orm';
import type { SortDirection } from '../../common/dto/list-query.dto';
import {
  resolveOrderBy,
  type SortableColumns,
} from '../../common/repository/sorting';
import { type Database, InjectDatabase, schema } from '../../database';
import type {
  NewServiceItem,
  NewServiceMembership,
  ServiceItem,
  ServiceMembership,
} from '../../database/schema';

const SORTABLE_ITEMS: SortableColumns = {
  name: schema.serviceItems.name,
  priceCents: schema.serviceItems.priceCents,
  durationMinutes: schema.serviceItems.durationMinutes,
  createdAt: schema.serviceItems.createdAt,
};

const SORTABLE_MEMBERSHIPS: SortableColumns = {
  startsAt: schema.serviceMemberships.startsAt,
  expiresAt: schema.serviceMemberships.expiresAt,
  createdAt: schema.serviceMemberships.createdAt,
};

export interface FindServiceItemsOptions {
  businessId: string;
  limit: number;
  offset: number;
  sortBy?: string;
  sortDirection: SortDirection;
  search?: string;
  category?: string;
  isActive?: boolean;
}

export interface FindMembershipsOptions {
  businessId: string;
  limit: number;
  offset: number;
  sortBy?: string;
  sortDirection: SortDirection;
  customerId?: string;
  status?: string;
}

@Injectable()
export class ServicesRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findItems(
    options: FindServiceItemsOptions,
  ): Promise<{ rows: ServiceItem[]; total: number }> {
    const where = this.itemsWhere(options);

    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.serviceItems)
        .where(where)
        .orderBy(
          resolveOrderBy(
            SORTABLE_ITEMS,
            options.sortBy,
            options.sortDirection,
            schema.serviceItems.name,
          ),
        )
        .limit(options.limit)
        .offset(options.offset),
      this.db.select({ value: count() }).from(schema.serviceItems).where(where),
    ]);

    return { rows, total: total?.value ?? 0 };
  }

  async findItemById(
    businessId: string,
    serviceItemId: string,
  ): Promise<ServiceItem | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.serviceItems)
      .where(
        and(
          eq(schema.serviceItems.businessId, businessId),
          eq(schema.serviceItems.id, serviceItemId),
        ),
      )
      .limit(1);

    return row;
  }

  async insertItem(values: NewServiceItem): Promise<ServiceItem> {
    const [row] = await this.db
      .insert(schema.serviceItems)
      .values(values)
      .returning();
    return row;
  }

  async updateItem(
    businessId: string,
    serviceItemId: string,
    patch: Partial<NewServiceItem>,
  ): Promise<ServiceItem | undefined> {
    const [row] = await this.db
      .update(schema.serviceItems)
      .set(patch)
      .where(
        and(
          eq(schema.serviceItems.businessId, businessId),
          eq(schema.serviceItems.id, serviceItemId),
        ),
      )
      .returning();

    return row;
  }

  async countItems(businessId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.serviceItems)
      .where(eq(schema.serviceItems.businessId, businessId));

    return row?.value ?? 0;
  }

  async findMemberships(
    options: FindMembershipsOptions,
  ): Promise<{ rows: ServiceMembership[]; total: number }> {
    const where = and(
      eq(schema.serviceMemberships.businessId, options.businessId),
      ...(options.customerId
        ? [eq(schema.serviceMemberships.customerId, options.customerId)]
        : []),
      ...(options.status
        ? [eq(schema.serviceMemberships.status, options.status)]
        : []),
    );

    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.serviceMemberships)
        .where(where)
        .orderBy(
          resolveOrderBy(
            SORTABLE_MEMBERSHIPS,
            options.sortBy,
            options.sortDirection,
            schema.serviceMemberships.createdAt,
          ),
        )
        .limit(options.limit)
        .offset(options.offset),
      this.db
        .select({ value: count() })
        .from(schema.serviceMemberships)
        .where(where),
    ]);

    return { rows, total: total?.value ?? 0 };
  }

  async findMembershipById(
    businessId: string,
    membershipId: string,
  ): Promise<ServiceMembership | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.serviceMemberships)
      .where(
        and(
          eq(schema.serviceMemberships.businessId, businessId),
          eq(schema.serviceMemberships.id, membershipId),
        ),
      )
      .limit(1);

    return row;
  }

  async insertMembership(
    values: NewServiceMembership,
  ): Promise<ServiceMembership> {
    const [row] = await this.db
      .insert(schema.serviceMemberships)
      .values(values)
      .returning();
    return row;
  }

  private itemsWhere(options: FindServiceItemsOptions): SQL | undefined {
    const term = options.search?.trim();

    return and(
      eq(schema.serviceItems.businessId, options.businessId),
      ...(options.category
        ? [eq(schema.serviceItems.category, options.category)]
        : []),
      ...(options.isActive === undefined
        ? []
        : [eq(schema.serviceItems.isActive, options.isActive)]),
      ...(term ? [ilike(schema.serviceItems.name, `%${term}%`)] : []),
    );
  }
}
