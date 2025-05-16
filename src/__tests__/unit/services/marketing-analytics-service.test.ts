import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { MarketingAnalyticsService } from "../../../services/marketing-analytics-service";
import { createMockReelContent } from "../../helpers/mocks";

// Мокируем зависимости
mock.module("../../../logger", () => {
  return {
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    },
  };
});

describe("MarketingAnalyticsService", () => {
  let marketingService: MarketingAnalyticsService;

  beforeEach(() => {
    // Сбрасываем все моки перед каждым тестом
    jest.clearAllMocks();

    // Создаем экземпляр сервиса
    marketingService = new MarketingAnalyticsService();
  });

  afterEach(() => {
    // Очищаем все моки после каждого теста
    jest.clearAllMocks();
  });

  describe("calculateMarketingData", () => {
    it("should calculate marketing data for a reel with views, likes and comments", () => {
      // Создаем мок Reel с данными
      const mockReel = createMockReelContent({
        id: 1,
        project_id: 123,
        instagram_id: "reel1",
        views: 10000,
        likes: 1000,
        comments_count: 100,
        published_at: "2023-01-01T00:00:00Z",
      });

      // Вызываем метод
      const result = marketingService.calculateMarketingData(mockReel);

      // Проверяем, что все маркетинговые данные были рассчитаны
      expect(result.days_since_published).toBeDefined();
      expect(result.engagement_rate_video).toBeDefined();
      expect(result.engagement_rate_all).toBeDefined();
      expect(result.view_to_like_ratio).toBeDefined();
      expect(result.comments_to_likes_ratio).toBeDefined();
      expect(result.recency).toBeDefined();
      expect(result.marketing_score).toBeDefined();

      // Проверяем корректность расчетов
      expect(result.engagement_rate_video).toBeCloseTo((1000 + 100) / 10000 * 100, 5);
      expect(result.view_to_like_ratio).toBeCloseTo(10000 / 1000, 5);
      expect(result.comments_to_likes_ratio).toBeCloseTo(100 / 1000, 5);
    });

    it("should calculate marketing data for a reel without views", () => {
      // Создаем мок Reel без просмотров
      const mockReel = createMockReelContent({
        id: 1,
        project_id: 123,
        instagram_id: "reel1",
        views: undefined,
        likes: 1000,
        comments_count: 100,
        published_at: "2023-01-01T00:00:00Z",
      });

      // Вызываем метод
      const result = marketingService.calculateMarketingData(mockReel);

      // Проверяем, что маркетинговые данные были рассчитаны
      expect(result.days_since_published).toBeDefined();
      expect(result.engagement_rate_video).toBeUndefined();
      expect(result.engagement_rate_all).toBeDefined();
      expect(result.view_to_like_ratio).toBeUndefined();
      expect(result.comments_to_likes_ratio).toBeDefined();
      expect(result.recency).toBeDefined();
      expect(result.marketing_score).toBeDefined();
    });

    it("should calculate marketing data for a reel without likes", () => {
      // Создаем мок Reel без лайков
      const mockReel = createMockReelContent({
        id: 1,
        project_id: 123,
        instagram_id: "reel1",
        views: 10000,
        likes: undefined,
        comments_count: 100,
        published_at: "2023-01-01T00:00:00Z",
      });

      // Вызываем метод
      const result = marketingService.calculateMarketingData(mockReel);

      // Проверяем, что маркетинговые данные были рассчитаны
      expect(result.days_since_published).toBeDefined();
      expect(result.engagement_rate_video).toBeDefined();
      expect(result.engagement_rate_all).toBeDefined();
      expect(result.view_to_like_ratio).toBeUndefined();
      expect(result.comments_to_likes_ratio).toBeUndefined();
      expect(result.recency).toBeDefined();
      expect(result.marketing_score).toBeDefined();
    });

    it("should calculate marketing data for a reel without comments", () => {
      // Создаем мок Reel без комментариев
      const mockReel = createMockReelContent({
        id: 1,
        project_id: 123,
        instagram_id: "reel1",
        views: 10000,
        likes: 1000,
        comments_count: undefined,
        published_at: "2023-01-01T00:00:00Z",
      });

      // Вызываем метод
      const result = marketingService.calculateMarketingData(mockReel);

      // Проверяем, что маркетинговые данные были рассчитаны
      expect(result.days_since_published).toBeDefined();
      expect(result.engagement_rate_video).toBeDefined();
      expect(result.engagement_rate_all).toBeDefined();
      expect(result.view_to_like_ratio).toBeDefined();
      expect(result.comments_to_likes_ratio).toBeUndefined();
      expect(result.recency).toBeDefined();
      expect(result.marketing_score).toBeDefined();
    });

    it("should handle errors gracefully", () => {
      // Создаем мок Reel с некорректной датой
      const mockReel = createMockReelContent({
        id: 1,
        project_id: 123,
        instagram_id: "reel1",
        views: 10000,
        likes: 1000,
        comments_count: 100,
        published_at: "invalid-date",
      });

      // Вызываем метод
      const result = marketingService.calculateMarketingData(mockReel);

      // Проверяем, что метод не выбросил исключение и вернул объект с исходными данными
      expect(result.id).toEqual(mockReel.id);
      expect(result.instagram_id).toEqual(mockReel.instagram_id);
      expect(result.project_id).toEqual(mockReel.project_id);

      // Проверяем, что маркетинговые данные были добавлены
      expect(result.days_since_published).toBeDefined();
      expect(result.engagement_rate_video).toBeDefined();
      expect(result.engagement_rate_all).toBeDefined();
      expect(result.view_to_like_ratio).toBeDefined();
      expect(result.comments_to_likes_ratio).toBeDefined();
      expect(result.marketing_score).toBeDefined();
    });
  });
});
