import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { handleNotificationEnter, handleToggleNewReelsAction, handleBackToMenuAction } from "../../../scenes/notification-scene";
import { ScraperSceneStep } from "../../../types";
import { createMockUser } from "../../helpers/mocks";

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

describe("NotificationScene", () => {
  // Создаем моки для контекста Telegraf
  let ctx;
  let mockStorage;

  beforeEach(() => {
    // Сбрасываем все моки перед каждым тестом
    jest.clearAllMocks();

    // Создаем мок для хранилища
    mockStorage = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getUserByTelegramId: jest.fn(),
      getNotificationSettings: jest.fn(),
      saveNotificationSettings: jest.fn(),
      updateNotificationSettings: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Создаем мок контекста
    ctx = {
      scene: {
        enter: jest.fn(),
        reenter: jest.fn(),
        leave: jest.fn(),
        state: {},
        session: {},
      },
      reply: jest.fn().mockResolvedValue({}),
      from: { id: 123456789 },
      storage: mockStorage,
      callbackQuery: { id: "callback123" },
      answerCbQuery: jest.fn().mockResolvedValue(true),
      match: null,
    };
  });

  afterEach(() => {
    // Очищаем все моки после каждого теста
    jest.clearAllMocks();
  });

  describe("handleNotificationEnter", () => {
    it("should leave scene if ctx.from is undefined", async () => {
      // Устанавливаем ctx.from в undefined
      ctx.from = undefined;

      // Вызываем обработчик входа в сцену напрямую
      await handleNotificationEnter(ctx);

      // Проверяем, что был вызван метод reply с сообщением об ошибке
      expect(ctx.reply).toHaveBeenCalledWith(
        "Не удалось определить пользователя. Попробуйте перезапустить бота командой /start."
      );

      // Проверяем, что был вызван метод leave
      expect(ctx.scene.leave).toHaveBeenCalled();

      // Проверяем, что не было вызовов к storage
      expect(mockStorage.initialize).not.toHaveBeenCalled();
    });

    it("should leave scene if user is not found", async () => {
      // Мокируем результат запроса getUserByTelegramId
      mockStorage.getUserByTelegramId.mockResolvedValue(null);

      // Вызываем обработчик входа в сцену напрямую
      await handleNotificationEnter(ctx);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод reply с сообщением об ошибке
      expect(ctx.reply).toHaveBeenCalledWith(
        "Вы не зарегистрированы. Пожалуйста, используйте /start для начала работы."
      );

      // Проверяем, что был вызван метод leave
      expect(ctx.scene.leave).toHaveBeenCalled();
    });

    it("should create default notification settings if not found", async () => {
      // Мокируем результаты запросов
      const mockUser = createMockUser({ id: 1, telegram_id: 123456789 });
      const mockSettings = {
        user_id: 1,
        new_reels_enabled: true,
        trends_enabled: true,
        weekly_report_enabled: true,
        min_views_threshold: 1000,
        notification_time: "09:00",
        notification_days: [1, 2, 3, 4, 5, 6, 7],
      };

      mockStorage.getUserByTelegramId.mockResolvedValue(mockUser);
      mockStorage.getNotificationSettings.mockResolvedValue(null);
      mockStorage.saveNotificationSettings.mockResolvedValue(mockSettings);

      // Вызываем обработчик входа в сцену напрямую
      await handleNotificationEnter(ctx);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(mockStorage.getNotificationSettings).toHaveBeenCalledWith(1);
      expect(mockStorage.saveNotificationSettings).toHaveBeenCalledWith({
        user_id: 1,
        new_reels_enabled: true,
        trends_enabled: true,
        weekly_report_enabled: true,
        min_views_threshold: 1000,
        notification_time: "09:00",
        notification_days: [1, 2, 3, 4, 5, 6, 7],
      });
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод reply с настройками уведомлений
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Настройки уведомлений"),
        expect.anything()
      );

      // Проверяем, что был установлен правильный шаг в сессии
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.NOTIFICATION_SETTINGS);
    });

    it("should show notification settings if found", async () => {
      // Мокируем результаты запросов
      const mockUser = createMockUser({ id: 1, telegram_id: 123456789 });
      const mockSettings = {
        user_id: 1,
        new_reels_enabled: true,
        trends_enabled: true,
        weekly_report_enabled: true,
        min_views_threshold: 1000,
        notification_time: "09:00",
        notification_days: [1, 2, 3, 4, 5, 6, 7],
      };

      mockStorage.getUserByTelegramId.mockResolvedValue(mockUser);
      mockStorage.getNotificationSettings.mockResolvedValue(mockSettings);

      // Вызываем обработчик входа в сцену напрямую
      await handleNotificationEnter(ctx);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(mockStorage.getNotificationSettings).toHaveBeenCalledWith(1);
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод reply с настройками уведомлений
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Настройки уведомлений"),
        expect.anything()
      );

      // Проверяем, что был установлен правильный шаг в сессии
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.NOTIFICATION_SETTINGS);
    });

    it("should handle error during data loading", async () => {
      // Мокируем ошибку при запросе getUserByTelegramId
      mockStorage.getUserByTelegramId.mockRejectedValue(new Error("Test error"));

      // Вызываем обработчик входа в сцену напрямую
      await handleNotificationEnter(ctx);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод reply с сообщением об ошибке
      expect(ctx.reply).toHaveBeenCalledWith(
        "Произошла ошибка при загрузке настроек уведомлений. Попробуйте еще раз."
      );
    });
  });

  describe("handleToggleNewReelsAction", () => {
    it("should toggle new reels notifications on", async () => {
      // Устанавливаем match для action
      ctx.match = ["toggle_new_reels_on", "on"];

      // Мокируем результаты запросов
      const mockUser = createMockUser({ id: 1, telegram_id: 123456789 });
      const mockSettings = {
        user_id: 1,
        new_reels_enabled: false,
        trends_enabled: true,
        weekly_report_enabled: true,
      };
      const updatedSettings = {
        ...mockSettings,
        new_reels_enabled: true,
      };

      mockStorage.getUserByTelegramId.mockResolvedValue(mockUser);
      mockStorage.getNotificationSettings.mockResolvedValue(mockSettings);
      mockStorage.updateNotificationSettings.mockResolvedValue(updatedSettings);

      // Вызываем обработчик
      await handleToggleNewReelsAction(ctx);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(mockStorage.getNotificationSettings).toHaveBeenCalledWith(1);
      expect(mockStorage.updateNotificationSettings).toHaveBeenCalledWith(1, {
        new_reels_enabled: true,
      });
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalledWith(
        "Уведомления о новых Reels включены"
      );
    });

    it("should toggle new reels notifications off", async () => {
      // Устанавливаем match для action
      ctx.match = ["toggle_new_reels_off", "off"];

      // Мокируем результаты запросов
      const mockUser = createMockUser({ id: 1, telegram_id: 123456789 });
      const mockSettings = {
        user_id: 1,
        new_reels_enabled: true,
        trends_enabled: true,
        weekly_report_enabled: true,
      };
      const updatedSettings = {
        ...mockSettings,
        new_reels_enabled: false,
      };

      mockStorage.getUserByTelegramId.mockResolvedValue(mockUser);
      mockStorage.getNotificationSettings.mockResolvedValue(mockSettings);
      mockStorage.updateNotificationSettings.mockResolvedValue(updatedSettings);

      // Вызываем обработчик
      await handleToggleNewReelsAction(ctx);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(mockStorage.getNotificationSettings).toHaveBeenCalledWith(1);
      expect(mockStorage.updateNotificationSettings).toHaveBeenCalledWith(1, {
        new_reels_enabled: false,
      });
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalledWith(
        "Уведомления о новых Reels отключены"
      );
    });
  });

  describe("handleBackToMenuAction", () => {
    it("should return to main menu", async () => {
      // Вызываем обработчик
      await handleBackToMenuAction(ctx);

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();

      // Проверяем, что был вызван метод leave
      expect(ctx.scene.leave).toHaveBeenCalled();

      // Проверяем, что был вызван метод reply с главным меню
      expect(ctx.reply).toHaveBeenCalledWith(
        "Вы вернулись в главное меню. Выберите действие:",
        expect.anything()
      );
    });
  });
});
