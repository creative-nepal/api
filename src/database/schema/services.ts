import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { businesses, customers } from './billing';

export const APPOINTMENT_STATUSES = [
  'booked',
  'completed',
  'no_show',
  'canceled',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const MEMBERSHIP_STATUSES = [
  'active',
  'exhausted',
  'expired',
  'canceled',
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const serviceItems = pgTable(
  'service_items',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code'),
    category: text('category'),
    priceCents: integer('price_cents').notNull(),
    durationMinutes: integer('duration_minutes').default(30).notNull(),
    isVatable: boolean('is_vatable').default(true).notNull(),
    depositCents: integer('deposit_cents').default(0).notNull(),
    noShowFeeCents: integer('no_show_fee_cents').default(0).notNull(),
    sessionsPerPackage: integer('sessions_per_package'),
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
    uniqueIndex('service_items_businessId_code_uidx').on(
      table.businessId,
      table.code,
    ),
    index('service_items_businessId_isActive_idx').on(
      table.businessId,
      table.isActive,
    ),
  ],
);

export const serviceMemberships = pgTable(
  'service_memberships',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    serviceItemId: text('service_item_id')
      .notNull()
      .references(() => serviceItems.id, { onDelete: 'restrict' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    startsAt: timestamp('starts_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    sessionsTotal: integer('sessions_total').notNull(),
    sessionsUsed: integer('sessions_used').default(0).notNull(),
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
    index('service_memberships_businessId_customerId_idx').on(
      table.businessId,
      table.customerId,
    ),
    index('service_memberships_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
  ],
);

export const staffAvailability = pgTable(
  'staff_availability',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    staffUserId: text('staff_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    dayOfWeek: integer('day_of_week').notNull(),
    startMinute: integer('start_minute').notNull(),
    endMinute: integer('end_minute').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('staff_availability_staff_day_start_uidx').on(
      table.staffUserId,
      table.dayOfWeek,
      table.startMinute,
    ),
    index('staff_availability_businessId_staff_idx').on(
      table.businessId,
      table.staffUserId,
    ),
  ],
);

export const staffTimeOff = pgTable(
  'staff_time_off',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    staffUserId: text('staff_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('staff_time_off_businessId_staff_startsAt_idx').on(
      table.businessId,
      table.staffUserId,
      table.startsAt,
    ),
  ],
);

export const serviceAppointments = pgTable(
  'service_appointments',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    serviceItemId: text('service_item_id')
      .notNull()
      .references(() => serviceItems.id, { onDelete: 'restrict' }),
    customerId: text('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    membershipId: text('membership_id').references(
      () => serviceMemberships.id,
      { onDelete: 'set null' },
    ),
    staffUserId: text('staff_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    status: text('status').default('booked').notNull(),
    note: text('note'),
    orderId: text('order_id'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    depositRequiredCents: integer('deposit_required_cents')
      .default(0)
      .notNull(),
    depositPaidCents: integer('deposit_paid_cents').default(0).notNull(),
    depositMethod: text('deposit_method'),
    depositReference: text('deposit_reference'),
    depositPaidAt: timestamp('deposit_paid_at', { withTimezone: true }),
    depositForfeitedCents: integer('deposit_forfeited_cents')
      .default(0)
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
    index('service_appointments_businessId_scheduledAt_idx').on(
      table.businessId,
      table.scheduledAt,
    ),
    index('service_appointments_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
    index('service_appointments_businessId_staff_idx').on(
      table.businessId,
      table.staffUserId,
    ),
  ],
);

export const serviceItemsRelations = relations(serviceItems, ({ many }) => ({
  memberships: many(serviceMemberships),
  appointments: many(serviceAppointments),
}));

export const serviceMembershipsRelations = relations(
  serviceMemberships,
  ({ one, many }) => ({
    serviceItem: one(serviceItems, {
      fields: [serviceMemberships.serviceItemId],
      references: [serviceItems.id],
    }),
    customer: one(customers, {
      fields: [serviceMemberships.customerId],
      references: [customers.id],
    }),
    appointments: many(serviceAppointments),
  }),
);

export const serviceAppointmentsRelations = relations(
  serviceAppointments,
  ({ one }) => ({
    serviceItem: one(serviceItems, {
      fields: [serviceAppointments.serviceItemId],
      references: [serviceItems.id],
    }),
    membership: one(serviceMemberships, {
      fields: [serviceAppointments.membershipId],
      references: [serviceMemberships.id],
    }),
    customer: one(customers, {
      fields: [serviceAppointments.customerId],
      references: [customers.id],
    }),
  }),
);

export type ServiceItem = typeof serviceItems.$inferSelect;
export type NewServiceItem = typeof serviceItems.$inferInsert;
export type ServiceMembership = typeof serviceMemberships.$inferSelect;
export type NewServiceMembership = typeof serviceMemberships.$inferInsert;
export type ServiceAppointment = typeof serviceAppointments.$inferSelect;
export type NewServiceAppointment = typeof serviceAppointments.$inferInsert;
export type StaffAvailability = typeof staffAvailability.$inferSelect;
export type StaffTimeOff = typeof staffTimeOff.$inferSelect;
