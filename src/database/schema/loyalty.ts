import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { businesses, businessInvoices, customers, orders } from './billing';

export const LOYALTY_ENTRY_TYPES = [
  'earned',
  'redeemed',
  'adjusted',
  'referral_earned',
  'referral_welcome',
] as const;
export type LoyaltyEntryType = (typeof LOYALTY_ENTRY_TYPES)[number];

export const loyaltyLedger = pgTable(
  'loyalty_ledger',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    invoiceId: text('invoice_id').references(() => businessInvoices.id, {
      onDelete: 'set null',
    }),
    type: text('type').notNull(),
    points: integer('points').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    note: text('note'),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('loyalty_ledger_businessId_customerId_idx').on(
      table.businessId,
      table.customerId,
    ),
    uniqueIndex('loyalty_ledger_invoiceId_earned_uidx').on(
      table.invoiceId,
      table.type,
    ),
  ],
);

export const customerFeedback = pgTable(
  'customer_feedback',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    orderId: text('order_id').references(() => orders.id, {
      onDelete: 'cascade',
    }),
    invoiceId: text('invoice_id').references(() => businessInvoices.id, {
      onDelete: 'set null',
    }),
    customerId: text('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('customer_feedback_businessId_createdAt_idx').on(
      table.businessId,
      table.createdAt,
    ),
    uniqueIndex('customer_feedback_businessId_orderId_uidx').on(
      table.businessId,
      table.orderId,
    ),
  ],
);

export const loyaltyLedgerRelations = relations(loyaltyLedger, ({ one }) => ({
  customer: one(customers, {
    fields: [loyaltyLedger.customerId],
    references: [customers.id],
  }),
}));

export const customerFeedbackRelations = relations(
  customerFeedback,
  ({ one }) => ({
    order: one(orders, {
      fields: [customerFeedback.orderId],
      references: [orders.id],
    }),
  }),
);

export type LoyaltyEntry = typeof loyaltyLedger.$inferSelect;
export type NewLoyaltyEntry = typeof loyaltyLedger.$inferInsert;
export type CustomerFeedback = typeof customerFeedback.$inferSelect;
export type NewCustomerFeedback = typeof customerFeedback.$inferInsert;
