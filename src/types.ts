import { Context as TelegrafContext, Scenes } from "telegraf";

// Placeholder for project types
export {};

// Базовый интерфейс для контекста Telegraf с добавлением поддержки сцен
export interface ScraperBotContext extends TelegrafContext {
  storage: StorageAdapter; // Используем интерфейс
  scraperConfig?: InstagramScraperBotConfig;
  // Возвращаем тип к SceneContextScene, который включает и контекст, и сессию
  scene: Scenes.SceneContextScene<ScraperBotContext, ScraperSceneSessionData>;
  match?: RegExpExecArray | null;
}

// Адаптер для хранения данных
export interface StorageAdapter {
  initialize(): Promise<void>;
  close(): Promise<void>;
  getUserByTelegramId(telegramId: number): Promise<User | null>;
  createUser(telegramId: number, username?: string): Promise<User>;
  getProjectsByUserId(userId: number): Promise<Project[]>;
  createProject(userId: number, name: string): Promise<Project>;
  getProjectById(projectId: number): Promise<Project | null>;
  addCompetitorAccount(
    projectId: number,
    username: string,
    instagramUrl: string
  ): Promise<Competitor | null>;
  getCompetitorAccounts(
    projectId: number,
    activeOnly?: boolean
  ): Promise<Competitor[]>;
  addHashtag(projectId: number, name: string): Promise<Hashtag | null>;
  getTrackingHashtags(
    projectId: number,
    activeOnly?: boolean
  ): Promise<Hashtag[]>;
  saveReels(
    reels: Partial<ReelContent>[],
    projectId: number,
    sourceType: string,
    sourceId: string | number
  ): Promise<number>;
  getReels(filter?: ReelsFilter): Promise<ReelContent[]>;
  logParsingRun(log: Partial<ParsingRunLog>): Promise<ParsingRunLog>;
  // TODO: Добавить остальные методы по мере необходимости
}

export interface User {
  id: number;
  telegram_id: number;
  username?: string;
  created_at: string;
  is_active: boolean;
  user_id?: number; // Сделал опциональным для упрощения моков
}

export interface Project {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  is_active: boolean;
}

export interface Competitor {
  id: number;
  project_id: number;
  username: string;
  instagram_url: string;
  created_at: string;
  is_active: boolean;
}

// Тип для хештега
export interface Hashtag {
  id: number;
  project_id: number;
  hashtag: string; // Сам хештег без #
  created_at: string; // Дата добавления
}

// Определяем ReelContent (ранее Reel, чтобы избежать конфликта с возможным Reel из telegraf)
export interface ReelContent {
  id?: number; // Сделал опциональным, т.к. при сохранении его еще нет
  instagram_id: string;
  url: string;
  caption?: string; // Было description, используется как caption в sqlite-adapter
  views?: number; // Было views, используется как view_count в sqlite-adapter
  likes?: number; // Было likes, используется как like_count в sqlite-adapter
  comments_count?: number; // Уже было comments_count
  published_at: string; // Или Date
  author_username?: string; // Уже было author_username, используется как owner_username в sqlite-adapter
  author_id?: string; // Было author_url, используется как owner_id (хотя там URL, тут ID)
  music_title?: string; // Уже было music_title, используется как audio_title в sqlite-adapter
  duration?: number; // Добавлено, используется в sqlite-adapter
  thumbnail_url?: string;
  project_id: number;
  source_type: "competitor" | "hashtag";
  source_id: string | number;
  created_at?: string;
}

export interface InstagramScraperBotConfig {
  // Пока пусто, добавим по мере необходимости
  apifyToken?: string;
}

// Шаги сцены
export enum ScraperSceneStep {
  PROJECT_LIST = "PROJECT_LIST", // Шаг для отображения списка проектов
  CREATE_PROJECT = "CREATE_PROJECT",
  COMPETITOR_LIST = "COMPETITOR_LIST", // Добавлен для сцены конкурентов
  ADD_COMPETITOR = "ADD_COMPETITOR", // Добавлен для сцены конкурентов
  DELETE_COMPETITOR = "DELETE_COMPETITOR", // Добавлен для сцены конкурентов
  HASHTAG_LIST = "HASHTAG_LIST", // Добавлен для сцены хештегов
  ADD_HASHTAG = "ADD_HASHTAG", // Добавлен для сцены хештегов
}

// Данные сессии для сцен
export interface ScraperSceneSessionData extends Scenes.SceneSessionData {
  step?: ScraperSceneStep;
  currentProjectId?: number; // ID текущего проекта для сцены
  currentCompetitorId?: number; // ID текущего конкурента
  messageIdToEdit?: number; // ID сообщения для редактирования (например, список)
  projectId?: number; // Добавлено для хранения ID проекта в сессии сцены
}

// Тип для MiddlewareFn, если он не импортируется из telegraf/types
// (Telegraf V4 использует `Middleware<TContext> `)
export type Middleware<TContext extends TelegrafContext> = (
  ctx: TContext,
  next: () => Promise<void>
) => Promise<void> | void;

// Используем Middleware<ScraperBotContext> вместо MiddlewareFn<any>
// Для stage.middleware()

// Этот тип был в ошибках, вероятно, связан с конкретной реализацией адаптера Neon
export interface NeonStorageAdapter extends StorageAdapter {
  // Специфичные методы для Neon, если они есть
}

// Типы для моков или данных скрейпинга
export interface InstagramReel {
  id: string; // или number
  url: string;
  shortCode?: string;
  caption?: string;
  displayUrl?: string;
  videoUrl?: string;
  viewCount?: number;
  likesCount?: number;
  commentsCount?: number;
  takenAtTimestamp?: number;
  ownerUsername?: string;
  ownerId?: string;
  [key: string]: any; // для дополнительных полей
}

export interface ScraperOptions {
  maxReels?: number; // maxResults в mock-apify-service, оставляю maxReels
  maxConcurrency?: number;
  delayBetweenRequests?: number; // Добавлено из mock-apify-service
  minViews?: number; // Добавлено из mock-apify-service
  maxDaysOld?: number; // Добавлено из mock-apify-service
  // ... другие опции
}

// Этот тип также был в ошибках, вероятно, результат работы скрейпера
export interface ScrapedReel extends InstagramReel {
  // Могут быть дополнительные поля после обработки
}

export interface ReelsFilter {
  projectId?: number;
  sourceType?: "competitor" | "hashtag";
  sourceId?: string | number;
  minViews?: number;
  maxAgeDays?: number; // Максимальный возраст публикации в днях
  afterDate?: string; // ISO Timestamp, reels опубликованные после этой даты
  beforeDate?: string; // ISO Timestamp, reels опубликованные до этой даты
  limit?: number;
  offset?: number;
  orderBy?: string; // Поле для сортировки (например, 'published_at', 'views')
  orderDirection?: "ASC" | "DESC";
  is_processed?: boolean; // Добавлено для фильтрации по статусу обработки
}

export interface ParsingRunLog {
  id?: string; // Уникальный ID записи лога (может быть UUID или автоинкремент)
  run_id: string; // Уникальный ID конкретного запуска парсинга (например, UUID)
  project_id: number;
  source_type: "competitor" | "hashtag";
  source_id: string | number; // ID конкурента или хэштега (может быть числом или строкой, если это username)
  status: "running" | "completed" | "failed" | "partial_success";
  started_at: string; // ISO Timestamp
  ended_at?: string; // ISO Timestamp
  reels_found_count?: number; // Опционально
  reels_added_count?: number; // Опционально
  errors_count?: number; // Опционально
  error_message?: string;
}

// Для использования в index.ts вместо any для Telegraf
// export type BotType = Telegraf<ScraperBotContext>;

export {}; // Если есть другие файлы, которые только экспортируют типы, это может не понадобиться
