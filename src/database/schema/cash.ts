import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { branches, businesses, businessInvoices } from './billing';

export const BUSINESS_PAYMENT_METHODS = [
  'cash',
  'esewa',
  'khalti',
  'fonepay',
  'connectips',
  'card',
  'bank_transfer',
  'credit',
] as const;
export type BusinessPaymentMethod = (typeof BUSINESS_PAYMENT_METHODS)[number];

export const CASH_SESSION_STATUSES = ['open', 'closed'] as const;
export type CashSessionStatus = (typeof CASH_SESSION_STATUSES)[number];

export const CASH_MOVEMENT_DIRECTIONS = ['in', 'out'] as const;
export type CashMovementDirection = (typeof CASH_MOVEMENT_DIRECTIONS)[number];

export const cashSessions = pgTable(
  'cash_sessions',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    status: text('status').default('open').notNull(),
    openingFloatCents: integer('opening_float_cents').default(0).notNull(),
    openedByUserId: text('opened_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    openedAt: timestamp('opened_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    countedCashCents: integer('counted_cash_cents'),
    expectedCashCents: integer('expected_cash_cents'),
    varianceCents: integer('variance_cents'),
    closedByUserId: text('closed_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    note: text('note'),
  },
  (table) => [
    uniqueIndex('cash_sessions_businessId_branchId_open_uidx')
      .on(table.businessId, table.branchId)
      .where(sql`status = 'open'`),
    index('cash_sessions_businessId_openedAt_idx').on(
      table.businessId,
      table.openedAt,
    ),
  ],
);

export const invoicePayments = pgTable(
  'invoice_payments',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => businessInvoices.id, { onDelete: 'restrict' }),
    cashSessionId: text('cash_session_id').references(() => cashSessions.id, {
      onDelete: 'set null',
    }),
    method: text('method').notNull(),
    amountCents: integer('amount_cents').notNull(),
    reference: text('reference'),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('invoice_payments_businessId_invoiceId_idx').on(
      table.businessId,
      table.invoiceId,
    ),
    index('invoice_payments_sessionId_method_idx').on(
      table.cashSessionId,
      table.method,
    ),
    index('invoice_payments_businessId_createdAt_idx').on(
      table.businessId,
      table.createdAt,
    ),
  ],
);

export const cashMovements = pgTable(
  'cash_movements',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    cashSessionId: text('cash_session_id')
      .notNull()
      .references(() => cashSessions.id, { onDelete: 'cascade' }),
    direction: text('direction').notNull(),
    amountCents: integer('amount_cents').notNull(),
    reason: text('reason').notNull(),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('cash_movements_businessId_sessionId_idx').on(
      table.businessId,
      table.cashSessionId,
    ),
  ],
);

export const cashSessionsRelations = relations(cashSessions, ({ many }) => ({
  payments: many(invoicePayments),
  movements: many(cashMovements),
}));

export const invoicePaymentsRelations = relations(
  invoicePayments,
  ({ one }) => ({
    invoice: one(businessInvoices, {
      fields: [invoicePayments.invoiceId],
      references: [businessInvoices.id],
    }),
    session: one(cashSessions, {
      fields: [invoicePayments.cashSessionId],
      references: [cashSessions.id],
    }),
  }),
);

export const cashMovementsRelations = relations(cashMovements, ({ one }) => ({
  session: one(cashSessions, {
    fields: [cashMovements.cashSessionId],
    references: [cashSessions.id],
  }),
}));

export type CashSession = typeof cashSessions.$inferSelect;
export type NewCashSession = typeof cashSessions.$inferInsert;
export type InvoicePayment = typeof invoicePayments.$inferSelect;
export type NewInvoicePayment = typeof invoicePayments.$inferInsert;
export type CashMovement = typeof cashMovements.$inferSelect;
export type NewCashMovement = typeof cashMovements.$inferInsert;
