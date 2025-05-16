import { ReelContent, ReelsCollection, ReelsFilter } from "../schemas";
import { StorageAdapter } from "../types";
import { logger } from "../logger";
import { MarketingAnalyticsService } from "./marketing-analytics-service";

/**
 * Сервис для работы с коллекциями Reels
 */
export class ReelsCollectionService {
  private storage: StorageAdapter;
  private marketingService: MarketingAnalyticsService;

  /**
   * Конструктор сервиса
   * @param storage Адаптер хранилища
   */
  constructor(storage: StorageAdapter) {
    this.storage = storage;
    this.marketingService = new MarketingAnalyticsService();
  }

  /**
   * Создание новой коллекции Reels
   * @param projectId ID проекта
   * @param name Название коллекции
   * @param description Описание коллекции
   * @param filter Фильтр для Reels
   * @param reelsIds Массив ID Reels для добавления в коллекцию
   * @returns Созданная коллекция
   */
  async createCollection(
    projectId: number,
    name: string,
    description?: string,
    filter?: ReelsFilter,
    reelsIds?: string[]
  ): Promise<ReelsCollection> {
    try {
      if (!this.storage.createReelsCollection) {
        throw new Error("Метод createReelsCollection не реализован в адаптере хранилища");
      }

      return await this.storage.createReelsCollection(
        projectId,
        name,
        description,
        filter,
        reelsIds
      );
    } catch (error) {
      logger.error("[ReelsCollectionService] Ошибка при создании коллекции:", error);
      throw error;
    }
  }

  /**
   * Получение коллекций Reels для проекта
   * @param projectId ID проекта
   * @returns Массив коллекций
   */
  async getCollectionsByProjectId(projectId: number): Promise<ReelsCollection[]> {
    try {
      if (!this.storage.getReelsCollectionsByProjectId) {
        throw new Error("Метод getReelsCollectionsByProjectId не реализован в адаптере хранилища");
      }

      return await this.storage.getReelsCollectionsByProjectId(projectId);
    } catch (error) {
      logger.error("[ReelsCollectionService] Ошибка при получении коллекций:", error);
      return [];
    }
  }

  /**
   * Получение коллекции Reels по ID
   * @param collectionId ID коллекции
   * @returns Коллекция или null, если не найдена
   */
  async getCollectionById(collectionId: number): Promise<ReelsCollection | null> {
    try {
      if (!this.storage.getReelsCollectionById) {
        throw new Error("Метод getReelsCollectionById не реализован в адаптере хранилища");
      }

      return await this.storage.getReelsCollectionById(collectionId);
    } catch (error) {
      logger.error("[ReelsCollectionService] Ошибка при получении коллекции:", error);
      return null;
    }
  }

  /**
   * Обновление коллекции Reels
   * @param collectionId ID коллекции
   * @param data Данные для обновления
   * @returns Обновленная коллекция или null, если не найдена
   */
  async updateCollection(
    collectionId: number,
    data: Partial<ReelsCollection>
  ): Promise<ReelsCollection | null> {
    try {
      if (!this.storage.updateReelsCollection) {
        throw new Error("Метод updateReelsCollection не реализован в адаптере хранилища");
      }

      return await this.storage.updateReelsCollection(collectionId, data);
    } catch (error) {
      logger.error("[ReelsCollectionService] Ошибка при обновлении коллекции:", error);
      return null;
    }
  }

  /**
   * Удаление коллекции Reels
   * @param collectionId ID коллекции
   * @returns true, если коллекция успешно удалена, иначе false
   */
  async deleteCollection(collectionId: number): Promise<boolean> {
    try {
      if (!this.storage.deleteReelsCollection) {
        throw new Error("Метод deleteReelsCollection не реализован в адаптере хранилища");
      }

      return await this.storage.deleteReelsCollection(collectionId);
    } catch (error) {
      logger.error("[ReelsCollectionService] Ошибка при удалении коллекции:", error);
      return false;
    }
  }

  /**
   * Обработка коллекции Reels и создание контента в выбранном формате
   * @param collectionId ID коллекции
   * @param format Формат контента ("text", "csv" или "json")
   * @returns Обработанная коллекция или null, если не найдена
   */
  async processCollection(
    collectionId: number,
    format: "text" | "csv" | "json"
  ): Promise<ReelsCollection | null> {
    try {
      if (!this.storage.processReelsCollection) {
        throw new Error("Метод processReelsCollection не реализован в адаптере хранилища");
      }

      // Получаем коллекцию
      const collection = await this.getCollectionById(collectionId);
      if (!collection) {
        throw new Error(`Коллекция с ID ${collectionId} не найдена`);
      }

      // Получаем Reels для коллекции
      const reels = await this.getReelsForCollection(collection);
      if (reels.length === 0) {
        throw new Error(`Не найдены Reels для коллекции с ID ${collectionId}`);
      }

      // Обрабатываем Reels и создаем контент в выбранном формате
      const contentData = this.createContentForReels(reels, format);

      // Обновляем коллекцию
      const updatedCollection = await this.storage.updateReelsCollection(collectionId, {
        is_processed: true,
        processing_status: "completed",
        content_format: format,
        content_data: contentData,
        updated_at: new Date().toISOString()
      });

      return updatedCollection;
    } catch (error) {
      logger.error("[ReelsCollectionService] Ошибка при обработке коллекции:", error);
      
      // Обновляем статус коллекции в случае ошибки
      if (this.storage.updateReelsCollection) {
        await this.storage.updateReelsCollection(collectionId, {
          is_processed: true,
          processing_status: "failed",
          processing_result: error instanceof Error ? error.message : String(error),
          updated_at: new Date().toISOString()
        });
      }
      
      return null;
    }
  }

  /**
   * Получение Reels для коллекции
   * @param collection Коллекция
   * @returns Массив Reels
   */
  private async getReelsForCollection(collection: ReelsCollection): Promise<ReelContent[]> {
    try {
      // Если в коллекции есть конкретные ID Reels
      if (collection.reels_ids && collection.reels_ids.length > 0) {
        // TODO: Реализовать получение Reels по ID
        // Пока просто получаем все Reels для проекта
        return await this.storage.getReels({ projectId: collection.project_id });
      }

      // Если в коллекции есть фильтр
      if (collection.filter) {
        // Получаем Reels по фильтру
        return await this.storage.getReels({
          ...collection.filter,
          projectId: collection.project_id
        });
      }

      // Если нет ни ID, ни фильтра, получаем все Reels для проекта
      return await this.storage.getReels({ projectId: collection.project_id });
    } catch (error) {
      logger.error("[ReelsCollectionService] Ошибка при получении Reels для коллекции:", error);
      return [];
    }
  }

  /**
   * Создание контента для Reels в выбранном формате
   * @param reels Массив Reels
   * @param format Формат контента ("text", "csv" или "json")
   * @returns Контент в выбранном формате
   */
  private createContentForReels(reels: ReelContent[], format: "text" | "csv" | "json"): string {
    try {
      // Обрабатываем Reels и добавляем маркетинговые данные
      const processedReels = reels.map(reel => this.marketingService.calculateMarketingData(reel));

      // Создаем контент в выбранном формате
      switch (format) {
        case "text":
          return this.createTextContent(processedReels);
        case "csv":
          return this.createCsvContent(processedReels);
        case "json":
          return this.createJsonContent(processedReels);
        default:
          throw new Error(`Неподдерживаемый формат: ${format}`);
      }
    } catch (error) {
      logger.error("[ReelsCollectionService] Ошибка при создании контента для Reels:", error);
      throw error;
    }
  }

  /**
   * Создание текстового контента для Reels
   * @param reels Массив Reels
   * @returns Текстовый контент
   */
  private createTextContent(reels: ReelContent[]): string {
    let content = "# Отчет по Reels\n\n";

    // Добавляем информацию о каждом Reel
    reels.forEach((reel, index) => {
      content += `## Reel ${index + 1}\n`;
      content += `- URL: ${reel.url}\n`;
      content += `- Автор: ${reel.author_username || "Неизвестно"}\n`;
      content += `- Просмотры: ${reel.views || 0}\n`;
      content += `- Лайки: ${reel.likes || 0}\n`;
      content += `- Комментарии: ${reel.comments_count || 0}\n`;
      content += `- Дата публикации: ${new Date(reel.published_at).toLocaleDateString()}\n`;
      
      // Добавляем маркетинговые данные
      if (reel.engagement_rate_video !== undefined) {
        content += `- Коэффициент вовлеченности (видео): ${reel.engagement_rate_video.toFixed(2)}%\n`;
      }
      
      if (reel.engagement_rate_all !== undefined) {
        content += `- Коэффициент вовлеченности (общий): ${reel.engagement_rate_all.toFixed(2)}%\n`;
      }
      
      if (reel.view_to_like_ratio !== undefined) {
        content += `- Отношение просмотров к лайкам: ${reel.view_to_like_ratio.toFixed(2)}\n`;
      }
      
      if (reel.comments_to_likes_ratio !== undefined) {
        content += `- Отношение комментариев к лайкам: ${reel.comments_to_likes_ratio.toFixed(2)}\n`;
      }
      
      if (reel.marketing_score !== undefined) {
        content += `- Общий балл: ${reel.marketing_score.toFixed(2)}/10\n`;
      }
      
      content += `\n`;
    });

    return content;
  }

  /**
   * Создание CSV-контента для Reels
   * @param reels Массив Reels
   * @returns CSV-контент
   */
  private createCsvContent(reels: ReelContent[]): string {
    // Заголовки CSV
    const headers = [
      "URL",
      "Автор",
      "Просмотры",
      "Лайки",
      "Комментарии",
      "Дата публикации",
      "Коэффициент вовлеченности (видео)",
      "Коэффициент вовлеченности (общий)",
      "Отношение просмотров к лайкам",
      "Отношение комментариев к лайкам",
      "Общий балл"
    ];

    // Создаем строки CSV
    const rows = reels.map(reel => [
      reel.url,
      reel.author_username || "",
      reel.views || 0,
      reel.likes || 0,
      reel.comments_count || 0,
      new Date(reel.published_at).toLocaleDateString(),
      reel.engagement_rate_video !== undefined ? reel.engagement_rate_video.toFixed(2) : "",
      reel.engagement_rate_all !== undefined ? reel.engagement_rate_all.toFixed(2) : "",
      reel.view_to_like_ratio !== undefined ? reel.view_to_like_ratio.toFixed(2) : "",
      reel.comments_to_likes_ratio !== undefined ? reel.comments_to_likes_ratio.toFixed(2) : "",
      reel.marketing_score !== undefined ? reel.marketing_score.toFixed(2) : ""
    ]);

    // Объединяем заголовки и строки
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    return csvContent;
  }

  /**
   * Создание JSON-контента для Reels
   * @param reels Массив Reels
   * @returns JSON-контент
   */
  private createJsonContent(reels: ReelContent[]): string {
    // Создаем массив объектов с нужными полями
    const jsonData = reels.map(reel => ({
      url: reel.url,
      author: reel.author_username,
      views: reel.views,
      likes: reel.likes,
      comments: reel.comments_count,
      published_at: reel.published_at,
      engagement_rate_video: reel.engagement_rate_video,
      engagement_rate_all: reel.engagement_rate_all,
      view_to_like_ratio: reel.view_to_like_ratio,
      comments_to_likes_ratio: reel.comments_to_likes_ratio,
      marketing_score: reel.marketing_score
    }));

    return JSON.stringify(jsonData, null, 2);
  }
}
