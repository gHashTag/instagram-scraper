import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const testTable = pgTable("test_table", {
  id: serial("id").primaryKey(),
  name: text("name"),
});

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authId: text("auth_id").unique(),
  email: text("email").unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  telegram_id: integer("telegram_id").notNull().unique(),
  username: varchar("username", { length: 255 }),
  first_name: varchar("first_name", { length: 255 }),
  last_name: varchar("last_name", { length: 255 }),
  subscription_level: varchar("subscription_level", { length: 50 })
    .default("'free'")
    .notNull(),
  subscription_expires_at: timestamp("subscription_expires_at"),
  last_active_at: timestamp("last_active_at").defaultNow(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  industry: varchar("industry", { length: 255 }),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// New tables for Instagram Scraper Bot

export const competitorsTable = pgTable(
  "competitors",
  {
    id: serial("id").primaryKey(),
    project_id: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    username: varchar("username", { length: 255 }).notNull(),
    profile_url: text("profile_url").notNull(),
    full_name: varchar("full_name", { length: 255 }),
    notes: text("notes"),
    is_active: boolean("is_active").default(true).notNull(),
    added_at: timestamp("added_at").defaultNow().notNull(),
    last_scraped_at: timestamp("last_scraped_at"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => {
    return {
      projectUsernameUnq: unique("project_username_unq").on(
        table.project_id,
        table.username
      ),
    };
  }
);

export const hashtagsTable = pgTable(
  "hashtags",
  {
    id: serial("id").primaryKey(),
    project_id: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    tag_name: varchar("tag_name", { length: 255 }).notNull(),
    notes: text("notes"),
    is_active: boolean("is_active").default(true).notNull(),
    added_at: timestamp("added_at").defaultNow().notNull(),
    last_scraped_at: timestamp("last_scraped_at"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => {
    return {
      projectTagNameUnq: unique("project_tag_name_unq").on(
        table.project_id,
        table.tag_name
      ),
    };
  }
);

export const reelsTable = pgTable("reels", {
  id: serial("id").primaryKey(),
  reel_url: text("reel_url").unique(),
  project_id: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  source_type: varchar("source_type", { length: 50 }),
  source_identifier: varchar("source_identifier", { length: 255 }),
  profile_url: text("profile_url"),
  author_username: varchar("author_username", { length: 255 }),
  description: text("description"),
  views_count: integer("views_count"),
  likes_count: integer("likes_count"),
  comments_count: integer("comments_count"),
  published_at: timestamp("published_at"),
  audio_title: varchar("audio_title", { length: 255 }),
  audio_artist: varchar("audio_artist", { length: 255 }),
  thumbnail_url: text("thumbnail_url"),
  video_download_url: text("video_download_url"),
  raw_data: jsonb("raw_data"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const parsingRunsTable = pgTable("parsing_runs", {
  id: serial("id").primaryKey(),
  run_id: uuid("run_id").notNull().unique(),
  project_id: integer("project_id").references(() => projectsTable.id, {
    onDelete: "set null",
  }), // или cascade, если нужно удалять логи при удалении проекта
  source_type: varchar("source_type", { length: 50 }), // e.g., 'competitor', 'hashtag', 'overall'
  source_id: integer("source_id"), // FK to competitorsTable.id or hashtagsTable.id, or null if 'overall'
  status: varchar("status", { length: 50 }).notNull(), // e.g., 'started', 'running', 'completed', 'failed'
  started_at: timestamp("started_at").defaultNow().notNull(),
  ended_at: timestamp("ended_at"),
  reels_found_count: integer("reels_found_count").default(0).notNull(),
  reels_added_count: integer("reels_added_count").default(0).notNull(),
  errors_count: integer("errors_count").default(0).notNull(),
  log_message: text("log_message"),
  error_details: jsonb("error_details"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
