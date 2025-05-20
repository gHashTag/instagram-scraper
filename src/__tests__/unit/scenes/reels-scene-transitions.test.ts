import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { reelsScene } from "../../../scenes/reels-scene";
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

describe("reelsScene transitions", () => {
  // Определяем тип для тестового контекста
  type TestContext = Partial<ScraperBotContext> & {
    scene: any;
    reply: jest.Mock;
    from: any;
    storage: any;
  };
  
  let ctx: TestContext;

  beforeEach(() => {
    // Создаем мок для контекста
    ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
      scene: {
        enter: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn().mockResolvedValue(undefined),
        session: {
          reelsFilter: undefined,
          reelsPage: 1,
          currentReelId: undefined,
          currentSourceType: undefined,
          currentSourceId: undefined,
          currentProjectId: 1,
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
      },
    } as TestContext;

    jest.clearAllMocks();
  });

  describe("handleReelsEnter", () => {
    it("should handle missing user correctly", async () => {
      // Удаляем пользователя из контекста
      ctx.from = undefined;
      
      // Получаем обработчик enter
      const enterHandler = reelsScene.enterHandler;
      
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
      expect(ctx.scene.session.reelsFilter).toBeUndefined();
      expect(ctx.scene.session.reelsPage).toBe(1);
      expect(ctx.scene.session.currentReelId).toBeUndefined();
      expect(ctx.scene.session.currentSourceType).toBeUndefined();
      expect(ctx.scene.session.currentSourceId).toBeUndefined();
    });

    it("should handle data loading error correctly", async () => {
      // Настраиваем мок для getReelsByProjectId, чтобы он выбрасывал ошибку
      ctx.storage.getReelsByProjectId = jest.fn().mockRejectedValue(new Error("Test error"));
      
      // Получаем обработчик enter
      const enterHandler = reelsScene.enterHandler;
      
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
      expect(ctx.scene.session.reelsFilter).toBeUndefined();
      expect(ctx.scene.session.reelsPage).toBe(1);
      expect(ctx.scene.session.currentReelId).toBeUndefined();
      expect(ctx.scene.session.currentSourceType).toBeUndefined();
      expect(ctx.scene.session.currentSourceId).toBeUndefined();
      
      // Проверяем, что соединение с базой данных было закрыто
      expect(ctx.storage.close).toHaveBeenCalled();
    });

    it("should handle scene transition error correctly", async () => {
      // Настраиваем мок для scene.enter, чтобы он выбрасывал ошибку
      ctx.scene.enter = jest.fn().mockRejectedValue(new Error("Test error"));
      
      // Удаляем пользователя из контекста, чтобы вызвать переход в другую сцену
      ctx.from = undefined;
      
      // Получаем обработчик enter
      const enterHandler = reelsScene.enterHandler;
      
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
});
