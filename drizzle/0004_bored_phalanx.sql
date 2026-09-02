CREATE TABLE "service_appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"service_item_id" text NOT NULL,
	"customer_id" text,
	"membership_id" text,
	"staff_user_id" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"note" text,
	"order_id" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_items" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"category" text,
	"price_cents" integer NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"is_vatable" boolean DEFAULT true NOT NULL,
	"sessions_per_package" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"service_item_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"sessions_total" integer NOT NULL,
	"sessions_used" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "service_item_id" text;--> statement-breakpoint
ALTER TABLE "service_appointments" ADD CONSTRAINT "service_appointments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_appointments" ADD CONSTRAINT "service_appointments_service_item_id_service_items_id_fk" FOREIGN KEY ("service_item_id") REFERENCES "public"."service_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_appointments" ADD CONSTRAINT "service_appointments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_appointments" ADD CONSTRAINT "service_appointments_membership_id_service_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."service_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_appointments" ADD CONSTRAINT "service_appointments_staff_user_id_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_memberships" ADD CONSTRAINT "service_memberships_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_memberships" ADD CONSTRAINT "service_memberships_service_item_id_service_items_id_fk" FOREIGN KEY ("service_item_id") REFERENCES "public"."service_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_memberships" ADD CONSTRAINT "service_memberships_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_appointments_businessId_scheduledAt_idx" ON "service_appointments" USING btree ("business_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "service_appointments_businessId_status_idx" ON "service_appointments" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "service_appointments_businessId_staff_idx" ON "service_appointments" USING btree ("business_id","staff_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_items_businessId_code_uidx" ON "service_items" USING btree ("business_id","code");--> statement-breakpoint
CREATE INDEX "service_items_businessId_isActive_idx" ON "service_items" USING btree ("business_id","is_active");--> statement-breakpoint
CREATE INDEX "service_memberships_businessId_customerId_idx" ON "service_memberships" USING btree ("business_id","customer_id");--> statement-breakpoint
CREATE INDEX "service_memberships_businessId_status_idx" ON "service_memberships" USING btree ("business_id","status");