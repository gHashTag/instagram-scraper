import { ReelContent, ParsingRunLog } from "../schemas";
import { StorageAdapter } from "../types";
import { logger } from "../logger";

/**
 * Интерфейс для опций скрапинга
 */
export interface ScraperOptions {
  maxReels?: number;
  minViews?: number;
  maxDaysOld?: number;
}

/**
 * Сервис-имитатор скрапинга Instagram Reels
 * Используется для тестирования функционала скрапинга без реального доступа к API
 */
export class MockScraperService {
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  /**
   * Имитирует скрапинг Reels конкурента
   * @param projectId ID проекта
   * @param competitorId ID конкурента
   * @param options Опции скрапинга
   * @returns Количество сохраненных Reels
   */
  async scrapeCompetitorReels(
    projectId: number,
    competitorId: number,
    options: ScraperOptions = {}
  ): Promise<number> {
    logger.info(`[MockScraperService] Scraping competitor reels for competitor ID: ${competitorId}`);
    
    try {
      // Получаем информацию о конкуренте
      const competitors = await this.storage.getCompetitorAccounts(projectId);
      const competitor = competitors.find(c => c.id === competitorId);
      
      if (!competitor) {
        throw new Error(`Competitor with ID ${competitorId} not found`);
      }
      
      // Создаем лог запуска парсинга
      const runId = this.generateUUID();
      const parsingLog: Partial<ParsingRunLog> = {
        run_id: runId,
        project_id: projectId,
        source_type: "competitor",
        source_id: competitorId.toString(),
        status: "running",
        started_at: new Date().toISOString(),
      };
      
      await this.storage.logParsingRun(parsingLog);
      
      // Генерируем моковые данные Reels
      const mockReels = this.generateMockReels(
        projectId,
        "competitor",
        competitorId.toString(),
        competitor.username,
        options.maxReels || 10
      );
      
      // Сохраняем Reels в базу данных
      const savedCount = await this.storage.saveReels(
        mockReels,
        projectId,
        "competitor",
        competitorId
      );
      
      // Обновляем лог запуска парсинга
      const updatedLog: Partial<ParsingRunLog> = {
        run_id: runId,
        status: "completed",
        ended_at: new Date().toISOString(),
        reels_found_count: mockReels.length,
        reels_added_count: savedCount,
      };
      
      await this.storage.logParsingRun(updatedLog);
      
      logger.info(`[MockScraperService] Saved ${savedCount} reels for competitor ${competitor.username}`);
      
      return savedCount;
    } catch (error) {
      logger.error(`[MockScraperService] Error scraping competitor reels:`, error);
      throw error;
    }
  }

  /**
   * Имитирует скрапинг Reels по хештегу
   * @param projectId ID проекта
   * @param hashtagId ID хештега
   * @param options Опции скрапинга
   * @returns Количество сохраненных Reels
   */
  async scrapeHashtagReels(
    projectId: number,
    hashtagId: number,
    options: ScraperOptions = {}
  ): Promise<number> {
    logger.info(`[MockScraperService] Scraping hashtag reels for hashtag ID: ${hashtagId}`);
    
    try {
      // Получаем информацию о хештеге
      const hashtags = await this.storage.getHashtagsByProjectId(projectId);
      const hashtag = hashtags?.find(h => h.id === hashtagId);
      
      if (!hashtag) {
        throw new Error(`Hashtag with ID ${hashtagId} not found`);
      }
      
      // Создаем лог запуска парсинга
      const runId = this.generateUUID();
      const parsingLog: Partial<ParsingRunLog> = {
        run_id: runId,
        project_id: projectId,
        source_type: "hashtag",
        source_id: hashtagId.toString(),
        status: "running",
        started_at: new Date().toISOString(),
      };
      
      await this.storage.logParsingRun(parsingLog);
      
      // Генерируем моковые данные Reels
      const mockReels = this.generateMockReels(
        projectId,
        "hashtag",
        hashtagId.toString(),
        hashtag.hashtag,
        options.maxReels || 10
      );
      
      // Сохраняем Reels в базу данных
      const savedCount = await this.storage.saveReels(
        mockReels,
        projectId,
        "hashtag",
        hashtagId
      );
      
      // Обновляем лог запуска парсинга
      const updatedLog: Partial<ParsingRunLog> = {
        run_id: runId,
        status: "completed",
        ended_at: new Date().toISOString(),
        reels_found_count: mockReels.length,
        reels_added_count: savedCount,
      };
      
      await this.storage.logParsingRun(updatedLog);
      
      logger.info(`[MockScraperService] Saved ${savedCount} reels for hashtag #${hashtag.hashtag}`);
      
      return savedCount;
    } catch (error) {
      logger.error(`[MockScraperService] Error scraping hashtag reels:`, error);
      throw error;
    }
  }

  /**
   * Генерирует моковые данные Reels
   * @param projectId ID проекта
   * @param sourceType Тип источника (competitor или hashtag)
   * @param sourceId ID источника
   * @param sourceName Имя источника (имя пользователя или хештег)
   * @param count Количество Reels для генерации
   * @returns Массив моковых Reels
   */
  private generateMockReels(
    projectId: number,
    sourceType: "competitor" | "hashtag",
    sourceId: string,
    sourceName: string,
    count: number
  ): Partial<ReelContent>[] {
    const reels: Partial<ReelContent>[] = [];
    
    for (let i = 0; i < count; i++) {
      const publishedDate = new Date();
      publishedDate.setDate(publishedDate.getDate() - Math.floor(Math.random() * 30)); // Случайная дата в пределах 30 дней
      
      const reel: Partial<ReelContent> = {
        project_id: projectId,
        source_type: sourceType,
        source_id: sourceId,
        instagram_id: `reel_${this.generateUUID().substring(0, 8)}`,
        url: `https://www.instagram.com/reel/mock_${i}_${sourceName.replace(/[^a-zA-Z0-9]/g, "")}`,
        caption: this.generateMockCaption(sourceName, i),
        author_username: sourceType === "competitor" ? sourceName : `user_${Math.floor(Math.random() * 1000)}`,
        author_id: `author_${Math.floor(Math.random() * 10000)}`,
        views: Math.floor(Math.random() * 10000) + 100,
        likes: Math.floor(Math.random() * 1000) + 10,
        comments_count: Math.floor(Math.random() * 100),
        duration: Math.floor(Math.random() * 60) + 10,
        thumbnail_url: `https://example.com/thumbnails/mock_${i}_${sourceName.replace(/[^a-zA-Z0-9]/g, "")}.jpg`,
        music_title: this.generateMockMusicTitle(),
        published_at: publishedDate.toISOString(),
        fetched_at: new Date().toISOString(),
        is_processed: false,
      };
      
      reels.push(reel);
    }
    
    return reels;
  }

  /**
   * Генерирует моковый текст описания Reel
   * @param sourceName Имя источника
   * @param index Индекс Reel
   * @returns Текст описания
   */
  private generateMockCaption(sourceName: string, index: number): string {
    const captions = [
      `Новый контент от ${sourceName}! #reels #instagram #trending`,
      `Смотрите наш новый ролик! 🔥 #viral #content #${sourceName}`,
      `Делимся секретами успеха! 💪 #motivation #success #tips`,
      `Закулисье нашей работы 👀 #behindthescenes #work #process`,
      `Специально для наших подписчиков! ❤️ #followers #special #exclusive`,
    ];
    
    return captions[index % captions.length];
  }

  /**
   * Генерирует моковое название музыки для Reel
   * @returns Название музыки
   */
  private generateMockMusicTitle(): string {
    const artists = ["Artist One", "Popular Singer", "Music Band", "DJ Cool", "Famous Rapper"];
    const titles = ["Summer Hit", "Viral Sound", "Trending Track", "Popular Song", "New Release"];
    
    const artist = artists[Math.floor(Math.random() * artists.length)];
    const title = titles[Math.floor(Math.random() * titles.length)];
    
    return `${artist} - ${title}`;
  }

  /**
   * Генерирует UUID
   * @returns UUID строка
   */
  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }
}

export default MockScraperService;
