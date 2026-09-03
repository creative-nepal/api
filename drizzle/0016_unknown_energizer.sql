CREATE TABLE "staff_availability" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"staff_user_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_time_off" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"staff_user_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_availability" ADD CONSTRAINT "staff_availability_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_availability" ADD CONSTRAINT "staff_availability_staff_user_id_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_time_off" ADD CONSTRAINT "staff_time_off_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_time_off" ADD CONSTRAINT "staff_time_off_staff_user_id_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_availability_staff_day_start_uidx" ON "staff_availability" USING btree ("staff_user_id","day_of_week","start_minute");--> statement-breakpoint
CREATE INDEX "staff_availability_businessId_staff_idx" ON "staff_availability" USING btree ("business_id","staff_user_id");--> statement-breakpoint
CREATE INDEX "staff_time_off_businessId_staff_startsAt_idx" ON "staff_time_off" USING btree ("business_id","staff_user_id","starts_at");