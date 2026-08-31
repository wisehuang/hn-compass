import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const digests = pgTable("digests", {
  id: uuid("id").defaultRandom().primaryKey(),
  digestDate: text("digest_date").notNull().unique(),
  sourceRssUrl: text("source_rss_url").notNull(),
  ...timestamps,
});

export const stories = pgTable("stories", {
  id: uuid("id").defaultRandom().primaryKey(),
  digestId: uuid("digest_id").notNull().references(() => digests.id, { onDelete: "cascade" }),
  rank: integer("rank").notNull(), title: text("title").notNull(), articleUrl: text("article_url").notNull(),
  sourceDomain: text("source_domain").notNull(), hnItemId: integer("hn_item_id").notNull().unique(),
  hnDiscussionUrl: text("hn_discussion_url").notNull(), articleFetchStatus: text("article_fetch_status").notNull(),
  articleContent: text("article_content"), articleContentHash: text("article_content_hash"),
  articleExtractor: text("article_extractor"), articleExtractionConfidence: real("article_extraction_confidence"), ...timestamps,
}, (table) => [unique("stories_digest_rank_unique").on(table.digestId, table.rank), index("stories_digest_index").on(table.digestId)]);

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(), storyId: uuid("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  hnCommentId: integer("hn_comment_id").notNull(), parentHnCommentId: integer("parent_hn_comment_id"), author: text("author"),
  score: integer("score"), bodyText: text("body_text").notNull(), position: integer("position").notNull(), insiderSignal: text("insider_signal"), isDeleted: boolean("is_deleted").notNull().default(false),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [unique("comments_story_hn_comment_unique").on(table.storyId, table.hnCommentId), index("comments_story_index").on(table.storyId)]);

export const summaries = pgTable("summaries", {
  id: uuid("id").defaultRandom().primaryKey(), storyId: uuid("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), payloadJson: jsonb("payload_json").notNull(), model: text("model").notNull(), promptVersion: text("prompt_version").notNull(),
  inputHash: text("input_hash").notNull(), generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [unique("summaries_story_kind_unique").on(table.storyId, table.kind), index("summaries_story_index").on(table.storyId)]);

export const summaryJobs = pgTable("summary_jobs", {
  id: uuid("id").defaultRandom().primaryKey(), storyId: uuid("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), status: text("status").notNull(), attempts: integer("attempts").notNull().default(0),
  errorSummary: text("error_summary"), ...timestamps,
}, (table) => [unique("summary_jobs_story_kind_unique").on(table.storyId, table.kind), index("summary_jobs_story_index").on(table.storyId)]);

export const ingestionRuns = pgTable("ingestion_runs", {
  id: uuid("id").defaultRandom().primaryKey(), digestDate: text("digest_date").notNull(), status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(), completedAt: timestamp("completed_at", { withTimezone: true }),
  errorSummary: text("error_summary"), metricsJson: jsonb("metrics_json").notNull().default({}),
}, (table) => [index("ingestion_runs_digest_date_index").on(table.digestDate)]);

export const digestRelations = relations(digests, ({ many }) => ({ stories: many(stories) }));
export const storyRelations = relations(stories, ({ one, many }) => ({
  digest: one(digests, { fields: [stories.digestId], references: [digests.id] }),
  comments: many(comments), summaries: many(summaries), summaryJobs: many(summaryJobs),
}));
export const commentRelations = relations(comments, ({ one }) => ({ story: one(stories, { fields: [comments.storyId], references: [stories.id] }) }));
export const summaryRelations = relations(summaries, ({ one }) => ({ story: one(stories, { fields: [summaries.storyId], references: [stories.id] }) }));
export const summaryJobRelations = relations(summaryJobs, ({ one }) => ({ story: one(stories, { fields: [summaryJobs.storyId], references: [stories.id] }) }));
