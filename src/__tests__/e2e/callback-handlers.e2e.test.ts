import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
} from "bun:test";
import { Telegraf } from "telegraf";
import { setupInstagramScraperBot } from "../../..";
import { Update } from "telegraf/types";
import type {
  ScraperBotContext,
  InstagramScraperBotConfig,
  StorageAdapter,
  Project,
} from "../../types";

describe.skip("E2E: Callback Handlers", () => {
  let bot: Telegraf<ScraperBotContext>;
  let mockSceneEnter: jest.Mock;
  let mockSendMessage: jest.Mock;
  let mockAnswerCbQuery: jest.Mock;
  let mockStorage: StorageAdapter;

  const mockConfig: InstagramScraperBotConfig = {
    telegramBotToken: "test-bot-token",
    apifyClientToken: "test-apify-token",
  };

  const mockProject: Project = {
    id: 1,
    user_id: 1,
    name: "Test Project",
    created_at: new Date().toISOString(),
    is_active: true,
  };

  beforeEach(() => {
    // Создаем моки для методов бота
    mockSceneEnter = jest.fn();
    mockSendMessage = jest.fn().mockResolvedValue({
      message_id: 100,
      from: {
        id: 987654321,
        is_bot: true,
        first_name: "TestBot",
        username: "TestBot_username",
      },
      chat: {
        id: 12345,
        type: 'private',
        first_name: 'Test',
        username: 'testuser'
      },
      date: Math.floor(Date.now() / 1000),
      text: 'Mocked response'
    });
    mockAnswerCbQuery = jest.fn().mockResolvedValue(true);

    // Создаем мок для хранилища
    mockStorage = {
      initialize: jest.fn(),
      close: jest.fn(),
      findUserByTelegramIdOrCreate: jest.fn().mockResolvedValue({
        id: 1,
        telegram_id: 123456789,
        username: "testuser",
        created_at: new Date().toISOString(),
        is_active: true,
      }),
      getUserByTelegramId: jest.fn(),
      getProjectsByUserId: jest.fn(),
      getProjectById: jest.fn().mockResolvedValue(mockProject),
      createProject: jest.fn(),
      getHashtagsByProjectId: jest.fn().mockResolvedValue([]),
      addHashtag: jest.fn(),
      removeHashtag: jest.fn(),
      getCompetitorAccounts: jest.fn().mockResolvedValue([]),
      addCompetitorAccount: jest.fn(),
      deleteCompetitorAccount: jest.fn(),
      getReelsByProjectId: jest.fn(),
      saveReels: jest.fn(),
      getParsingLogsByProjectId: jest.fn(),
      createParsingLog: jest.fn(),
      updateParsingLog: jest.fn(),
    };

    // Создаем бот с мидлварой для мокирования методов
    bot = new Telegraf<ScraperBotContext>("test-bot-token");

    // Мокируем метод getMe
    bot.telegram.getMe = jest.fn().mockResolvedValue({
      id: 987654321,
      is_bot: true,
      first_name: "TestBot",
      username: "TestBot_username",
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
    });

    bot.use((ctx: any, next) => {
      ctx.scene = { enter: mockSceneEnter };
      ctx.session = {};
      return next();
    });

    // Мокируем методы API Telegram
    bot.telegram.sendMessage = mockSendMessage;
    bot.telegram.answerCbQuery = mockAnswerCbQuery;

    // Настраиваем бот с мок-хранилищем
    setupInstagramScraperBot(bot, mockStorage, mockConfig);
  });

  it("should handle project selection callback", async () => {
    // Создаем объект Update для имитации нажатия на кнопку выбора проекта
    const update: Update = {
      update_id: 123457,
      callback_query: {
        id: "123456",
        from: {
          id: 123456789,
          is_bot: false,
          first_name: "Test",
          username: "testuser",
        },
        message: {
          message_id: 2,
          date: Math.floor(Date.now() / 1000),
          chat: {
            id: 12345,
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
    await bot.handleUpdate(update);

    // Проверяем, что был вызван метод getProjectById с правильным ID проекта
    expect(mockStorage.getProjectById).toHaveBeenCalledWith(1);

    // Проверяем, что был вызван метод answerCbQuery
    expect(mockAnswerCbQuery).toHaveBeenCalledWith("123456");

    // Проверяем, что было отправлено сообщение с меню проекта
    expect(mockSendMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining("Test Project"),
      expect.any(Object)
    );
  });

  it("should handle create project callback", async () => {
    // Создаем объект Update для имитации нажатия на кнопку создания проекта
    const update: Update = {
      update_id: 123458,
      callback_query: {
        id: "123457",
        from: {
          id: 123456789,
          is_bot: false,
          first_name: "Test",
          username: "testuser",
        },
        message: {
          message_id: 3,
          date: Math.floor(Date.now() / 1000),
          chat: {
            id: 12345,
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
    await bot.handleUpdate(update);

    // Проверяем, что был вызван метод answerCbQuery
    expect(mockAnswerCbQuery).toHaveBeenCalledWith("123457");

    // Проверяем, что было отправлено сообщение с запросом названия проекта
    expect(mockSendMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining("Введите название проекта"),
      expect.any(Object)
    );
  });

  it("should handle add competitor callback", async () => {
    // Создаем объект Update для имитации нажатия на кнопку добавления конкурента
    const update: Update = {
      update_id: 123459,
      callback_query: {
        id: "123458",
        from: {
          id: 123456789,
          is_bot: false,
          first_name: "Test",
          username: "testuser",
        },
        message: {
          message_id: 4,
          date: Math.floor(Date.now() / 1000),
          chat: {
            id: 12345,
            type: "private",
            first_name: "Test",
            username: "testuser",
          },
          text: "У проекта Test Project нет конкурентов",
          entities: [],
        },
        chat_instance: "123456",
        data: "add_competitor_1",
      },
    };

    // Вызываем обработчик callback-запроса
    await bot.handleUpdate(update);

    // Проверяем, что был вызван метод answerCbQuery
    expect(mockAnswerCbQuery).toHaveBeenCalledWith("123458");

    // Проверяем, что было отправлено сообщение с запросом имени конкурента
    expect(mockSendMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining("Введите имя аккаунта конкурента"),
      expect.any(Object)
    );
  });
});
