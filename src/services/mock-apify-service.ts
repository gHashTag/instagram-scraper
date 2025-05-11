/**
 * Instagram Scraper Bot - Mock Apify Service
 *
 * Этот сервис имитирует работу с Apify API для тестирования и разработки
 * без использования реального API.
 */

import type { ScrapedReel, ScraperOptions } from "@/types"; // Добавлены импорты
// import { InstagramScraperService } from "../types" // Закомментировано

/**
 * Мок сервиса InstagramScraperService для использования в тестах.
 * Этот мок имитирует поведение реального сервиса, но возвращает предопределенные данные,
 * что позволяет тестировать логику без реальных вызовов API Apify.
 */
// export class MockApifyService implements InstagramScraperService { // implements закомментировано
export class MockInstagramScraperService /* implements InstagramScraperService */ {
  // implements закомментировано
  private defaultDelay: number = 500; // Задержка по умолчанию (мс)
  private mockReels: Map<string, any[]> = new Map(); // Мок-данные для аккаунтов
  private mockHashtags: Map<string, any[]> = new Map(); // Мок-данные для хэштегов
  // private reelsData: any[] = []; // Удаляем это неиспользуемое свойство
  public errorToThrow: Error | null = null;

  constructor() {
    console.log("📱 Mock Apify Service инициализирован");
    this.initializeMockData();
  }

  /**
   * Инициализация мок-данных
   */
  private initializeMockData(): void {
    // Мок-данные для аккаунтов
    this.mockReels.set(
      "beauty_clinic",
      this.generateMockReels(15, "beauty_clinic")
    );
    this.mockReels.set(
      "luxury_beauty",
      this.generateMockReels(12, "luxury_beauty")
    );
    this.mockReels.set(
      "cosmetology_pro",
      this.generateMockReels(10, "cosmetology_pro")
    );
    this.mockReels.set(
      "skin_experts",
      this.generateMockReels(8, "skin_experts")
    );
    this.mockReels.set(
      "plastic_surgery",
      this.generateMockReels(20, "plastic_surgery")
    );

    // Мок-данные для хэштегов
    this.mockHashtags.set(
      "красота",
      this.generateMockReels(25, "различные_аккаунты", "красота")
    );
    this.mockHashtags.set(
      "косметология",
      this.generateMockReels(18, "различные_аккаунты", "косметология")
    );
    this.mockHashtags.set(
      "уходзалицом",
      this.generateMockReels(15, "различные_аккаунты", "уходзалицом")
    );
    this.mockHashtags.set(
      "инъекции",
      this.generateMockReels(12, "различные_аккаунты", "инъекции")
    );
    this.mockHashtags.set(
      "филлеры",
      this.generateMockReels(10, "различные_аккаунты", "филлеры")
    );
    this.mockHashtags.set(
      "пластика",
      this.generateMockReels(22, "различные_аккаунты", "пластика")
    );
    this.mockHashtags.set(
      "ринопластика",
      this.generateMockReels(14, "различные_аккаунты", "ринопластика")
    );
  }

  /**
   * Генерация мок-данных для Reels
   */
  private generateMockReels(
    count: number,
    ownerUsername: string,
    hashtag?: string
  ): any[] {
    const reels: any[] = [];

    for (let i = 0; i < count; i++) {
      const publishedDate = new Date();
      publishedDate.setDate(
        publishedDate.getDate() - Math.floor(Math.random() * 14)
      ); // Случайная дата в последние 14 дней

      const viewCount = Math.floor(Math.random() * 200000) + 50000; // От 50k до 250k просмотров
      const likeCount = Math.floor(viewCount * (Math.random() * 0.1 + 0.05)); // 5%-15% от просмотров
      const commentCount = Math.floor(likeCount * (Math.random() * 0.1 + 0.01)); // 1%-11% от лайков

      const reelId = `mock_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      const captionHashtags = hashtag ? `#${hashtag} ` : "";
      const randomHashtags = [
        "#красота",
        "#косметология",
        "#эстетика",
        "#процедуры",
        "#уход",
      ]
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .join(" ");

      const reel: any = {
        instagram_id: reelId,
        url: `https://instagram.com/reel/${reelId}/`,
        caption: `Мок-контент для тестирования. ${captionHashtags}${randomHashtags}`,
        owner_username:
          ownerUsername === "различные_аккаунты"
            ? `user_${Math.floor(Math.random() * 1000)}`
            : ownerUsername,
        owner_id: `${Math.floor(Math.random() * 10000000)}`,
        view_count: viewCount,
        like_count: likeCount,
        comment_count: commentCount,
        duration: Math.floor(Math.random() * 45) + 15, // 15-60 секунд
        thumbnail_url: `https://example.com/thumbnails/${reelId}.jpg`,
        audio_title: `Мок-аудио ${Math.floor(Math.random() * 100)}`,
        published_at: publishedDate.toISOString(),
      };

      reels.push(reel);
    }

    return reels;
  }

  /**
   * Симуляция задержки выполнения запроса
   */
  private async simulateDelay(options?: ScraperOptions): Promise<void> {
    const delay = options?.delayBetweenRequests || this.defaultDelay;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Фильтрация результатов согласно опциям
   */
  private filterResults(
    reels: ScrapedReel[],
    options?: ScraperOptions
  ): ScrapedReel[] {
    let filtered = [...reels];

    // Фильтр по минимальному количеству просмотров
    if (options?.minViews) {
      filtered = filtered.filter(
        (reel) => (reel.view_count || 0) >= (options.minViews || 0)
      );
    }

    // Фильтр по возрасту постов
    if (options?.maxDaysOld && options.maxDaysOld > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.maxDaysOld);

      filtered = filtered.filter((reel) => {
        if (!reel.published_at) return true;
        const publishDate = new Date(reel.published_at);
        return publishDate >= cutoffDate;
      });
    }

    // Лимит результатов
    if (options?.maxReels && options.maxReels > 0) {
      filtered = filtered.slice(0, options.maxReels);
    }

    return filtered;
  }

  /**
   * Получение Reels из аккаунта конкурента
   */
  async getReelsFromAccount(
    username: string,
    options?: ScraperOptions
  ): Promise<ScrapedReel[]> {
    console.log(`📱 [Mock] Получение Reels из аккаунта: ${username}`);

    // Симуляция задержки
    await this.simulateDelay(options);

    // Получение мок-данных
    const mockData =
      this.mockReels.get(username) || this.generateMockReels(5, username);

    // Применение фильтров
    const filteredResults = this.filterResults(mockData, options);

    console.log(
      `📱 [Mock] Найдено ${filteredResults.length} Reels для аккаунта ${username}`
    );

    return filteredResults;
  }

  /**
   * Получение Reels по хэштегу
   */
  async getReelsByHashtag(
    hashtag: string,
    options?: ScraperOptions
  ): Promise<ScrapedReel[]> {
    console.log(`📱 [Mock] Получение Reels по хэштегу: #${hashtag}`);

    // Симуляция задержки
    await this.simulateDelay(options);

    // Получение мок-данных
    const mockData =
      this.mockHashtags.get(hashtag) ||
      this.generateMockReels(10, "различные_аккаунты", hashtag);

    // Применение фильтров
    const filteredResults = this.filterResults(mockData, options);

    console.log(
      `📱 [Mock] Найдено ${filteredResults.length} Reels по хэштегу #${hashtag}`
    );

    return filteredResults;
  }
}
