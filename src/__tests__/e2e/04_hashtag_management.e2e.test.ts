import {
  describe,
  it,
  expect,
  beforeEach,
  mock,
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
    NeonAdapter: mock.fn().mockImplementation(() => ({
      initialize: mock.fn().mockResolvedValue(undefined),
      close: mock.fn().mockResolvedValue(undefined),
      getUserByTelegramId: mock.fn(),
      getProjectById: mock.fn(),
      getProjectsByUserId: mock.fn(),
      createProject: mock.fn(),
      getHashtagsByProjectId: mock.fn(),
      addHashtag: mock.fn(),
      removeHashtag: mock.fn(),
      getCompetitorAccounts: mock.fn(),
      addCompetitorAccount: mock.fn(),
      deleteCompetitorAccount: mock.fn(),
      findUserByTelegramIdOrCreate: mock.fn(),
    })),
  };
});

describe.skip("E2E: Hashtag Management", () => {
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

  it("should show hashtag list when user has hashtags", async () => {
    // Устанавливаем сессию для имитации состояния сцены
    testEnv.bot.context.scene.session = {
      step: 'HASHTAG_LIST',
      currentProjectId: 1,
      user: testEnv.mockUser
    };

    // Создаем объект Update для имитации входа в сцену хештегов
    const update: Update = {
      update_id: 123465,
      callback_query: {
        id: "123461",
        from: {
          id: USER_ID_FOR_TESTING,
          is_bot: false,
          first_name: "Test",
          username: "testuser",
        },
        message: {
          message_id: 10,
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

    // Проверяем, что был вызван метод getHashtagsByProjectId с правильным ID проекта
    expect(testEnv.mockStorage.getHashtagsByProjectId).toHaveBeenCalledWith(1);
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

    // Теперь имитируем ввод хештега
    const textUpdate: Update = {
      update_id: 123467,
      message: {
        message_id: 12,
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
        text: 'test3'
      }
    };

    // Устанавливаем сессию для имитации состояния сцены
    testEnv.bot.context.scene.session = {
      step: 'ADD_HASHTAG',
      currentProjectId: 1,
      user: testEnv.mockUser
    };

    // Вызываем обработчик текстового сообщения
    await testEnv.bot.handleUpdate(textUpdate);

    // Проверяем, что был вызван метод addHashtag с правильными параметрами
    expect(testEnv.mockStorage.addHashtag).toHaveBeenCalledWith(1, 'test3');
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

    // Устанавливаем сессию для имитации состояния сцены
    testEnv.bot.context.scene.session = {
      step: 'HASHTAG_LIST',
      currentProjectId: 1,
      user: testEnv.mockUser
    };

    // Вызываем обработчик callback-запроса
    await testEnv.bot.handleUpdate(update);

    // Проверяем, что был вызван метод removeHashtag с правильными параметрами
    expect(testEnv.mockStorage.removeHashtag).toHaveBeenCalledWith(1, "test1");

    // Проверяем, что был вызван метод answerCbQuery
    expect(testEnv.mockAnswerCbQuery).toHaveBeenCalledWith("123463");
  });
});
