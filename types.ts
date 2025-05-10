import { Context, Scenes } from "telegraf"
import type { Update } from "telegraf/types"
import { NeonStorageAdapter } from "./storage/neon-adapter"

/**
 * Расширение типов сеанса сцены Telegraf
 */
export interface ScraperSceneSessionData extends Scenes.SceneSessionData {
  step?: ScraperSceneStep
  projectId?: number
  competitorId?: number
  hashtagId?: number
  userInput?: {
    projectName?: string
    competitorUrl?: string
    hashtagName?: string
  }
}

/**
 * Конфигурация для модуля Instagram Scraper Bot
 */
export interface InstagramScraperBotConfig {
  token: string
  apifyToken: string
  dbUrl: string
  adminIds?: number[]
  logLevel?: "info" | "error" | "warn" | "debug" | "verbose"
}

/**
 * Пользователь системы
 */
export interface User {
  id: number
  telegram_id: string
  username?: string
  first_name?: string
  last_name?: string
  created_at: string
}

/**
 * Проект для мониторинга Instagram Reels
 */
export interface Project {
  id: number
  user_id: number
  name: string
  description?: string
  is_active: boolean
  created_at: string
}

/**
 * Конкурент (Instagram аккаунт) для мониторинга
 */
export interface Competitor {
  id: number
  project_id: number
  username: string
  full_name?: string
  profile_url?: string
  is_active: boolean
  created_at: string
}

/**
 * Хэштег для мониторинга
 */
export interface Hashtag {
  id: number
  project_id: number
  name: string
  is_active: boolean
  created_at: string
}

/**
 * Контент из Instagram Reels
 */
export interface ReelContent {
  id: number
  project_id: number
  source_type: "competitor" | "hashtag"
  source_id: number
  instagram_id: string
  url: string
  caption?: string
  owner_username?: string
  owner_id?: string
  view_count: number
  like_count: number
  comment_count: number
  duration?: number
  thumbnail_url?: string
  audio_title?: string
  published_at: string
  fetched_at: string
  is_processed: boolean
  processing_status?: string
  processing_result?: string
}

/**
 * Фильтр для получения Reels
 */
export interface ReelsFilter {
  sourceType?: "competitor" | "hashtag"
  sourceId?: number
  minViews?: number
  afterDate?: string
  beforeDate?: string
  orderBy?: string
  orderDirection?: "ASC" | "DESC"
  limit?: number
  offset?: number
}

/**
 * Интерфейс хранилища данных (Storage Adapter)
 */
export interface StorageAdapter {
  connect(): Promise<void>
  disconnect(): Promise<void>

  // Проекты
  getProjects(userId: number): Promise<Project[]>
  getProject(projectId: number): Promise<Project | null>
  createProject(
    userId: number,
    name: string,
    description?: string
  ): Promise<Project>

  // Конкуренты
  getCompetitors(projectId: number): Promise<Competitor[]>
  addCompetitor(
    projectId: number,
    username: string,
    fullName?: string,
    profileUrl?: string
  ): Promise<Competitor>

  // Хэштеги
  getHashtags(projectId: number): Promise<Hashtag[]>
  addHashtag(projectId: number, name: string): Promise<Hashtag>

  // Reels контент
  saveReel(reel: Partial<ReelContent>): Promise<ReelContent>
  getReels(projectId: number, filter?: ReelsFilter): Promise<ReelContent[]>
  updateReelProcessingStatus(
    reelId: number,
    isProcessed: boolean,
    status?: string,
    result?: string
  ): Promise<void>
}

/**
 * Интерфейс для сервиса парсинга Instagram
 */
export interface InstagramScraperService {
  /**
   * Получение Reels из аккаунта конкурента
   * @param username Имя пользователя Instagram
   * @param options Дополнительные параметры
   */
  getReelsFromAccount(
    username: string,
    options?: ScraperOptions
  ): Promise<ScrapedReel[]>

  /**
   * Получение Reels по хэштегу
   * @param hashtag Хэштег (без символа #)
   * @param options Дополнительные параметры
   */
  getReelsByHashtag(
    hashtag: string,
    options?: ScraperOptions
  ): Promise<ScrapedReel[]>
}

/**
 * Настройки для парсера Instagram
 */
export interface ScraperOptions {
  maxResults?: number // Максимальное количество результатов
  minViews?: number // Минимальное количество просмотров
  maxDaysOld?: number // Максимальный возраст в днях
  proxyUrl?: string // URL прокси-сервера
  delayBetweenRequests?: number // Задержка между запросами (в мс)
}

/**
 * Результат парсинга Reel
 */
export interface ScrapedReel {
  instagram_id: string // Уникальный ID Reel в Instagram
  url: string // URL Reel
  caption?: string // Описание (подпись) к Reel
  owner_username: string // Имя пользователя-владельца
  owner_id?: string // ID пользователя-владельца
  view_count?: number // Количество просмотров
  like_count?: number // Количество лайков
  comment_count?: number // Количество комментариев
  duration?: number // Длительность в секундах
  thumbnail_url?: string // URL изображения-превью
  audio_title?: string // Название аудиодорожки
  published_at?: string // Дата публикации в формате ISO
}

/**
 * Reel из Instagram
 */
export interface Reel {
  id: number
  project_id: number
  source_type: "competitor" | "hashtag"
  source_id: number
  reels_url: string
  publication_date: Date
  views_count: number
  likes_count?: number
  comments_count?: number
  description?: string
  author_username?: string
  author_id?: string
  audio_title?: string
  audio_artist?: string
  parsed_at: Date
  updated_at: Date
}

/**
 * Расширение для ScraperBotContext с доп. полями
 */
export interface ScraperBotContextExtensions {
  storage?: NeonStorageAdapter
  scraperConfig?: InstagramScraperBotConfig
}

/**
 * Расширенный контекст Telegraf для модуля Instagram Scraper Bot
 */
export interface ScraperBotContext
  extends Context<Update>,
    ScraperBotContextExtensions {
  scene: Scenes.SceneContextScene<ScraperBotContext, ScraperSceneSessionData>
  session: any // Используем any для обхода ограничений типизации
}

/**
 * Возможные шаги сцены для взаимодействия с пользователем
 */
export enum ScraperSceneStep {
  SELECT_PROJECT = "SELECT_PROJECT",
  ENTER_PROJECT_NAME = "ENTER_PROJECT_NAME",
  ENTER_COMPETITOR_URL = "ENTER_COMPETITOR_URL",
  ENTER_HASHTAG_NAME = "ENTER_HASHTAG_NAME",
  ADD_PROJECT = "ADD_PROJECT",
  ADD_COMPETITOR = "ADD_COMPETITOR",
}

// Типы для парсинга Instagram
export interface InstagramScrapingOptions {
  apifyToken: string
  minViews: number
  maxAgeDays: number
}

// Конфигурация скрапера
export interface ScraperConfig {
  apifyToken: string
  minViews?: number
  maxAgeDays?: number
}

// Результат скрапинга Instagram
export interface InstagramReelRaw {
  url: string
  publishedAt?: string
  viewCount: number
  likeCount?: number
  commentCount?: number
  description?: string
  ownerUsername?: string
  ownerId?: string
  audioTitle?: string
  audioArtist?: string
  thumbnailUrl?: string
  durationSeconds?: number
  rawData?: Record<string, unknown>
}
