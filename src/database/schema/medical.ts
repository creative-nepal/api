import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import {
  branches,
  businesses,
  businessInvoices,
  orders,
  products,
} from './billing';

export const DRUG_SCHEDULES = ['otc', 'prescription', 'controlled'] as const;
export type DrugSchedule = (typeof DRUG_SCHEDULES)[number];

export const MEDICAL_UNIT_TYPES = [
  'strip',
  'bottle',
  'vial',
  'box',
  'pcs',
] as const;
export type MedicalUnitType = (typeof MEDICAL_UNIT_TYPES)[number];

export const STOCK_ADJUSTMENT_REASONS = [
  'stock_in',
  'recount',
  'damaged',
  'expired_write_off',
  'customer_return',
  'debit_note',
  'recipe_depletion',
  'recalled',
] as const;
export type StockAdjustmentReason = (typeof STOCK_ADJUSTMENT_REASONS)[number];

export const INSURANCE_CLAIM_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
] as const;
export type InsuranceClaimStatus = (typeof INSURANCE_CLAIM_STATUSES)[number];

export const BUYER_ID_TYPES = [
  'citizenship',
  'passport',
  'driving_license',
  'national_id',
] as const;
export type BuyerIdType = (typeof BUYER_ID_TYPES)[number];

export const productBatches = pgTable(
  'product_batches',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    batchNo: text('batch_no').notNull(),
    expiryDate: date('expiry_date').notNull(),
    qty: numeric('qty', { precision: 14, scale: 3 }).default('0').notNull(),
    costPriceCents: integer('cost_price_cents').default(0).notNull(),
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
    uniqueIndex('product_batches_businessId_productId_batchNo_uidx').on(
      table.businessId,
      table.productId,
      table.batchNo,
    ),
    index('product_batches_businessId_productId_expiry_idx').on(
      table.businessId,
      table.productId,
      table.expiryDate,
    ),
    index('product_batches_businessId_expiry_idx').on(
      table.businessId,
      table.expiryDate,
    ),
  ],
);

export const prescriptions = pgTable(
  'prescriptions',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    orderId: text('order_id').references(() => orders.id, {
      onDelete: 'cascade',
    }),
    doctorName: text('doctor_name').notNull(),
    patientName: text('patient_name').notNull(),
    attachmentUrl: text('attachment_url'),
    attachmentFileId: text('attachment_file_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('prescriptions_businessId_orderId_idx').on(
      table.businessId,
      table.orderId,
    ),
  ],
);

export const controlledSubstanceRegister = pgTable(
  'controlled_substance_register',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => businessInvoices.id, { onDelete: 'restrict' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    batchId: text('batch_id')
      .notNull()
      .references(() => productBatches.id, { onDelete: 'restrict' }),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    buyerName: text('buyer_name').notNull(),
    buyerIdType: text('buyer_id_type').notNull(),
    buyerIdNumber: text('buyer_id_number').notNull(),
    prescriptionId: text('prescription_id').references(() => prescriptions.id, {
      onDelete: 'set null',
    }),
    dispensedByUserId: text('dispensed_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('controlled_register_businessId_createdAt_idx').on(
      table.businessId,
      table.createdAt,
    ),
    index('controlled_register_businessId_productId_idx').on(
      table.businessId,
      table.productId,
    ),
  ],
);

export const insuranceClaims = pgTable(
  'insurance_claims',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    invoiceId: text('invoice_id').references(() => businessInvoices.id, {
      onDelete: 'set null',
    }),
    provider: text('provider').notNull(),
    policyNumber: text('policy_number').notNull(),
    claimedAmountCents: integer('claimed_amount_cents').default(0).notNull(),
    status: text('status').default('draft').notNull(),
    settledAmountCents: integer('settled_amount_cents'),
    reference: text('reference'),
    reason: text('reason'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('insurance_claims_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
  ],
);

export const claimAuditLog = pgTable(
  'claim_audit_log',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    claimId: text('claim_id')
      .notNull()
      .references(() => insuranceClaims.id, { onDelete: 'cascade' }),
    fromStatus: text('from_status').notNull(),
    toStatus: text('to_status').notNull(),
    note: text('note'),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('claim_audit_log_businessId_claimId_idx').on(
      table.businessId,
      table.claimId,
    ),
  ],
);

export const stockAdjustments = pgTable(
  'stock_adjustments',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    branchId: text('branch_id').references(() => branches.id, {
      onDelete: 'set null',
    }),
    batchId: text('batch_id').references(() => productBatches.id, {
      onDelete: 'set null',
    }),
    delta: numeric('delta', { precision: 14, scale: 3 }).notNull(),
    reason: text('reason').notNull(),
    note: text('note'),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('stock_adjustments_businessId_createdAt_idx').on(
      table.businessId,
      table.createdAt,
    ),
    index('stock_adjustments_businessId_reason_idx').on(
      table.businessId,
      table.reason,
    ),
    index('stock_adjustments_businessId_productId_idx').on(
      table.businessId,
      table.productId,
    ),
  ],
);

export const productBatchesRelations = relations(
  productBatches,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productBatches.productId],
      references: [products.id],
    }),
    adjustments: many(stockAdjustments),
  }),
);

export const prescriptionsRelations = relations(prescriptions, ({ one }) => ({
  order: one(orders, {
    fields: [prescriptions.orderId],
    references: [orders.id],
  }),
}));

export const controlledSubstanceRegisterRelations = relations(
  controlledSubstanceRegister,
  ({ one }) => ({
    order: one(orders, {
      fields: [controlledSubstanceRegister.orderId],
      references: [orders.id],
    }),
    batch: one(productBatches, {
      fields: [controlledSubstanceRegister.batchId],
      references: [productBatches.id],
    }),
  }),
);

export const insuranceClaimsRelations = relations(
  insuranceClaims,
  ({ one }) => ({
    order: one(orders, {
      fields: [insuranceClaims.orderId],
      references: [orders.id],
    }),
  }),
);

export const stockAdjustmentsRelations = relations(
  stockAdjustments,
  ({ one }) => ({
    product: one(products, {
      fields: [stockAdjustments.productId],
      references: [products.id],
    }),
    batch: one(productBatches, {
      fields: [stockAdjustments.batchId],
      references: [productBatches.id],
    }),
  }),
);

export type ProductBatch = typeof productBatches.$inferSelect;
export type NewProductBatch = typeof productBatches.$inferInsert;
export type Prescription = typeof prescriptions.$inferSelect;
export type NewPrescription = typeof prescriptions.$inferInsert;
export type ControlledSubstanceEntry =
  typeof controlledSubstanceRegister.$inferSelect;
export type NewControlledSubstanceEntry =
  typeof controlledSubstanceRegister.$inferInsert;
export type InsuranceClaim = typeof insuranceClaims.$inferSelect;
export type NewInsuranceClaim = typeof insuranceClaims.$inferInsert;
export type StockAdjustment = typeof stockAdjustments.$inferSelect;
export type NewStockAdjustment = typeof stockAdjustments.$inferInsert;

export interface MedicalProductData {
  genericName?: string;
  manufacturer?: string;
  schedule?: DrugSchedule;
  [key: string]: unknown;
}
export type ClaimAuditEntry = typeof claimAuditLog.$inferSelect;
