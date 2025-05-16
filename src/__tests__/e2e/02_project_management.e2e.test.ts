import {
  describe,
  it,
  expect,
  beforeEach,
  mock,
  jest,
} from "bun:test";
import { Update } from "telegraf/types";
import {
  setupE2ETestEnvironment,
  USER_ID_FOR_TESTING,
  CHAT_ID_FOR_TESTING
} from "../helpers/e2e-setup";

// Мокируем модуль neon-adapter для тестов
mock.module("../../adapters/neon-adapter", () => {
  return {
    NeonAdapter: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      getUserByTelegramId: jest.fn(),
      getProjectById: jest.fn(),
      getProjectsByUserId: jest.fn(),
      createProject: jest.fn(),
      getHashtagsByProjectId: jest.fn(),
      addHashtag: jest.fn(),
      removeHashtag: jest.fn(),
      getCompetitorAccounts: jest.fn(),
      addCompetitorAccount: jest.fn(),
      deleteCompetitorAccount: jest.fn(),
      findUserByTelegramIdOrCreate: jest.fn(),
    })),
  };
});

describe("E2E: Project Management", () => {
  let testEnv: ReturnType<typeof setupE2ETestEnvironment>;

  beforeEach(() => {
    // Настраиваем тестовое окружение
    testEnv = setupE2ETestEnvironment();
  });

  it("should show project list when user has projects", async () => {
    // Создаем объект Update для имитации команды /projects
    const update: Update = {
      update_id: 123457,
      message: {
        message_id: 2,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: CHAT_ID_FOR_TESTING,
          type: 'private',
          first_name: 'Test',
          username: 'testuser'
        },
        from: {
          id: USER_ID_FOR_TESTING,
          is_bot: false,
          first_name: 'Test',
          username: 'testuser'
        },
        text: '/projects',
        entities: [
          {
            offset: 0,
            length: 9,
            type: 'bot_command'
          }
        ]
      }
    };

    // Вызываем обработчик команды /projects
    await testEnv.bot.handleUpdate(update);

    // Проверяем, что был вызван метод scene.enter с правильным именем сцены
    expect(testEnv.mockSceneEnter).toHaveBeenCalledWith("instagram_scraper_projects");
  });

  it("should allow creating a new project", async () => {
    // Создаем объект Update для имитации нажатия на кнопку создания проекта
    const callbackUpdate: Update = {
      update_id: 123458,
      callback_query: {
        id: "123457",
        from: {
          id: USER_ID_FOR_TESTING,
          is_bot: false,
          first_name: "Test",
          username: "testuser",
        },
        message: {
          message_id: 3,
          date: Math.floor(Date.now() / 1000),
          chat: {
            id: CHAT_ID_FOR_TESTING,
            type: "private",
            first_name: "Test",
            username: "testuser",
          },
          text: "У вас нет проектов",
          entities: [],
        },
        chat_instance: "123456",
        data: "create_project",
      },
    };

    // Вызываем обработчик callback-запроса
    await testEnv.bot.handleUpdate(callbackUpdate);

    // Проверяем, что был вызван метод answerCbQuery
    expect(testEnv.mockAnswerCbQuery).toHaveBeenCalledWith("123457");

    // Проверяем, что было отправлено сообщение с запросом названия проекта
    expect(testEnv.mockSendMessage).toHaveBeenCalledWith(
      CHAT_ID_FOR_TESTING,
      expect.stringContaining("Введите название проекта"),
      expect.any(Object)
    );
  });

  it("should show project menu when selecting a project", async () => {
    // Создаем объект Update для имитации нажатия на кнопку выбора проекта
    const update: Update = {
      update_id: 123457,
      callback_query: {
        id: "123456",
        from: {
          id: USER_ID_FOR_TESTING,
          is_bot: false,
          first_name: "Test",
          username: "testuser",
        },
        message: {
          message_id: 2,
          date: Math.floor(Date.now() / 1000),
          chat: {
            id: CHAT_ID_FOR_TESTING,
            type: "private",
            first_name: "Test",
            username: "testuser",
          },
          text: "Ваши проекты:",
          entities: [],
        },
        chat_instance: "123456",
        data: "project_1",
      },
    };

    // Вызываем обработчик callback-запроса
    await testEnv.bot.handleUpdate(update);

    // Проверяем, что был вызван метод answerCbQuery
    expect(testEnv.mockAnswerCbQuery).toHaveBeenCalledWith("123456");

    // Проверяем, что было отправлено сообщение с меню проекта
    expect(testEnv.mockSendMessage).toHaveBeenCalledWith(
      CHAT_ID_FOR_TESTING,
      expect.stringContaining(testEnv.mockProjects[0].name),
      expect.any(Object)
    );
  });
});
