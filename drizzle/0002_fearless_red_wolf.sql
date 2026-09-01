CREATE TABLE "content_navigation" (
	"locale" text PRIMARY KEY NOT NULL,
	"header" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"footer" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tagline" text,
	"copyright" text,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_page_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"nav_label" text,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
ALTER TABLE "content_navigation" ADD CONSTRAINT "content_navigation_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_page_translations" ADD CONSTRAINT "content_page_translations_page_id_content_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."content_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_pages" ADD CONSTRAINT "content_pages_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_page_translations_page_locale_uidx" ON "content_page_translations" USING btree ("page_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "content_pages_slug_uidx" ON "content_pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "content_pages_status_idx" ON "content_pages" USING btree ("status");