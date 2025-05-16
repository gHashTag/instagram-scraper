import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { NotificationService } from "../../../services/notification-service";
import { createMockReelContent, createMockProject, createMockUser } from "../../helpers/mocks";

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

describe("NotificationService", () => {
  // Создаем моки для Telegraf и хранилища
  let mockBot;
  let mockStorage;
  let notificationService;

  beforeEach(() => {
    // Сбрасываем все моки перед каждым тестом
    jest.clearAllMocks();

    // Создаем мок для Telegraf
    mockBot = {
      telegram: {
        sendMessage: jest.fn().mockResolvedValue({}),
      },
    };

    // Создаем мок для хранилища
    mockStorage = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getNotificationSettings: jest.fn(),
      getProjectById: jest.fn(),
      getUserById: jest.fn(),
      getReels: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Создаем экземпляр сервиса уведомлений
    notificationService = new NotificationService(mockBot, mockStorage);
  });

  afterEach(() => {
    // Очищаем все моки после каждого теста
    jest.clearAllMocks();
  });

  describe("sendNewReelsNotification", () => {
    it("should send notification about new reels", async () => {
      // Мокируем результаты запросов
      const mockSettings = {
        user_id: 1,
        new_reels_enabled: true,
        trends_enabled: true,
        weekly_report_enabled: true,
      };
      const mockProject = createMockProject({ id: 123, user_id: 1, name: "Test Project" });
      const mockUser = createMockUser({ id: 1, telegram_id: 123456789 });
      const mockReels = [
        createMockReelContent({
          id: 1,
          project_id: 123,
          instagram_id: "reel1",
          views: 1000,
          published_at: "2023-01-01T00:00:00Z",
        }),
        createMockReelContent({
          id: 2,
          project_id: 123,
          instagram_id: "reel2",
          views: 5000,
          published_at: "2023-01-02T00:00:00Z",
        }),
      ];

      mockStorage.getNotificationSettings.mockResolvedValue(mockSettings);
      mockStorage.getProjectById.mockResolvedValue(mockProject);
      mockStorage.getUserById.mockResolvedValue(mockUser);

      // Вызываем метод
      await notificationService.sendNewReelsNotification(1, 123, mockReels);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getNotificationSettings).toHaveBeenCalledWith(1);
      expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
      expect(mockStorage.getUserById).toHaveBeenCalledWith(1);
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод sendMessage
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        123456789,
        expect.stringContaining("Новые Reels для проекта"),
        expect.anything()
      );
    });

    it("should not send notification if new_reels_enabled is false", async () => {
      // Мокируем результаты запросов
      const mockSettings = {
        user_id: 1,
        new_reels_enabled: false,
        trends_enabled: true,
        weekly_report_enabled: true,
      };

      mockStorage.getNotificationSettings.mockResolvedValue(mockSettings);

      // Вызываем метод
      await notificationService.sendNewReelsNotification(1, 123, []);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getNotificationSettings).toHaveBeenCalledWith(1);
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что не был вызван метод sendMessage
      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it("should handle error when project is not found", async () => {
      // Мокируем результаты запросов
      const mockSettings = {
        user_id: 1,
        new_reels_enabled: true,
        trends_enabled: true,
        weekly_report_enabled: true,
      };

      mockStorage.getNotificationSettings.mockResolvedValue(mockSettings);
      mockStorage.getProjectById.mockResolvedValue(null);

      // Вызываем метод
      await notificationService.sendNewReelsNotification(1, 123, []);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getNotificationSettings).toHaveBeenCalledWith(1);
      expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что не был вызван метод sendMessage
      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe("sendTrendNotification", () => {
    it("should send notification about trends", async () => {
      // Мокируем результаты запросов
      const mockSettings = {
        user_id: 1,
        new_reels_enabled: true,
        trends_enabled: true,
        weekly_report_enabled: true,
      };
      const mockProject = createMockProject({ id: 123, user_id: 1, name: "Test Project" });
      const mockUser = createMockUser({ id: 1, telegram_id: 123456789 });
      const trendData = {
        trendType: "views",
        description: "Рост просмотров Reels",
        value: 5000,
        changePercent: 15,
      };

      mockStorage.getNotificationSettings.mockResolvedValue(mockSettings);
      mockStorage.getProjectById.mockResolvedValue(mockProject);
      mockStorage.getUserById.mockResolvedValue(mockUser);

      // Вызываем метод
      await notificationService.sendTrendNotification(1, 123, trendData);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getNotificationSettings).toHaveBeenCalledWith(1);
      expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
      expect(mockStorage.getUserById).toHaveBeenCalledWith(1);
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод sendMessage
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        123456789,
        expect.stringContaining("Обнаружен новый тренд"),
        expect.anything()
      );
    });

    it("should not send notification if trends_enabled is false", async () => {
      // Мокируем результаты запросов
      const mockSettings = {
        user_id: 1,
        new_reels_enabled: true,
        trends_enabled: false,
        weekly_report_enabled: true,
      };
      const trendData = {
        trendType: "views",
        description: "Рост просмотров Reels",
        value: 5000,
        changePercent: 15,
      };

      mockStorage.getNotificationSettings.mockResolvedValue(mockSettings);

      // Вызываем метод
      await notificationService.sendTrendNotification(1, 123, trendData);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getNotificationSettings).toHaveBeenCalledWith(1);
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что не был вызван метод sendMessage
      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe("sendWeeklyReport", () => {
    it("should send weekly report", async () => {
      // Мокируем результаты запросов
      const mockSettings = {
        user_id: 1,
        new_reels_enabled: true,
        trends_enabled: true,
        weekly_report_enabled: true,
      };
      const mockProject = createMockProject({ id: 123, user_id: 1, name: "Test Project" });
      const mockUser = createMockUser({ id: 1, telegram_id: 123456789 });
      const mockReels = [
        createMockReelContent({
          id: 1,
          project_id: 123,
          instagram_id: "reel1",
          views: 1000,
          published_at: "2023-01-01T00:00:00Z",
        }),
        createMockReelContent({
          id: 2,
          project_id: 123,
          instagram_id: "reel2",
          views: 5000,
          published_at: "2023-01-02T00:00:00Z",
        }),
      ];

      mockStorage.getNotificationSettings.mockResolvedValue(mockSettings);
      mockStorage.getProjectById.mockResolvedValue(mockProject);
      mockStorage.getUserById.mockResolvedValue(mockUser);
      mockStorage.getReels.mockResolvedValue(mockReels);

      // Вызываем метод
      await notificationService.sendWeeklyReport(1, 123);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getNotificationSettings).toHaveBeenCalledWith(1);
      expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
      expect(mockStorage.getUserById).toHaveBeenCalledWith(1);
      expect(mockStorage.getReels).toHaveBeenCalled();
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод sendMessage
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        123456789,
        expect.stringContaining("Еженедельный отчет"),
        expect.anything()
      );
    });

    it("should not send weekly report if weekly_report_enabled is false", async () => {
      // Мокируем результаты запросов
      const mockSettings = {
        user_id: 1,
        new_reels_enabled: true,
        trends_enabled: true,
        weekly_report_enabled: false,
      };

      mockStorage.getNotificationSettings.mockResolvedValue(mockSettings);

      // Вызываем метод
      await notificationService.sendWeeklyReport(1, 123);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getNotificationSettings).toHaveBeenCalledWith(1);
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что не был вызван метод sendMessage
      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
    });
  });
});
