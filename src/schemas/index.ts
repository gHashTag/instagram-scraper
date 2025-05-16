import { z } from "zod";

/**
 * Схема для пользователя
 */
export const UserSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(val =>
    typeof val === 'string' ? parseInt(val, 10) : val
  ),
  telegram_id: z.number(),
  username: z.string().nullable(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  created_at: z.union([z.string(), z.date()]).transform(val =>
    val instanceof Date ? val.toISOString() : val
  ),
  is_active: z.boolean().optional().default(true),
});

/**
 * Тип пользователя, выведенный из схемы Zod
 */
export type User = z.infer<typeof UserSchema>;

/**
 * Схема для проекта
 */
export const ProjectSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(val =>
    typeof val === 'string' ? parseInt(val, 10) : val
  ),
  user_id: z.union([z.number(), z.string()]),
  name: z.string(),
  description: z.string().nullable().optional(),
  created_at: z.union([z.string(), z.date()]).transform(val =>
    val instanceof Date ? val.toISOString() : val
  ),
  is_active: z.boolean().optional().default(true),
});

/**
 * Тип проекта, выведенный из схемы Zod
 */
export type Project = {
  id: number;
  user_id: string | number;
  name: string;
  description?: string | null;
  created_at: string;
  is_active: boolean;
};

/**
 * Схема для конкурента
 */
export const CompetitorSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  username: z.string(),
  instagram_url: z.string(),
  created_at: z.string(),
  is_active: z.boolean(),
});

/**
 * Тип конкурента, выведенный из схемы Zod
 */
export type Competitor = z.infer<typeof CompetitorSchema>;

/**
 * Схема для хештега
 */
export const HashtagSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  hashtag: z.string(),
  created_at: z.string(),
  is_active: z.boolean().optional(),
});

/**
 * Тип хештега, выведенный из схемы Zod
 */
export type Hashtag = z.infer<typeof HashtagSchema>;

/**
 * Схема для контента Reel
 */
export const ReelContentSchema = z.object({
  id: z.number().optional(),
  project_id: z.number(),
  source_type: z.enum(["competitor", "hashtag"]),
  source_id: z.string(),
  instagram_id: z.string(),
  url: z.string(),
  caption: z.string().nullable().optional(),
  author_username: z.string().nullable().optional(),
  author_id: z.string().nullable().optional(),
  views: z.number().optional(),
  likes: z.number().optional(),
  comments_count: z.number().optional(),
  duration: z.number().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  music_title: z.string().nullable().optional(),
  published_at: z.string(),
  fetched_at: z.string().optional(),
  is_processed: z.boolean().optional(),
  processing_status: z.string().nullable().optional(),
  processing_result: z.string().nullable().optional(),

  // Маркетинговые данные
  engagement_rate_video: z.number().nullable().optional(), // Коэффициент вовлеченности для видео
  engagement_rate_all: z.number().nullable().optional(), // Коэффициент вовлеченности для всех типов контента
  view_to_like_ratio: z.number().nullable().optional(), // Отношение просмотров к лайкам
  comments_to_likes_ratio: z.number().nullable().optional(), // Отношение комментариев к лайкам
  recency: z.number().nullable().optional(), // Свежесть поста
  marketing_score: z.number().nullable().optional(), // Общий балл поста
  days_since_published: z.number().nullable().optional(), // Количество дней с момента публикации

  // Данные расшифровки видео
  transcript: z.string().nullable().optional(), // Текстовая расшифровка видео
  transcript_status: z.enum(["pending", "processing", "completed", "failed"]).nullable().optional(), // Статус расшифровки
  transcript_updated_at: z.string().nullable().optional(), // Дата и время последнего обновления расшифровки
});

/**
 * Тип контента Reel, выведенный из схемы Zod
 */
export type ReelContent = z.infer<typeof ReelContentSchema>;

/**
 * Схема для фильтра Reels
 * Соответствует интерфейсу ReelsFilter из types.ts
 */
export const ReelsFilterSchema = z.object({
  projectId: z.number().optional(),
  sourceType: z.enum(["competitor", "hashtag"]).optional(),
  sourceId: z.union([z.string(), z.number()]).optional(),
  minViews: z.number().optional(),
  maxAgeDays: z.number().optional(), // Максимальный возраст публикации в днях
  afterDate: z.string().optional(), // ISO Timestamp, reels опубликованные после этой даты
  beforeDate: z.string().optional(), // ISO Timestamp, reels опубликованные до этой даты
  limit: z.number().optional(),
  offset: z.number().optional(),
  orderBy: z.string().optional(), // Поле для сортировки (например, 'published_at', 'views')
  orderDirection: z.enum(["ASC", "DESC"]).optional(),
  is_processed: z.boolean().optional(), // Для фильтрации по статусу обработки
});

/**
 * Тип фильтра Reels, выведенный из схемы Zod
 */
export type ReelsFilter = z.infer<typeof ReelsFilterSchema>;

/**
 * Схема для лога запуска парсинга
 * Соответствует интерфейсу ParsingRunLog из types.ts
 */
export const ParsingRunLogSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(), // Может быть UUID или автоинкремент
  run_id: z.string(), // Уникальный ID конкретного запуска парсинга (например, UUID)
  project_id: z.number(),
  source_type: z.enum(["competitor", "hashtag"]),
  source_id: z.union([z.string(), z.number()]), // ID конкурента или хэштега
  status: z.enum(["running", "completed", "failed", "partial_success"]),
  error_message: z.string().nullable().optional(),
  started_at: z.string(), // ISO Timestamp
  ended_at: z.string().nullable().optional(), // ISO Timestamp
  reels_found_count: z.number().optional(),
  reels_added_count: z.number().optional(),
  errors_count: z.number().optional(),
});

/**
 * Тип лога запуска парсинга, выведенный из схемы Zod
 */
export type ParsingRunLog = z.infer<typeof ParsingRunLogSchema>;

/**
 * Схема для данных сессии сцены
 * Соответствует интерфейсу ScraperSceneSessionData из types.ts
 */
export const ScraperSceneSessionDataSchema = z.object({
  // Используем z.enum для шага сцены, чтобы соответствовать ScraperSceneStep
  step: z.enum([
    "PROJECT_LIST",
    "CREATE_PROJECT",
    "PROJECT_MENU",
    "COMPETITOR_LIST",
    "ADD_COMPETITOR",
    "DELETE_COMPETITOR",
    "HASHTAG_LIST",
    "ADD_HASHTAG",
    "SCRAPING_MENU",
    "SCRAPING_COMPETITORS",
    "SCRAPING_HASHTAGS",
    "SCRAPING_PROGRESS",
    "SCRAPING_RESULTS",
    "REELS_LIST",
    "REEL_DETAILS",
    "REELS_FILTER",
    "REELS_ANALYTICS",
    "NOTIFICATION_SETTINGS",
    "NOTIFICATION_SCHEDULE",
    "REELS_COLLECTIONS",
    "CREATE_COLLECTION",
    "COLLECTION_DETAILS",
    "EXPORT_COLLECTION",
    "TRANSCRIBE_REEL",
    "EDIT_TRANSCRIPT",
    "CHATBOT",
    "CHATBOT_REEL_LIST"
  ]).optional(),
  currentProjectId: z.number().optional(),
  currentCompetitorId: z.number().optional(),
  messageIdToEdit: z.number().optional(),
  projectId: z.number().optional(),
  user: z.lazy(() => UserSchema.optional()),
  // Поля для сцены просмотра Reels
  currentReelId: z.string().optional(),
  currentSourceType: z.enum(["competitor", "hashtag"]).optional(),
  currentSourceId: z.union([z.string(), z.number()]).optional(),
  reelsFilter: z.lazy(() => ReelsFilterSchema.optional()),
  reelsPage: z.number().optional(),
  reelsPerPage: z.number().optional(),
  // Поля для сцены коллекций Reels
  currentCollectionId: z.number().optional(),
  collectionName: z.string().optional(),
  collectionDescription: z.string().optional(),
  selectedReelsIds: z.array(z.string()).optional(),
  contentFormat: z.enum(["text", "csv", "json"]).optional(),
  contentData: z.string().optional(),

  // Поля для сцены расшифровки Reels
  transcriptLanguage: z.string().optional(),
  transcriptText: z.string().optional(),
  transcriptEdited: z.boolean().optional(),
});

/**
 * Тип данных сессии сцены, выведенный из схемы Zod
 * Примечание: Этот тип используется только для валидации данных.
 * Для типизации в Telegraf используется интерфейс ScraperSceneSessionData из types.ts
 */
export type ScraperSceneSessionDataType = z.infer<typeof ScraperSceneSessionDataSchema>;

/**
 * Схема для настроек уведомлений
 */
export const NotificationSettingsSchema = z.object({
  id: z.number().optional(),
  user_id: z.number(),
  new_reels_enabled: z.boolean().default(true),
  trends_enabled: z.boolean().default(true),
  weekly_report_enabled: z.boolean().default(true),
  min_views_threshold: z.number().default(1000),
  notification_time: z.string().default("09:00"), // Время для отправки уведомлений в формате "HH:MM"
  notification_days: z.array(z.number()).default([1, 2, 3, 4, 5, 6, 7]), // Дни недели для отправки уведомлений (1-7, где 1 - понедельник)
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/**
 * Тип настроек уведомлений, выведенный из схемы Zod
 */
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;

/**
 * Схема для коллекции Reels
 */
export const ReelsCollectionSchema = z.object({
  id: z.number().optional(),
  project_id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  filter: z.lazy(() => ReelsFilterSchema.optional()),
  reels_ids: z.array(z.string()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  is_processed: z.boolean().default(false),
  processing_status: z.string().nullable().optional(),
  processing_result: z.string().nullable().optional(),
  content_format: z.enum(["text", "csv", "json"]).optional(),
  content_data: z.string().nullable().optional(),
});

/**
 * Тип коллекции Reels, выведенный из схемы Zod
 */
export type ReelsCollection = z.infer<typeof ReelsCollectionSchema>;
