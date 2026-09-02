CREATE TABLE "debit_note_counters" (
	"business_id" text NOT NULL,
	"series" text NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "debit_note_counters_business_id_series_pk" PRIMARY KEY("business_id","series")
);
--> statement-breakpoint
CREATE TABLE "debit_note_items" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"debit_note_id" text NOT NULL,
	"purchase_bill_item_id" text,
	"product_id" text,
	"description" text NOT NULL,
	"quantity" numeric(14, 3) DEFAULT '1' NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"vat_cents" integer DEFAULT 0 NOT NULL,
	"line_total_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debit_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"purchase_bill_id" text NOT NULL,
	"note_number" integer NOT NULL,
	"series" text NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"vat_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"restocked" boolean DEFAULT false NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "debit_note_counters" ADD CONSTRAINT "debit_note_counters_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_debit_note_id_debit_notes_id_fk" FOREIGN KEY ("debit_note_id") REFERENCES "public"."debit_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_purchase_bill_item_id_purchase_bill_items_id_fk" FOREIGN KEY ("purchase_bill_item_id") REFERENCES "public"."purchase_bill_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_purchase_bill_id_purchase_bills_id_fk" FOREIGN KEY ("purchase_bill_id") REFERENCES "public"."purchase_bills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debit_note_items_businessId_noteId_idx" ON "debit_note_items" USING btree ("business_id","debit_note_id");--> statement-breakpoint
CREATE UNIQUE INDEX "debit_notes_businessId_series_number_uidx" ON "debit_notes" USING btree ("business_id","series","note_number");--> statement-breakpoint
CREATE INDEX "debit_notes_businessId_billId_idx" ON "debit_notes" USING btree ("business_id","purchase_bill_id");--> statement-breakpoint
CREATE INDEX "debit_notes_businessId_supplierId_idx" ON "debit_notes" USING btree ("business_id","supplier_id");--> statement-breakpoint
CREATE INDEX "debit_notes_businessId_issuedAt_idx" ON "debit_notes" USING btree ("business_id","issued_at");