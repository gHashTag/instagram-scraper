import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { 
  handleAddHashtagAction, 
  handleCancelHashtagInputAction, 
  handleDeleteHashtagAction,
  handleBackToProjectAction
} from "../../../scenes/hashtag-scene";
import { ScraperSceneStep } from "../../../types";

// Мокируем NeonAdapter
mock.module("../../../adapters/neon-adapter", () => {
  return {
    NeonAdapter: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      removeHashtag: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe("hashtagScene - Action Handlers", () => {
  let ctx: any;
  let mockAdapter: any;

  beforeEach(() => {
    // Создаем мок для контекста
    ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
      answerCbQuery: jest.fn().mockResolvedValue(true),
      deleteMessage: jest.fn().mockResolvedValue(true),
      scene: {
        session: {},
        leave: jest.fn(),
        reenter: jest.fn(),
      },
      storage: {
        initialize: jest.fn().mockResolvedValue(undefined),
        removeHashtag: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      },
      match: [],
    };
    
    mockAdapter = ctx.storage;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleAddHashtagAction", () => {
    it("should set session data and prompt for hashtag input", async () => {
      // Устанавливаем match для projectId
      ctx.match = ["add_hashtag_123", "123"];
      
      // Вызываем обработчик
      await handleAddHashtagAction(ctx);
      
      // Проверяем, что были установлены данные сессии
      expect(ctx.scene.session.projectId).toBe(123);
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.ADD_HASHTAG);
      
      // Проверяем, что был вызван метод reply с запросом ввода хештега
      expect(ctx.reply).toHaveBeenCalledWith(
        "Введите хештег для добавления (без #):",
        expect.anything()
      );
      
      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    it("should handle invalid projectId", async () => {
      // Устанавливаем match с невалидным projectId
      ctx.match = ["add_hashtag_invalid", "invalid"];
      
      // Вызываем обработчик
      await handleAddHashtagAction(ctx);
      
      // Проверяем, что был вызван метод reply с сообщением об ошибке
      expect(ctx.reply).toHaveBeenCalledWith(
        "Ошибка выбора проекта. Пожалуйста, вернитесь назад."
      );
      
      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
      
      // Проверяем, что данные сессии не были установлены
      expect(ctx.scene.session.projectId).toBeUndefined();
      expect(ctx.scene.session.step).toBeUndefined();
    });
  });

  describe("handleCancelHashtagInputAction", () => {
    it("should clear step and reenter scene", async () => {
      // Устанавливаем начальное значение step
      ctx.scene.session.step = ScraperSceneStep.ADD_HASHTAG;
      
      // Вызываем обработчик
      await handleCancelHashtagInputAction(ctx);
      
      // Проверяем, что был вызван метод deleteMessage
      expect(ctx.deleteMessage).toHaveBeenCalled();
      
      // Проверяем, что step был очищен
      expect(ctx.scene.session.step).toBeUndefined();
      
      // Проверяем, что был вызван метод answerCbQuery с сообщением
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ввод отменен.");
      
      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });
  });

  describe("handleDeleteHashtagAction", () => {
    it("should delete hashtag and reenter scene", async () => {
      // Устанавливаем match для projectId и hashtag
      ctx.match = ["delete_hashtag_123_test", "123", "test"];
      
      // Вызываем обработчик
      await handleDeleteHashtagAction(ctx);
      
      // Проверяем, что были вызваны методы адаптера
      expect(mockAdapter.initialize).toHaveBeenCalled();
      expect(mockAdapter.removeHashtag).toHaveBeenCalledWith(123, "test");
      expect(mockAdapter.close).toHaveBeenCalled();
      
      // Проверяем, что был вызван метод reply с сообщением об успешном удалении
      expect(ctx.reply).toHaveBeenCalledWith("Хештег #test удален.");
      
      // Проверяем, что был вызван метод answerCbQuery с сообщением
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Удалено");
      
      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });

    it("should handle invalid data", async () => {
      // Устанавливаем match с невалидными данными
      ctx.match = ["delete_hashtag_invalid_", "invalid", ""];
      
      // Вызываем обработчик
      await handleDeleteHashtagAction(ctx);
      
      // Проверяем, что был вызван метод reply с сообщением об ошибке
      expect(ctx.reply).toHaveBeenCalledWith("Ошибка при удалении хештега.");
      
      // Проверяем, что был вызван метод answerCbQuery с сообщением об ошибке
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка");
      
      // Проверяем, что методы адаптера не были вызваны
      expect(mockAdapter.initialize).not.toHaveBeenCalled();
      expect(mockAdapter.removeHashtag).not.toHaveBeenCalled();
    });

    it("should handle error when removeHashtag fails", async () => {
      // Устанавливаем match для projectId и hashtag
      ctx.match = ["delete_hashtag_123_test", "123", "test"];
      
      // Мокируем ошибку в запросе
      mockAdapter.removeHashtag.mockRejectedValue(new Error("Database error"));
      
      // Вызываем обработчик
      await handleDeleteHashtagAction(ctx);
      
      // Проверяем, что был вызван метод reply с сообщением об ошибке
      expect(ctx.reply).toHaveBeenCalledWith("Произошла ошибка при удалении хештега.");
      
      // Проверяем, что был вызван метод answerCbQuery с сообщением об ошибке
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка");
      
      // Проверяем, что были вызваны методы адаптера
      expect(mockAdapter.initialize).toHaveBeenCalled();
      expect(mockAdapter.removeHashtag).toHaveBeenCalledWith(123, "test");
      expect(mockAdapter.close).toHaveBeenCalled();
      
      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });
  });

  describe("handleBackToProjectAction", () => {
    it("should leave scene and show message", async () => {
      // Вызываем обработчик
      await handleBackToProjectAction(ctx);
      
      // Проверяем, что был вызван метод leave
      expect(ctx.scene.leave).toHaveBeenCalled();
      
      // Проверяем, что был вызван метод reply с сообщением
      expect(ctx.reply).toHaveBeenCalledWith("Возврат к управлению проектом...");
      
      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });
  });
});
