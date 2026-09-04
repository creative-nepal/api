import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { branches, businesses, products } from './billing';
import { productBatches } from './medical';
import { menuItems } from './restaurant';

export const WASTAGE_REASONS = [
  'spoilage',
  'spillage',
  'expired',
  'preparation_error',
  'customer_return',
  'staff_meal',
  'breakage',
] as const;
export type WastageReason = (typeof WASTAGE_REASONS)[number];

export const wastageRecords = pgTable(
  'wastage_records',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    productId: text('product_id').references(() => products.id, {
      onDelete: 'restrict',
    }),
    menuItemId: text('menu_item_id').references(() => menuItems.id, {
      onDelete: 'restrict',
    }),
    batchId: text('batch_id').references(() => productBatches.id, {
      onDelete: 'set null',
    }),
    itemName: text('item_name').notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    reason: text('reason').notNull(),
    costCents: integer('cost_cents').default(0).notNull(),
    note: text('note'),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('wastage_records_businessId_createdAt_idx').on(
      table.businessId,
      table.createdAt,
    ),
    index('wastage_records_businessId_reason_idx').on(
      table.businessId,
      table.reason,
    ),
    index('wastage_records_businessId_productId_idx').on(
      table.businessId,
      table.productId,
    ),
  ],
);

export const wastageRecordsRelations = relations(wastageRecords, ({ one }) => ({
  product: one(products, {
    fields: [wastageRecords.productId],
    references: [products.id],
  }),
  menuItem: one(menuItems, {
    fields: [wastageRecords.menuItemId],
    references: [menuItems.id],
  }),
}));

export type WastageRecord = typeof wastageRecords.$inferSelect;
export type NewWastageRecord = typeof wastageRecords.$inferInsert;
