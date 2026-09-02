import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase, schema } from '../../database';
import type { NotificationSeverity } from '../../database/schema';

export interface RaiseNotification {
  businessId: string | null;
  userId?: string | null;
  type: string;
  severity?: NotificationSeverity;
  titleKey: string;
  bodyKey?: string;
  params?: Record<string, unknown>;
  href?: string;
  dedupeKey: string;
}

export interface NotificationView {
  id: string;
  type: string;
  severity: string;
  titleKey: string;
  bodyKey: string | null;
  params: Record<string, unknown>;
  href: string | null;
  createdAt: Date;
  read: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async raise(input: RaiseNotification): Promise<void> {
    await this.db
      .insert(schema.notifications)
      .values({
        id: randomUUID(),
        businessId: input.businessId,
        userId: input.userId ?? null,
        type: input.type,
        severity: input.severity ?? 'info',
        titleKey: input.titleKey,
        bodyKey: input.bodyKey ?? null,
        params: input.params ?? {},
        href: input.href ?? null,
        dedupeKey: input.dedupeKey,
      })
      .onConflictDoNothing();
  }

  async raiseMany(inputs: RaiseNotification[]): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }

    const rows = await this.db
      .insert(schema.notifications)
      .values(
        inputs.map((input) => ({
          id: randomUUID(),
          businessId: input.businessId,
          userId: input.userId ?? null,
          type: input.type,
          severity: input.severity ?? 'info',
          titleKey: input.titleKey,
          bodyKey: input.bodyKey ?? null,
          params: input.params ?? {},
          href: input.href ?? null,
          dedupeKey: input.dedupeKey,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: schema.notifications.id });

    return rows.length;
  }

  private visibleTo(businessId: string | null, userId: string) {
    return and(
      businessId === null
        ? isNull(schema.notifications.businessId)
        : eq(schema.notifications.businessId, businessId),
      or(
        isNull(schema.notifications.userId),
        eq(schema.notifications.userId, userId),
      ),
    );
  }

  async list(
    businessId: string | null,
    userId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResult<NotificationView>> {
    const where = this.visibleTo(businessId, userId);

    const [rows, [total]] = await Promise.all([
      this.db
        .select({
          notification: schema.notifications,
          readAt: schema.notificationReads.readAt,
        })
        .from(schema.notifications)
        .leftJoin(
          schema.notificationReads,
          and(
            eq(
              schema.notificationReads.notificationId,
              schema.notifications.id,
            ),
            eq(schema.notificationReads.userId, userId),
          ),
        )
        .where(where)
        .orderBy(desc(schema.notifications.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(schema.notifications)
        .where(where),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.notification.id,
        type: row.notification.type,
        severity: row.notification.severity,
        titleKey: row.notification.titleKey,
        bodyKey: row.notification.bodyKey,
        params: row.notification.params,
        href: row.notification.href,
        createdAt: row.notification.createdAt,
        read: row.readAt !== null,
      })),
      total: total?.value ?? 0,
      limit,
      offset,
    };
  }

  async unreadCount(
    businessId: string | null,
    userId: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.notifications)
      .leftJoin(
        schema.notificationReads,
        and(
          eq(schema.notificationReads.notificationId, schema.notifications.id),
          eq(schema.notificationReads.userId, userId),
        ),
      )
      .where(
        and(
          this.visibleTo(businessId, userId),
          isNull(schema.notificationReads.notificationId),
        ),
      );

    return row?.value ?? 0;
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    await this.db
      .insert(schema.notificationReads)
      .values({ notificationId, userId })
      .onConflictDoNothing();
  }

  async markAllRead(
    businessId: string | null,
    userId: string,
  ): Promise<number> {
    const unread = await this.db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .leftJoin(
        schema.notificationReads,
        and(
          eq(schema.notificationReads.notificationId, schema.notifications.id),
          eq(schema.notificationReads.userId, userId),
        ),
      )
      .where(
        and(
          this.visibleTo(businessId, userId),
          isNull(schema.notificationReads.notificationId),
        ),
      );

    if (unread.length === 0) {
      return 0;
    }

    await this.db
      .insert(schema.notificationReads)
      .values(unread.map((row) => ({ notificationId: row.id, userId })))
      .onConflictDoNothing();

    return unread.length;
  }

  async prune(olderThan: Date): Promise<number> {
    const rows = await this.db
      .delete(schema.notifications)
      .where(lt(schema.notifications.createdAt, olderThan))
      .returning({ id: schema.notifications.id });

    return rows.length;
  }

  async unreadForDigest(businessId: string, userId: string) {
    return this.db
      .select({ notification: schema.notifications })
      .from(schema.notifications)
      .leftJoin(
        schema.notificationReads,
        and(
          eq(schema.notificationReads.notificationId, schema.notifications.id),
          eq(schema.notificationReads.userId, userId),
        ),
      )
      .where(
        and(
          this.visibleTo(businessId, userId),
          isNull(schema.notificationReads.notificationId),
          sql`${schema.notifications.severity} <> 'info'`,
        ),
      )
      .orderBy(desc(schema.notifications.createdAt))
      .limit(20);
  }
}
