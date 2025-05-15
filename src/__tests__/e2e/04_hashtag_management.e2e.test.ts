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

describe("E2E: Hashtag Management", () => {
  let testEnv: ReturnType<typeof setupE2ETestEnvironment>;

  beforeEach(() => {
    // Настраиваем тестовое окружение
    testEnv = setupE2ETestEnvironment();
  });

  it("should enter hashtag scene when hashtag button is clicked", async () => {
    // Создаем объект Update для имитации нажатия на кнопку хештегов
    const update: Update = {
      update_id: 123464,
      callback_query: {
        id: "123460",
        from: {
          id: USER_ID_FOR_TESTING,
          is_bot: false,
          first_name: "Test",
          username: "testuser",
        },
        message: {
          message_id: 9,
          date: Math.floor(Date.now() / 1000),
          chat: {
            id: CHAT_ID_FOR_TESTING,
            type: "private",
            first_name: "Test",
            username: "testuser",
          },
          text: "Меню проекта",
          entities: [],
        },
        chat_instance: "123456",
        data: "hashtags_1",
      },
    };

    // Вызываем обработчик callback-запроса
    await testEnv.bot.handleUpdate(update);

    // Проверяем, что был вызван метод scene.enter с правильным именем сцены
    expect(testEnv.mockSceneEnter).toHaveBeenCalledWith("instagram_scraper_hashtags");

    // Проверяем, что был вызван метод answerCbQuery
    expect(testEnv.mockAnswerCbQuery).toHaveBeenCalledWith("123460");
  });

  it("should allow adding a new hashtag", async () => {
    // Создаем объект Update для имитации нажатия на кнопку добавления хештега
    const callbackUpdate: Update = {
      update_id: 123466,
      callback_query: {
        id: "123462",
        from: {
          id: USER_ID_FOR_TESTING,
          is_bot: false,
          first_name: "Test",
          username: "testuser",
        },
        message: {
          message_id: 11,
          date: Math.floor(Date.now() / 1000),
          chat: {
            id: CHAT_ID_FOR_TESTING,
            type: "private",
            first_name: "Test",
            username: "testuser",
          },
          text: "Список хештегов",
          entities: [],
        },
        chat_instance: "123456",
        data: "add_hashtag_1",
      },
    };

    // Вызываем обработчик callback-запроса
    await testEnv.bot.handleUpdate(callbackUpdate);

    // Проверяем, что был вызван метод answerCbQuery
    expect(testEnv.mockAnswerCbQuery).toHaveBeenCalledWith("123462");

    // Проверяем, что было отправлено сообщение с запросом хештега
    expect(testEnv.mockSendMessage).toHaveBeenCalledWith(
      CHAT_ID_FOR_TESTING,
      expect.stringContaining("Введите хештег"),
      expect.any(Object)
    );
  });

  it("should allow removing a hashtag", async () => {
    // Создаем объект Update для имитации нажатия на кнопку удаления хештега
    const update: Update = {
      update_id: 123468,
      callback_query: {
        id: "123463",
        from: {
          id: USER_ID_FOR_TESTING,
          is_bot: false,
          first_name: "Test",
          username: "testuser",
        },
        message: {
          message_id: 13,
          date: Math.floor(Date.now() / 1000),
          chat: {
            id: CHAT_ID_FOR_TESTING,
            type: "private",
            first_name: "Test",
            username: "testuser",
          },
          text: "Список хештегов",
          entities: [],
        },
        chat_instance: "123456",
        data: "remove_hashtag_1_test1",
      },
    };

    // Вызываем обработчик callback-запроса
    await testEnv.bot.handleUpdate(update);

    // Проверяем, что был вызван метод answerCbQuery
    expect(testEnv.mockAnswerCbQuery).toHaveBeenCalledWith("123463");
  });
});
