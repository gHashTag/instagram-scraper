import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { competitorScene } from "../../../scenes/competitor-scene";
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

describe("competitorScene transitions", () => {
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
          projectId: 1,
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
        getUserByTelegramId: jest.fn().mockResolvedValue({
          id: 1,
          telegram_id: 123456789,
          username: "testuser",
        }),
        getProjectsByUserId: jest.fn().mockResolvedValue([
          {
            id: 1,
            name: "Test Project",
            user_id: 1,
          },
        ]),
        getCompetitorAccounts: jest.fn().mockResolvedValue([]),
        close: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
      },
      match: [null, "1"] as unknown as RegExpExecArray,
    } as TestContext;

    jest.clearAllMocks();
  });

  describe("handleCompetitorEnter", () => {
    it("should handle missing user correctly", async () => {
      // Настраиваем мок для getUserByTelegramId, чтобы он возвращал null
      ctx.storage.getUserByTelegramId = jest.fn().mockResolvedValue(null);
      
      // Получаем обработчик enter
      const enterHandler = competitorScene.enterHandler;
      
      // Проверяем, что обработчик существует
      expect(enterHandler).toBeDefined();
      
      // Вызываем обработчик
      if (enterHandler) {
        await enterHandler(ctx as any);
      }
      
      // Проверяем, что было отправлено сообщение об ошибке
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Вы не зарегистрированы")
      );
      
      // Проверяем, что был вызван переход в другую сцену
      expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");
      
      // Проверяем, что состояние было очищено
      expect(ctx.scene.session.projectId).toBeUndefined();
      expect(ctx.scene.session.currentProjectId).toBeUndefined();
      expect(ctx.scene.session.step).toBeUndefined();
      
      // Проверяем, что соединение с базой данных было закрыто
      expect(ctx.storage.close).toHaveBeenCalled();
    });

    it("should handle no projects correctly", async () => {
      // Настраиваем мок для getProjectsByUserId, чтобы он возвращал пустой массив
      ctx.storage.getProjectsByUserId = jest.fn().mockResolvedValue([]);
      
      // Получаем обработчик enter
      const enterHandler = competitorScene.enterHandler;
      
      // Проверяем, что обработчик существует
      expect(enterHandler).toBeDefined();
      
      // Вызываем обработчик
      if (enterHandler) {
        await enterHandler(ctx as any);
      }
      
      // Проверяем, что было отправлено сообщение об ошибке
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("У вас нет проектов")
      );
      
      // Проверяем, что был вызван переход в другую сцену
      expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");
      
      // Проверяем, что состояние было очищено
      expect(ctx.scene.session.projectId).toBeUndefined();
      expect(ctx.scene.session.currentProjectId).toBeUndefined();
      expect(ctx.scene.session.step).toBeUndefined();
      
      // Проверяем, что соединение с базой данных было закрыто
      expect(ctx.storage.close).toHaveBeenCalled();
    });

    it("should handle database error correctly", async () => {
      // Настраиваем мок для initialize, чтобы он выбрасывал ошибку
      ctx.storage.initialize = jest.fn().mockRejectedValue(new Error("Test error"));
      
      // Получаем обработчик enter
      const enterHandler = competitorScene.enterHandler;
      
      // Проверяем, что обработчик существует
      expect(enterHandler).toBeDefined();
      
      // Вызываем обработчик
      if (enterHandler) {
        await enterHandler(ctx as any);
      }
      
      // Проверяем, что было отправлено сообщение об ошибке
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Не удалось загрузить данные")
      );
      
      // Проверяем, что был вызван переход в другую сцену
      expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");
      
      // Проверяем, что состояние было очищено
      expect(ctx.scene.session.projectId).toBeUndefined();
      expect(ctx.scene.session.currentProjectId).toBeUndefined();
      expect(ctx.scene.session.step).toBeUndefined();
    });
  });

  describe("handleExitCompetitorSceneAction", () => {
    it("should transition to projects scene correctly with project ID", async () => {
      // Создаем мок для обработчика
      const handler = competitorScene.options.handlers.find(
        (h: any) => h.id && h.id.toString() === "exit_scene"
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
      expect(ctx.scene.session.projectId).toBeUndefined();
      expect(ctx.scene.session.currentProjectId).toBeUndefined();
      expect(ctx.scene.session.step).toBeUndefined();
      
      // Проверяем, что был вызван переход в другую сцену
      expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects", { projectId: 1 });
    });
  });

  describe("handleBackToProjectsCompetitorAction", () => {
    it("should transition to projects scene correctly", async () => {
      // Создаем мок для обработчика
      const handler = competitorScene.options.handlers.find(
        (h: any) => h.id && h.id.toString() === "back_to_projects"
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
      expect(ctx.scene.session.projectId).toBeUndefined();
      expect(ctx.scene.session.currentProjectId).toBeUndefined();
      expect(ctx.scene.session.step).toBeUndefined();
      
      // Проверяем, что был вызван переход в другую сцену
      expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");
    });
  });
});
