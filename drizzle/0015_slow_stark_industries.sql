CREATE TABLE "claim_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"claim_id" text NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"note" text,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD COLUMN "settled_amount_cents" integer;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD COLUMN "settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "claim_audit_log" ADD CONSTRAINT "claim_audit_log_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_audit_log" ADD CONSTRAINT "claim_audit_log_claim_id_insurance_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."insurance_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_audit_log" ADD CONSTRAINT "claim_audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claim_audit_log_businessId_claimId_idx" ON "claim_audit_log" USING btree ("business_id","claim_id");