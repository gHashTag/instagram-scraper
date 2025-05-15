import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { ScraperSceneStep } from "../../../types";
import { handleProjectEnter } from "../../../scenes/project-scene";

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

describe("projectScene - Enter Handler", () => {
  let ctx: any;
  let mockStorage: any;

  beforeEach(() => {
    // Создаем мок для контекста
    mockStorage = {
      initialize: jest.fn().mockResolvedValue(undefined),
      findUserByTelegramIdOrCreate: jest.fn(),
      getProjectsByUserId: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
      from: {
        id: 123456789,
        username: "testuser",
        first_name: "Test",
        last_name: "User",
      },
      scene: {
        session: {},
        leave: jest.fn(),
        enter: jest.fn(),
      },
      storage: mockStorage,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should leave scene if ctx.from is undefined", async () => {
    // Устанавливаем ctx.from в undefined
    ctx.from = undefined;

    // Вызываем обработчик входа в сцену напрямую
    await handleProjectEnter(ctx);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Не удалось определить пользователя. Попробуйте перезапустить бота командой /start."
    );

    // Проверяем, что был вызван метод leave
    expect(ctx.scene.leave).toHaveBeenCalled();

    // Проверяем, что не было вызовов к storage
    expect(mockStorage.initialize).not.toHaveBeenCalled();
  });

  it("should show message when user has no projects", async () => {
    // Мокируем результаты запросов
    mockStorage.findUserByTelegramIdOrCreate.mockResolvedValue({ id: 1, telegram_id: 123456789, username: "testuser" });
    mockStorage.getProjectsByUserId.mockResolvedValue([]);

    // Вызываем обработчик входа в сцену напрямую
    await handleProjectEnter(ctx);

    // Проверяем, что был вызван метод reply с сообщением о пустом списке проектов
    expect(ctx.reply).toHaveBeenCalledWith(
      "У вас еще нет проектов. Хотите создать первый?",
      expect.anything()
    );

    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.findUserByTelegramIdOrCreate).toHaveBeenCalledWith(
      123456789,
      "testuser",
      "Test",
      "User"
    );
    expect(mockStorage.getProjectsByUserId).toHaveBeenCalledWith(1);
    expect(mockStorage.close).toHaveBeenCalled();

    // Проверяем, что был установлен правильный шаг в сессии
    expect(ctx.scene.session.step).toBe(ScraperSceneStep.PROJECT_LIST);
  });

  it("should show projects list when user has projects", async () => {
    // Мокируем результаты запросов
    mockStorage.findUserByTelegramIdOrCreate.mockResolvedValue({ id: 1, telegram_id: 123456789, username: "testuser" });
    const mockProjects = [
      { id: 1, user_id: 1, name: "Project 1" },
      { id: 2, user_id: 1, name: "Project 2" }
    ];
    mockStorage.getProjectsByUserId.mockResolvedValue(mockProjects);

    // Подготавливаем вызов обработчика

    // Вызываем обработчик входа в сцену напрямую
    await handleProjectEnter(ctx);

    // Проверяем, что был вызван метод reply с сообщением со списком проектов
    expect(ctx.reply).toHaveBeenCalledWith(
      "Ваши проекты:",
      expect.anything()
    );

    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.findUserByTelegramIdOrCreate).toHaveBeenCalledWith(
      123456789,
      "testuser",
      "Test",
      "User"
    );
    expect(mockStorage.getProjectsByUserId).toHaveBeenCalledWith(1);
    expect(mockStorage.close).toHaveBeenCalled();

    // Проверяем, что был установлен правильный шаг в сессии
    expect(ctx.scene.session.step).toBe(ScraperSceneStep.PROJECT_LIST);
  });

  it("should handle error when findUserByTelegramIdOrCreate returns null", async () => {
    // Мокируем результаты запросов
    mockStorage.findUserByTelegramIdOrCreate.mockResolvedValue(null);

    // Вызываем обработчик входа в сцену напрямую
    await handleProjectEnter(ctx);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Произошла ошибка при получении данных пользователя. Попробуйте позже."
    );

    // Проверяем, что был вызван метод leave
    expect(ctx.scene.leave).toHaveBeenCalled();

    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.findUserByTelegramIdOrCreate).toHaveBeenCalledWith(
      123456789,
      "testuser",
      "Test",
      "User"
    );
    expect(mockStorage.close).toHaveBeenCalled();
  });

  it("should handle error when getProjectsByUserId throws", async () => {
    // Мокируем результаты запросов
    mockStorage.findUserByTelegramIdOrCreate.mockResolvedValue({ id: 1, telegram_id: 123456789, username: "testuser" });
    mockStorage.getProjectsByUserId.mockRejectedValue(new Error("Database error"));

    // Вызываем обработчик входа в сцену напрямую
    await handleProjectEnter(ctx);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Произошла ошибка при загрузке ваших проектов. Попробуйте еще раз."
    );

    // Проверяем, что был вызван метод leave
    expect(ctx.scene.leave).toHaveBeenCalled();

    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.findUserByTelegramIdOrCreate).toHaveBeenCalledWith(
      123456789,
      "testuser",
      "Test",
      "User"
    );
    expect(mockStorage.getProjectsByUserId).toHaveBeenCalledWith(1);
    expect(mockStorage.close).toHaveBeenCalled();
  });
});
