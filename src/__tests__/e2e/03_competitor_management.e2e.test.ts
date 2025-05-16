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

describe("E2E: Competitor Management", () => {
  let testEnv: ReturnType<typeof setupE2ETestEnvironment>;

  beforeEach(() => {
    // Настраиваем тестовое окружение
    testEnv = setupE2ETestEnvironment();
  });

  it("should enter competitor scene when /competitors command is sent", async () => {
    // Создаем объект Update для имитации команды /competitors
    const update: Update = {
      update_id: 123459,
      message: {
        message_id: 4,
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
        text: '/competitors',
        entities: [
          {
            offset: 0,
            length: 12,
            type: 'bot_command'
          }
        ]
      }
    };

    // Вызываем обработчик команды /competitors
    await testEnv.bot.handleUpdate(update);

    // Проверяем, что был вызван метод scene.enter с правильным именем сцены
    expect(testEnv.mockSceneEnter).toHaveBeenCalledWith("instagram_scraper_competitors");
  });

  it("should enter competitor scene when /competitors command is sent", async () => {
    // Создаем объект Update для имитации команды /competitors
    const update: Update = {
      update_id: 123459,
      message: {
        message_id: 4,
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
        text: '/competitors',
        entities: [
          {
            offset: 0,
            length: 12,
            type: 'bot_command'
          }
        ]
      }
    };

    // Вызываем обработчик команды /competitors
    await testEnv.bot.handleUpdate(update);

    // Проверяем, что был вызван метод scene.enter с правильным именем сцены
    expect(testEnv.mockSceneEnter).toHaveBeenCalledWith("instagram_scraper_competitors");
  });

  it("should allow adding a new competitor", async () => {
    // Создаем объект Update для имитации нажатия на кнопку добавления конкурента
    const callbackUpdate: Update = {
      update_id: 123461,
      callback_query: {
        id: "123458",
        from: {
          id: USER_ID_FOR_TESTING,
          is_bot: false,
          first_name: "Test",
          username: "testuser",
        },
        message: {
          message_id: 6,
          date: Math.floor(Date.now() / 1000),
          chat: {
            id: CHAT_ID_FOR_TESTING,
            type: "private",
            first_name: "Test",
            username: "testuser",
          },
          text: "Список конкурентов",
          entities: [],
        },
        chat_instance: "123456",
        data: "add_competitor_1",
      },
    };

    // Вызываем обработчик callback-запроса
    await testEnv.bot.handleUpdate(callbackUpdate);

    // Проверяем, что был вызван метод answerCbQuery
    expect(testEnv.mockAnswerCbQuery).toHaveBeenCalledWith("123458");

    // Проверяем, что было отправлено сообщение с запросом имени конкурента
    expect(testEnv.mockSendMessage).toHaveBeenCalledWith(
      CHAT_ID_FOR_TESTING,
      expect.stringContaining("Введите имя аккаунта конкурента"),
      expect.any(Object)
    );
  });

  it("should allow deleting a competitor", async () => {
    // Создаем объект Update для имитации нажатия на кнопку удаления конкурента
    const update: Update = {
      update_id: 123463,
      callback_query: {
        id: "123459",
        from: {
          id: USER_ID_FOR_TESTING,
          is_bot: false,
          first_name: "Test",
          username: "testuser",
        },
        message: {
          message_id: 8,
          date: Math.floor(Date.now() / 1000),
          chat: {
            id: CHAT_ID_FOR_TESTING,
            type: "private",
            first_name: "Test",
            username: "testuser",
          },
          text: "Список конкурентов",
          entities: [],
        },
        chat_instance: "123456",
        data: "delete_competitor_1_competitor1",
      },
    };

    // Вызываем обработчик callback-запроса
    await testEnv.bot.handleUpdate(update);

    // Проверяем, что был вызван метод answerCbQuery
    expect(testEnv.mockAnswerCbQuery).toHaveBeenCalledWith("123459");
  });
});
