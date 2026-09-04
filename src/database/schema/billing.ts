import { relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organization, team, user } from './auth';

export { SECTOR_KEYS as SECTORS } from './sector-keys';
export type { SectorKey as Sector } from './sector-keys';

export const BUSINESS_STATUSES = ['active', 'suspended', 'closed'] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const BILLING_CYCLES = ['monthly', 'yearly'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'canceled',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const UNIT_TYPES = ['pcs', 'kg', 'gm', 'ml', 'l'] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const ORDER_STATUSES = [
  'placed',
  'confirmed',
  'in_kitchen',
  'preparing',
  'ready',
  'served',
  'billed',
  'voided',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const INVOICE_STATUSES = ['issued', 'credit_note', 'voided'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const CBMS_STATUSES = ['pending', 'pushed', 'failed'] as const;
export type CbmsStatus = (typeof CBMS_STATUSES)[number];

export const CBMS_QUEUE_STATUSES = ['pending', 'succeeded', 'failed'] as const;
export type CbmsQueueStatus = (typeof CBMS_QUEUE_STATUSES)[number];

export const INVOICE_AUDIT_ACTIONS = [
  'issued',
  'printed',
  'credit_note_issued',
  'cbms_pushed',
  'cbms_failed',
] as const;
export type InvoiceAuditAction = (typeof INVOICE_AUDIT_ACTIONS)[number];

export interface PlanFeatureFlags {
  maxStaff?: number;
  maxProducts?: number;
  maxInvoicesPerPeriod?: number;
  [key: string]: unknown;
}

export const businesses = pgTable(
  'businesses',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    sector: text('sector').notNull(),
    legalName: text('legal_name').notNull(),
    panNumber: text('pan_number'),
    vatRegistered: boolean('vat_registered').default(false).notNull(),
    cbmsRequired: boolean('cbms_required').default(false).notNull(),
    serviceChargePercent: integer('service_charge_percent')
      .default(0)
      .notNull(),
    maxDiscountPercent: integer('max_discount_percent').default(0).notNull(),
    loyaltyPointsPerHundred: integer('loyalty_points_per_hundred')
      .default(0)
      .notNull(),
    loyaltyPointValueCents: integer('loyalty_point_value_cents')
      .default(0)
      .notNull(),
    referralRewardPoints: integer('referral_reward_points')
      .default(0)
      .notNull(),
    referralWelcomePoints: integer('referral_welcome_points')
      .default(0)
      .notNull(),
    displayName: text('display_name'),
    theme: jsonb('theme').$type<BusinessTheme>().default({}).notNull(),
    fiscalYearStartMonth: integer('fiscal_year_start_month')
      .default(4)
      .notNull(),
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
    uniqueIndex('businesses_organizationId_uidx').on(table.organizationId),
    index('businesses_sector_status_idx').on(table.sector, table.status),
    index('businesses_createdAt_idx').on(table.createdAt),
  ],
);

export interface BusinessTheme {
  primary?: string;
  primaryForeground?: string;
  accent?: string;
  radius?: string;
  logoUrl?: string;
  defaultMode?: string;
  [key: string]: unknown;
}

export const branches = pgTable(
  'branches',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    teamId: text('team_id').references(() => team.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    code: text('code'),
    address: text('address'),
    isDefault: boolean('is_default').default(false).notNull(),
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
    uniqueIndex('branches_teamId_uidx').on(table.teamId),
    uniqueIndex('branches_businessId_code_uidx').on(
      table.businessId,
      table.code,
    ),
    uniqueIndex('branches_businessId_default_uidx')
      .on(table.businessId)
      .where(sql`is_default = true`),
    index('branches_businessId_isActive_idx').on(
      table.businessId,
      table.isActive,
    ),
  ],
);

export const plans = pgTable(
  'plans',
  {
    id: text('id').primaryKey(),
    sector: text('sector').notNull(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    priceCents: integer('price_cents').notNull(),
    currency: text('currency').default('NPR').notNull(),
    billingCycle: text('billing_cycle').default('monthly').notNull(),
    featureFlags: jsonb('feature_flags')
      .$type<PlanFeatureFlags>()
      .default({})
      .notNull(),
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
    uniqueIndex('plans_sector_key_uidx').on(table.sector, table.key),
    index('plans_sector_isActive_idx').on(table.sector, table.isActive),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'restrict' }),
    status: text('status').default('trialing').notNull(),
    currentPeriodStart: timestamp('current_period_start', {
      withTimezone: true,
    }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', {
      withTimezone: true,
    }).notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('subscriptions_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
    uniqueIndex('subscriptions_businessId_live_uidx')
      .on(table.businessId)
      .where(sql`status <> 'canceled'`),
  ],
);

export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sku: text('sku'),
    unitType: text('unit_type').default('pcs').notNull(),
    unitsPerPack: integer('units_per_pack').default(1).notNull(),
    subUnitLabel: text('sub_unit_label'),
    priceCents: integer('price_cents').notNull(),
    costPriceCents: integer('cost_price_cents').default(0).notNull(),
    stockQty: numeric('stock_qty', { precision: 14, scale: 3 })
      .default('0')
      .notNull(),
    lowStockThreshold: numeric('low_stock_threshold', {
      precision: 14,
      scale: 3,
    })
      .default('0')
      .notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    sectorData: jsonb('sector_data')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('products_businessId_sku_uidx').on(table.businessId, table.sku),
    index('products_businessId_isActive_idx').on(
      table.businessId,
      table.isActive,
    ),
  ],
);

export const productBranchStock = pgTable(
  'product_branch_stock',
  {
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    stockQty: numeric('stock_qty', { precision: 14, scale: 3 })
      .default('0')
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: 'product_branch_stock_pk',
      columns: [table.branchId, table.productId],
    }),
    index('product_branch_stock_businessId_productId_idx').on(
      table.businessId,
      table.productId,
    ),
  ],
);

export const customers = pgTable(
  'customers',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    panNumber: text('pan_number'),
    creditLimitCents: integer('credit_limit_cents').default(0).notNull(),
    balanceCents: integer('balance_cents').default(0).notNull(),
    loyaltyPoints: integer('loyalty_points').default(0).notNull(),
    referralCode: text('referral_code'),
    referredByCustomerId: text('referred_by_customer_id').references(
      (): AnyPgColumn => customers.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('customers_businessId_phone_idx').on(table.businessId, table.phone),
    uniqueIndex('customers_businessId_referralCode_uidx').on(
      table.businessId,
      table.referralCode,
    ),
  ],
);

export const LEDGER_ENTRY_TYPES = ['sale', 'payment', 'adjustment'] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export const customerLedgerEntries = pgTable(
  'customer_ledger_entries',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    amountCents: integer('amount_cents').notNull(),
    balanceAfterCents: integer('balance_after_cents').notNull(),
    invoiceId: text('invoice_id'),
    note: text('note'),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('customer_ledger_businessId_customerId_createdAt_idx').on(
      table.businessId,
      table.customerId,
      table.createdAt,
    ),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    customerId: text('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    status: text('status').default('placed').notNull(),
    tableId: text('table_id'),
    source: text('source').default('staff').notNull(),
    channelId: text('channel_id'),
    channelCommissionCents: integer('channel_commission_cents')
      .default(0)
      .notNull(),
    subtotalCents: integer('subtotal_cents').notNull(),
    discountCents: integer('discount_cents').default(0).notNull(),
    serviceChargeCents: integer('service_charge_cents').default(0).notNull(),
    taxCents: integer('tax_cents').default(0).notNull(),
    totalCents: integer('total_cents').notNull(),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    clientRequestId: text('client_request_id'),
    sectorData: jsonb('sector_data')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('orders_businessId_status_idx').on(table.businessId, table.status),
    index('orders_businessId_createdAt_idx').on(
      table.businessId,
      table.createdAt,
    ),
    uniqueIndex('orders_businessId_clientRequestId_uidx')
      .on(table.businessId, table.clientRequestId)
      .where(sql`client_request_id IS NOT NULL`),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    productId: text('product_id').references(() => products.id, {
      onDelete: 'restrict',
    }),
    menuItemId: text('menu_item_id'),
    serviceItemId: text('service_item_id'),
    note: text('note'),
    modifiers: jsonb('modifiers')
      .$type<Array<{ name: string; label: string; priceDeltaCents: number }>>()
      .default([])
      .notNull(),
    invoiceId: text('invoice_id'),
    productName: text('product_name').notNull(),
    batchId: text('batch_id'),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    discountCents: integer('discount_cents').default(0).notNull(),
    lineTotalCents: integer('line_total_cents').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('order_items_businessId_orderId_idx').on(
      table.businessId,
      table.orderId,
    ),
    index('order_items_businessId_productId_idx').on(
      table.businessId,
      table.productId,
    ),
  ],
);

export const invoiceCounters = pgTable(
  'invoice_counters',
  {
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    fiscalYear: text('fiscal_year').notNull(),
    lastNumber: integer('last_number').default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: 'invoice_counters_pk',
      columns: [table.businessId, table.branchId, table.fiscalYear],
    }),
  ],
);

export const invoiceLeases = pgTable(
  'invoice_leases',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    fiscalYear: text('fiscal_year').notNull(),
    deviceId: text('device_id').notNull(),
    firstNumber: integer('first_number').notNull(),
    lastNumber: integer('last_number').notNull(),
    usedThrough: integer('used_through'),
    status: text('status').default('open').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('invoice_leases_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
    index('invoice_leases_businessId_deviceId_idx').on(
      table.businessId,
      table.deviceId,
    ),
  ],
);

export type InvoiceLease = typeof invoiceLeases.$inferSelect;
export type NewInvoiceLease = typeof invoiceLeases.$inferInsert;

export const LEASE_STATUSES = ['open', 'reconciled', 'expired'] as const;
export type LeaseStatus = (typeof LEASE_STATUSES)[number];

export const businessInvoices = pgTable(
  'business_invoices',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    orderId: text('order_id').references(() => orders.id, {
      onDelete: 'restrict',
    }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    invoiceNumber: integer('invoice_number').notNull(),
    fiscalYear: text('fiscal_year').notNull(),
    customerId: text('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    customerName: text('customer_name'),
    customerPan: text('customer_pan'),
    subtotalCents: integer('subtotal_cents').notNull(),
    discountCents: integer('discount_cents').default(0).notNull(),
    serviceChargeCents: integer('service_charge_cents').default(0).notNull(),
    vatCents: integer('vat_cents').default(0).notNull(),
    totalCents: integer('total_cents').notNull(),
    status: text('status').default('issued').notNull(),
    printedCount: integer('printed_count').default(0).notNull(),
    cbmsStatus: text('cbms_status'),
    cbmsPushedAt: timestamp('cbms_pushed_at', { withTimezone: true }),
    leaseId: text('lease_id'),
    clientRequestId: text('client_request_id'),
    creditNoteForInvoiceId: text('credit_note_for_invoice_id').references(
      (): AnyPgColumn => businessInvoices.id,
      { onDelete: 'restrict' },
    ),
    issuedByUserId: text('issued_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('business_invoices_branch_fiscalYear_number_uidx').on(
      table.businessId,
      table.branchId,
      table.fiscalYear,
      table.invoiceNumber,
    ),
    index('business_invoices_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
    index('business_invoices_businessId_createdAt_idx').on(
      table.businessId,
      table.createdAt,
    ),
    index('business_invoices_businessId_creditNoteFor_idx').on(
      table.businessId,
      table.creditNoteForInvoiceId,
    ),
  ],
);

export const cbmsPushQueue = pgTable(
  'cbms_push_queue',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => businessInvoices.id, { onDelete: 'cascade' }),
    attempts: integer('attempts').default(0).notNull(),
    lastError: text('last_error'),
    status: text('status').default('pending').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('cbms_push_queue_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
  ],
);

export const invoiceAuditLog = pgTable(
  'invoice_audit_log',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => businessInvoices.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('invoice_audit_log_businessId_invoiceId_idx').on(
      table.businessId,
      table.invoiceId,
    ),
    index('invoice_audit_log_businessId_createdAt_idx').on(
      table.businessId,
      table.createdAt,
    ),
  ],
);

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  organization: one(organization, {
    fields: [businesses.organizationId],
    references: [organization.id],
  }),
  subscriptions: many(subscriptions),
  products: many(products),
  customers: many(customers),
  orders: many(orders),
  invoices: many(businessInvoices),
}));

export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  business: one(businesses, {
    fields: [subscriptions.businessId],
    references: [businesses.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  business: one(businesses, {
    fields: [products.businessId],
    references: [businesses.id],
  }),
  orderItems: many(orderItems),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  business: one(businesses, {
    fields: [customers.businessId],
    references: [businesses.id],
  }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  business: one(businesses, {
    fields: [orders.businessId],
    references: [businesses.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
  invoices: many(businessInvoices),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const businessInvoicesRelations = relations(
  businessInvoices,
  ({ one, many }) => ({
    business: one(businesses, {
      fields: [businessInvoices.businessId],
      references: [businesses.id],
    }),
    order: one(orders, {
      fields: [businessInvoices.orderId],
      references: [orders.id],
    }),
    auditLog: many(invoiceAuditLog),
  }),
);

export const invoiceAuditLogRelations = relations(
  invoiceAuditLog,
  ({ one }) => ({
    invoice: one(businessInvoices, {
      fields: [invoiceAuditLog.invoiceId],
      references: [businessInvoices.id],
    }),
  }),
);

export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type CustomerLedgerEntry = typeof customerLedgerEntries.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type ProductBranchStock = typeof productBranchStock.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
export type InvoiceCounter = typeof invoiceCounters.$inferSelect;
export type BusinessInvoice = typeof businessInvoices.$inferSelect;
export type NewBusinessInvoice = typeof businessInvoices.$inferInsert;
export type CbmsPushQueueRow = typeof cbmsPushQueue.$inferSelect;
export type InvoiceAuditLogRow = typeof invoiceAuditLog.$inferSelect;
