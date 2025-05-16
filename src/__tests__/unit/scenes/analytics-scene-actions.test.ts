import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { 
  handlePopularityAnalyticsAction,
  handleHashtagsAnalyticsAction,
  handleTrendsAnalyticsAction,
  handleRecommendationsAction,
  handleExportAction,
  handleExportTextAction,
  handleExportCsvAction,
  handleAnalyticsMenuAction,
  handleBackToProjectAction
} from "../../../scenes/analytics-scene";
import { ScraperSceneStep } from "../../../types";
import { createMockReelContent, createMockProject, createMockHashtag } from "../../helpers/mocks";

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

describe("AnalyticsScene - Action Handlers", () => {
  // Создаем моки для контекста Telegraf
  let ctx;
  let mockStorage;

  beforeEach(() => {
    // Сбрасываем все моки перед каждым тестом
    jest.clearAllMocks();

    // Создаем мок для хранилища
    mockStorage = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getProjectById: jest.fn(),
      getReels: jest.fn(),
      getReelsCount: jest.fn(),
      getCompetitorAccounts: jest.fn(),
      getHashtagsByProjectId: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Создаем мок контекста
    ctx = {
      scene: {
        enter: jest.fn(),
        reenter: jest.fn(),
        leave: jest.fn(),
        state: {},
        session: {
          currentProjectId: 123,
          step: ScraperSceneStep.REELS_ANALYTICS,
        },
      },
      reply: jest.fn().mockResolvedValue({}),
      editMessageText: jest.fn().mockResolvedValue({}),
      replyWithDocument: jest.fn().mockResolvedValue({}),
      from: { id: 123456789 },
      storage: mockStorage,
      callbackQuery: { id: "callback123" },
      answerCbQuery: jest.fn().mockResolvedValue(true),
      match: null,
    };
  });

  afterEach(() => {
    // Очищаем все моки после каждого теста
    jest.clearAllMocks();
  });

  describe("handlePopularityAnalyticsAction", () => {
    it("should show popularity analytics when reels are available", async () => {
      // Устанавливаем match для projectId
      ctx.match = ["analytics_popularity_123", "123"];
      
      // Мокируем результаты запросов
      const mockProject = createMockProject({ id: 123, user_id: 1, name: "Test Project" });
      const mockReels = [
        createMockReelContent({ 
          id: 1, 
          project_id: 123, 
          instagram_id: "reel1",
          views: 1000,
          published_at: "2023-01-01T00:00:00Z"
        }),
        createMockReelContent({ 
          id: 2, 
          project_id: 123, 
          instagram_id: "reel2",
          views: 5000,
          published_at: "2023-01-02T00:00:00Z"
        })
      ];
      mockStorage.getProjectById.mockResolvedValue(mockProject);
      mockStorage.getReels.mockResolvedValue(mockReels);
      
      // Вызываем обработчик
      await handlePopularityAnalyticsAction(ctx);
      
      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
      expect(mockStorage.getReels).toHaveBeenCalled();
      expect(mockStorage.close).toHaveBeenCalled();
      
      // Проверяем, что был вызван метод reply с сообщением
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Анализ популярности контента"),
        expect.anything()
      );
      
      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    it("should show message when no reels are available", async () => {
      // Устанавливаем match для projectId
      ctx.match = ["analytics_popularity_123", "123"];
      
      // Мокируем результаты запросов
      const mockProject = createMockProject({ id: 123, user_id: 1, name: "Test Project" });
      mockStorage.getProjectById.mockResolvedValue(mockProject);
      mockStorage.getReels.mockResolvedValue([]);
      
      // Вызываем обработчик
      await handlePopularityAnalyticsAction(ctx);
      
      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
      expect(mockStorage.getReels).toHaveBeenCalled();
      expect(mockStorage.close).toHaveBeenCalled();
      
      // Проверяем, что был вызван метод reply с сообщением об отсутствии данных
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Нет доступных Reels для анализа"),
        expect.anything()
      );
      
      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });
  });

  describe("handleHashtagsAnalyticsAction", () => {
    it("should show hashtags analytics when hashtags and reels are available", async () => {
      // Устанавливаем match для projectId
      ctx.match = ["analytics_hashtags_123", "123"];
      
      // Мокируем результаты запросов
      const mockProject = createMockProject({ id: 123, user_id: 1, name: "Test Project" });
      const mockHashtags = [
        createMockHashtag({ id: 1, project_id: 123, tag_name: "hashtag1" }),
        createMockHashtag({ id: 2, project_id: 123, tag_name: "hashtag2" })
      ];
      const mockReels = [
        createMockReelContent({ 
          id: 1, 
          project_id: 123, 
          instagram_id: "reel1",
          source_type: "hashtag",
          source_id: "1",
          views: 1000,
          published_at: "2023-01-01T00:00:00Z"
        }),
        createMockReelContent({ 
          id: 2, 
          project_id: 123, 
          instagram_id: "reel2",
          source_type: "hashtag",
          source_id: "2",
          views: 5000,
          published_at: "2023-01-02T00:00:00Z"
        })
      ];
      mockStorage.getProjectById.mockResolvedValue(mockProject);
      mockStorage.getHashtagsByProjectId.mockResolvedValue(mockHashtags);
      mockStorage.getReels.mockResolvedValue(mockReels);
      
      // Вызываем обработчик
      await handleHashtagsAnalyticsAction(ctx);
      
      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
      expect(mockStorage.getHashtagsByProjectId).toHaveBeenCalledWith(123);
      expect(mockStorage.getReels).toHaveBeenCalled();
      expect(mockStorage.close).toHaveBeenCalled();
      
      // Проверяем, что был вызван метод reply с сообщением
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Анализ эффективности хештегов"),
        expect.anything()
      );
      
      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });
  });

  describe("handleExportAction", () => {
    it("should prepare export options when reels are available", async () => {
      // Устанавливаем match для projectId
      ctx.match = ["analytics_export_123", "123"];
      
      // Мокируем результаты запросов
      const mockProject = createMockProject({ id: 123, user_id: 1, name: "Test Project" });
      const mockReels = [
        createMockReelContent({ 
          id: 1, 
          project_id: 123, 
          instagram_id: "reel1",
          views: 1000,
          published_at: "2023-01-01T00:00:00Z"
        }),
        createMockReelContent({ 
          id: 2, 
          project_id: 123, 
          instagram_id: "reel2",
          views: 5000,
          published_at: "2023-01-02T00:00:00Z"
        })
      ];
      mockStorage.getProjectById.mockResolvedValue(mockProject);
      mockStorage.getReels.mockResolvedValue(mockReels);
      
      // Вызываем обработчик
      await handleExportAction(ctx);
      
      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
      expect(mockStorage.getReels).toHaveBeenCalled();
      expect(mockStorage.close).toHaveBeenCalled();
      
      // Проверяем, что был вызван метод reply с сообщением
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Экспорт отчета"),
        expect.anything()
      );
      
      // Проверяем, что отчеты были сохранены в сессии
      expect(ctx.scene.session.textReport).toBeDefined();
      expect(ctx.scene.session.csvReport).toBeDefined();
      
      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });
  });

  describe("handleExportTextAction", () => {
    it("should send text report from session", async () => {
      // Устанавливаем match для projectId
      ctx.match = ["export_text_123", "123"];
      
      // Устанавливаем текстовый отчет в сессии
      ctx.scene.session.textReport = "Test report content";
      
      // Вызываем обработчик
      await handleExportTextAction(ctx);
      
      // Проверяем, что был вызван метод reply с текстовым отчетом
      expect(ctx.reply).toHaveBeenCalledWith("Test report content");
      
      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Текстовый отчет сформирован");
    });
  });

  describe("handleBackToProjectAction", () => {
    it("should enter project scene", async () => {
      // Устанавливаем match для projectId
      ctx.match = ["project_123", "123"];
      
      // Вызываем обработчик
      await handleBackToProjectAction(ctx);
      
      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
      
      // Проверяем, что был вызван метод enter с правильным параметром
      expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects", { projectId: 123 });
    });
  });
});
