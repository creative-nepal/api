import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, count, eq, gt, isNull, sql } from 'drizzle-orm';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../database';
import type {
  Business,
  RestaurantTable,
  TableSession,
} from '../../database/schema';

const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

const MAX_ACTIVE_SESSIONS_PER_TABLE = 3;

const MAX_OPEN_ORDERS_PER_SITTING = 20;

export interface IssuedTableSession {
  token: string;
  expiresAt: Date;
  tableId: string;
  businessId: string;
}

export interface ResolvedTableSession {
  session: TableSession;
  table: RestaurantTable;
  business: Business;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class TableSessionsService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async issue(
    businessId: string,
    tableId: string,
  ): Promise<IssuedTableSession> {
    const [table] = await this.db
      .select()
      .from(schema.restaurantTables)
      .where(
        and(
          eq(schema.restaurantTables.businessId, businessId),
          eq(schema.restaurantTables.id, tableId),
        ),
      )
      .limit(1);

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    const [business] = await this.db
      .select()
      .from(schema.businesses)
      .where(eq(schema.businesses.id, businessId))
      .limit(1);

    if (!business || business.status !== 'active') {
      throw new NotFoundException('Table not found');
    }

    if (business.sector !== 'restaurant') {
      throw new NotFoundException('Table not found');
    }

    const [active] = await this.db
      .select({ value: count() })
      .from(schema.tableSessions)
      .where(
        and(
          eq(schema.tableSessions.businessId, businessId),
          eq(schema.tableSessions.tableId, tableId),
          isNull(schema.tableSessions.revokedAt),
          gt(schema.tableSessions.expiresAt, new Date()),
        ),
      );

    if ((active?.value ?? 0) >= MAX_ACTIVE_SESSIONS_PER_TABLE) {
      throw new BadRequestException(
        'Too many active sessions for this table; ask a waiter for help',
      );
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.db.insert(schema.tableSessions).values({
      id: randomUUID(),
      businessId,
      tableId,
      tokenHash: hashToken(token),
      expiresAt,
    });

    await this.db
      .update(schema.restaurantTables)
      .set({ status: 'occupied' })
      .where(
        and(
          eq(schema.restaurantTables.id, tableId),
          eq(schema.restaurantTables.status, 'empty'),
        ),
      );

    return { token, expiresAt, tableId, businessId };
  }

  async resolve(token: string): Promise<ResolvedTableSession> {
    const tokenHash = hashToken(token);

    const [row] = await this.db
      .select({
        session: schema.tableSessions,
        table: schema.restaurantTables,
        business: schema.businesses,
      })
      .from(schema.tableSessions)
      .innerJoin(
        schema.restaurantTables,
        eq(schema.restaurantTables.id, schema.tableSessions.tableId),
      )
      .innerJoin(
        schema.businesses,
        eq(schema.businesses.id, schema.tableSessions.businessId),
      )
      .where(eq(schema.tableSessions.tokenHash, tokenHash))
      .limit(1);

    if (!row) {
      throw new UnauthorizedException('Invalid table session');
    }

    const expected = Buffer.from(row.session.tokenHash, 'utf8');
    const actual = Buffer.from(tokenHash, 'utf8');

    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new UnauthorizedException('Invalid table session');
    }

    if (row.session.revokedAt) {
      throw new UnauthorizedException('This table session has ended');
    }

    if (row.session.expiresAt <= new Date()) {
      throw new UnauthorizedException('This table session has expired');
    }

    if (row.business.status !== 'active') {
      throw new UnauthorizedException('Invalid table session');
    }

    return row;
  }

  async revokeForTable(
    executor: DatabaseExecutor,
    businessId: string,
    tableId: string,
  ): Promise<void> {
    await executor
      .update(schema.tableSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.tableSessions.businessId, businessId),
          eq(schema.tableSessions.tableId, tableId),
          isNull(schema.tableSessions.revokedAt),
        ),
      );
  }

  async assertOrderQuotaAvailable(
    businessId: string,
    tableId: string,
  ): Promise<void> {
    const [open] = await this.db
      .select({ value: count() })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.businessId, businessId),
          eq(schema.orders.tableId, tableId),
          sql`${schema.orders.status} <> 'billed'`,
        ),
      );

    if ((open?.value ?? 0) >= MAX_OPEN_ORDERS_PER_SITTING) {
      throw new BadRequestException(
        'This table has too many open orders; ask a waiter for help',
      );
    }
  }
}
