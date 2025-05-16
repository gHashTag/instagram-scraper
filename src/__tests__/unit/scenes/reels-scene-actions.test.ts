import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import {
  handleReelDetailsAction,
  handleReelsPageAction,
  handleReelsListAction,
  handleReelsFilterAction,
  handleReelsFilterViewsAction,
  handleReelsFilterDateAction,
  handleReelsSortAction,
  handleReelsFilterResetAction,
  handleReelsAnalyticsAction,
  handleBackToProjectAction
} from "../../../scenes/reels-scene";
import { ScraperSceneStep } from "../../../types";
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

describe("ReelsScene - Action Handlers", () => {
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
      getReelById: jest.fn(),
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
          reelsPage: 1,
          reelsPerPage: 5,
          step: ScraperSceneStep.REELS_LIST,
        },
      },
      reply: jest.fn().mockResolvedValue({}),
      editMessageText: jest.fn().mockResolvedValue({}),
      replyWithPhoto: jest.fn().mockResolvedValue({}),
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

  describe("handleReelDetailsAction", () => {
    it("should show reel details when reel exists", async () => {
      // Устанавливаем match для reelId
      ctx.match = ["reel_details_123_reel456", "123", "reel456"];

      // Мокируем результат запроса getReelById
      const mockReel = createMockReelContent({
        id: 1,
        project_id: 123,
        instagram_id: "reel456",
        source_type: "competitor",
        source_id: "789",
        author_username: "testuser",
        views: 1000,
        likes: 100,
        comments_count: 10,
        caption: "Test caption",
        published_at: "2023-01-01T00:00:00Z"
      });
      mockStorage.getReelById = jest.fn().mockResolvedValue(mockReel);

      // Вызываем обработчик
      await handleReelDetailsAction(ctx);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getReelById).toHaveBeenCalledWith("reel456");
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод reply с сообщением
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Детальная информация о Reel"),
        expect.anything()
      );

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();

      // Проверяем, что был установлен правильный шаг в сессии
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.REEL_DETAILS);
    });

    it("should handle invalid reelId", async () => {
      // Устанавливаем match с невалидным reelId
      ctx.match = ["reel_details_invalid_", "invalid", ""];

      // Вызываем обработчик
      await handleReelDetailsAction(ctx);

      // Проверяем, что был вызван метод answerCbQuery с сообщением об ошибке
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка: неверные параметры.");

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();

      // Проверяем, что не были вызваны методы storage
      expect(mockStorage.initialize).not.toHaveBeenCalled();
    });

    it("should handle reel not found", async () => {
      // Устанавливаем match для reelId
      ctx.match = ["reel_details_123_reel456", "123", "reel456"];

      // Удаляем метод getReelById, чтобы использовался запасной вариант
      mockStorage.getReelById = undefined;

      // Мокируем результат запроса getReels
      const mockReels = [];
      mockStorage.getReels.mockResolvedValue(mockReels);

      // Вызываем обработчик
      await handleReelDetailsAction(ctx);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();

      // Проверяем, что был вызван метод getReels с правильными параметрами
      expect(mockStorage.getReels).toHaveBeenCalledWith({ projectId: 123 });

      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод answerCbQuery с сообщением об ошибке
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Reel не найден. Возможно, он был удален.");

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });
  });

  describe("handleReelsPageAction", () => {
    it("should update page and reenter scene", async () => {
      // Устанавливаем match для page
      ctx.match = ["reels_page_123_2", "123", "2"];

      // Вызываем обработчик
      await handleReelsPageAction(ctx);

      // Проверяем, что параметры были сохранены в сессии
      expect(ctx.scene.session.currentProjectId).toBe(123);
      expect(ctx.scene.session.reelsPage).toBe(2);

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });

    it("should handle invalid page", async () => {
      // Устанавливаем match с невалидной страницей
      ctx.match = ["reels_page_123_invalid", "123", "invalid"];

      // Вызываем обработчик
      await handleReelsPageAction(ctx);

      // Проверяем, что был вызван метод answerCbQuery с сообщением об ошибке
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка: неверные параметры.");

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });
  });

  describe("handleReelsFilterAction", () => {
    it("should show filter options", async () => {
      // Устанавливаем match для projectId
      ctx.match = ["reels_filter_123", "123"];

      // Мокируем результат запроса getProjectById
      mockStorage.getProjectById.mockResolvedValue({ id: 123, user_id: 1, name: "Test Project" });

      // Вызываем обработчик
      await handleReelsFilterAction(ctx);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод editMessageText с сообщением
      expect(ctx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining("Фильтрация Reels"),
        expect.anything()
      );

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();

      // Проверяем, что был установлен правильный шаг в сессии
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.REELS_FILTER);
    });

    it("should handle project not found", async () => {
      // Устанавливаем match для projectId
      ctx.match = ["reels_filter_123", "123"];

      // Мокируем результат запроса getProjectById
      mockStorage.getProjectById.mockResolvedValue(null);

      // Вызываем обработчик
      await handleReelsFilterAction(ctx);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод reply с сообщением об ошибке
      expect(ctx.reply).toHaveBeenCalledWith(
        "Проект не найден. Возможно, он был удален."
      );

      // Проверяем, что был вызван метод enter с правильным параметром
      expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");
    });
  });

  describe("handleReelsFilterViewsAction", () => {
    it("should apply views filter and reenter scene", async () => {
      // Устанавливаем match для minViews
      ctx.match = ["reels_filter_views_123_1000", "123", "1000"];

      // Вызываем обработчик
      await handleReelsFilterViewsAction(ctx);

      // Проверяем, что параметры были сохранены в сессии
      expect(ctx.scene.session.currentProjectId).toBe(123);
      expect(ctx.scene.session.reelsFilter).toEqual({
        projectId: 123,
        minViews: 1000,
        limit: 5,
        offset: 0,
      });
      expect(ctx.scene.session.reelsPage).toBe(1);

      // Проверяем, что был вызван метод answerCbQuery с сообщением
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Фильтр применен: просмотры > 1000");

      // Проверяем, что был установлен правильный шаг в сессии
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.REELS_LIST);

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });

    it("should handle invalid minViews", async () => {
      // Устанавливаем match с невалидным minViews
      ctx.match = ["reels_filter_views_123_invalid", "123", "invalid"];

      // Вызываем обработчик
      await handleReelsFilterViewsAction(ctx);

      // Проверяем, что был вызван метод answerCbQuery с сообщением об ошибке
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка: неверные параметры.");

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });
  });

  describe("handleReelsFilterDateAction", () => {
    it("should apply date filter for week and reenter scene", async () => {
      // Устанавливаем match для period
      ctx.match = ["reels_filter_date_123_week", "123", "week"];

      // Вызываем обработчик
      await handleReelsFilterDateAction(ctx);

      // Проверяем, что параметры были сохранены в сессии
      expect(ctx.scene.session.currentProjectId).toBe(123);
      expect(ctx.scene.session.reelsFilter).toEqual({
        projectId: 123,
        afterDate: expect.any(String),
        limit: 5,
        offset: 0,
      });
      expect(ctx.scene.session.reelsPage).toBe(1);

      // Проверяем, что был вызван метод answerCbQuery с сообщением
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Фильтр применен: за неделю");

      // Проверяем, что был установлен правильный шаг в сессии
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.REELS_LIST);

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });

    it("should apply date filter for month and reenter scene", async () => {
      // Устанавливаем match для period
      ctx.match = ["reels_filter_date_123_month", "123", "month"];

      // Вызываем обработчик
      await handleReelsFilterDateAction(ctx);

      // Проверяем, что параметры были сохранены в сессии
      expect(ctx.scene.session.currentProjectId).toBe(123);
      expect(ctx.scene.session.reelsFilter).toEqual({
        projectId: 123,
        afterDate: expect.any(String),
        limit: 5,
        offset: 0,
      });
      expect(ctx.scene.session.reelsPage).toBe(1);

      // Проверяем, что был вызван метод answerCbQuery с сообщением
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Фильтр применен: за месяц");

      // Проверяем, что был установлен правильный шаг в сессии
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.REELS_LIST);

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });

    it("should handle invalid period", async () => {
      // Устанавливаем match с невалидным period
      ctx.match = ["reels_filter_date_123_", "123", ""];

      // Вызываем обработчик
      await handleReelsFilterDateAction(ctx);

      // Проверяем, что был вызван метод answerCbQuery с сообщением об ошибке
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка: неверные параметры.");

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });
  });

  describe("handleReelsSortAction", () => {
    it("should apply sort by views and reenter scene", async () => {
      // Устанавливаем match для sortField
      ctx.match = ["reels_sort_123_views", "123", "views"];

      // Вызываем обработчик
      await handleReelsSortAction(ctx);

      // Проверяем, что параметры были сохранены в сессии
      expect(ctx.scene.session.currentProjectId).toBe(123);
      expect(ctx.scene.session.reelsFilter).toEqual({
        projectId: 123,
        orderBy: "views",
        orderDirection: "DESC",
        limit: 5,
        offset: 0,
      });
      expect(ctx.scene.session.reelsPage).toBe(1);

      // Проверяем, что был вызван метод answerCbQuery с сообщением
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Сортировка применена: по просмотрам");

      // Проверяем, что был установлен правильный шаг в сессии
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.REELS_LIST);

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });

    it("should apply sort by date and reenter scene", async () => {
      // Устанавливаем match для sortField
      ctx.match = ["reels_sort_123_date", "123", "date"];

      // Вызываем обработчик
      await handleReelsSortAction(ctx);

      // Проверяем, что параметры были сохранены в сессии
      expect(ctx.scene.session.currentProjectId).toBe(123);
      expect(ctx.scene.session.reelsFilter).toEqual({
        projectId: 123,
        orderBy: "published_at",
        orderDirection: "DESC",
        limit: 5,
        offset: 0,
      });
      expect(ctx.scene.session.reelsPage).toBe(1);

      // Проверяем, что был вызван метод answerCbQuery с сообщением
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Сортировка применена: по дате");

      // Проверяем, что был установлен правильный шаг в сессии
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.REELS_LIST);

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });

    it("should handle invalid sortField", async () => {
      // Устанавливаем match с невалидным sortField
      ctx.match = ["reels_sort_123_", "123", ""];

      // Вызываем обработчик
      await handleReelsSortAction(ctx);

      // Проверяем, что был вызван метод answerCbQuery с сообщением об ошибке
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка: неверные параметры.");

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });
  });

  describe("handleReelsFilterResetAction", () => {
    it("should reset filters and reenter scene", async () => {
      // Устанавливаем match для projectId
      ctx.match = ["reels_filter_reset_123", "123"];

      // Вызываем обработчик
      await handleReelsFilterResetAction(ctx);

      // Проверяем, что параметры были сохранены в сессии
      expect(ctx.scene.session.currentProjectId).toBe(123);
      expect(ctx.scene.session.reelsFilter).toEqual({
        projectId: 123,
        limit: 5,
        offset: 0,
        orderBy: "published_at",
        orderDirection: "DESC",
      });
      expect(ctx.scene.session.reelsPage).toBe(1);

      // Проверяем, что был вызван метод answerCbQuery с сообщением
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Фильтры сброшены");

      // Проверяем, что был установлен правильный шаг в сессии
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.REELS_LIST);

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });

    it("should handle invalid projectId", async () => {
      // Устанавливаем match с невалидным projectId
      ctx.match = ["reels_filter_reset_invalid", "invalid"];

      // Вызываем обработчик
      await handleReelsFilterResetAction(ctx);

      // Проверяем, что был вызван метод answerCbQuery с сообщением об ошибке
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка: неверный ID проекта.");

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });
  });

  describe("handleReelsAnalyticsAction", () => {
    it("should show analytics when reels are available", async () => {
      // Устанавливаем match для projectId
      ctx.match = ["reels_analytics_123", "123"];

      // Мокируем результаты запросов
      const mockProject = { id: 123, user_id: 1, name: "Test Project" };
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
      await handleReelsAnalyticsAction(ctx);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
      expect(mockStorage.getReels).toHaveBeenCalled();
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод editMessageText с сообщением
      expect(ctx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining("Аналитика Reels"),
        expect.anything()
      );

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();

      // Проверяем, что был установлен правильный шаг в сессии
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.REELS_ANALYTICS);
    });

    it("should show message when no reels are available", async () => {
      // Устанавливаем match для projectId
      ctx.match = ["reels_analytics_123", "123"];

      // Мокируем результаты запросов
      const mockProject = { id: 123, user_id: 1, name: "Test Project" };
      mockStorage.getProjectById.mockResolvedValue(mockProject);
      mockStorage.getReels.mockResolvedValue([]);

      // Вызываем обработчик
      await handleReelsAnalyticsAction(ctx);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
      expect(mockStorage.getReels).toHaveBeenCalled();
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод editMessageText с сообщением
      expect(ctx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining("Нет доступных Reels для анализа"),
        expect.anything()
      );

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    it("should handle invalid projectId", async () => {
      // Устанавливаем match с невалидным projectId
      ctx.match = ["reels_analytics_invalid", "invalid"];

      // Вызываем обработчик
      await handleReelsAnalyticsAction(ctx);

      // Проверяем, что был вызван метод answerCbQuery с сообщением об ошибке
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка: неверный ID проекта.");

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
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

    it("should handle invalid projectId", async () => {
      // Устанавливаем match с невалидным projectId
      ctx.match = ["project_invalid", "invalid"];

      // Вызываем обработчик
      await handleBackToProjectAction(ctx);

      // Проверяем, что был вызван метод answerCbQuery с сообщением об ошибке
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка: неверный ID проекта.");

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });
  });
});
