CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"issuer" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp with time zone NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp with time zone,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"order_id" text,
	"invoice_number" integer NOT NULL,
	"fiscal_year" text NOT NULL,
	"customer_id" text,
	"customer_name" text,
	"customer_pan" text,
	"subtotal_cents" integer NOT NULL,
	"service_charge_cents" integer DEFAULT 0 NOT NULL,
	"vat_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"printed_count" integer DEFAULT 0 NOT NULL,
	"cbms_status" text,
	"cbms_pushed_at" timestamp with time zone,
	"lease_id" text,
	"client_request_id" text,
	"credit_note_for_invoice_id" text,
	"issued_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"sector" text NOT NULL,
	"legal_name" text NOT NULL,
	"pan_number" text,
	"vat_registered" boolean DEFAULT false NOT NULL,
	"cbms_required" boolean DEFAULT false NOT NULL,
	"service_charge_percent" integer DEFAULT 0 NOT NULL,
	"fiscal_year_start_month" integer DEFAULT 4 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cbms_push_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"pan_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_counters" (
	"business_id" text NOT NULL,
	"fiscal_year" text NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_counters_pk" PRIMARY KEY("business_id","fiscal_year")
);
--> statement-breakpoint
CREATE TABLE "invoice_leases" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"fiscal_year" text NOT NULL,
	"device_id" text NOT NULL,
	"first_number" integer NOT NULL,
	"last_number" integer NOT NULL,
	"used_through" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"business_id" text NOT NULL,
	"product_id" text,
	"menu_item_id" text,
	"modifiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"invoice_id" text,
	"product_name" text NOT NULL,
	"batch_id" text,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"line_total_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"customer_id" text,
	"status" text DEFAULT 'placed' NOT NULL,
	"table_id" text,
	"source" text DEFAULT 'staff' NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"service_charge_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"created_by_user_id" text,
	"client_request_id" text,
	"sector_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"sector" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'NPR' NOT NULL,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"feature_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"unit_type" text DEFAULT 'pcs' NOT NULL,
	"price_cents" integer NOT NULL,
	"cost_price_cents" integer DEFAULT 0 NOT NULL,
	"stock_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	"low_stock_threshold" numeric(14, 3) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sector_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"status" text DEFAULT 'trialing' NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "controlled_substance_register" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"order_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"product_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_id_type" text NOT NULL,
	"buyer_id_number" text NOT NULL,
	"prescription_id" text,
	"dispensed_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insurance_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"order_id" text NOT NULL,
	"invoice_id" text,
	"provider" text NOT NULL,
	"policy_number" text NOT NULL,
	"claimed_amount_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"order_id" text,
	"doctor_name" text NOT NULL,
	"patient_name" text NOT NULL,
	"attachment_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"product_id" text NOT NULL,
	"batch_no" text NOT NULL,
	"expiry_date" date NOT NULL,
	"qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	"cost_price_cents" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"product_id" text NOT NULL,
	"batch_id" text,
	"delta" numeric(14, 3) NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kitchen_ticket_items" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"ticket_id" text NOT NULL,
	"order_item_id" text NOT NULL,
	"status" text DEFAULT 'in_kitchen' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kitchen_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"order_id" text NOT NULL,
	"table_id" text,
	"station" text NOT NULL,
	"status" text DEFAULT 'in_kitchen' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"price_cents" integer NOT NULL,
	"modifiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"image_url" text,
	"station" text DEFAULT 'main' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"table_no" text NOT NULL,
	"seats" integer DEFAULT 4 NOT NULL,
	"status" text DEFAULT 'empty' NOT NULL,
	"assigned_waiter_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"table_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"business_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"payment_method_id" text,
	"amount_cents" integer NOT NULL,
	"provider" text,
	"status" text NOT NULL,
	"gateway_reference" text,
	"failure_reason" text,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"gateway_token" text NOT NULL,
	"display_label" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"action" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_invoice_counters" (
	"series" text PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_invoice_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"platform_invoice_id" text NOT NULL,
	"business_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"description" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"invoice_number" integer,
	"series" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"vat_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_bill_items" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"purchase_bill_id" text NOT NULL,
	"product_id" text,
	"description" text NOT NULL,
	"quantity" numeric(14, 3) DEFAULT '1' NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"vat_cents" integer DEFAULT 0 NOT NULL,
	"line_total_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_bills" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"purchase_order_id" text,
	"bill_number" text NOT NULL,
	"bill_date" date NOT NULL,
	"due_date" date,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"vat_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"tds_rate_basis_points" integer DEFAULT 0 NOT NULL,
	"tds_amount_cents" integer DEFAULT 0 NOT NULL,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'unpaid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"purchase_order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"ordered_qty" numeric(14, 3) NOT NULL,
	"received_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	"purchase_price_cents" integer NOT NULL,
	"line_total_cents" integer NOT NULL,
	"batch_no" text,
	"expiry_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"reference" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"ordered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expected_at" date,
	"received_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"pan_number" text,
	"address" text,
	"contact" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_invoices" ADD CONSTRAINT "business_invoices_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_invoices" ADD CONSTRAINT "business_invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_invoices" ADD CONSTRAINT "business_invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_invoices" ADD CONSTRAINT "business_invoices_credit_note_for_invoice_id_business_invoices_id_fk" FOREIGN KEY ("credit_note_for_invoice_id") REFERENCES "public"."business_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_invoices" ADD CONSTRAINT "business_invoices_issued_by_user_id_user_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbms_push_queue" ADD CONSTRAINT "cbms_push_queue_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbms_push_queue" ADD CONSTRAINT "cbms_push_queue_invoice_id_business_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."business_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_audit_log" ADD CONSTRAINT "invoice_audit_log_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_audit_log" ADD CONSTRAINT "invoice_audit_log_invoice_id_business_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."business_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_audit_log" ADD CONSTRAINT "invoice_audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_counters" ADD CONSTRAINT "invoice_counters_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_leases" ADD CONSTRAINT "invoice_leases_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controlled_substance_register" ADD CONSTRAINT "controlled_substance_register_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controlled_substance_register" ADD CONSTRAINT "controlled_substance_register_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controlled_substance_register" ADD CONSTRAINT "controlled_substance_register_invoice_id_business_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."business_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controlled_substance_register" ADD CONSTRAINT "controlled_substance_register_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controlled_substance_register" ADD CONSTRAINT "controlled_substance_register_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controlled_substance_register" ADD CONSTRAINT "controlled_substance_register_prescription_id_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controlled_substance_register" ADD CONSTRAINT "controlled_substance_register_dispensed_by_user_id_user_id_fk" FOREIGN KEY ("dispensed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_invoice_id_business_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."business_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_ticket_id_kitchen_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."kitchen_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_ticket_items" ADD CONSTRAINT "kitchen_ticket_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_table_id_restaurant_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_assigned_waiter_id_user_id_fk" FOREIGN KEY ("assigned_waiter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_table_id_restaurant_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_audit_log" ADD CONSTRAINT "platform_audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_invoice_lines" ADD CONSTRAINT "platform_invoice_lines_platform_invoice_id_platform_invoices_id_fk" FOREIGN KEY ("platform_invoice_id") REFERENCES "public"."platform_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_invoice_lines" ADD CONSTRAINT "platform_invoice_lines_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_invoice_lines" ADD CONSTRAINT "platform_invoice_lines_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_invoice_lines" ADD CONSTRAINT "platform_invoice_lines_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_invoices" ADD CONSTRAINT "platform_invoices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bill_items" ADD CONSTRAINT "purchase_bill_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bill_items" ADD CONSTRAINT "purchase_bill_items_purchase_bill_id_purchase_bills_id_fk" FOREIGN KEY ("purchase_bill_id") REFERENCES "public"."purchase_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bill_items" ADD CONSTRAINT "purchase_bill_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "business_invoices_businessId_fiscalYear_number_uidx" ON "business_invoices" USING btree ("business_id","fiscal_year","invoice_number");--> statement-breakpoint
CREATE INDEX "business_invoices_businessId_status_idx" ON "business_invoices" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "business_invoices_businessId_createdAt_idx" ON "business_invoices" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "business_invoices_businessId_creditNoteFor_idx" ON "business_invoices" USING btree ("business_id","credit_note_for_invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_organizationId_uidx" ON "businesses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "businesses_sector_status_idx" ON "businesses" USING btree ("sector","status");--> statement-breakpoint
CREATE INDEX "businesses_createdAt_idx" ON "businesses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cbms_push_queue_businessId_status_idx" ON "cbms_push_queue" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "customers_businessId_phone_idx" ON "customers" USING btree ("business_id","phone");--> statement-breakpoint
CREATE INDEX "invoice_audit_log_businessId_invoiceId_idx" ON "invoice_audit_log" USING btree ("business_id","invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_audit_log_businessId_createdAt_idx" ON "invoice_audit_log" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "invoice_leases_businessId_status_idx" ON "invoice_leases" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "invoice_leases_businessId_deviceId_idx" ON "invoice_leases" USING btree ("business_id","device_id");--> statement-breakpoint
CREATE INDEX "order_items_businessId_orderId_idx" ON "order_items" USING btree ("business_id","order_id");--> statement-breakpoint
CREATE INDEX "order_items_businessId_productId_idx" ON "order_items" USING btree ("business_id","product_id");--> statement-breakpoint
CREATE INDEX "orders_businessId_status_idx" ON "orders" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "orders_businessId_createdAt_idx" ON "orders" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_businessId_clientRequestId_uidx" ON "orders" USING btree ("business_id","client_request_id") WHERE client_request_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "plans_sector_key_uidx" ON "plans" USING btree ("sector","key");--> statement-breakpoint
CREATE INDEX "plans_sector_isActive_idx" ON "plans" USING btree ("sector","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "products_businessId_sku_uidx" ON "products" USING btree ("business_id","sku");--> statement-breakpoint
CREATE INDEX "products_businessId_isActive_idx" ON "products" USING btree ("business_id","is_active");--> statement-breakpoint
CREATE INDEX "subscriptions_businessId_status_idx" ON "subscriptions" USING btree ("business_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_businessId_live_uidx" ON "subscriptions" USING btree ("business_id") WHERE status <> 'canceled';--> statement-breakpoint
CREATE INDEX "controlled_register_businessId_createdAt_idx" ON "controlled_substance_register" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "controlled_register_businessId_productId_idx" ON "controlled_substance_register" USING btree ("business_id","product_id");--> statement-breakpoint
CREATE INDEX "insurance_claims_businessId_status_idx" ON "insurance_claims" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "prescriptions_businessId_orderId_idx" ON "prescriptions" USING btree ("business_id","order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_batches_businessId_productId_batchNo_uidx" ON "product_batches" USING btree ("business_id","product_id","batch_no");--> statement-breakpoint
CREATE INDEX "product_batches_businessId_productId_expiry_idx" ON "product_batches" USING btree ("business_id","product_id","expiry_date");--> statement-breakpoint
CREATE INDEX "product_batches_businessId_expiry_idx" ON "product_batches" USING btree ("business_id","expiry_date");--> statement-breakpoint
CREATE INDEX "stock_adjustments_businessId_createdAt_idx" ON "stock_adjustments" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_adjustments_businessId_reason_idx" ON "stock_adjustments" USING btree ("business_id","reason");--> statement-breakpoint
CREATE INDEX "stock_adjustments_businessId_productId_idx" ON "stock_adjustments" USING btree ("business_id","product_id");--> statement-breakpoint
CREATE INDEX "kitchen_ticket_items_businessId_ticketId_idx" ON "kitchen_ticket_items" USING btree ("business_id","ticket_id");--> statement-breakpoint
CREATE INDEX "kitchen_tickets_businessId_status_idx" ON "kitchen_tickets" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "kitchen_tickets_businessId_orderId_idx" ON "kitchen_tickets" USING btree ("business_id","order_id");--> statement-breakpoint
CREATE INDEX "menu_items_businessId_category_idx" ON "menu_items" USING btree ("business_id","category");--> statement-breakpoint
CREATE INDEX "menu_items_businessId_isAvailable_idx" ON "menu_items" USING btree ("business_id","is_available");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_tables_businessId_tableNo_uidx" ON "restaurant_tables" USING btree ("business_id","table_no");--> statement-breakpoint
CREATE INDEX "restaurant_tables_businessId_status_idx" ON "restaurant_tables" USING btree ("business_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "table_sessions_tokenHash_uidx" ON "table_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "table_sessions_businessId_tableId_idx" ON "table_sessions" USING btree ("business_id","table_id");--> statement-breakpoint
CREATE INDEX "payment_attempts_userId_createdAt_idx" ON "payment_attempts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_attempts_subscriptionId_createdAt_idx" ON "payment_attempts" USING btree ("subscription_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_methods_userId_status_idx" ON "payment_methods" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_userId_default_uidx" ON "payment_methods" USING btree ("user_id") WHERE is_default = true AND status = 'active';--> statement-breakpoint
CREATE INDEX "platform_audit_log_target_idx" ON "platform_audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "platform_audit_log_createdAt_idx" ON "platform_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_invoice_lines_invoiceId_idx" ON "platform_invoice_lines" USING btree ("platform_invoice_id");--> statement-breakpoint
CREATE INDEX "platform_invoice_lines_businessId_idx" ON "platform_invoice_lines" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_invoices_series_number_uidx" ON "platform_invoices" USING btree ("series","invoice_number");--> statement-breakpoint
CREATE INDEX "platform_invoices_userId_status_idx" ON "platform_invoices" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "purchase_bill_items_businessId_billId_idx" ON "purchase_bill_items" USING btree ("business_id","purchase_bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_bills_businessId_supplier_number_uidx" ON "purchase_bills" USING btree ("business_id","supplier_id","bill_number");--> statement-breakpoint
CREATE INDEX "purchase_bills_businessId_status_idx" ON "purchase_bills" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "purchase_bills_businessId_billDate_idx" ON "purchase_bills" USING btree ("business_id","bill_date");--> statement-breakpoint
CREATE INDEX "purchase_order_items_businessId_poId_idx" ON "purchase_order_items" USING btree ("business_id","purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_order_items_businessId_productId_idx" ON "purchase_order_items" USING btree ("business_id","product_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_businessId_status_idx" ON "purchase_orders" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "purchase_orders_businessId_supplierId_idx" ON "purchase_orders" USING btree ("business_id","supplier_id");--> statement-breakpoint
CREATE INDEX "suppliers_businessId_isActive_idx" ON "suppliers" USING btree ("business_id","is_active");