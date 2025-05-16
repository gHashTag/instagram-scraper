import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
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
        embeddings: {
          create: jest.fn().mockResolvedValue({
            data: [
              {
                embedding: [0.1, 0.2, 0.3],
              },
            ],
          }),
        },
      };
    }),
  };
});

describe("EmbeddingsService", () => {
  let mockAdapter: any;
  let embeddingsService: EmbeddingsService;
  let mockOpenAI: any;

  beforeEach(() => {
    // Сбрасываем все моки перед каждым тестом
    jest.clearAllMocks();

    // Создаем мок адаптера хранилища
    mockAdapter = {
      executeQuery: jest.fn(),
    };

    // Создаем экземпляр сервиса
    embeddingsService = new EmbeddingsService(mockAdapter, "test-api-key");

    // Получаем доступ к моку OpenAI
    mockOpenAI = require("openai").OpenAI;
  });

  afterEach(() => {
    // Очищаем все моки после каждого теста
    jest.clearAllMocks();
  });

  describe("isApiAvailable", () => {
    it("should return true when API key is provided", () => {
      expect(embeddingsService.isApiAvailable()).toBe(true);
    });

    it("should return false when API key is not provided", () => {
      // Создаем новый экземпляр сервиса без API ключа и с мокированным openai = null
      const serviceWithoutKey = new EmbeddingsService(mockAdapter);
      // Явно устанавливаем openai в null для теста
      (serviceWithoutKey as any).openai = null;

      expect(serviceWithoutKey.isApiAvailable()).toBe(false);
    });
  });

  describe("createEmbedding", () => {
    it("should return null if API is not available", async () => {
      // Мокируем isApiAvailable для возврата false
      jest.spyOn(EmbeddingsService.prototype, "isApiAvailable").mockReturnValueOnce(false);

      const serviceWithoutKey = new EmbeddingsService(mockAdapter);
      const result = await serviceWithoutKey.createEmbedding("test");
      expect(result).toBeNull();

      // Восстанавливаем оригинальный метод
      jest.restoreAllMocks();
    });

    it("should create embedding using OpenAI API", async () => {
      // Мокируем OpenAI для возврата эмбеддинга
      const mockOpenAIInstance = {
        embeddings: {
          create: jest.fn().mockResolvedValue({
            data: [
              {
                embedding: [0.1, 0.2, 0.3],
              },
            ],
          }),
        },
      };

      // Устанавливаем мок OpenAI в сервис
      (embeddingsService as any).openai = mockOpenAIInstance;

      const result = await embeddingsService.createEmbedding("test");

      // Проверяем, что OpenAI API был вызван с правильными параметрами
      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledWith({
        model: "text-embedding-3-small",
        input: "test",
        dimensions: 1536,
      });

      // Проверяем результат
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it("should handle errors from OpenAI API", async () => {
      // Мокируем OpenAI для возврата ошибки
      const mockOpenAIInstance = {
        embeddings: {
          create: jest.fn().mockRejectedValue(new Error("API error")),
        },
      };

      // Устанавливаем мок OpenAI в сервис
      (embeddingsService as any).openai = mockOpenAIInstance;

      const result = await embeddingsService.createEmbedding("test");

      // Проверяем, что результат равен null
      expect(result).toBeNull();
    });
  });

  describe("createAndSaveEmbedding", () => {
    it("should return null if embedding creation fails", async () => {
      // Мокируем ошибку при создании эмбеддинга
      jest.spyOn(embeddingsService, "createEmbedding").mockResolvedValueOnce(null);

      const result = await embeddingsService.createAndSaveEmbedding("reel123", "test");

      // Проверяем, что результат равен null
      expect(result).toBeNull();

      // Проверяем, что executeQuery не был вызван
      expect(mockAdapter.executeQuery).not.toHaveBeenCalled();
    });

    it("should save embedding to database", async () => {
      // Мокируем успешное создание эмбеддинга
      jest.spyOn(embeddingsService, "createEmbedding").mockResolvedValueOnce([0.1, 0.2, 0.3]);

      // Мокируем успешное сохранение в базу данных
      mockAdapter.executeQuery.mockResolvedValueOnce({
        rows: [{ id: 1 }],
      });

      const result = await embeddingsService.createAndSaveEmbedding("reel123", "test");

      // Проверяем, что executeQuery был вызван с правильными параметрами
      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO transcript_embeddings"),
        ["reel123", "test", [0.1, 0.2, 0.3]]
      );

      // Проверяем результат
      expect(result).toBe(1);
    });

    it("should return null if database query fails", async () => {
      // Мокируем успешное создание эмбеддинга
      jest.spyOn(embeddingsService, "createEmbedding").mockResolvedValueOnce([0.1, 0.2, 0.3]);

      // Мокируем ошибку при сохранении в базу данных
      mockAdapter.executeQuery.mockResolvedValueOnce(null);

      const result = await embeddingsService.createAndSaveEmbedding("reel123", "test");

      // Проверяем, что результат равен null
      expect(result).toBeNull();
    });
  });

  describe("searchSimilarTranscripts", () => {
    it("should return null if embedding creation fails", async () => {
      // Мокируем ошибку при создании эмбеддинга
      jest.spyOn(embeddingsService, "createEmbedding").mockResolvedValueOnce(null);

      const result = await embeddingsService.searchSimilarTranscripts("test");

      // Проверяем, что результат равен null
      expect(result).toBeNull();

      // Проверяем, что executeQuery не был вызван
      expect(mockAdapter.executeQuery).not.toHaveBeenCalled();
    });

    it("should search for similar transcripts", async () => {
      // Мокируем успешное создание эмбеддинга
      jest.spyOn(embeddingsService, "createEmbedding").mockResolvedValueOnce([0.1, 0.2, 0.3]);

      // Мокируем успешный поиск в базе данных
      mockAdapter.executeQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, reel_id: "reel123", transcript: "test", similarity: 0.9 },
          { id: 2, reel_id: "reel456", transcript: "test2", similarity: 0.8 },
        ],
      });

      const result = await embeddingsService.searchSimilarTranscripts("test", 2);

      // Проверяем, что executeQuery был вызван с правильными параметрами
      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id, reel_id, transcript"),
        [[0.1, 0.2, 0.3], 2]
      );

      // Проверяем результат
      expect(result).toEqual([
        { id: 1, reel_id: "reel123", transcript: "test", similarity: 0.9 },
        { id: 2, reel_id: "reel456", transcript: "test2", similarity: 0.8 },
      ]);
    });

    it("should return null if database query fails", async () => {
      // Мокируем успешное создание эмбеддинга
      jest.spyOn(embeddingsService, "createEmbedding").mockResolvedValueOnce([0.1, 0.2, 0.3]);

      // Мокируем ошибку при поиске в базе данных
      mockAdapter.executeQuery.mockResolvedValueOnce(null);

      const result = await embeddingsService.searchSimilarTranscripts("test");

      // Проверяем, что результат равен null
      expect(result).toBeNull();
    });
  });

  describe("getEmbeddingByReelId", () => {
    it("should return embedding for reel", async () => {
      // Мокируем успешный запрос к базе данных
      mockAdapter.executeQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, reel_id: "reel123", transcript: "test", embedding: [0.1, 0.2, 0.3] },
        ],
      });

      const result = await embeddingsService.getEmbeddingByReelId("reel123");

      // Проверяем, что executeQuery был вызван с правильными параметрами
      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id, reel_id, transcript, embedding"),
        ["reel123"]
      );

      // Проверяем результат
      expect(result).toEqual({
        id: 1,
        reel_id: "reel123",
        transcript: "test",
        embedding: [0.1, 0.2, 0.3],
      });
    });

    it("should return null if embedding not found", async () => {
      // Мокируем пустой результат запроса
      mockAdapter.executeQuery.mockResolvedValueOnce({
        rows: [],
      });

      const result = await embeddingsService.getEmbeddingByReelId("reel123");

      // Проверяем, что результат равен null
      expect(result).toBeNull();
    });

    it("should return null if database query fails", async () => {
      // Мокируем ошибку при запросе к базе данных
      mockAdapter.executeQuery.mockResolvedValueOnce(null);

      const result = await embeddingsService.getEmbeddingByReelId("reel123");

      // Проверяем, что результат равен null
      expect(result).toBeNull();
    });
  });

  describe("updateEmbedding", () => {
    it("should return false if API is not available", async () => {
      // Мокируем isApiAvailable для возврата false
      jest.spyOn(embeddingsService, "isApiAvailable").mockReturnValueOnce(false);

      const result = await embeddingsService.updateEmbedding("reel123", "test");

      // Проверяем, что результат равен false
      expect(result).toBe(false);

      // Восстанавливаем оригинальный метод
      jest.restoreAllMocks();
    });

    it("should update embedding in database", async () => {
      // Мокируем успешное создание эмбеддинга
      jest.spyOn(embeddingsService, "createEmbedding").mockResolvedValueOnce([0.1, 0.2, 0.3]);

      // Мокируем успешное обновление в базе данных
      mockAdapter.executeQuery.mockResolvedValueOnce({
        rowCount: 1,
      });

      const result = await embeddingsService.updateEmbedding("reel123", "test");

      // Проверяем, что executeQuery был вызван с правильными параметрами
      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE transcript_embeddings"),
        ["reel123", "test", [0.1, 0.2, 0.3]]
      );

      // Проверяем результат
      expect(result).toBe(true);
    });

    it("should return false if embedding creation fails", async () => {
      // Мокируем ошибку при создании эмбеддинга
      jest.spyOn(embeddingsService, "createEmbedding").mockResolvedValueOnce(null);

      const result = await embeddingsService.updateEmbedding("reel123", "test");

      // Проверяем, что результат равен false
      expect(result).toBe(false);

      // Проверяем, что executeQuery не был вызван
      expect(mockAdapter.executeQuery).not.toHaveBeenCalled();
    });

    it("should return false if database query fails", async () => {
      // Мокируем успешное создание эмбеддинга
      jest.spyOn(embeddingsService, "createEmbedding").mockResolvedValueOnce([0.1, 0.2, 0.3]);

      // Мокируем ошибку при обновлении в базе данных
      mockAdapter.executeQuery.mockResolvedValueOnce(null);

      const result = await embeddingsService.updateEmbedding("reel123", "test");

      // Проверяем, что результат равен false
      expect(result).toBe(false);
    });
  });

  describe("deleteEmbedding", () => {
    it("should delete embedding from database", async () => {
      // Мокируем успешное удаление из базы данных
      mockAdapter.executeQuery.mockResolvedValueOnce({
        rowCount: 1,
      });

      const result = await embeddingsService.deleteEmbedding("reel123");

      // Проверяем, что executeQuery был вызван с правильными параметрами
      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM transcript_embeddings"),
        ["reel123"]
      );

      // Проверяем результат
      expect(result).toBe(true);
    });

    it("should return false if database query fails", async () => {
      // Мокируем ошибку при удалении из базы данных
      mockAdapter.executeQuery.mockResolvedValueOnce(null);

      const result = await embeddingsService.deleteEmbedding("reel123");

      // Проверяем, что результат равен false
      expect(result).toBe(false);
    });
  });
});
