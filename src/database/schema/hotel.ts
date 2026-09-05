import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { branches, businesses, businessInvoices, customers } from './billing';

export const ROOM_STATUSES = [
  'vacant_clean',
  'vacant_dirty',
  'occupied',
  'out_of_service',
] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const HOTEL_RESERVATION_STATUSES = [
  'booked',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show',
] as const;
export type HotelReservationStatus =
  (typeof HOTEL_RESERVATION_STATUSES)[number];

export const MEAL_PLANS = [
  'room_only',
  'bb',
  'half_board',
  'full_board',
] as const;
export type MealPlan = (typeof MEAL_PLANS)[number];

export const FOLIO_POSTING_SOURCES = [
  'room',
  'restaurant',
  'room_service',
  'laundry',
  'banquet',
  'minibar',
  'other',
] as const;
export type FolioPostingSource = (typeof FOLIO_POSTING_SOURCES)[number];

export const HOUSEKEEPING_STATUSES = [
  'pending',
  'in_progress',
  'done',
  'inspected',
] as const;
export type HousekeepingStatus = (typeof HOUSEKEEPING_STATUSES)[number];

export const roomTypes = pgTable(
  'room_types',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    baseRateCents: integer('base_rate_cents').default(0).notNull(),
    maxOccupancy: integer('max_occupancy').default(2).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('room_types_businessId_name_uidx').on(
      table.businessId,
      table.name,
    ),
  ],
);

export const rooms = pgTable(
  'rooms',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    roomTypeId: text('room_type_id')
      .notNull()
      .references(() => roomTypes.id, { onDelete: 'restrict' }),
    roomNo: text('room_no').notNull(),
    floor: text('floor'),
    status: text('status').default('vacant_clean').notNull(),
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
    uniqueIndex('rooms_businessId_roomNo_uidx').on(
      table.businessId,
      table.roomNo,
    ),
    index('rooms_businessId_status_idx').on(table.businessId, table.status),
  ],
);

export const hotelReservations = pgTable(
  'hotel_reservations',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    roomId: text('room_id').references(() => rooms.id, {
      onDelete: 'set null',
    }),
    roomTypeId: text('room_type_id')
      .notNull()
      .references(() => roomTypes.id, { onDelete: 'restrict' }),
    customerId: text('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    guestName: text('guest_name').notNull(),
    guestPhone: text('guest_phone'),
    guestIdNumber: text('guest_id_number'),
    adults: integer('adults').default(1).notNull(),
    children: integer('children').default(0).notNull(),
    checkInDate: date('check_in_date').notNull(),
    checkOutDate: date('check_out_date').notNull(),
    nightlyRateCents: integer('nightly_rate_cents').notNull(),
    mealPlan: text('meal_plan').default('room_only').notNull(),
    status: text('status').default('booked').notNull(),
    invoiceId: text('invoice_id').references(() => businessInvoices.id, {
      onDelete: 'set null',
    }),
    note: text('note'),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
    checkedOutAt: timestamp('checked_out_at', { withTimezone: true }),
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
    index('hotel_reservations_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
    index('hotel_reservations_room_dates_idx').on(
      table.roomId,
      table.checkInDate,
      table.checkOutDate,
    ),
    index('hotel_reservations_businessId_checkIn_idx').on(
      table.businessId,
      table.checkInDate,
    ),
  ],
);

export const folioPostings = pgTable(
  'folio_postings',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    reservationId: text('reservation_id')
      .notNull()
      .references(() => hotelReservations.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    description: text('description').notNull(),
    quantity: integer('quantity').default(1).notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    amountCents: integer('amount_cents').notNull(),
    postedForDate: date('posted_for_date'),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('folio_postings_businessId_reservationId_idx').on(
      table.businessId,
      table.reservationId,
    ),
  ],
);

export const housekeepingTasks = pgTable(
  'housekeeping_tasks',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    forDate: date('for_date').notNull(),
    status: text('status').default('pending').notNull(),
    assignedUserId: text('assigned_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    note: text('note'),
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
    uniqueIndex('housekeeping_tasks_room_forDate_uidx').on(
      table.roomId,
      table.forDate,
    ),
    index('housekeeping_tasks_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
  ],
);

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  roomType: one(roomTypes, {
    fields: [rooms.roomTypeId],
    references: [roomTypes.id],
  }),
  reservations: many(hotelReservations),
}));

export const hotelReservationsRelations = relations(
  hotelReservations,
  ({ one, many }) => ({
    room: one(rooms, {
      fields: [hotelReservations.roomId],
      references: [rooms.id],
    }),
    roomType: one(roomTypes, {
      fields: [hotelReservations.roomTypeId],
      references: [roomTypes.id],
    }),
    postings: many(folioPostings),
  }),
);

export const folioPostingsRelations = relations(folioPostings, ({ one }) => ({
  reservation: one(hotelReservations, {
    fields: [folioPostings.reservationId],
    references: [hotelReservations.id],
  }),
}));

export type RoomType = typeof roomTypes.$inferSelect;
export type NewRoomType = typeof roomTypes.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type HotelReservation = typeof hotelReservations.$inferSelect;
export type NewHotelReservation = typeof hotelReservations.$inferInsert;
export type FolioPosting = typeof folioPostings.$inferSelect;
export type NewFolioPosting = typeof folioPostings.$inferInsert;
export type HousekeepingTask = typeof housekeepingTasks.$inferSelect;
export type NewHousekeepingTask = typeof housekeepingTasks.$inferInsert;
