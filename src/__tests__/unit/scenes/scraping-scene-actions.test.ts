import { describe, it, expect, jest, mock, beforeEach, afterEach, spyOn } from "bun:test";
import {
  handleScrapeCompetitorsAction,
  handleScrapeHashtagsAction,
  handleBackToScrapingMenuAction,
  handleScrapeCompetitorAction,
  handleScrapeHashtagAction,
  handleScrapeAllCompetitorsAction
} from "../../../scenes/scraping-scene";
import { ScraperSceneStep } from "../../../types";
import { MockedNeonAdapterType, createMockNeonAdapter } from "../../helpers/types";
import { createMockCompetitor, createMockHashtag } from "../../helpers/mocks";

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

// Мокируем NeonAdapter
mock.module("../../../adapters/neon-adapter", () => {
  return {
    NeonAdapter: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      getCompetitorAccounts: jest.fn(),
      getHashtagsByProjectId: jest.fn(),
    })),
  };
});

// Мокируем MockScraperService
mock.module("../../../services/mock-scraper-service", () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      scrapeCompetitorReels: jest.fn().mockResolvedValue(5),
      scrapeHashtagReels: jest.fn().mockResolvedValue(5),
    })),
  };
});

describe("scrapingScene - Action Handlers", () => {
  // Определяем тип для тестового контекста
  type TestContext = {
    match: RegExpExecArray;
    scene: any;
    storage: any;
    reply: jest.Mock;
    editMessageText: jest.Mock;
    answerCbQuery: jest.Mock;
    callbackQuery: any;
    telegram: any;
    chat: any;
    from: any;
  };
  
  let ctx: TestContext;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    // Создаем мок для контекста
    ctx = {
      reply: jest.fn().mockResolvedValue({ message_id: 123 }),
      editMessageText: jest.fn().mockResolvedValue(undefined),
      answerCbQuery: jest.fn().mockResolvedValue(undefined),
      scene: {
        session: {
          currentProjectId: 1,
        },
        leave: jest.fn(),
        reenter: jest.fn(),
        enter: jest.fn(),
      },
      storage: {
        initialize: jest.fn().mockResolvedValue(undefined),
        getCompetitorAccounts: jest.fn(),
        getHashtagsByProjectId: jest.fn(),
        getProjectById: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
      },
      match: ["", "1"] as unknown as RegExpExecArray,
      callbackQuery: { id: "123" },
      telegram: {
        editMessageText: jest.fn().mockResolvedValue(undefined),
      },
      chat: {
        id: 123456789,
      },
      from: {
        id: 123456789,
        username: "testuser",
        first_name: "Test",
        last_name: "User",
        is_bot: false,
      },
    } as unknown as TestContext;

    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("handleScrapeCompetitorsAction", () => {
    it("should show competitors list when project has competitors", async () => {
      // Мокируем результат запроса getCompetitorAccounts
      const mockCompetitors = [
        createMockCompetitor({ id: 1, project_id: 1, username: "competitor1", instagram_url: "https://instagram.com/competitor1" }),
        createMockCompetitor({ id: 2, project_id: 1, username: "competitor2", instagram_url: "https://instagram.com/competitor2" })
      ];
      ctx.storage.getCompetitorAccounts.mockResolvedValue(mockCompetitors);

      // Вызываем обработчик
      await handleScrapeCompetitorsAction(ctx as any);

      // Проверяем, что был вызван метод initialize
      expect(ctx.storage.initialize).toHaveBeenCalled();

      // Проверяем, что был вызван метод getCompetitorAccounts с правильным параметром
      expect(ctx.storage.getCompetitorAccounts).toHaveBeenCalledWith(1, true);

      // Проверяем, что был вызван метод editMessageText с сообщением со списком конкурентов
      expect(ctx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining("Выберите конкурентов для скрапинга"),
        expect.anything()
      );

      // Проверяем, что был вызван метод close
      expect(ctx.storage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    it("should reenter scene if no competitors found", async () => {
      // Мокируем результат запроса getCompetitorAccounts
      ctx.storage.getCompetitorAccounts.mockResolvedValue([]);

      // Вызываем обработчик
      await handleScrapeCompetitorsAction(ctx as any);

      // Проверяем, что был вызван метод initialize
      expect(ctx.storage.initialize).toHaveBeenCalled();

      // Проверяем, что был вызван метод getCompetitorAccounts с правильным параметром
      expect(ctx.storage.getCompetitorAccounts).toHaveBeenCalledWith(1, true);

      // Проверяем, что был вызван метод answerCbQuery с сообщением
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("У вас нет добавленных конкурентов.");

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();

      // Проверяем, что был вызван метод close
      expect(ctx.storage.close).toHaveBeenCalled();
    });
  });

  describe("handleBackToScrapingMenuAction", () => {
    it("should reenter scene", async () => {
      // Вызываем обработчик
      await handleBackToScrapingMenuAction(ctx as any);

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });
  });

  describe("handleScrapeCompetitorAction", () => {
    beforeEach(() => {
      // Устанавливаем match для projectId и competitorId
      ctx.match = ["scrape_competitor_1_2", "1", "2"] as unknown as RegExpExecArray;
      
      // Мокируем результат запроса getCompetitorAccounts
      const mockCompetitors = [
        createMockCompetitor({ id: 2, project_id: 1, username: "competitor2", instagram_url: "https://instagram.com/competitor2" })
      ];
      ctx.storage.getCompetitorAccounts.mockResolvedValue(mockCompetitors);
    });

    it("should start scraping for specific competitor", async () => {
      // Вызываем обработчик
      await handleScrapeCompetitorAction(ctx as any);

      // Проверяем, что был вызван метод answerCbQuery с сообщением о начале скрапинга
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Начинаем скрапинг...");

      // Проверяем, что был вызван метод reply с сообщением о прогрессе
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Скрапинг Reels конкурента"),
        expect.anything()
      );

      // Проверяем, что был вызван метод initialize
      expect(ctx.storage.initialize).toHaveBeenCalled();

      // Проверяем, что был вызван метод getCompetitorAccounts с правильным параметром
      expect(ctx.storage.getCompetitorAccounts).toHaveBeenCalledWith(1);

      // Проверяем, что был вызван метод editMessageText с сообщением о завершении скрапинга
      expect(ctx.telegram.editMessageText).toHaveBeenCalledWith(
        123456789,
        123,
        undefined,
        expect.stringContaining("Скрапинг завершен"),
        expect.anything()
      );

      // Проверяем, что был вызван метод close
      expect(ctx.storage.close).toHaveBeenCalled();
    });
  });
});
