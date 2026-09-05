CREATE TABLE "folio_postings" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"reservation_id" text NOT NULL,
	"source" text NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"posted_for_date" date,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hotel_reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"room_id" text,
	"room_type_id" text NOT NULL,
	"customer_id" text,
	"guest_name" text NOT NULL,
	"guest_phone" text,
	"guest_id_number" text,
	"adults" integer DEFAULT 1 NOT NULL,
	"children" integer DEFAULT 0 NOT NULL,
	"check_in_date" date NOT NULL,
	"check_out_date" date NOT NULL,
	"nightly_rate_cents" integer NOT NULL,
	"meal_plan" text DEFAULT 'room_only' NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"invoice_id" text,
	"note" text,
	"checked_in_at" timestamp with time zone,
	"checked_out_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "housekeeping_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"room_id" text NOT NULL,
	"for_date" date NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_user_id" text,
	"note" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_types" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"base_rate_cents" integer DEFAULT 0 NOT NULL,
	"max_occupancy" integer DEFAULT 2 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"room_type_id" text NOT NULL,
	"room_no" text NOT NULL,
	"floor" text,
	"status" text DEFAULT 'vacant_clean' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "folio_postings" ADD CONSTRAINT "folio_postings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_postings" ADD CONSTRAINT "folio_postings_reservation_id_hotel_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."hotel_reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folio_postings" ADD CONSTRAINT "folio_postings_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_reservations" ADD CONSTRAINT "hotel_reservations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_reservations" ADD CONSTRAINT "hotel_reservations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_reservations" ADD CONSTRAINT "hotel_reservations_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_reservations" ADD CONSTRAINT "hotel_reservations_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_reservations" ADD CONSTRAINT "hotel_reservations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_reservations" ADD CONSTRAINT "hotel_reservations_invoice_id_business_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."business_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_reservations" ADD CONSTRAINT "hotel_reservations_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "folio_postings_businessId_reservationId_idx" ON "folio_postings" USING btree ("business_id","reservation_id");--> statement-breakpoint
CREATE INDEX "hotel_reservations_businessId_status_idx" ON "hotel_reservations" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "hotel_reservations_room_dates_idx" ON "hotel_reservations" USING btree ("room_id","check_in_date","check_out_date");--> statement-breakpoint
CREATE INDEX "hotel_reservations_businessId_checkIn_idx" ON "hotel_reservations" USING btree ("business_id","check_in_date");--> statement-breakpoint
CREATE UNIQUE INDEX "housekeeping_tasks_room_forDate_uidx" ON "housekeeping_tasks" USING btree ("room_id","for_date");--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_businessId_status_idx" ON "housekeeping_tasks" USING btree ("business_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "room_types_businessId_name_uidx" ON "room_types" USING btree ("business_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_businessId_roomNo_uidx" ON "rooms" USING btree ("business_id","room_no");--> statement-breakpoint
CREATE INDEX "rooms_businessId_status_idx" ON "rooms" USING btree ("business_id","status");