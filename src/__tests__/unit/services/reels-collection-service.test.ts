import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { ReelsCollectionService } from "../../../services/reels-collection-service";
import { createMockReelContent } from "../../helpers/mocks";
import { ReelsCollection } from "../../../schemas";

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

describe("ReelsCollectionService", () => {
  let mockAdapter: any;
  let collectionService: ReelsCollectionService;

  beforeEach(() => {
    // Сбрасываем все моки перед каждым тестом
    jest.clearAllMocks();

    // Создаем мок адаптера хранилища
    mockAdapter = {
      createReelsCollection: jest.fn(),
      getReelsCollectionsByProjectId: jest.fn(),
      getReelsCollectionById: jest.fn(),
      updateReelsCollection: jest.fn(),
      deleteReelsCollection: jest.fn(),
      processReelsCollection: jest.fn(),
      getReels: jest.fn(),
    };

    // Создаем экземпляр сервиса
    collectionService = new ReelsCollectionService(mockAdapter);
  });

  afterEach(() => {
    // Очищаем все моки после каждого теста
    jest.clearAllMocks();
  });

  describe("createCollection", () => {
    it("should create a new collection", async () => {
      // Мокируем возвращаемое значение
      const mockCollection: ReelsCollection = {
        id: 1,
        project_id: 123,
        name: "Test Collection",
        description: "Test Description",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_processed: false,
      };

      mockAdapter.createReelsCollection.mockResolvedValue(mockCollection);

      // Вызываем метод
      const result = await collectionService.createCollection(
        123,
        "Test Collection",
        "Test Description"
      );

      // Проверяем, что метод адаптера был вызван с правильными параметрами
      expect(mockAdapter.createReelsCollection).toHaveBeenCalledWith(
        123,
        "Test Collection",
        "Test Description",
        undefined,
        undefined
      );

      // Проверяем результат
      expect(result).toEqual(mockCollection);
    });

    it("should throw an error if adapter method is not implemented", async () => {
      // Удаляем метод из адаптера
      mockAdapter.createReelsCollection = undefined;

      // Проверяем, что метод выбрасывает исключение
      await expect(
        collectionService.createCollection(123, "Test Collection")
      ).rejects.toThrow("Метод createReelsCollection не реализован в адаптере хранилища");
    });
  });

  describe("getCollectionsByProjectId", () => {
    it("should return collections for a project", async () => {
      // Мокируем возвращаемое значение
      const mockCollections: ReelsCollection[] = [
        {
          id: 1,
          project_id: 123,
          name: "Collection 1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_processed: false,
        },
        {
          id: 2,
          project_id: 123,
          name: "Collection 2",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_processed: true,
        },
      ];

      mockAdapter.getReelsCollectionsByProjectId.mockResolvedValue(mockCollections);

      // Вызываем метод
      const result = await collectionService.getCollectionsByProjectId(123);

      // Проверяем, что метод адаптера был вызван с правильными параметрами
      expect(mockAdapter.getReelsCollectionsByProjectId).toHaveBeenCalledWith(123);

      // Проверяем результат
      expect(result).toEqual(mockCollections);
    });

    it("should return empty array if adapter method is not implemented", async () => {
      // Удаляем метод из адаптера
      mockAdapter.getReelsCollectionsByProjectId = undefined;

      // Вызываем метод
      const result = await collectionService.getCollectionsByProjectId(123);

      // Проверяем результат
      expect(result).toEqual([]);
    });
  });

  describe("getCollectionById", () => {
    it("should return a collection by ID", async () => {
      // Мокируем возвращаемое значение
      const mockCollection: ReelsCollection = {
        id: 1,
        project_id: 123,
        name: "Test Collection",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_processed: false,
      };

      mockAdapter.getReelsCollectionById.mockResolvedValue(mockCollection);

      // Вызываем метод
      const result = await collectionService.getCollectionById(1);

      // Проверяем, что метод адаптера был вызван с правильными параметрами
      expect(mockAdapter.getReelsCollectionById).toHaveBeenCalledWith(1);

      // Проверяем результат
      expect(result).toEqual(mockCollection);
    });

    it("should return null if adapter method is not implemented", async () => {
      // Удаляем метод из адаптера
      mockAdapter.getReelsCollectionById = undefined;

      // Вызываем метод
      const result = await collectionService.getCollectionById(1);

      // Проверяем результат
      expect(result).toBeNull();
    });
  });

  describe("updateCollection", () => {
    it("should update a collection", async () => {
      // Мокируем возвращаемое значение
      const mockCollection: ReelsCollection = {
        id: 1,
        project_id: 123,
        name: "Updated Collection",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_processed: false,
      };

      mockAdapter.updateReelsCollection.mockResolvedValue(mockCollection);

      // Вызываем метод
      const result = await collectionService.updateCollection(1, { name: "Updated Collection" });

      // Проверяем, что метод адаптера был вызван с правильными параметрами
      expect(mockAdapter.updateReelsCollection).toHaveBeenCalledWith(1, { name: "Updated Collection" });

      // Проверяем результат
      expect(result).toEqual(mockCollection);
    });

    it("should return null if adapter method is not implemented", async () => {
      // Удаляем метод из адаптера
      mockAdapter.updateReelsCollection = undefined;

      // Вызываем метод
      const result = await collectionService.updateCollection(1, { name: "Updated Collection" });

      // Проверяем результат
      expect(result).toBeNull();
    });
  });

  describe("deleteCollection", () => {
    it("should delete a collection", async () => {
      // Мокируем возвращаемое значение
      mockAdapter.deleteReelsCollection.mockResolvedValue(true);

      // Вызываем метод
      const result = await collectionService.deleteCollection(1);

      // Проверяем, что метод адаптера был вызван с правильными параметрами
      expect(mockAdapter.deleteReelsCollection).toHaveBeenCalledWith(1);

      // Проверяем результат
      expect(result).toBe(true);
    });

    it("should return false if adapter method is not implemented", async () => {
      // Удаляем метод из адаптера
      mockAdapter.deleteReelsCollection = undefined;

      // Вызываем метод
      const result = await collectionService.deleteCollection(1);

      // Проверяем результат
      expect(result).toBe(false);
    });
  });

  describe("processCollection", () => {
    it("should process a collection", async () => {
      // Мокируем возвращаемое значение для getCollectionById
      const mockCollection: ReelsCollection = {
        id: 1,
        project_id: 123,
        name: "Test Collection",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_processed: false,
      };

      mockAdapter.getReelsCollectionById.mockResolvedValue(mockCollection);

      // Мокируем возвращаемое значение для getReels
      const mockReels = [
        createMockReelContent({
          id: 1,
          project_id: 123,
          instagram_id: "reel1",
          views: 1000,
          likes: 100,
          comments_count: 10,
          published_at: "2023-01-01T00:00:00Z",
        }),
        createMockReelContent({
          id: 2,
          project_id: 123,
          instagram_id: "reel2",
          views: 2000,
          likes: 200,
          comments_count: 20,
          published_at: "2023-01-02T00:00:00Z",
        }),
      ];

      mockAdapter.getReels.mockResolvedValue(mockReels);

      // Мокируем возвращаемое значение для updateReelsCollection
      const mockProcessedCollection: ReelsCollection = {
        ...mockCollection,
        is_processed: true,
        processing_status: "completed",
        content_format: "text",
        content_data: "Test content",
      };

      mockAdapter.updateReelsCollection.mockResolvedValue(mockProcessedCollection);

      // Вызываем метод
      const result = await collectionService.processCollection(1, "text");

      // Проверяем, что методы адаптера были вызваны с правильными параметрами
      expect(mockAdapter.getReelsCollectionById).toHaveBeenCalledWith(1);
      expect(mockAdapter.getReels).toHaveBeenCalledWith({ projectId: 123 });
      expect(mockAdapter.updateReelsCollection).toHaveBeenCalled();

      // Проверяем результат
      expect(result).toEqual(mockProcessedCollection);
    });

    it("should return null if collection is not found", async () => {
      // Мокируем возвращаемое значение для getCollectionById
      mockAdapter.getReelsCollectionById.mockResolvedValue(null);

      // Вызываем метод
      const result = await collectionService.processCollection(1, "text");

      // Проверяем результат
      expect(result).toBeNull();
    });

    it("should return null if adapter method is not implemented", async () => {
      // Удаляем метод из адаптера
      mockAdapter.processReelsCollection = undefined;

      // Вызываем метод
      const result = await collectionService.processCollection(1, "text");

      // Проверяем результат
      expect(result).toBeNull();
    });
  });
});
