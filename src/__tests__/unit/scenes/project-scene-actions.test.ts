import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import {
  handleExitSceneAction,
  handleCreateProjectAction,
  handleBackToProjectsAction,
  handleProjectSelectionAction,
  handleManageHashtagsAction
} from "../../../scenes/project-scene";
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

describe("projectScene - Action Handlers", () => {
  let ctx: any;
  let mockStorage: any;

  beforeEach(() => {
    // Создаем мок для хранилища
    mockStorage = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getProjectById: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Создаем мок для контекста
    ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
      answerCbQuery: jest.fn().mockResolvedValue(true),
      scene: {
        session: {},
        leave: jest.fn(),
        reenter: jest.fn(),
        enter: jest.fn(),
      },
      storage: mockStorage,
      callbackQuery: {},
      match: [],
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleExitSceneAction", () => {
    it("should leave scene and show message", async () => {
      // Вызываем обработчик
      await handleExitSceneAction(ctx);

      // Проверяем, что был вызван метод reply с сообщением
      expect(ctx.reply).toHaveBeenCalledWith("Вы вышли из меню проектов.");

      // Проверяем, что был вызван метод leave
      expect(ctx.scene.leave).toHaveBeenCalled();

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    it("should not call answerCbQuery if callbackQuery is undefined", async () => {
      // Устанавливаем callbackQuery в undefined
      ctx.callbackQuery = undefined;

      // Вызываем обработчик
      await handleExitSceneAction(ctx);

      // Проверяем, что был вызван метод reply с сообщением
      expect(ctx.reply).toHaveBeenCalledWith("Вы вышли из меню проектов.");

      // Проверяем, что был вызван метод leave
      expect(ctx.scene.leave).toHaveBeenCalled();

      // Проверяем, что не был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).not.toHaveBeenCalled();
    });
  });

  describe("handleCreateProjectAction", () => {
    it("should set step and show message", async () => {
      // Вызываем обработчик
      await handleCreateProjectAction(ctx);

      // Проверяем, что был установлен правильный шаг в сессии
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.CREATE_PROJECT);

      // Проверяем, что был вызван метод reply с сообщением
      expect(ctx.reply).toHaveBeenCalledWith(
        "Введите название нового проекта (например, 'Клиника Аврора МСК'):",
        expect.anything()
      );

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    it("should not call answerCbQuery if callbackQuery is undefined", async () => {
      // Устанавливаем callbackQuery в undefined
      ctx.callbackQuery = undefined;

      // Вызываем обработчик
      await handleCreateProjectAction(ctx);

      // Проверяем, что был установлен правильный шаг в сессии
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.CREATE_PROJECT);

      // Проверяем, что был вызван метод reply с сообщением
      expect(ctx.reply).toHaveBeenCalledWith(
        "Введите название нового проекта (например, 'Клиника Аврора МСК'):",
        expect.anything()
      );

      // Проверяем, что не был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).not.toHaveBeenCalled();
    });
  });

  describe("handleBackToProjectsAction", () => {
    it("should reenter scene", async () => {
      // Вызываем обработчик
      await handleBackToProjectsAction(ctx);

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });

    it("should not call answerCbQuery if callbackQuery is undefined", async () => {
      // Устанавливаем callbackQuery в undefined
      ctx.callbackQuery = undefined;

      // Вызываем обработчик
      await handleBackToProjectsAction(ctx);

      // Проверяем, что не был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).not.toHaveBeenCalled();

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });
  });

  describe("handleProjectSelectionAction", () => {
    it("should show project menu if project exists", async () => {
      // Устанавливаем match для projectId
      ctx.match = ["project_123", "123"];

      // Мокируем результат запроса getProjectById
      const mockProject = { id: 123, user_id: 1, name: "Test Project" };
      mockStorage.getProjectById.mockResolvedValue(mockProject);

      // Вызываем обработчик
      await handleProjectSelectionAction(ctx);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что были установлены правильные значения в сессии
      expect(ctx.scene.session.currentProjectId).toBe(123);
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.PROJECT_MENU);

      // Проверяем, что был вызван метод reply с сообщением
      expect(ctx.reply).toHaveBeenCalledWith(
        'Проект "Test Project". Что вы хотите сделать?',
        expect.anything()
      );

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    it("should reenter scene if project does not exist", async () => {
      // Устанавливаем match для projectId
      ctx.match = ["project_123", "123"];

      // Мокируем результат запроса getProjectById
      mockStorage.getProjectById.mockResolvedValue(null);

      // Вызываем обработчик
      await handleProjectSelectionAction(ctx);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод reply с сообщением
      expect(ctx.reply).toHaveBeenCalledWith("Проект не найден. Возможно, он был удален.");

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    it("should handle invalid projectId", async () => {
      // Устанавливаем match с невалидным projectId
      ctx.match = ["project_invalid", "invalid"];

      // Вызываем обработчик
      await handleProjectSelectionAction(ctx);

      // Проверяем, что был вызван метод answerCbQuery с сообщением об ошибке
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка: неверный ID проекта.");

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();

      // Проверяем, что не были вызваны методы storage
      expect(mockStorage.initialize).not.toHaveBeenCalled();
    });

    it("should handle error when getProjectById throws", async () => {
      // Устанавливаем match для projectId
      ctx.match = ["project_123", "123"];

      // Мокируем ошибку в запросе getProjectById
      mockStorage.getProjectById.mockRejectedValue(new Error("Database error"));

      // Вызываем обработчик
      await handleProjectSelectionAction(ctx);

      // Проверяем, что были вызваны методы storage
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
      expect(mockStorage.close).toHaveBeenCalled();

      // Проверяем, что был вызван метод reply с сообщением об ошибке
      expect(ctx.reply).toHaveBeenCalledWith("Ошибка при выборе проекта.");

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });
  });

  describe("handleManageHashtagsAction", () => {
    it("should enter hashtag wizard scene with projectId", async () => {
      // Устанавливаем match для projectId
      ctx.match = ["manage_hashtags_123", "123"];

      // Вызываем обработчик
      await handleManageHashtagsAction(ctx);

      // Проверяем, что был установлен правильный projectId в сессии
      expect(ctx.scene.session.currentProjectId).toBe(123);
      expect(ctx.scene.session.projectId).toBe(123);

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();

      // Проверяем, что был вызван метод enter с правильными параметрами
      expect(ctx.scene.enter).toHaveBeenCalledWith("hashtag_wizard");
    });

    it("should handle invalid projectId", async () => {
      // Устанавливаем match с невалидным projectId
      ctx.match = ["manage_hashtags_invalid", "invalid"];

      // Вызываем обработчик
      await handleManageHashtagsAction(ctx);

      // Проверяем, что был вызван метод answerCbQuery с сообщением об ошибке
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка: неверный ID проекта.");

      // Проверяем, что был вызван метод reenter
      expect(ctx.scene.reenter).toHaveBeenCalled();

      // Проверяем, что не был вызван метод enter
      expect(ctx.scene.enter).not.toHaveBeenCalled();
    });
  });
});
