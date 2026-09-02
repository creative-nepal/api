import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { businesses } from './billing';

export const EMAIL_STATUSES = ['pending', 'sent', 'failed'] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const EMAIL_TEMPLATES = [
  'reset-password',
  'otp-verification',
  'organization-invitation',
  'notification-digest',
] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export const NOTIFICATION_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

export const JOB_STATUSES = ['running', 'succeeded', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: text('id').primaryKey(),
    recipient: text('recipient').notNull(),
    subject: text('subject').notNull(),
    template: text('template').notNull(),
    payload: jsonb('payload')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    status: text('status').default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(5).notNull(),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastError: text('last_error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('email_outbox_status_nextAttemptAt_idx').on(
      table.status,
      table.nextAttemptAt,
    ),
    index('email_outbox_createdAt_idx').on(table.createdAt),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id').references(() => businesses.id, {
      onDelete: 'cascade',
    }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    severity: text('severity').default('info').notNull(),
    titleKey: text('title_key').notNull(),
    bodyKey: text('body_key'),
    params: jsonb('params')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    href: text('href'),
    dedupeKey: text('dedupe_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('notifications_scope_dedupe_uidx').on(
      table.businessId,
      table.dedupeKey,
    ),
    index('notifications_businessId_createdAt_idx').on(
      table.businessId,
      table.createdAt,
    ),
    index('notifications_userId_createdAt_idx').on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const notificationReads = pgTable(
  'notification_reads',
  {
    notificationId: text('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: 'notification_reads_pk',
      columns: [table.notificationId, table.userId],
    }),
    index('notification_reads_userId_idx').on(table.userId),
  ],
);

export const jobSchedules = pgTable('job_schedules', {
  name: text('name').primaryKey(),
  cronExpression: text('cron_expression').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const jobRuns = pgTable(
  'job_runs',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    status: text('status').default('running').notNull(),
    trigger: text('trigger').default('schedule').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    detail: jsonb('detail')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    error: text('error'),
  },
  (table) => [
    index('job_runs_name_startedAt_idx').on(table.name, table.startedAt),
    index('job_runs_startedAt_idx').on(table.startedAt),
  ],
);

export const notificationsRelations = relations(notifications, ({ many }) => ({
  reads: many(notificationReads),
}));

export const notificationReadsRelations = relations(
  notificationReads,
  ({ one }) => ({
    notification: one(notifications, {
      fields: [notificationReads.notificationId],
      references: [notifications.id],
    }),
  }),
);

export type EmailOutboxRow = typeof emailOutbox.$inferSelect;
export type NewEmailOutboxRow = typeof emailOutbox.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type JobRun = typeof jobRuns.$inferSelect;
export type JobSchedule = typeof jobSchedules.$inferSelect;
