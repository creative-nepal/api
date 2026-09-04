CREATE TABLE "branch_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"business_id" text PRIMARY KEY NOT NULL,
	"contact_phone" text,
	"contact_email" text,
	"address_line" text,
	"website" text,
	"invoice_footer" text,
	"receipt_width" text DEFAULT '80mm' NOT NULL,
	"show_logo_on_receipt" boolean DEFAULT true NOT NULL,
	"timezone" text DEFAULT 'Asia/Kathmandu' NOT NULL,
	"default_locale" text DEFAULT 'en' NOT NULL,
	"digest_enabled" boolean DEFAULT true NOT NULL,
	"digest_hour" integer DEFAULT 7 NOT NULL,
	"low_stock_alerts_enabled" boolean DEFAULT true NOT NULL,
	"expiry_alerts_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "branch_roles" ADD CONSTRAINT "branch_roles_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_roles" ADD CONSTRAINT "branch_roles_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_roles" ADD CONSTRAINT "branch_roles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "branch_roles_branchId_userId_uidx" ON "branch_roles" USING btree ("branch_id","user_id");