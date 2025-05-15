import { Context as TelegrafContext, Scenes } from "telegraf";
import {
  User,
  Project,
  Competitor,
  Hashtag,
  ReelContent,
  ReelsFilter,
  ParsingRunLog
} from "./schemas";

// Реэкспортируем типы для обратной совместимости
export type {
  User,
  Project,
  Competitor,
  Hashtag,
  ReelContent,
  ReelsFilter,
  ParsingRunLog
};

// Базовый интерфейс для контекста Telegraf с добавлением поддержки сцен
export interface ScraperBotContext extends TelegrafContext {
  storage: StorageAdapter;
  config: InstagramScraperBotConfig;
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
