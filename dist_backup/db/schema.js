import { sql } from "drizzle-orm";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("Users", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    telegram_id: text("telegram_id").notNull().unique(),
    username: text("username"),
    first_name: text("first_name"),
    last_name: text("last_name"),
    created_at: text("created_at").default(sql `(datetime('now'))`),
});
export const projects = sqliteTable("Projects", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    user_id: integer("user_id")
        .notNull()
        .references(() => users.id),
    name: text("name").notNull(),
    description: text("description"),
    is_active: integer("is_active", { mode: "boolean" }).default(true),
    created_at: text("created_at").default(sql `(datetime('now'))`),
});
export const competitors = sqliteTable("Competitors", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    project_id: integer("project_id")
        .notNull()
        .references(() => projects.id),
    username: text("username").notNull(),
    full_name: text("full_name"),
    profile_url: text("profile_url"),
    is_active: integer("is_active", { mode: "boolean" }).default(true),
    created_at: text("created_at").default(sql `(datetime('now'))`),
});
export const hashtags = sqliteTable("Hashtags", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    project_id: integer("project_id")
        .notNull()
        .references(() => projects.id),
    name: text("name").notNull(),
    is_active: integer("is_active", { mode: "boolean" }).default(true),
    created_at: text("created_at").default(sql `(datetime('now'))`),
});
export const reelsContent = sqliteTable("ReelsContent", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    project_id: integer("project_id")
        .notNull()
        .references(() => projects.id),
    source_type: text("source_type").notNull(),
    source_id: integer("source_id").notNull(),
    instagram_id: text("instagram_id").notNull().unique(),
    url: text("url").notNull(),
    caption: text("caption"),
    owner_username: text("owner_username"),
    owner_id: text("owner_id"),
    view_count: integer("view_count").default(0),
    like_count: integer("like_count").default(0),
    comment_count: integer("comment_count").default(0),
    duration: integer("duration"),
    thumbnail_url: text("thumbnail_url"),
    audio_title: text("audio_title"),
    published_at: text("published_at").notNull(),
    fetched_at: text("fetched_at").default(sql `(datetime('now'))`),
    is_processed: integer("is_processed", { mode: "boolean" }).default(false),
    processing_status: text("processing_status"),
    processing_result: text("processing_result"),
});
