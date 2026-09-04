import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { branches, businesses } from './billing';

export const CALENDAR_EVENT_KINDS = [
  'event',
  'reminder',
  'task',
  'deadline',
  'holiday',
] as const;
export type CalendarEventKind = (typeof CALENDAR_EVENT_KINDS)[number];

export const CALENDAR_SCOPES = ['organisation', 'branch', 'personal'] as const;
export type CalendarScope = (typeof CALENDAR_SCOPES)[number];

export const CALENDAR_EVENT_STATUSES = ['open', 'done', 'cancelled'] as const;
export type CalendarEventStatus = (typeof CALENDAR_EVENT_STATUSES)[number];

export const RECURRENCE_FREQUENCIES = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export interface Recurrence {
  freq: RecurrenceFrequency;
  interval: number;
  byWeekday?: number[];
  until?: string;
  count?: number;
}

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    scope: text('scope').default('organisation').notNull(),
    branchId: text('branch_id').references(() => branches.id, {
      onDelete: 'cascade',
    }),
    kind: text('kind').default('event').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    allDay: boolean('all_day').default(false).notNull(),
    recurrence: jsonb('recurrence').$type<Recurrence | null>(),
    remindMinutesBefore: integer('remind_minutes_before'),
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    assignedToUserId: text('assigned_to_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    linkedType: text('linked_type'),
    linkedId: text('linked_id'),
    status: text('status').default('open').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('calendar_events_businessId_scope_idx').on(
      table.businessId,
      table.scope,
    ),
    index('calendar_events_businessId_startsAt_idx').on(
      table.businessId,
      table.startsAt,
    ),
    index('calendar_events_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
    index('calendar_events_assignedTo_idx').on(table.assignedToUserId),
  ],
);

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  branch: one(branches, {
    fields: [calendarEvents.branchId],
    references: [branches.id],
  }),
}));

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type NewCalendarEvent = typeof calendarEvents.$inferInsert;
