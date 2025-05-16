import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { handleAnalyticsEnter } from "../../../scenes/analytics-scene";
import { ScraperSceneStep } from "../../../types";
import { createMockProject } from "../../helpers/mocks";

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

describe("AnalyticsScene - Enter Handler", () => {
  // Создаем моки для контекста Telegraf
  let ctx;
  let mockStorage;

  beforeEach(() => {
    // Сбрасываем все моки перед каждым тестом
    jest.clearAllMocks();

    // Создаем мок для хранилища
    mockStorage = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getProjectById: jest.fn(),
      getReels: jest.fn(),
      getReelsCount: jest.fn(),
      getCompetitorAccounts: jest.fn(),
      getHashtagsByProjectId: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Создаем мок контекста
    ctx = {
      scene: {
        enter: jest.fn(),
        reenter: jest.fn(),
        leave: jest.fn(),
        state: {},
        session: {
          currentProjectId: 123,
        },
      },
      reply: jest.fn().mockResolvedValue({}),
      from: { id: 123456789 },
      storage: mockStorage,
    };
  });

  afterEach(() => {
    // Очищаем все моки после каждого теста
    jest.clearAllMocks();
  });

  it("should leave scene if ctx.from is undefined", async () => {
    // Устанавливаем ctx.from в undefined
    ctx.from = undefined;

    // Вызываем обработчик входа в сцену напрямую
    await handleAnalyticsEnter(ctx);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Не удалось определить пользователя. Попробуйте перезапустить бота командой /start."
    );

    // Проверяем, что был вызван метод leave
    expect(ctx.scene.leave).toHaveBeenCalled();

    // Проверяем, что не было вызовов к storage
    expect(mockStorage.initialize).not.toHaveBeenCalled();
  });

  it("should enter projects scene if projectId is undefined", async () => {
    // Устанавливаем projectId в undefined
    ctx.scene.session.currentProjectId = undefined;
    ctx.scene.state = {};

    // Вызываем обработчик входа в сцену напрямую
    await handleAnalyticsEnter(ctx);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Не удалось определить проект. Пожалуйста, выберите проект из списка."
    );

    // Проверяем, что был вызван метод enter с правильным параметром
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");

    // Проверяем, что не было вызовов к storage
    expect(mockStorage.initialize).not.toHaveBeenCalled();
  });

  it("should use projectId from state if available", async () => {
    // Устанавливаем projectId в state
    ctx.scene.session.currentProjectId = undefined;
    ctx.scene.state = { projectId: 456 };

    // Мокируем результат запроса getProjectById
    const mockProject = createMockProject({ id: 456, user_id: 1, name: "Test Project" });
    mockStorage.getProjectById.mockResolvedValue(mockProject);

    // Вызываем обработчик входа в сцену напрямую
    await handleAnalyticsEnter(ctx);

    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.getProjectById).toHaveBeenCalledWith(456);
    expect(mockStorage.close).toHaveBeenCalled();

    // Проверяем, что был вызван метод reply с меню аналитики
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Аналитика для проекта"),
      expect.anything()
    );

    // Проверяем, что был установлен правильный шаг в сессии
    expect(ctx.scene.session.step).toBe(ScraperSceneStep.REELS_ANALYTICS);
  });

  it("should enter projects scene if project is not found", async () => {
    // Мокируем результат запроса getProjectById
    mockStorage.getProjectById.mockResolvedValue(null);

    // Вызываем обработчик входа в сцену напрямую
    await handleAnalyticsEnter(ctx);

    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
    expect(mockStorage.close).toHaveBeenCalled();

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Проект не найден. Возможно, он был удален."
    );

    // Проверяем, что был вызван метод enter с правильным параметром
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");
  });

  it("should show analytics menu when project is found", async () => {
    // Мокируем результат запроса getProjectById
    const mockProject = createMockProject({ id: 123, user_id: 1, name: "Test Project" });
    mockStorage.getProjectById.mockResolvedValue(mockProject);

    // Вызываем обработчик входа в сцену напрямую
    await handleAnalyticsEnter(ctx);

    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
    expect(mockStorage.close).toHaveBeenCalled();

    // Проверяем, что был вызван метод reply с меню аналитики
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Аналитика для проекта"),
      expect.anything()
    );

    // Проверяем, что был установлен правильный шаг в сессии
    expect(ctx.scene.session.step).toBe(ScraperSceneStep.REELS_ANALYTICS);
  });

  it("should handle error during data loading", async () => {
    // Мокируем ошибку при запросе getProjectById
    mockStorage.getProjectById.mockRejectedValue(new Error("Test error"));

    // Вызываем обработчик входа в сцену напрямую
    await handleAnalyticsEnter(ctx);

    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
    expect(mockStorage.close).toHaveBeenCalled();

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Произошла ошибка при загрузке данных. Попробуйте еще раз."
    );

    // Проверяем, что был вызван метод leave
    expect(ctx.scene.leave).toHaveBeenCalled();
  });
});
