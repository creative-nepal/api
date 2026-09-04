import { relations } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { branches, businesses } from './billing';
import { cashSessions } from './cash';

export const EXPENSE_CATEGORIES = [
  'rent',
  'utilities',
  'salary',
  'gas',
  'repairs',
  'transport',
  'marketing',
  'supplies',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const expenses = pgTable(
  'expenses',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    category: text('category').notNull(),
    description: text('description').notNull(),
    amountCents: integer('amount_cents').notNull(),
    paidVia: text('paid_via').notNull(),
    reference: text('reference'),
    cashSessionId: text('cash_session_id').references(() => cashSessions.id, {
      onDelete: 'set null',
    }),
    incurredAt: timestamp('incurred_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('expenses_businessId_incurredAt_idx').on(
      table.businessId,
      table.incurredAt,
    ),
    index('expenses_businessId_category_idx').on(
      table.businessId,
      table.category,
    ),
  ],
);

export const expensesRelations = relations(expenses, ({ one }) => ({
  session: one(cashSessions, {
    fields: [expenses.cashSessionId],
    references: [cashSessions.id],
  }),
}));

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
