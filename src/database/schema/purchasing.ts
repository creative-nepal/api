import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { businesses, products } from './billing';

export const PURCHASE_ORDER_STATUSES = [
  'pending',
  'confirmed',
  'partially_received',
  'received',
  'canceled',
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const PURCHASE_BILL_STATUSES = [
  'unpaid',
  'partially_paid',
  'paid',
] as const;

export const DEBIT_NOTE_REASONS = [
  'return',
  'damaged',
  'short_supply',
  'rate_difference',
  'other',
] as const;
export type DebitNoteReason = (typeof DEBIT_NOTE_REASONS)[number];

export const BASIS_POINTS_DIVISOR = 10_000;
export type PurchaseBillStatus = (typeof PURCHASE_BILL_STATUSES)[number];

export const suppliers = pgTable(
  'suppliers',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    panNumber: text('pan_number'),
    address: text('address'),
    contact: text('contact'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('suppliers_businessId_isActive_idx').on(
      table.businessId,
      table.isActive,
    ),
  ],
);

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    reference: text('reference'),
    status: text('status').default('pending').notNull(),
    orderedAt: timestamp('ordered_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    expectedAt: date('expected_at'),
    receivedAt: timestamp('received_at', { withTimezone: true }),
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
    index('purchase_orders_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
    index('purchase_orders_businessId_supplierId_idx').on(
      table.businessId,
      table.supplierId,
    ),
  ],
);

export const purchaseOrderItems = pgTable(
  'purchase_order_items',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    purchaseOrderId: text('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    orderedQty: numeric('ordered_qty', { precision: 14, scale: 3 }).notNull(),
    receivedQty: numeric('received_qty', { precision: 14, scale: 3 })
      .default('0')
      .notNull(),
    purchasePriceCents: integer('purchase_price_cents').notNull(),
    lineTotalCents: integer('line_total_cents').notNull(),
    batchNo: text('batch_no'),
    expiryDate: date('expiry_date'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('purchase_order_items_businessId_poId_idx').on(
      table.businessId,
      table.purchaseOrderId,
    ),
    index('purchase_order_items_businessId_productId_idx').on(
      table.businessId,
      table.productId,
    ),
  ],
);

export const purchaseBills = pgTable(
  'purchase_bills',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    purchaseOrderId: text('purchase_order_id').references(
      () => purchaseOrders.id,
      { onDelete: 'set null' },
    ),
    billNumber: text('bill_number').notNull(),
    billDate: date('bill_date').notNull(),
    dueDate: date('due_date'),
    subtotalCents: integer('subtotal_cents').default(0).notNull(),
    vatCents: integer('vat_cents').default(0).notNull(),
    totalCents: integer('total_cents').default(0).notNull(),
    tdsRateBasisPoints: integer('tds_rate_basis_points').default(0).notNull(),
    tdsAmountCents: integer('tds_amount_cents').default(0).notNull(),
    paidCents: integer('paid_cents').default(0).notNull(),
    status: text('status').default('unpaid').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('purchase_bills_businessId_supplier_number_uidx').on(
      table.businessId,
      table.supplierId,
      table.billNumber,
    ),
    index('purchase_bills_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
    index('purchase_bills_businessId_billDate_idx').on(
      table.businessId,
      table.billDate,
    ),
  ],
);

export const purchaseBillItems = pgTable(
  'purchase_bill_items',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    purchaseBillId: text('purchase_bill_id')
      .notNull()
      .references(() => purchaseBills.id, { onDelete: 'cascade' }),
    productId: text('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 3 })
      .default('1')
      .notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    vatCents: integer('vat_cents').default(0).notNull(),
    lineTotalCents: integer('line_total_cents').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('purchase_bill_items_businessId_billId_idx').on(
      table.businessId,
      table.purchaseBillId,
    ),
  ],
);

export const debitNotes = pgTable(
  'debit_notes',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    purchaseBillId: text('purchase_bill_id')
      .notNull()
      .references(() => purchaseBills.id, { onDelete: 'restrict' }),
    noteNumber: integer('note_number').notNull(),
    series: text('series').notNull(),
    reason: text('reason').notNull(),
    note: text('note'),
    subtotalCents: integer('subtotal_cents').default(0).notNull(),
    vatCents: integer('vat_cents').default(0).notNull(),
    totalCents: integer('total_cents').default(0).notNull(),
    restocked: boolean('restocked').default(false).notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('debit_notes_businessId_series_number_uidx').on(
      table.businessId,
      table.series,
      table.noteNumber,
    ),
    index('debit_notes_businessId_billId_idx').on(
      table.businessId,
      table.purchaseBillId,
    ),
    index('debit_notes_businessId_supplierId_idx').on(
      table.businessId,
      table.supplierId,
    ),
    index('debit_notes_businessId_issuedAt_idx').on(
      table.businessId,
      table.issuedAt,
    ),
  ],
);

export const debitNoteItems = pgTable(
  'debit_note_items',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    debitNoteId: text('debit_note_id')
      .notNull()
      .references(() => debitNotes.id, { onDelete: 'cascade' }),
    purchaseBillItemId: text('purchase_bill_item_id').references(
      () => purchaseBillItems.id,
      { onDelete: 'set null' },
    ),
    productId: text('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 3 })
      .default('1')
      .notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    vatCents: integer('vat_cents').default(0).notNull(),
    lineTotalCents: integer('line_total_cents').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('debit_note_items_businessId_noteId_idx').on(
      table.businessId,
      table.debitNoteId,
    ),
  ],
);

export const debitNoteCounters = pgTable(
  'debit_note_counters',
  {
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    series: text('series').notNull(),
    lastNumber: integer('last_number').default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.businessId, table.series] })],
);

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
  bills: many(purchaseBills),
  debitNotes: many(debitNotes),
}));

export const purchaseOrdersRelations = relations(
  purchaseOrders,
  ({ one, many }) => ({
    supplier: one(suppliers, {
      fields: [purchaseOrders.supplierId],
      references: [suppliers.id],
    }),
    items: many(purchaseOrderItems),
  }),
);

export const purchaseOrderItemsRelations = relations(
  purchaseOrderItems,
  ({ one }) => ({
    purchaseOrder: one(purchaseOrders, {
      fields: [purchaseOrderItems.purchaseOrderId],
      references: [purchaseOrders.id],
    }),
    product: one(products, {
      fields: [purchaseOrderItems.productId],
      references: [products.id],
    }),
  }),
);

export const purchaseBillsRelations = relations(
  purchaseBills,
  ({ one, many }) => ({
    supplier: one(suppliers, {
      fields: [purchaseBills.supplierId],
      references: [suppliers.id],
    }),
    items: many(purchaseBillItems),
    debitNotes: many(debitNotes),
  }),
);

export const purchaseBillItemsRelations = relations(
  purchaseBillItems,
  ({ one }) => ({
    bill: one(purchaseBills, {
      fields: [purchaseBillItems.purchaseBillId],
      references: [purchaseBills.id],
    }),
  }),
);

export const debitNotesRelations = relations(debitNotes, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [debitNotes.supplierId],
    references: [suppliers.id],
  }),
  bill: one(purchaseBills, {
    fields: [debitNotes.purchaseBillId],
    references: [purchaseBills.id],
  }),
  items: many(debitNoteItems),
}));

export const debitNoteItemsRelations = relations(debitNoteItems, ({ one }) => ({
  debitNote: one(debitNotes, {
    fields: [debitNoteItems.debitNoteId],
    references: [debitNotes.id],
  }),
  product: one(products, {
    fields: [debitNoteItems.productId],
    references: [products.id],
  }),
}));

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type NewPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;
export type PurchaseBill = typeof purchaseBills.$inferSelect;
export type NewPurchaseBill = typeof purchaseBills.$inferInsert;
export type PurchaseBillItem = typeof purchaseBillItems.$inferSelect;
export type NewPurchaseBillItem = typeof purchaseBillItems.$inferInsert;
export type DebitNote = typeof debitNotes.$inferSelect;
export type NewDebitNote = typeof debitNotes.$inferInsert;
export type DebitNoteItem = typeof debitNoteItems.$inferSelect;
export type NewDebitNoteItem = typeof debitNoteItems.$inferInsert;
