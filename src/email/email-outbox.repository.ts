import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, lte, sql } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../database';
import type { EmailOutboxRow, EmailTemplate } from '../database/schema';

export interface EnqueueEmail {
  recipient: string;
  subject: string;
  template: EmailTemplate;
  payload: Record<string, unknown>;
}

@Injectable()
export class EmailOutboxRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async enqueue(email: EnqueueEmail): Promise<EmailOutboxRow> {
    const [row] = await this.db
      .insert(schema.emailOutbox)
      .values({
        id: randomUUID(),
        recipient: email.recipient,
        subject: email.subject,
        template: email.template,
        payload: email.payload,
        status: 'pending',
      })
      .returning();

    return row;
  }

  async claimDue(limit: number): Promise<EmailOutboxRow[]> {
    return this.db
      .update(schema.emailOutbox)
      .set({ attempts: sql`${schema.emailOutbox.attempts} + 1` })
      .where(
        sql`${schema.emailOutbox.id} in (
          select id from ${schema.emailOutbox}
          where status = 'pending' and next_attempt_at <= now()
          order by next_attempt_at asc
          limit ${limit}
          for update skip locked
        )`,
      )
      .returning();
  }

  async markSent(id: string): Promise<void> {
    await this.db
      .update(schema.emailOutbox)
      .set({ status: 'sent', sentAt: new Date(), lastError: null })
      .where(eq(schema.emailOutbox.id, id));
  }

  async markRetry(
    id: string,
    error: string,
    nextAttemptAt: Date,
  ): Promise<void> {
    await this.db
      .update(schema.emailOutbox)
      .set({ status: 'pending', lastError: error, nextAttemptAt })
      .where(eq(schema.emailOutbox.id, id));
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.db
      .update(schema.emailOutbox)
      .set({ status: 'failed', lastError: error })
      .where(eq(schema.emailOutbox.id, id));
  }

  async requeue(id: string): Promise<EmailOutboxRow | undefined> {
    const [row] = await this.db
      .update(schema.emailOutbox)
      .set({
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
      })
      .where(eq(schema.emailOutbox.id, id))
      .returning();

    return row;
  }

  async list(
    limit: number,
    offset: number,
    status?: string,
  ): Promise<{ rows: EmailOutboxRow[]; total: number }> {
    const where = status ? eq(schema.emailOutbox.status, status) : undefined;

    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.emailOutbox)
        .where(where)
        .orderBy(desc(schema.emailOutbox.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(schema.emailOutbox).where(where),
    ]);

    return { rows, total: total?.value ?? 0 };
  }

  async pendingDueCount(): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.emailOutbox)
      .where(
        and(
          eq(schema.emailOutbox.status, 'pending'),
          lte(schema.emailOutbox.nextAttemptAt, new Date()),
        ),
      );

    return row?.value ?? 0;
  }

  async oldestPending(): Promise<EmailOutboxRow | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.status, 'pending'))
      .orderBy(asc(schema.emailOutbox.createdAt))
      .limit(1);

    return row;
  }
}
