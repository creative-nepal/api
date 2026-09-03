import { relations, sql } from 'drizzle-orm';
import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { branches, businesses, products } from './billing';
import { productBatches } from './medical';

export const STOCK_TAKE_STATUSES = ['open', 'completed', 'cancelled'] as const;
export type StockTakeStatus = (typeof STOCK_TAKE_STATUSES)[number];

export const stockTakes = pgTable(
  'stock_takes',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    reference: text('reference').notNull(),
    status: text('status').default('open').notNull(),
    note: text('note'),
    startedByUserId: text('started_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    closedByUserId: text('closed_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('stock_takes_businessId_reference_uidx').on(
      table.businessId,
      table.reference,
    ),
    uniqueIndex('stock_takes_businessId_branchId_open_uidx')
      .on(table.businessId, table.branchId)
      .where(sql`status = 'open'`),
    index('stock_takes_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
    index('stock_takes_businessId_createdAt_idx').on(
      table.businessId,
      table.createdAt,
    ),
  ],
);

export const stockTakeLines = pgTable(
  'stock_take_lines',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    stockTakeId: text('stock_take_id')
      .notNull()
      .references(() => stockTakes.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    batchId: text('batch_id').references(() => productBatches.id, {
      onDelete: 'restrict',
    }),
    productName: text('product_name').notNull(),
    batchNo: text('batch_no'),
    systemQty: numeric('system_qty', { precision: 14, scale: 3 }).notNull(),
    countedQty: numeric('counted_qty', { precision: 14, scale: 3 }),
    countedByUserId: text('counted_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    countedAt: timestamp('counted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('stock_take_lines_takeId_productId_batchId_uq')
      .on(table.stockTakeId, table.productId, table.batchId)
      .nullsNotDistinct(),
    index('stock_take_lines_businessId_stockTakeId_idx').on(
      table.businessId,
      table.stockTakeId,
    ),
  ],
);

export const stockTakesRelations = relations(stockTakes, ({ many }) => ({
  lines: many(stockTakeLines),
}));

export const stockTakeLinesRelations = relations(stockTakeLines, ({ one }) => ({
  stockTake: one(stockTakes, {
    fields: [stockTakeLines.stockTakeId],
    references: [stockTakes.id],
  }),
  product: one(products, {
    fields: [stockTakeLines.productId],
    references: [products.id],
  }),
  batch: one(productBatches, {
    fields: [stockTakeLines.batchId],
    references: [productBatches.id],
  }),
}));

export type StockTake = typeof stockTakes.$inferSelect;
export type NewStockTake = typeof stockTakes.$inferInsert;
export type StockTakeLine = typeof stockTakeLines.$inferSelect;
export type NewStockTakeLine = typeof stockTakeLines.$inferInsert;
