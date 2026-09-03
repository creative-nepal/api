CREATE TABLE "cash_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"cash_session_id" text NOT NULL,
	"direction" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason" text NOT NULL,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"opening_float_cents" integer DEFAULT 0 NOT NULL,
	"opened_by_user_id" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"counted_cash_cents" integer,
	"expected_cash_cents" integer,
	"variance_cents" integer,
	"closed_by_user_id" text,
	"closed_at" timestamp with time zone,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"cash_session_id" text,
	"method" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"reference" text,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cash_session_id_cash_sessions_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_opened_by_user_id_user_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closed_by_user_id_user_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_business_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."business_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_cash_session_id_cash_sessions_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_movements_businessId_sessionId_idx" ON "cash_movements" USING btree ("business_id","cash_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_sessions_businessId_branchId_open_uidx" ON "cash_sessions" USING btree ("business_id","branch_id") WHERE status = 'open';--> statement-breakpoint
CREATE INDEX "cash_sessions_businessId_openedAt_idx" ON "cash_sessions" USING btree ("business_id","opened_at");--> statement-breakpoint
CREATE INDEX "invoice_payments_businessId_invoiceId_idx" ON "invoice_payments" USING btree ("business_id","invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_payments_sessionId_method_idx" ON "invoice_payments" USING btree ("cash_session_id","method");--> statement-breakpoint
CREATE INDEX "invoice_payments_businessId_createdAt_idx" ON "invoice_payments" USING btree ("business_id","created_at");