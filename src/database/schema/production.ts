import { relations } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { branches, businesses, products } from './billing';
import { menuItems } from './restaurant';

export const PRODUCTION_STATUSES = [
  'planned',
  'in_progress',
  'done',
  'cancelled',
] as const;
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export const productionRuns = pgTable(
  'production_runs',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    productId: text('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    menuItemId: text('menu_item_id').references(() => menuItems.id, {
      onDelete: 'set null',
    }),
    itemName: text('item_name').notNull(),
    plannedFor: date('planned_for').notNull(),
    plannedQty: numeric('planned_qty', { precision: 14, scale: 3 }).notNull(),
    producedQty: numeric('produced_qty', { precision: 14, scale: 3 })
      .default('0')
      .notNull(),
    wastedQty: numeric('wasted_qty', { precision: 14, scale: 3 })
      .default('0')
      .notNull(),
    unitCostCents: integer('unit_cost_cents').default(0).notNull(),
    status: text('status').default('planned').notNull(),
    note: text('note'),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('production_runs_businessId_plannedFor_idx').on(
      table.businessId,
      table.plannedFor,
    ),
    index('production_runs_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
  ],
);

export const productionRunsRelations = relations(productionRuns, ({ one }) => ({
  product: one(products, {
    fields: [productionRuns.productId],
    references: [products.id],
  }),
  menuItem: one(menuItems, {
    fields: [productionRuns.menuItemId],
    references: [menuItems.id],
  }),
}));

export type ProductionRun = typeof productionRuns.$inferSelect;
export type NewProductionRun = typeof productionRuns.$inferInsert;
