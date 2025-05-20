import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { analyticsScene } from "../../../scenes/analytics-scene";
import { ScraperBotContext } from "@/types";

// Мокируем зависимости
mock.module("../../../logger", () => {
  return {
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  };
});

describe("analyticsScene transitions", () => {
  // Определяем тип для тестового контекста
  type TestContext = Partial<ScraperBotContext> & {
    scene: any;
    reply: jest.Mock;
    from: any;
    storage: any;
    callbackQuery?: any;
    answerCbQuery: jest.Mock;
  };
  
  let ctx: TestContext;

  beforeEach(() => {
    // Создаем мок для контекста
    ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
      answerCbQuery: jest.fn().mockResolvedValue(undefined),
      scene: {
        enter: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn().mockResolvedValue(undefined),
        reenter: jest.fn().mockResolvedValue(undefined),
        session: {
          textReport: "Test report",
          csvReport: "Test CSV",
          currentProjectId: 1,
          step: 1,
        },
        state: {
          projectId: 1,
        },
      },
      from: {
        id: 123456789,
        username: "testuser",
        first_name: "Test",
        last_name: "User",
        is_bot: false,
      },
      storage: {
        getProjectById: jest.fn().mockResolvedValue({
          id: 1,
          name: "Test Project",
          user_id: 1,
        }),
        getReelsByProjectId: jest.fn().mockResolvedValue([]),
        close: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
      },
      match: [null, "1"] as unknown as RegExpExecArray,
    } as TestContext;

    jest.clearAllMocks();
  });

  describe("handleAnalyticsEnter", () => {
    it("should handle missing user correctly", async () => {
      // Удаляем пользователя из контекста
      ctx.from = undefined;
      
      // Получаем обработчик enter
      const enterHandler = analyticsScene.enterHandler;
      
      // Проверяем, что обработчик существует
      expect(enterHandler).toBeDefined();
      
      // Вызываем обработчик
      if (enterHandler) {
        await enterHandler(ctx as any);
      }
      
      // Проверяем, что было отправлено сообщение об ошибке
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Не удалось определить пользователя")
      );
      
      // Проверяем, что был вызван переход в другую сцену
      expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");
      
      // Проверяем, что состояние было очищено
      expect(ctx.scene.session.textReport).toBeUndefined();
      expect(ctx.scene.session.csvReport).toBeUndefined();
      expect(ctx.scene.session.currentProjectId).toBeUndefined();
      expect(ctx.scene.session.step).toBeUndefined();
    });

    it("should handle data loading error correctly", async () => {
      // Настраиваем мок для getProjectById, чтобы он выбрасывал ошибку
      ctx.storage.getProjectById = jest.fn().mockRejectedValue(new Error("Test error"));
      
      // Получаем обработчик enter
      const enterHandler = analyticsScene.enterHandler;
      
      // Проверяем, что обработчик существует
      expect(enterHandler).toBeDefined();
      
      // Вызываем обработчик
      if (enterHandler) {
        await enterHandler(ctx as any);
      }
      
      // Проверяем, что было отправлено сообщение об ошибке
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Произошла ошибка при загрузке данных")
      );
      
      // Проверяем, что был вызван переход в другую сцену
      expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");
      
      // Проверяем, что состояние было очищено
      expect(ctx.scene.session.textReport).toBeUndefined();
      expect(ctx.scene.session.csvReport).toBeUndefined();
      expect(ctx.scene.session.currentProjectId).toBeUndefined();
      expect(ctx.scene.session.step).toBeUndefined();
      
      // Проверяем, что соединение с базой данных было закрыто
      expect(ctx.storage.close).toHaveBeenCalled();
    });

    it("should handle scene transition error correctly", async () => {
      // Настраиваем мок для scene.enter, чтобы он выбрасывал ошибку
      ctx.scene.enter = jest.fn().mockRejectedValue(new Error("Test error"));
      
      // Удаляем пользователя из контекста, чтобы вызвать переход в другую сцену
      ctx.from = undefined;
      
      // Получаем обработчик enter
      const enterHandler = analyticsScene.enterHandler;
      
      // Проверяем, что обработчик существует
      expect(enterHandler).toBeDefined();
      
      // Вызываем обработчик
      if (enterHandler) {
        await enterHandler(ctx as any);
      }
      
      // Проверяем, что было отправлено сообщение об ошибке
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Не удалось определить пользователя")
      );
      
      // Проверяем, что был вызван метод leave
      expect(ctx.scene.leave).toHaveBeenCalled();
    });
  });

  describe("handleBackToProjectAction", () => {
    it("should transition to projects scene correctly", async () => {
      // Создаем мок для обработчика
      const handler = analyticsScene.options.handlers.find(
        (h: any) => h.id && h.id.toString() === "/project_(\\d+)/"
      );
      
      // Проверяем, что обработчик существует
      expect(handler).toBeDefined();
      
      // Вызываем обработчик
      if (handler) {
        await handler.handler(ctx as any);
      }
      
      // Проверяем, что был вызван answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
      
      // Проверяем, что состояние было очищено
      expect(ctx.scene.session.textReport).toBeUndefined();
      expect(ctx.scene.session.csvReport).toBeUndefined();
      expect(ctx.scene.session.currentProjectId).toBeUndefined();
      expect(ctx.scene.session.step).toBeUndefined();
      
      // Проверяем, что был вызван переход в другую сцену
      expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects", { projectId: 1 });
    });
  });

  describe("handleReelsListAction", () => {
    it("should transition to reels scene correctly", async () => {
      // Создаем мок для обработчика
      const handler = analyticsScene.options.handlers.find(
        (h: any) => h.id && h.id.toString() === "/reels_list_(\\d+)/"
      );
      
      // Проверяем, что обработчик существует
      expect(handler).toBeDefined();
      
      // Вызываем обработчик
      if (handler) {
        await handler.handler(ctx as any);
      }
      
      // Проверяем, что был вызван answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
      
      // Проверяем, что состояние было очищено
      expect(ctx.scene.session.textReport).toBeUndefined();
      expect(ctx.scene.session.csvReport).toBeUndefined();
      expect(ctx.scene.session.currentProjectId).toBeUndefined();
      expect(ctx.scene.session.step).toBeUndefined();
      
      // Проверяем, что был вызван переход в другую сцену
      expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_reels", { projectId: 1 });
    });
  });
});
