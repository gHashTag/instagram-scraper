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

describe("E2E: Initial Bot Interaction", () => {
  let testEnv: ReturnType<typeof setupE2ETestEnvironment>;

  beforeEach(() => {
    // Настраиваем тестовое окружение
    testEnv = setupE2ETestEnvironment();
  });

  it("should respond to /start command with welcome message", async () => {
    // Создаем объект Update для имитации команды /start
    const update: Update = {
      update_id: 123456,
      message: {
        message_id: 1,
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
        text: '/start',
        entities: [
          {
            offset: 0,
            length: 6,
            type: 'bot_command'
          }
        ]
      }
    };

    // Вызываем обработчик команды /start
    await testEnv.bot.handleUpdate(update);

    // Проверяем, что было отправлено приветственное сообщение
    expect(testEnv.mockSendMessage).toHaveBeenCalledWith(
      CHAT_ID_FOR_TESTING,
      expect.stringContaining('Добро пожаловать'),
      expect.objectContaining({
        reply_markup: expect.objectContaining({
          keyboard: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({ text: expect.stringContaining('Проекты') })
            ])
          ])
        })
      })
    );
  });

  it("should respond to /projects command and enter project scene", async () => {
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

  it("should respond to /competitors command and enter competitor scene", async () => {
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
});
