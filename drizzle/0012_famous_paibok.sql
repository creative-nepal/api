ALTER TABLE "prescriptions" ALTER COLUMN "attachment_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "attachment_file_id" text;