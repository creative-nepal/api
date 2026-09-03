CREATE TABLE "reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"table_id" text,
	"customer_id" text,
	"guest_name" text NOT NULL,
	"guest_phone" text,
	"party_size" integer NOT NULL,
	"reserved_for" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 90 NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"note" text,
	"created_by_user_id" text,
	"seated_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_table_id_restaurant_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reservations_businessId_reservedFor_idx" ON "reservations" USING btree ("business_id","reserved_for");--> statement-breakpoint
CREATE INDEX "reservations_businessId_status_idx" ON "reservations" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "reservations_businessId_tableId_reservedFor_idx" ON "reservations" USING btree ("business_id","table_id","reserved_for");