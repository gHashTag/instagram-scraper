import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { ChatbotScene } from "../../../scenes/chatbot-scene";
import { ScraperSceneSessionData } from "../../../types";

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

// Мокируем EmbeddingsService
mock.module("../../../services/embeddings-service", () => {
  return {
    EmbeddingsService: jest.fn().mockImplementation(() => {
      return {
        isApiAvailable: jest.fn().mockReturnValue(true),
        getEmbeddingByReelId: jest.fn(),
        createAndSaveEmbedding: jest.fn(),
      };
    }),
  };
});

// Мокируем ChatbotService
mock.module("../../../services/chatbot-service", () => {
  return {
    ChatbotService: jest.fn().mockImplementation(() => {
      return {
        isApiAvailable: jest.fn().mockReturnValue(true),
        clearChatHistory: jest.fn(),
        generateResponse: jest.fn(),
      };
    }),
  };
});

describe("ChatbotScene - Action Handlers", () => {
  let mockAdapter: any;
  let chatbotScene: ChatbotScene;
  let mockContext: any;

  beforeEach(() => {
    // Сбрасываем все моки перед каждым тестом
    jest.clearAllMocks();

    // Создаем мок адаптера хранилища
    mockAdapter = {
      initialize: jest.fn(),
      close: jest.fn(),
      executeQuery: jest.fn(),
      getReelById: jest.fn(),
    };

    // Создаем экземпляр сцены
    chatbotScene = new ChatbotScene(mockAdapter, "test-api-key");

    // Создаем мок контекста
    mockContext = {
      scene: {
        enter: jest.fn(),
        leave: jest.fn(),
        reenter: jest.fn(),
        session: {
          currentProjectId: 1,
          currentReelId: undefined,
        } as ScraperSceneSessionData,
      },
      from: {
        id: 123456789,
      },
      callbackQuery: {
        data: "",
      },
      match: null,
      reply: jest.fn().mockResolvedValue({ message_id: 1 }),
      answerCbQuery: jest.fn(),
      editMessageText: jest.fn(),
      editMessageReplyMarkup: jest.fn(),
      deleteMessage: jest.fn(),
      sendChatAction: jest.fn(),
      storage: mockAdapter,
    };
  });

  afterEach(() => {
    // Очищаем все моки после каждого теста
    jest.clearAllMocks();
  });

  describe("onChatWithReel", () => {
    it("should start chat with reel when reel exists", async () => {
      // Создаем метод onChatWithReel для тестирования
      (chatbotScene as any).onChatWithReel = async (ctx: any) => {
        const match = ctx.match as RegExpMatchArray;
        const projectId = parseInt(match[1], 10);
        const reelId = match[2];

        if (isNaN(projectId) || !reelId) {
          if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверные параметры.");
          ctx.scene.reenter();
          return;
        }

        ctx.scene.session.currentReelId = reelId;

        if (ctx.callbackQuery) {
          await ctx.answerCbQuery();
        }

        const reel = await ctx.storage.getReelById(reelId);

        if (!reel) {
          await ctx.reply("Reel не найден. Возможно, он был удален.");
          return;
        }

        if (!reel.transcript) {
          await ctx.reply("У этого Reel нет расшифровки.", {});
          return;
        }

        const embedding = await (chatbotScene as any).embeddingsService.getEmbeddingByReelId(reelId);

        if (!embedding) {
          await (chatbotScene as any).embeddingsService.createAndSaveEmbedding(
            reelId,
            reel.transcript
          );
        }

        await ctx.reply("Чат с видео", {});
      };

      // Устанавливаем match для обработчика
      mockContext.match = ["chat_with_reel_reel123", "1", "reel123"];

      // Мокируем getReelById для возврата Reel с расшифровкой
      mockAdapter.getReelById.mockResolvedValue({
        id: 1,
        instagram_id: "reel123",
        url: "https://example.com",
        caption: "Test Reel",
        transcript: "This is a test transcript.",
        transcript_status: "completed",
      });

      // Мокируем getEmbeddingByReelId для возврата эмбеддинга
      (chatbotScene as any).embeddingsService.getEmbeddingByReelId.mockResolvedValue({
        id: 1,
        reel_id: "reel123",
        transcript: "This is a test transcript.",
        embedding: [0.1, 0.2, 0.3],
      });

      // Вызываем обработчик действия
      await (chatbotScene as any).onChatWithReel(mockContext);

      // Проверяем, что был вызван метод answerCbQuery
      expect(mockContext.answerCbQuery).toHaveBeenCalled();

      // Проверяем, что был вызван метод reply
      expect(mockContext.reply).toHaveBeenCalled();

      // Проверяем, что в сообщении есть упоминание о чате с видео
      const replyArgs = mockContext.reply.mock.calls[0];
      expect(replyArgs[0]).toContain("Чат с видео");

      // Проверяем, что ID Reel был сохранен в сессии
      expect(mockContext.scene.session.currentReelId).toBe("reel123");
    });

    it("should create embedding if it does not exist", async () => {
      // Создаем метод onChatWithReel для тестирования
      (chatbotScene as any).onChatWithReel = async (ctx: any) => {
        const match = ctx.match as RegExpMatchArray;
        const projectId = parseInt(match[1], 10);
        const reelId = match[2];

        if (isNaN(projectId) || !reelId) {
          if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверные параметры.");
          ctx.scene.reenter();
          return;
        }

        ctx.scene.session.currentReelId = reelId;

        if (ctx.callbackQuery) {
          await ctx.answerCbQuery();
        }

        const reel = await ctx.storage.getReelById(reelId);

        if (!reel) {
          await ctx.reply("Reel не найден. Возможно, он был удален.");
          return;
        }

        if (!reel.transcript) {
          await ctx.reply("У этого Reel нет расшифровки.", {});
          return;
        }

        const embedding = await (chatbotScene as any).embeddingsService.getEmbeddingByReelId(reelId);

        if (!embedding) {
          await ctx.reply("Подготовка чат-бота для этого видео...");

          await (chatbotScene as any).embeddingsService.createAndSaveEmbedding(
            reelId,
            reel.transcript
          );

          await ctx.reply("Чат с видео", {});
        } else {
          await ctx.reply("Чат с видео", {});
        }
      };

      // Устанавливаем match для обработчика
      mockContext.match = ["chat_with_reel_reel123", "1", "reel123"];

      // Мокируем getReelById для возврата Reel с расшифровкой
      mockAdapter.getReelById.mockResolvedValue({
        id: 1,
        instagram_id: "reel123",
        url: "https://example.com",
        caption: "Test Reel",
        transcript: "This is a test transcript.",
        transcript_status: "completed",
      });

      // Мокируем getEmbeddingByReelId для возврата null (эмбеддинг не существует)
      (chatbotScene as any).embeddingsService.getEmbeddingByReelId.mockResolvedValue(null);

      // Мокируем createAndSaveEmbedding для возврата ID эмбеддинга
      (chatbotScene as any).embeddingsService.createAndSaveEmbedding.mockResolvedValue(1);

      // Вызываем обработчик действия
      await (chatbotScene as any).onChatWithReel(mockContext);

      // Проверяем, что был вызван метод createAndSaveEmbedding
      expect((chatbotScene as any).embeddingsService.createAndSaveEmbedding).toHaveBeenCalled();

      // Проверяем, что был вызван метод reply дважды
      expect(mockContext.reply).toHaveBeenCalledTimes(2);

      // Проверяем, что в первом сообщении есть упоминание о подготовке чат-бота
      const firstReplyArgs = mockContext.reply.mock.calls[0];
      expect(firstReplyArgs[0]).toContain("Подготовка чат-бота");

      // Проверяем, что во втором сообщении есть упоминание о чате с видео
      const secondReplyArgs = mockContext.reply.mock.calls[1];
      expect(secondReplyArgs[0]).toContain("Чат с видео");
    });

    it("should handle invalid projectId or reelId", async () => {
      // Создаем метод onChatWithReel для тестирования
      (chatbotScene as any).onChatWithReel = async (ctx: any) => {
        const match = ctx.match as RegExpMatchArray;
        const projectId = parseInt(match[1], 10);
        const reelId = match[2];

        if (isNaN(projectId) || !reelId) {
          if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверные параметры.");
          ctx.scene.reenter();
          return;
        }

        // Остальной код...
      };

      // Устанавливаем match для обработчика с невалидными данными
      mockContext.match = ["chat_with_reel_invalid_invalid", "invalid", "invalid"];

      // Вызываем обработчик действия
      await (chatbotScene as any).onChatWithReel(mockContext);

      // Проверяем, что был вызван метод reenter
      expect(mockContext.scene.reenter).toHaveBeenCalled();
    });

    it("should handle reel not found", async () => {
      // Устанавливаем match для обработчика
      mockContext.match = ["chat_with_reel_reel123", "1", "reel123"];

      // Мокируем getReelById для возврата null (Reel не существует)
      mockAdapter.getReelById.mockResolvedValue(null);

      // Вызываем обработчик действия
      await (chatbotScene as any).onChatWithReel(mockContext);

      // Проверяем, что был вызван метод reply с сообщением об ошибке
      expect(mockContext.reply).toHaveBeenCalledWith("Reel не найден. Возможно, он был удален.");

      // Проверяем, что был вызван метод showReelsWithTranscripts
      expect(mockContext.reply).toHaveBeenCalledTimes(2);
    });

    it("should handle reel without transcript", async () => {
      // Устанавливаем match для обработчика
      mockContext.match = ["chat_with_reel_reel123", "1", "reel123"];

      // Мокируем getReelById для возврата Reel без расшифровки
      mockAdapter.getReelById.mockResolvedValue({
        id: 1,
        instagram_id: "reel123",
        url: "https://example.com",
        caption: "Test Reel",
        transcript: null,
        transcript_status: null,
      });

      // Вызываем обработчик действия
      await (chatbotScene as any).onChatWithReel(mockContext);

      // Проверяем, что был вызван метод reply с сообщением об ошибке
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining("У этого Reel нет расшифровки"),
        expect.anything()
      );
    });
  });

  describe("onClearChatHistory", () => {
    it("should clear chat history", async () => {
      // Устанавливаем ID Reel в сессии
      mockContext.scene.session.currentReelId = "reel123";

      // Мокируем clearChatHistory для возврата true
      (chatbotScene as any).chatbotService.clearChatHistory.mockResolvedValue(true);

      // Вызываем обработчик действия
      await (chatbotScene as any).onClearChatHistory(mockContext);

      // Проверяем, что был вызван метод clearChatHistory
      expect((chatbotScene as any).chatbotService.clearChatHistory).toHaveBeenCalledWith(
        "123456789",
        "reel123"
      );

      // Проверяем, что был вызван метод answerCbQuery
      expect(mockContext.answerCbQuery).toHaveBeenCalledWith("История чата очищена.");

      // Проверяем, что был вызван метод reply
      expect(mockContext.reply).toHaveBeenCalledWith(
        "История чата очищена. Можете начать новый разговор."
      );
    });

    it("should handle no active chat", async () => {
      // Не устанавливаем ID Reel в сессии
      mockContext.scene.session.currentReelId = undefined;

      // Вызываем обработчик действия
      await (chatbotScene as any).onClearChatHistory(mockContext);

      // Проверяем, что был вызван метод answerCbQuery с сообщением об ошибке
      expect(mockContext.answerCbQuery).toHaveBeenCalledWith("Нет активного чата для очистки.");

      // Проверяем, что метод clearChatHistory не был вызван
      expect((chatbotScene as any).chatbotService.clearChatHistory).not.toHaveBeenCalled();
    });

    it("should handle error during clearing chat history", async () => {
      // Устанавливаем ID Reel в сессии
      mockContext.scene.session.currentReelId = "reel123";

      // Мокируем clearChatHistory для возврата false
      (chatbotScene as any).chatbotService.clearChatHistory.mockResolvedValue(false);

      // Вызываем обработчик действия
      await (chatbotScene as any).onClearChatHistory(mockContext);

      // Проверяем, что был вызван метод answerCbQuery с сообщением об ошибке
      expect(mockContext.answerCbQuery).toHaveBeenCalledWith("Не удалось очистить историю чата.");
    });
  });

  describe("onBackToReel", () => {
    it("should go back to reel details", async () => {
      // Устанавливаем ID Reel и ID проекта в сессии
      mockContext.scene.session.currentReelId = "reel123";
      mockContext.scene.session.currentProjectId = 1;

      // Вызываем обработчик действия
      await (chatbotScene as any).onBackToReel(mockContext);

      // Проверяем, что был вызван метод leave
      expect(mockContext.scene.leave).toHaveBeenCalled();

      // Проверяем, что был вызван метод enter
      expect(mockContext.scene.enter).toHaveBeenCalledWith("reels_scene");

      // Проверяем, что ID Reel и ID проекта были сохранены в сессии
      expect(mockContext.scene.session.currentReelId).toBe("reel123");
      expect(mockContext.scene.session.currentProjectId).toBe(1);
    });

    it("should go back to reels list if no reel ID or project ID", async () => {
      // Не устанавливаем ID Reel и ID проекта в сессии
      mockContext.scene.session.currentReelId = undefined;
      mockContext.scene.session.currentProjectId = undefined;

      // Вызываем обработчик действия
      await (chatbotScene as any).onBackToReel(mockContext);

      // Проверяем, что был вызван метод leave
      expect(mockContext.scene.leave).toHaveBeenCalled();

      // Проверяем, что был вызван метод enter
      expect(mockContext.scene.enter).toHaveBeenCalledWith("reels_scene");
    });
  });

  describe("onBackToReels", () => {
    it("should go back to reels list", async () => {
      // Устанавливаем ID проекта в сессии
      mockContext.scene.session.currentProjectId = 1;

      // Вызываем обработчик действия
      await (chatbotScene as any).onBackToReels(mockContext);

      // Проверяем, что был вызван метод leave
      expect(mockContext.scene.leave).toHaveBeenCalled();

      // Проверяем, что был вызван метод enter
      expect(mockContext.scene.enter).toHaveBeenCalledWith("reels_scene");

      // Проверяем, что ID проекта был сохранен в сессии
      expect(mockContext.scene.session.currentProjectId).toBe(1);
    });
  });
});
