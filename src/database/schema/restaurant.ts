import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
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
  customers,
  orderItems,
  orders,
  products,
} from './billing';

export const TABLE_STATUSES = ['empty', 'occupied', 'billed'] as const;

export const RESERVATION_STATUSES = [
  'booked',
  'seated',
  'completed',
  'no_show',
  'cancelled',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const ORDER_SOURCES = ['staff', 'qr', 'delivery'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const KITCHEN_STATUSES = [
  'in_kitchen',
  'preparing',
  'ready',
  'served',
] as const;
export type KitchenStatus = (typeof KITCHEN_STATUSES)[number];

export const DEFAULT_STATIONS = ['main', 'grill', 'drinks', 'dessert'] as const;

export interface MenuModifierOption {
  label: string;
  priceDeltaCents: number;
}

export interface MenuModifier {
  name: string;
  options: MenuModifierOption[];

  required?: boolean;

  maxSelections?: number;
}

export interface SelectedModifier {
  name: string;
  label: string;
  priceDeltaCents: number;
}

export const restaurantTables = pgTable(
  'restaurant_tables',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    tableNo: text('table_no').notNull(),
    areaId: text('area_id'),
    seats: integer('seats').default(4).notNull(),
    status: text('status').default('empty').notNull(),
    assignedWaiterId: text('assigned_waiter_id').references(() => user.id, {
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
    uniqueIndex('restaurant_tables_businessId_tableNo_uidx').on(
      table.businessId,
      table.tableNo,
    ),
    index('restaurant_tables_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
  ],
);

export const menuItems = pgTable(
  'menu_items',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category').notNull(),
    priceCents: integer('price_cents').notNull(),
    modifiers: jsonb('modifiers').$type<MenuModifier[]>().default([]).notNull(),
    isAvailable: boolean('is_available').default(true).notNull(),
    imageUrl: text('image_url'),
    station: text('station').default('main').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('menu_items_businessId_category_idx').on(
      table.businessId,
      table.category,
    ),
    index('menu_items_businessId_isAvailable_idx').on(
      table.businessId,
      table.isAvailable,
    ),
  ],
);

export const menuItemIngredients = pgTable(
  'menu_item_ingredients',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    menuItemId: text('menu_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('menu_item_ingredients_menuItemId_productId_uidx').on(
      table.menuItemId,
      table.productId,
    ),
    index('menu_item_ingredients_businessId_menuItemId_idx').on(
      table.businessId,
      table.menuItemId,
    ),
  ],
);

export const tableSessions = pgTable(
  'table_sessions',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    tableId: text('table_id')
      .notNull()
      .references(() => restaurantTables.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('table_sessions_tokenHash_uidx').on(table.tokenHash),
    index('table_sessions_businessId_tableId_idx').on(
      table.businessId,
      table.tableId,
    ),
  ],
);

export const kitchenTickets = pgTable(
  'kitchen_tickets',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    tableId: text('table_id').references(() => restaurantTables.id, {
      onDelete: 'set null',
    }),
    station: text('station').notNull(),
    status: text('status').default('in_kitchen').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('kitchen_tickets_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
    index('kitchen_tickets_businessId_orderId_idx').on(
      table.businessId,
      table.orderId,
    ),
  ],
);

export const kitchenTicketItems = pgTable(
  'kitchen_ticket_items',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    ticketId: text('ticket_id')
      .notNull()
      .references(() => kitchenTickets.id, { onDelete: 'cascade' }),
    orderItemId: text('order_item_id')
      .notNull()
      .references(() => orderItems.id, { onDelete: 'cascade' }),
    status: text('status').default('in_kitchen').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('kitchen_ticket_items_businessId_ticketId_idx').on(
      table.businessId,
      table.ticketId,
    ),
  ],
);

export const restaurantTablesRelations = relations(
  restaurantTables,
  ({ many }) => ({
    sessions: many(tableSessions),
    orders: many(orders),
  }),
);

export const menuItemsRelations = relations(menuItems, ({ many }) => ({
  orderItems: many(orderItems),
}));

export const tableSessionsRelations = relations(tableSessions, ({ one }) => ({
  table: one(restaurantTables, {
    fields: [tableSessions.tableId],
    references: [restaurantTables.id],
  }),
}));

export const kitchenTicketsRelations = relations(
  kitchenTickets,
  ({ one, many }) => ({
    order: one(orders, {
      fields: [kitchenTickets.orderId],
      references: [orders.id],
    }),
    items: many(kitchenTicketItems),
  }),
);

export const kitchenTicketItemsRelations = relations(
  kitchenTicketItems,
  ({ one }) => ({
    ticket: one(kitchenTickets, {
      fields: [kitchenTicketItems.ticketId],
      references: [kitchenTickets.id],
    }),
  }),
);

export const tableAreas = pgTable(
  'table_areas',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('table_areas_branchId_name_uidx').on(
      table.branchId,
      table.name,
    ),
  ],
);

export const reservations = pgTable(
  'reservations',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    tableId: text('table_id').references(() => restaurantTables.id, {
      onDelete: 'set null',
    }),
    customerId: text('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    guestName: text('guest_name').notNull(),
    guestPhone: text('guest_phone'),
    partySize: integer('party_size').notNull(),
    reservedFor: timestamp('reserved_for', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').default(90).notNull(),
    status: text('status').default('booked').notNull(),
    note: text('note'),
    createdByUserId: text('created_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    seatedAt: timestamp('seated_at', { withTimezone: true }),
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
    index('reservations_businessId_reservedFor_idx').on(
      table.businessId,
      table.reservedFor,
    ),
    index('reservations_businessId_status_idx').on(
      table.businessId,
      table.status,
    ),
    index('reservations_businessId_tableId_reservedFor_idx').on(
      table.businessId,
      table.tableId,
      table.reservedFor,
    ),
  ],
);

export const reservationsRelations = relations(reservations, ({ one }) => ({
  table: one(restaurantTables, {
    fields: [reservations.tableId],
    references: [restaurantTables.id],
  }),
  customer: one(customers, {
    fields: [reservations.customerId],
    references: [customers.id],
  }),
}));

export const salesChannels = pgTable(
  'sales_channels',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    commissionPercent: numeric('commission_percent', {
      precision: 5,
      scale: 2,
    })
      .default('0')
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
    uniqueIndex('sales_channels_businessId_name_uidx').on(
      table.businessId,
      table.name,
    ),
  ],
);

export type RestaurantTable = typeof restaurantTables.$inferSelect;
export type NewRestaurantTable = typeof restaurantTables.$inferInsert;
export type MenuItem = typeof menuItems.$inferSelect;
export type NewMenuItem = typeof menuItems.$inferInsert;
export type TableSession = typeof tableSessions.$inferSelect;
export type NewTableSession = typeof tableSessions.$inferInsert;
export type KitchenTicket = typeof kitchenTickets.$inferSelect;
export type NewKitchenTicket = typeof kitchenTickets.$inferInsert;
export type KitchenTicketItem = typeof kitchenTicketItems.$inferSelect;
export type NewKitchenTicketItem = typeof kitchenTicketItems.$inferInsert;
export type MenuItemIngredient = typeof menuItemIngredients.$inferSelect;
export type NewMenuItemIngredient = typeof menuItemIngredients.$inferInsert;
export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;
export type SalesChannel = typeof salesChannels.$inferSelect;
export type NewSalesChannel = typeof salesChannels.$inferInsert;
export type TableArea = typeof tableAreas.$inferSelect;
export type NewTableArea = typeof tableAreas.$inferInsert;
