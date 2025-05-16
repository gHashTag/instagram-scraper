import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { ChatbotService } from "../../../services/chatbot-service";
import { EmbeddingsService } from "../../../services/embeddings-service";

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

// Мокируем OpenAI
mock.module("openai", () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => {
      return {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: "Mocked response",
                  },
                },
              ],
            }),
          },
        },
      };
    }),
  };
});

describe("ChatbotService", () => {
  let mockAdapter: any;
  let mockEmbeddingsService: any;
  let chatbotService: ChatbotService;
  let mockOpenAI: any;

  beforeEach(() => {
    // Сбрасываем все моки перед каждым тестом
    jest.clearAllMocks();

    // Создаем мок адаптера хранилища
    mockAdapter = {
      executeQuery: jest.fn(),
    };

    // Создаем мок сервиса эмбеддингов
    mockEmbeddingsService = {
      isApiAvailable: jest.fn().mockReturnValue(true),
      getEmbeddingByReelId: jest.fn(),
    };

    // Создаем экземпляр сервиса
    chatbotService = new ChatbotService(mockAdapter, mockEmbeddingsService as EmbeddingsService, "test-api-key");

    // Получаем доступ к моку OpenAI
    mockOpenAI = require("openai").OpenAI;
  });

  afterEach(() => {
    // Очищаем все моки после каждого теста
    jest.clearAllMocks();
  });

  describe("isApiAvailable", () => {
    it("should return true when API key is provided", () => {
      expect(chatbotService.isApiAvailable()).toBe(true);
    });

    it("should return false when API key is not provided", () => {
      // Создаем новый экземпляр сервиса без API ключа и с мокированным openai = null
      const serviceWithoutKey = new ChatbotService(mockAdapter, mockEmbeddingsService as EmbeddingsService);
      // Явно устанавливаем openai в null для теста
      (serviceWithoutKey as any).openai = null;

      expect(serviceWithoutKey.isApiAvailable()).toBe(false);
    });
  });

  describe("saveChatMessage", () => {
    it("should save chat message to database", async () => {
      // Мокируем успешное сохранение в базу данных
      mockAdapter.executeQuery.mockResolvedValueOnce({
        rows: [{ id: 1 }],
      });

      const result = await chatbotService.saveChatMessage("user123", "reel123", "Hello", "user");

      // Проверяем, что executeQuery был вызван с правильными параметрами
      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO chat_history"),
        ["user123", "reel123", "Hello", "user"]
      );

      // Проверяем результат
      expect(result).toBe(1);
    });

    it("should return null if database query fails", async () => {
      // Мокируем ошибку при сохранении в базу данных
      mockAdapter.executeQuery.mockResolvedValueOnce(null);

      const result = await chatbotService.saveChatMessage("user123", "reel123", "Hello", "user");

      // Проверяем, что результат равен null
      expect(result).toBeNull();
    });
  });

  describe("getChatHistory", () => {
    it("should return chat history from database", async () => {
      // Мокируем успешный запрос к базе данных
      mockAdapter.executeQuery.mockResolvedValueOnce({
        rows: [
          { role: "user", message: "Hello" },
          { role: "assistant", message: "Hi there" },
        ],
      });

      const result = await chatbotService.getChatHistory("user123", "reel123", 10);

      // Проверяем, что executeQuery был вызван с правильными параметрами
      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT role, message"),
        ["user123", "reel123", 10]
      );

      // Проверяем результат
      expect(result).toEqual([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ]);
    });

    it("should return null if database query fails", async () => {
      // Мокируем ошибку при запросе к базе данных
      mockAdapter.executeQuery.mockResolvedValueOnce(null);

      const result = await chatbotService.getChatHistory("user123", "reel123");

      // Проверяем, что результат равен null
      expect(result).toBeNull();
    });
  });

  describe("generateResponse", () => {
    it("should return null if API is not available", async () => {
      // Мокируем недоступность API
      jest.spyOn(chatbotService, "isApiAvailable").mockReturnValueOnce(false);

      const result = await chatbotService.generateResponse("user123", "reel123", "Hello");

      // Проверяем, что результат равен null
      expect(result).toBeNull();
    });

    it("should return default message if embedding not found", async () => {
      // Мокируем отсутствие эмбеддинга
      mockEmbeddingsService.getEmbeddingByReelId.mockResolvedValueOnce(null);

      // Мокируем saveChatMessage
      jest.spyOn(chatbotService as any, "saveChatMessage").mockResolvedValueOnce(1);

      const result = await chatbotService.generateResponse("user123", "reel123", "Hello");

      // Проверяем результат
      expect(result).toContain("Извините, я не могу ответить на этот вопрос");
    });

    it("should generate response using OpenAI API", async () => {
      // Мокируем наличие эмбеддинга
      mockEmbeddingsService.getEmbeddingByReelId.mockResolvedValueOnce({
        id: 1,
        reel_id: "reel123",
        transcript: "This is a test transcript",
      });

      // Мокируем saveChatMessage
      jest.spyOn(chatbotService as any, "saveChatMessage").mockResolvedValueOnce(1);

      // Мокируем getChatHistory
      jest.spyOn(chatbotService as any, "getChatHistory").mockResolvedValueOnce([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ]);

      // Мокируем OpenAI для возврата ответа
      const mockOpenAIInstance = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: "Mocked response",
                  },
                },
              ],
            }),
          },
        },
      };

      // Устанавливаем мок OpenAI в сервис
      (chatbotService as any).openai = mockOpenAIInstance;

      // Мокируем второй вызов saveChatMessage для ответа ассистента
      jest.spyOn(chatbotService as any, "saveChatMessage").mockResolvedValueOnce(2);

      const result = await chatbotService.generateResponse("user123", "reel123", "Hello");

      // Проверяем, что OpenAI API был вызван с правильными параметрами
      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith({
        model: "gpt-3.5-turbo",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user", content: "Hello" }),
          expect.objectContaining({ role: "assistant", content: "Hi there" }),
        ]),
        max_tokens: 500,
        temperature: 0.7,
      });

      // Проверяем результат
      expect(result).toBe("Mocked response");
    });
  });

  describe("clearChatHistory", () => {
    it("should clear chat history from database", async () => {
      // Мокируем успешное удаление из базы данных
      mockAdapter.executeQuery.mockResolvedValueOnce({
        rowCount: 2,
      });

      const result = await chatbotService.clearChatHistory("user123", "reel123");

      // Проверяем, что executeQuery был вызван с правильными параметрами
      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM chat_history"),
        ["user123", "reel123"]
      );

      // Проверяем результат
      expect(result).toBe(true);
    });

    it("should return false if database query fails", async () => {
      // Мокируем ошибку при удалении из базы данных
      mockAdapter.executeQuery.mockResolvedValueOnce(null);

      const result = await chatbotService.clearChatHistory("user123", "reel123");

      // Проверяем, что результат равен false
      expect(result).toBe(false);
    });
  });
});
