import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { branches, businesses } from './billing';

export const RECEIPT_WIDTHS = ['58mm', '80mm', 'a4'] as const;
export type ReceiptWidth = (typeof RECEIPT_WIDTHS)[number];

export const businessSettings = pgTable('business_settings', {
  businessId: text('business_id')
    .primaryKey()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  addressLine: text('address_line'),
  website: text('website'),
  invoiceFooter: text('invoice_footer'),
  receiptWidth: text('receipt_width').default('80mm').notNull(),
  showLogoOnReceipt: boolean('show_logo_on_receipt').default(true).notNull(),
  timezone: text('timezone').default('Asia/Kathmandu').notNull(),
  defaultLocale: text('default_locale').default('en').notNull(),
  digestEnabled: boolean('digest_enabled').default(true).notNull(),
  digestHour: integer('digest_hour').default(7).notNull(),
  lowStockAlertsEnabled: boolean('low_stock_alerts_enabled')
    .default(true)
    .notNull(),
  expiryAlertsEnabled: boolean('expiry_alerts_enabled').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const branchRoles = pgTable(
  'branch_roles',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('branch_roles_branchId_userId_uidx').on(
      table.branchId,
      table.userId,
    ),
  ],
);

export const businessSettingsRelations = relations(
  businessSettings,
  ({ one }) => ({
    business: one(businesses, {
      fields: [businessSettings.businessId],
      references: [businesses.id],
    }),
  }),
);

export const branchRolesRelations = relations(branchRoles, ({ one }) => ({
  branch: one(branches, {
    fields: [branchRoles.branchId],
    references: [branches.id],
  }),
}));

export type BusinessSettings = typeof businessSettings.$inferSelect;
export type NewBusinessSettings = typeof businessSettings.$inferInsert;
export type BranchRole = typeof branchRoles.$inferSelect;
export type NewBranchRole = typeof branchRoles.$inferInsert;
