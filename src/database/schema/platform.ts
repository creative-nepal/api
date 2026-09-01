import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { businesses, plans, subscriptions } from './billing';

export const PAYMENT_PROVIDERS = ['esewa', 'khalti', 'bank'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_METHOD_STATUSES = [
  'active',
  'expired',
  'removed',
] as const;
export type PaymentMethodStatus = (typeof PAYMENT_METHOD_STATUSES)[number];

export const PLATFORM_INVOICE_STATUSES = [
  'draft',
  'open',
  'paid',
  'uncollectible',
] as const;
export type PlatformInvoiceStatus = (typeof PLATFORM_INVOICE_STATUSES)[number];

export const PAYMENT_ATTEMPT_STATUSES = [
  'succeeded',
  'failed',
  'pending',
] as const;
export type PaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUSES)[number];

export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    gatewayToken: text('gateway_token').notNull(),
    displayLabel: text('display_label').notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    status: text('status').default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('payment_methods_userId_status_idx').on(table.userId, table.status),
    uniqueIndex('payment_methods_userId_default_uidx')
      .on(table.userId)
      .where(sql`is_default = true AND status = 'active'`),
  ],
);

export const platformInvoices = pgTable(
  'platform_invoices',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    invoiceNumber: integer('invoice_number'),
    series: text('series').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    subtotalCents: integer('subtotal_cents').default(0).notNull(),
    vatCents: integer('vat_cents').default(0).notNull(),
    totalCents: integer('total_cents').default(0).notNull(),
    status: text('status').default('draft').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('platform_invoices_series_number_uidx').on(
      table.series,
      table.invoiceNumber,
    ),
    index('platform_invoices_userId_status_idx').on(table.userId, table.status),
  ],
);

export const platformInvoiceLines = pgTable(
  'platform_invoice_lines',
  {
    id: text('id').primaryKey(),
    platformInvoiceId: text('platform_invoice_id')
      .notNull()
      .references(() => platformInvoices.id, { onDelete: 'cascade' }),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'restrict' }),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'restrict' }),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'restrict' }),
    description: text('description').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('platform_invoice_lines_invoiceId_idx').on(table.platformInvoiceId),
    index('platform_invoice_lines_businessId_idx').on(table.businessId),
  ],
);

export const platformInvoiceCounters = pgTable('platform_invoice_counters', {
  series: text('series').primaryKey(),
  lastNumber: integer('last_number').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const paymentAttempts = pgTable(
  'payment_attempts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    paymentMethodId: text('payment_method_id').references(
      () => paymentMethods.id,
      { onDelete: 'set null' },
    ),
    amountCents: integer('amount_cents').notNull(),
    provider: text('provider'),
    status: text('status').notNull(),
    gatewayReference: text('gateway_reference'),
    failureReason: text('failure_reason'),
    attemptNumber: integer('attempt_number').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('payment_attempts_userId_createdAt_idx').on(
      table.userId,
      table.createdAt,
    ),
    index('payment_attempts_subscriptionId_createdAt_idx').on(
      table.subscriptionId,
      table.createdAt,
    ),
  ],
);

export const platformAuditLog = pgTable(
  'platform_audit_log',
  {
    id: text('id').primaryKey(),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    action: text('action').notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('platform_audit_log_target_idx').on(table.targetType, table.targetId),
    index('platform_audit_log_createdAt_idx').on(table.createdAt),
  ],
);

export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  account: one(user, {
    fields: [paymentMethods.userId],
    references: [user.id],
  }),
}));

export const platformInvoicesRelations = relations(
  platformInvoices,
  ({ one, many }) => ({
    account: one(user, {
      fields: [platformInvoices.userId],
      references: [user.id],
    }),
    lines: many(platformInvoiceLines),
  }),
);

export const platformInvoiceLinesRelations = relations(
  platformInvoiceLines,
  ({ one }) => ({
    invoice: one(platformInvoices, {
      fields: [platformInvoiceLines.platformInvoiceId],
      references: [platformInvoices.id],
    }),
    business: one(businesses, {
      fields: [platformInvoiceLines.businessId],
      references: [businesses.id],
    }),
  }),
);

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;
export type PlatformInvoice = typeof platformInvoices.$inferSelect;
export type NewPlatformInvoice = typeof platformInvoices.$inferInsert;
export type PlatformInvoiceLine = typeof platformInvoiceLines.$inferSelect;
export type NewPlatformInvoiceLine = typeof platformInvoiceLines.$inferInsert;
export type PaymentAttempt = typeof paymentAttempts.$inferSelect;
export type NewPaymentAttempt = typeof paymentAttempts.$inferInsert;
export type PlatformAuditEntry = typeof platformAuditLog.$inferSelect;
