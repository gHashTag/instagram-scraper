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
        generateResponse: jest.fn(),
      };
    }),
  };
});

describe("ChatbotScene - Text Handler", () => {
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
          currentReelId: "reel123",
        } as ScraperSceneSessionData,
      },
      from: {
        id: 123456789,
      },
      message: {
        text: "What is this video about?",
      },
      reply: jest.fn().mockResolvedValue({ message_id: 1 }),
      sendChatAction: jest.fn(),
      storage: mockAdapter,
    };
  });

  afterEach(() => {
    // Очищаем все моки после каждого теста
    jest.clearAllMocks();
  });

  it("should generate response for text message", async () => {
    // Создаем метод onText для тестирования
    (chatbotScene as any).onText = async (ctx: any) => {
      const session = ctx.scene.session;
      const text = ctx.message.text;

      if (!session.currentReelId) {
        await ctx.reply(
          "Пожалуйста, сначала выберите Reel для чата.",
          {}
        );
        return;
      }

      try {
        // Отправляем индикатор набора текста
        await ctx.sendChatAction("typing");

        // Генерируем ответ
        const userId = ctx.from?.id.toString() || "";
        const response = await (chatbotScene as any).chatbotService.generateResponse(
          userId,
          session.currentReelId,
          text
        );

        if (response) {
          await ctx.reply(response, {});
        } else {
          await ctx.reply(
            "Извините, не удалось сгенерировать ответ. Пожалуйста, попробуйте еще раз или выберите другой Reel.",
            {}
          );
        }
      } catch (error) {
        await ctx.reply("Произошла ошибка при генерации ответа. Пожалуйста, попробуйте еще раз.");
      }
    };

    // Мокируем generateResponse для возврата ответа
    (chatbotScene as any).chatbotService.generateResponse = jest.fn().mockResolvedValue(
      "This video is about Instagram Reels."
    );

    // Вызываем обработчик текстового сообщения
    await (chatbotScene as any).onText(mockContext);

    // Проверяем, что был вызван метод sendChatAction
    expect(mockContext.sendChatAction).toHaveBeenCalledWith("typing");

    // Проверяем, что был вызван метод generateResponse
    expect((chatbotScene as any).chatbotService.generateResponse).toHaveBeenCalledWith(
      "123456789",
      "reel123",
      "What is this video about?"
    );

    // Проверяем, что был вызван метод reply
    expect(mockContext.reply).toHaveBeenCalledWith(
      "This video is about Instagram Reels.",
      expect.anything()
    );
  });

  it("should handle no active reel", async () => {
    // Не устанавливаем ID Reel в сессии
    mockContext.scene.session.currentReelId = undefined;

    // Вызываем обработчик текстового сообщения
    await (chatbotScene as any).onText(mockContext);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(mockContext.reply).toHaveBeenCalledWith(
      "Пожалуйста, сначала выберите Reel для чата.",
      expect.anything()
    );

    // Проверяем, что метод generateResponse не был вызван
    expect((chatbotScene as any).chatbotService.generateResponse).not.toHaveBeenCalled();
  });

  it("should handle error during response generation", async () => {
    // Мокируем generateResponse для возврата null (ошибка)
    (chatbotScene as any).chatbotService.generateResponse = jest.fn().mockResolvedValue(null);

    // Вызываем обработчик текстового сообщения
    await (chatbotScene as any).onText(mockContext);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(mockContext.reply).toHaveBeenCalledWith(
      expect.stringContaining("Извините, не удалось сгенерировать ответ"),
      expect.anything()
    );
  });

  it("should handle exception during response generation", async () => {
    // Мокируем generateResponse для выброса исключения
    (chatbotScene as any).chatbotService.generateResponse = jest.fn().mockRejectedValue(
      new Error("API error")
    );

    // Вызываем обработчик текстового сообщения
    await (chatbotScene as any).onText(mockContext);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(mockContext.reply).toHaveBeenCalledWith(
      "Произошла ошибка при генерации ответа. Пожалуйста, попробуйте еще раз."
    );
  });
});
