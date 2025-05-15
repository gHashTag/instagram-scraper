import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { handleProjectText } from "../../../scenes/project-scene";
import { ScraperSceneStep } from "../../../types";

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

mock.module("../../../utils/validation", () => {
  return {
    isValidProjectName: jest.fn(),
  };
});

describe("projectScene - Text Handler", () => {
  let ctx: any;
  let mockStorage: any;
  let isValidProjectName: jest.Mock;

  beforeEach(() => {
    // Получаем мок для isValidProjectName
    isValidProjectName = require("../../../utils/validation").isValidProjectName;
    
    // Создаем мок для хранилища
    mockStorage = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getUserByTelegramId: jest.fn(),
      createProject: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Создаем мок для контекста
    ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
      from: {
        id: 123456789,
        username: "testuser",
        first_name: "Test",
        last_name: "User",
      },
      message: {
        text: "Test Project",
      },
      scene: {
        session: {
          step: ScraperSceneStep.CREATE_PROJECT,
        },
        leave: jest.fn(),
        reenter: jest.fn(),
      },
      storage: mockStorage,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should do nothing if message is not text", async () => {
    // Устанавливаем message без text
    ctx.message = {};
    
    // Вызываем обработчик
    await handleProjectText(ctx);
    
    // Проверяем, что не было вызовов методов
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(mockStorage.initialize).not.toHaveBeenCalled();
    expect(ctx.scene.leave).not.toHaveBeenCalled();
    expect(ctx.scene.reenter).not.toHaveBeenCalled();
  });

  it("should do nothing if step is not CREATE_PROJECT", async () => {
    // Устанавливаем другой шаг
    ctx.scene.session.step = ScraperSceneStep.PROJECT_LIST;
    
    // Вызываем обработчик
    await handleProjectText(ctx);
    
    // Проверяем, что не было вызовов методов
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(mockStorage.initialize).not.toHaveBeenCalled();
    expect(ctx.scene.leave).not.toHaveBeenCalled();
    expect(ctx.scene.reenter).not.toHaveBeenCalled();
  });

  it("should leave scene if ctx.from is undefined", async () => {
    // Устанавливаем ctx.from в undefined
    ctx.from = undefined;
    
    // Вызываем обработчик
    await handleProjectText(ctx);
    
    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Не удалось определить пользователя. Попробуйте /start."
    );
    
    // Проверяем, что был вызван метод leave
    expect(ctx.scene.leave).toHaveBeenCalled();
    
    // Проверяем, что не было вызовов к storage
    expect(mockStorage.initialize).not.toHaveBeenCalled();
  });

  it("should show error message if project name is invalid", async () => {
    // Мокируем результат проверки имени проекта
    isValidProjectName.mockReturnValue(false);
    
    // Вызываем обработчик
    await handleProjectText(ctx);
    
    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Название проекта должно быть от 3 до 100 символов. Пожалуйста, введите корректное название:"
    );
    
    // Проверяем, что не было вызовов к storage
    expect(mockStorage.initialize).not.toHaveBeenCalled();
  });

  it("should leave scene if user is not found", async () => {
    // Мокируем результат проверки имени проекта
    isValidProjectName.mockReturnValue(true);
    
    // Мокируем результат запроса getUserByTelegramId
    mockStorage.getUserByTelegramId.mockResolvedValue(null);
    
    // Вызываем обработчик
    await handleProjectText(ctx);
    
    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.getUserByTelegramId).toHaveBeenCalledWith(123456789);
    expect(mockStorage.close).toHaveBeenCalled();
    
    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Произошла ошибка: пользователь не найден. Попробуйте /start."
    );
    
    // Проверяем, что шаг был очищен
    expect(ctx.scene.session.step).toBeUndefined();
    
    // Проверяем, что был вызван метод leave
    expect(ctx.scene.leave).toHaveBeenCalled();
  });

  it("should create project and reenter scene if all is valid", async () => {
    // Мокируем результат проверки имени проекта
    isValidProjectName.mockReturnValue(true);
    
    // Мокируем результаты запросов
    mockStorage.getUserByTelegramId.mockResolvedValue({ id: 1, telegram_id: 123456789, username: "testuser" });
    const mockProject = { id: 1, user_id: 1, name: "Test Project" };
    mockStorage.createProject.mockResolvedValue(mockProject);
    
    // Вызываем обработчик
    await handleProjectText(ctx);
    
    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.getUserByTelegramId).toHaveBeenCalledWith(123456789);
    expect(mockStorage.createProject).toHaveBeenCalledWith(1, "Test Project");
    expect(mockStorage.close).toHaveBeenCalled();
    
    // Проверяем, что был вызван метод reply с сообщением об успешном создании
    expect(ctx.reply).toHaveBeenCalledWith('Проект "Test Project" успешно создан!');
    
    // Проверяем, что были установлены правильные значения в сессии
    expect(ctx.scene.session.currentProjectId).toBe(1);
    expect(ctx.scene.session.step).toBeUndefined();
    
    // Проверяем, что был вызван метод reenter
    expect(ctx.scene.reenter).toHaveBeenCalled();
  });

  it("should show error message if project creation fails", async () => {
    // Мокируем результат проверки имени проекта
    isValidProjectName.mockReturnValue(true);
    
    // Мокируем результаты запросов
    mockStorage.getUserByTelegramId.mockResolvedValue({ id: 1, telegram_id: 123456789, username: "testuser" });
    mockStorage.createProject.mockResolvedValue(null);
    
    // Вызываем обработчик
    await handleProjectText(ctx);
    
    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.getUserByTelegramId).toHaveBeenCalledWith(123456789);
    expect(mockStorage.createProject).toHaveBeenCalledWith(1, "Test Project");
    expect(mockStorage.close).toHaveBeenCalled();
    
    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Не удалось создать проект. Попробуйте еще раз или обратитесь в поддержку."
    );
  });

  it("should handle error when createProject throws", async () => {
    // Мокируем результат проверки имени проекта
    isValidProjectName.mockReturnValue(true);
    
    // Мокируем результаты запросов
    mockStorage.getUserByTelegramId.mockResolvedValue({ id: 1, telegram_id: 123456789, username: "testuser" });
    mockStorage.createProject.mockRejectedValue(new Error("Database error"));
    
    // Вызываем обработчик
    await handleProjectText(ctx);
    
    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.getUserByTelegramId).toHaveBeenCalledWith(123456789);
    expect(mockStorage.createProject).toHaveBeenCalledWith(1, "Test Project");
    expect(mockStorage.close).toHaveBeenCalled();
    
    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Произошла серьезная ошибка при создании проекта."
    );
    
    // Проверяем, что шаг был очищен
    expect(ctx.scene.session.step).toBeUndefined();
    
    // Проверяем, что был вызван метод leave
    expect(ctx.scene.leave).toHaveBeenCalled();
  });
});
