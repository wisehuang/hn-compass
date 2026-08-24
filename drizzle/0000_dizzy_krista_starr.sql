CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"hn_comment_id" integer NOT NULL,
	"parent_hn_comment_id" integer,
	"author" text,
	"score" integer,
	"body_text" text NOT NULL,
	"position" integer NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_story_hn_comment_unique" UNIQUE("story_id","hn_comment_id")
);
--> statement-breakpoint
CREATE TABLE "digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digest_date" text NOT NULL,
	"source_rss_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "digests_digest_date_unique" UNIQUE("digest_date")
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digest_date" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_summary" text,
	"metrics_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digest_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"title" text NOT NULL,
	"article_url" text NOT NULL,
	"source_domain" text NOT NULL,
	"hn_item_id" integer NOT NULL,
	"hn_discussion_url" text NOT NULL,
	"article_fetch_status" text NOT NULL,
	"article_content" text,
	"article_content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stories_hn_item_id_unique" UNIQUE("hn_item_id"),
	CONSTRAINT "stories_digest_rank_unique" UNIQUE("digest_id","rank")
);
--> statement-breakpoint
CREATE TABLE "summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_hash" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "summaries_story_kind_unique" UNIQUE("story_id","kind")
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_digest_id_digests_id_fk" FOREIGN KEY ("digest_id") REFERENCES "public"."digests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_story_index" ON "comments" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "ingestion_runs_digest_date_index" ON "ingestion_runs" USING btree ("digest_date");--> statement-breakpoint
CREATE INDEX "stories_digest_index" ON "stories" USING btree ("digest_id");--> statement-breakpoint
CREATE INDEX "summaries_story_index" ON "summaries" USING btree ("story_id");