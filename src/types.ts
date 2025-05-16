import { Context as TelegrafContext, Scenes } from "telegraf";
import {
  User,
  Project,
  Competitor,
  Hashtag,
  ReelContent,
  ReelsFilter,
  ParsingRunLog,
  NotificationSettings,
  ReelsCollection
} from "./schemas";

// Реэкспортируем типы для обратной совместимости
export type {
  User,
  Project,
  Competitor,
  Hashtag,
  ReelContent,
  ReelsFilter,
  ParsingRunLog,
  NotificationSettings,
  ReelsCollection
};

// Базовый интерфейс для контекста Telegraf с добавлением поддержки сцен
export interface ScraperBotContext extends TelegrafContext {
  storage: StorageAdapter;
  config: InstagramScraperBotConfig;
  scraperConfig?: InstagramScraperBotConfig;
  // Добавляем session для поддержки сессии в контексте
  session?: Scenes.SceneSession<ScraperSceneSessionData> & {
    user?: User;
    [key: string]: any;
  };
  // Возвращаем тип к SceneContextScene, который включает и контекст, и сессию
  scene: Scenes.SceneContextScene<ScraperBotContext, ScraperSceneSessionData>;
  match?: RegExpExecArray | null;
}

// Адаптер для хранения данных
export interface StorageAdapter {
  initialize(): Promise<void>;
  close(): Promise<void>;
  getUserByTelegramId(telegramId: number): Promise<User | null>;
  createUser(
    telegramId: number,
    username?: string,
    firstName?: string,
    lastName?: string
  ): Promise<User>;
  findUserByTelegramIdOrCreate(
    telegramId: number,
    username?: string,
    firstName?: string,
    lastName?: string
  ): Promise<User>;
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
  getCompetitorsByProjectId?(projectId: number): Promise<Competitor[]>; // Опциональный метод для обратной совместимости
  deleteCompetitorAccount(
    projectId: number,
    username: string
  ): Promise<boolean>;
  addHashtag(projectId: number, name: string): Promise<Hashtag | null>;
  getTrackingHashtags(
    projectId: number,
    activeOnly?: boolean
  ): Promise<Hashtag[]>;
  getHashtagsByProjectId(projectId: number): Promise<Hashtag[] | null>;
  removeHashtag(projectId: number, hashtag: string): Promise<void>;
  getReelsByCompetitorId(
    competitorId: number,
    filter: any
  ): Promise<any[]>;
  // Метод для получения Reels по ID проекта (используется в тестах)
  getReelsByProjectId?(projectId: number, filter?: any): Promise<ReelContent[]>;
  saveReels(
    reels: Partial<ReelContent>[],
    projectId: number,
    sourceType: string,
    sourceId: string | number
  ): Promise<number>;
  getReels(filter?: ReelsFilter): Promise<ReelContent[]>;
  // Методы для работы с Reels
  getReelById?(reelId: string): Promise<ReelContent | null>;
  getReelsCount?(filter?: ReelsFilter): Promise<number>;
  getReelsByProjectId?(projectId: number, filter?: ReelsFilter): Promise<ReelContent[]>;
  getReelsByHashtagId?(hashtagId: number, filter?: ReelsFilter): Promise<ReelContent[]>;

  logParsingRun(log: Partial<ParsingRunLog>): Promise<ParsingRunLog>;
  // Алиас для logParsingRun (используется в тестах)
  createParsingLog?(log: Partial<ParsingRunLog>): Promise<ParsingRunLog>;
  // Алиас для обновления лога парсинга (используется в тестах)
  updateParsingLog?(log: Partial<ParsingRunLog>): Promise<ParsingRunLog>;
  getParsingRunLogs(
    targetType: "competitor" | "hashtag",
    targetId: string
  ): Promise<ParsingRunLog[]>;
  // Метод для получения логов парсинга по ID проекта (используется в тестах)
  getParsingLogsByProjectId?(projectId: number): Promise<ParsingRunLog[]>;

  // Методы для работы с уведомлениями
  getNotificationSettings(userId: number): Promise<NotificationSettings | null>;
  saveNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings>;
  updateNotificationSettings(userId: number, settings: Partial<NotificationSettings>): Promise<NotificationSettings>;
  getUserById(userId: number): Promise<User | null>;
  getNewReels(projectId: number, afterDate: string): Promise<ReelContent[]>;

  // Методы для работы с маркетинговыми данными
  calculateMarketingData?(reel: ReelContent, averageFollowers?: number): Promise<ReelContent>;
  updateReelMarketingData?(reelId: number, marketingData: Partial<ReelContent>): Promise<ReelContent | null>;
  getReelsWithMarketingData?(filter?: ReelsFilter): Promise<ReelContent[]>;

  // Методы для работы с коллекциями Reels
  createReelsCollection?(projectId: number, name: string, description?: string, filter?: ReelsFilter, reelsIds?: string[]): Promise<ReelsCollection>;
  getReelsCollectionsByProjectId?(projectId: number): Promise<ReelsCollection[]>;
  getReelsCollectionById?(collectionId: number): Promise<ReelsCollection | null>;
  updateReelsCollection?(collectionId: number, data: Partial<ReelsCollection>): Promise<ReelsCollection | null>;
  deleteReelsCollection?(collectionId: number): Promise<boolean>;
  processReelsCollection?(collectionId: number, format: "text" | "csv" | "json"): Promise<ReelsCollection | null>;

  // Методы для работы с расшифровками видео
  updateReel?(reelId: string, data: Partial<ReelContent>): Promise<ReelContent | null>;
  getReelById?(reelId: string): Promise<ReelContent | null>;

  // Метод для выполнения произвольных SQL-запросов
  executeQuery(query: string, params?: any[]): Promise<any>;
  // TODO: Добавить остальные методы по мере необходимости
}

// Типы User, Project, Competitor, Hashtag и ReelContent теперь импортируются из ./schemas

// Конфигурация для бота
export interface InstagramScraperBotConfig {
  apifyClientToken?: string; // Made optional as it might not always be configured
  telegramBotToken: string;
  webhookDomain?: string;
  // TODO: Добавить другие необходимые параметры конфигурации
}

// Шаги сцены
export enum ScraperSceneStep {
  PROJECT_LIST = "PROJECT_LIST", // Шаг для отображения списка проектов
  CREATE_PROJECT = "CREATE_PROJECT",
  PROJECT_MENU = "PROJECT_MENU",
  COMPETITOR_LIST = "COMPETITOR_LIST", // Добавлен для сцены конкурентов
  ADD_COMPETITOR = "ADD_COMPETITOR", // Добавлен для сцены конкурентов
  DELETE_COMPETITOR = "DELETE_COMPETITOR", // Добавлен для сцены конкурентов
  HASHTAG_LIST = "HASHTAG_LIST", // Добавлен для сцены хештегов
  ADD_HASHTAG = "ADD_HASHTAG", // Добавлен для сцены хештегов
  SCRAPING_MENU = "SCRAPING_MENU", // Добавлен для сцены скрапинга
  SCRAPING_COMPETITORS = "SCRAPING_COMPETITORS", // Добавлен для сцены скрапинга
  SCRAPING_HASHTAGS = "SCRAPING_HASHTAGS", // Добавлен для сцены скрапинга
  SCRAPING_PROGRESS = "SCRAPING_PROGRESS", // Добавлен для сцены скрапинга
  SCRAPING_RESULTS = "SCRAPING_RESULTS", // Добавлен для сцены скрапинга
  REELS_LIST = "REELS_LIST", // Добавлен для сцены просмотра Reels
  REEL_DETAILS = "REEL_DETAILS", // Добавлен для сцены просмотра Reels
  REELS_FILTER = "REELS_FILTER", // Добавлен для сцены просмотра Reels
  REELS_ANALYTICS = "REELS_ANALYTICS", // Добавлен для сцены просмотра Reels
  NOTIFICATION_SETTINGS = "NOTIFICATION_SETTINGS", // Добавлен для сцены уведомлений
  NOTIFICATION_SCHEDULE = "NOTIFICATION_SCHEDULE", // Добавлен для сцены уведомлений
  REELS_COLLECTIONS = "REELS_COLLECTIONS", // Добавлен для сцены коллекций Reels
  CREATE_COLLECTION = "CREATE_COLLECTION", // Добавлен для сцены создания коллекции
  COLLECTION_DETAILS = "COLLECTION_DETAILS", // Добавлен для сцены просмотра коллекции
  EXPORT_COLLECTION = "EXPORT_COLLECTION", // Добавлен для сцены экспорта коллекции
  TRANSCRIBE_REEL = "TRANSCRIBE_REEL", // Добавлен для сцены расшифровки Reel
  EDIT_TRANSCRIPT = "EDIT_TRANSCRIPT", // Добавлен для сцены редактирования расшифровки
  CHATBOT = "CHATBOT", // Добавлен для сцены чат-бота
  CHATBOT_REEL_LIST = "CHATBOT_REEL_LIST" // Добавлен для сцены выбора Reel для чат-бота
}

// Тип ScraperSceneSessionData теперь импортируется из ./schemas
// Но мы расширяем его для совместимости с Telegraf
export interface ScraperSceneSessionData extends Scenes.SceneSessionData {
  step?: ScraperSceneStep;
  currentProjectId?: number;
  currentCompetitorId?: number;
  messageIdToEdit?: number;
  projectId?: number;
  user?: User;
  // Поля для сцены просмотра Reels
  currentReelId?: string;
  currentSourceType?: "competitor" | "hashtag";
  currentSourceId?: string | number;
  reelsFilter?: ReelsFilter;
  reelsPage?: number;
  reelsPerPage?: number;
  // Поля для сцены коллекций Reels
  currentCollectionId?: number;
  collectionName?: string;
  collectionDescription?: string;
  selectedReelsIds?: string[];
  contentFormat?: "text" | "csv" | "json";
  contentData?: string;

  // Поля для сцены расшифровки Reels
  transcriptLanguage?: string;
  transcriptText?: string;
  transcriptEdited?: boolean;
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

// Типы ReelsFilter и ParsingRunLog теперь импортируются из ./schemas

// Для использования в index.ts вместо any для Telegraf
// export type BotType = Telegraf<ScraperBotContext>;

export {}; // Если есть другие файлы, которые только экспортируют типы, это может не понадобиться
