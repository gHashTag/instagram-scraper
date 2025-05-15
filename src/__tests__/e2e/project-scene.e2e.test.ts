import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
} from "bun:test";
import { handleProjectEnter, handleCreateProjectAction, handleProjectText, handleProjectSelectionAction } from "../../scenes/project-scene";
import { ScraperSceneStep } from "../../types";
import { createMockStorageAdapter } from "../helpers/types";
import { createMockUser, createMockProject } from "../helpers/mocks";

describe("E2E: Project Scene", () => {
  let mockContext: any;
  let mockStorage: any;

  beforeEach(() => {
    // Создаем мок для хранилища
    mockStorage = createMockStorageAdapter();

    // Создаем моки для пользователя и проектов
    const mockUser = createMockUser({
      id: 1,
      telegram_id: 123456789,
      username: "testuser"
    });

    const testProject = createMockProject({
      id: 1,
      user_id: 1,
      name: "Test Project"
    });

    const newProject = createMockProject({
      id: 1,
      user_id: 1,
      name: "New Project"
    });

    // Настраиваем моки с использованием mockImplementation
    (mockStorage.findUserByTelegramIdOrCreate as jest.Mock).mockImplementation(() => Promise.resolve(mockUser));
    (mockStorage.getUserByTelegramId as jest.Mock).mockImplementation(() => Promise.resolve(mockUser));
    (mockStorage.getProjectsByUserId as jest.Mock).mockImplementation(() => Promise.resolve([]));
    (mockStorage.getProjectById as jest.Mock).mockImplementation(() => Promise.resolve(testProject));
    (mockStorage.createProject as jest.Mock).mockImplementation(() => Promise.resolve(newProject));

    // Создаем мок для контекста
    mockContext = {
      from: {
        id: 123456789,
        username: "testuser",
        first_name: "Test",
      },
      scene: {
        enter: jest.fn(),
        leave: jest.fn(),
        reenter: jest.fn(),
        session: {},
      },
      reply: jest.fn().mockResolvedValue({}),
      answerCbQuery: jest.fn().mockResolvedValue(true),
      storage: mockStorage,
    };
  });

  it("should show empty projects list when entering scene", async () => {
    // Вызываем обработчик входа в сцену
    await handleProjectEnter(mockContext);

    // Проверяем, что был вызван метод initialize
    expect(mockStorage.initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод findUserByTelegramIdOrCreate
    expect(mockStorage.findUserByTelegramIdOrCreate).toHaveBeenCalledWith(
      123456789,
      "testuser",
      "Test",
      undefined
    );

    // Проверяем, что был вызван метод getProjectsByUserId
    expect(mockStorage.getProjectsByUserId).toHaveBeenCalledWith(1);

    // Проверяем, что было отправлено сообщение о пустом списке проектов
    expect(mockContext.reply).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object)
    );

    // Проверяем, что был вызван метод close
    expect(mockStorage.close).toHaveBeenCalled();
  });

  it("should handle create project action", async () => {
    // Добавляем callbackQuery в контекст
    mockContext.callbackQuery = { id: "123456" };

    // Вызываем обработчик создания проекта
    await handleCreateProjectAction(mockContext);

    // Проверяем, что был установлен правильный шаг сцены
    expect(mockContext.scene.session.step).toBe(ScraperSceneStep.CREATE_PROJECT);

    // Проверяем, что было отправлено сообщение с запросом названия проекта
    expect(mockContext.reply).toHaveBeenCalledWith(
      expect.stringContaining("Введите название нового проекта"),
      expect.any(Object)
    );

    // Проверяем, что был вызван метод answerCbQuery
    expect(mockContext.answerCbQuery).toHaveBeenCalled();
  });

  it("should handle project creation", async () => {
    // Настраиваем контекст для обработки текста
    mockContext.message = { text: "New Project" };
    mockContext.scene.session.step = ScraperSceneStep.CREATE_PROJECT;

    // Вызываем обработчик текста
    await handleProjectText(mockContext);

    // Проверяем, что был вызван метод initialize
    expect(mockStorage.initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод getUserByTelegramId
    expect(mockStorage.getUserByTelegramId).toHaveBeenCalledWith(123456789);

    // Проверяем, что был вызван метод createProject
    expect(mockStorage.createProject).toHaveBeenCalledWith(1, "New Project");

    // Проверяем, что было отправлено сообщение об успешном создании проекта
    expect(mockContext.reply).toHaveBeenCalledWith(
      expect.stringContaining("успешно создан")
    );

    // Проверяем, что был вызван метод reenter
    expect(mockContext.scene.reenter).toHaveBeenCalled();

    // Проверяем, что был вызван метод close
    expect(mockStorage.close).toHaveBeenCalled();
  });

  it("should handle project selection", async () => {
    // Настраиваем контекст для обработки выбора проекта
    mockContext.match = ["project_1", "1"];
    mockContext.callbackQuery = { id: "123456" };

    // Вызываем обработчик выбора проекта
    await handleProjectSelectionAction(mockContext);

    // Проверяем, что был вызван метод initialize
    expect(mockStorage.initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод getProjectById
    expect(mockStorage.getProjectById).toHaveBeenCalledWith(1);

    // Проверяем, что был установлен правильный ID проекта в сессии
    expect(mockContext.scene.session.currentProjectId).toBe(1);

    // Проверяем, что был установлен правильный шаг сцены
    expect(mockContext.scene.session.step).toBe(ScraperSceneStep.PROJECT_MENU);

    // Проверяем, что было отправлено сообщение с меню проекта
    expect(mockContext.reply).toHaveBeenCalledWith(
      expect.stringContaining("Проект \"Test Project\""),
      expect.any(Object)
    );

    // Проверяем, что был вызван метод answerCbQuery
    expect(mockContext.answerCbQuery).toHaveBeenCalled();

    // Проверяем, что был вызван метод close
    expect(mockStorage.close).toHaveBeenCalled();
  });
});
