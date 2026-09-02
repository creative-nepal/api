CREATE TABLE "stored_files" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text,
	"purpose" text NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"uploaded_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	CONSTRAINT "stored_files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stored_files_businessId_purpose_idx" ON "stored_files" USING btree ("business_id","purpose");--> statement-breakpoint
CREATE INDEX "stored_files_status_createdAt_idx" ON "stored_files" USING btree ("status","created_at");