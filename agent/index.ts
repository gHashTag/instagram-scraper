/**
 * Instagram Scraper - функциональность скрапинга Instagram Reels
 *
 * Отвечает за:
 * - Скрапинг Reels с аккаунтов конкурентов и хэштегов
 * - Фильтрацию контента по просмотрам и дате публикации
 * - Преобразование данных для сохранения в базу данных
 */

// Экспорт функций скрапинга
export { scrapeInstagramReels } from "./instagram-scraper"
export type { ScrapeOptions } from "./instagram-scraper"

// Экспорт функций работы с хранилищем данных
export {
  initializeNeonStorage,
  closeNeonStorage,
  createUser,
  createProject,
  addCompetitorAccount,
  addTrackingHashtag,
  saveReels,
} from "../storage/neonStorage-multitenant"

// Дополнительные типы, которые должны быть экспортированы
export interface ContentSource {
  id: number
  reels_id: number
  source_type: "competitor" | "hashtag"
  competitor_id?: number
  hashtag_id?: number
  project_id: number
  created_at?: Date
}

export interface UserContentInteraction {
  id: number
  user_id: number
  reels_id: number
  is_favorite?: boolean
  is_hidden?: boolean
  notes?: string
  created_at?: Date
  updated_at?: Date
}

/**
 * Конвертирует InstagramReelRaw в формат Reel для сохранения в базу данных
 * @param reelRaw Данные Reel от скрапера
 * @param projectId ID проекта, к которому относится Reel
 * @param sourceType Тип источника (competitor/hashtag)
 * @param sourceId ID источника (конкурента или хэштега)
 * @returns Объект для сохранения в базу данных
 */
export function convertToStorageReel(
  reelRaw: any,
  projectId: number,
  sourceType: "competitor" | "hashtag",
  sourceId: number
) {
  return {
    project_id: projectId,
    source_type: sourceType,
    source_id: sourceId,
    reels_url: reelRaw.url,
    publication_date: reelRaw.publishedAt
      ? new Date(reelRaw.publishedAt)
      : new Date(),
    views_count: reelRaw.viewCount || 0,
    likes_count: reelRaw.likeCount,
    comments_count: reelRaw.commentCount,
    description: reelRaw.description,
    author_username: reelRaw.ownerUsername,
    author_id: reelRaw.ownerId,
    audio_title: reelRaw.audioTitle,
    audio_artist: reelRaw.audioArtist,
    parsed_at: new Date(),
    updated_at: new Date(),
  }
}
