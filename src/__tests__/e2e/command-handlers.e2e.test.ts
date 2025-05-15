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
} from "../../types";
import { createMockStorageAdapter } from "../helpers/types";

describe.skip("E2E: Command Handlers", () => {
  let bot: Telegraf<ScraperBotContext>;
  let mockSceneEnter: jest.Mock;
  let mockStorage: StorageAdapter;

  const mockConfig: InstagramScraperBotConfig = {
    telegramBotToken: "test-bot-token",
    apifyClientToken: "test-apify-token",
  };

  beforeEach(() => {
    // Создаем мок для scene.enter
    mockSceneEnter = jest.fn();

    // Создаем мок для хранилища
    mockStorage = createMockStorageAdapter();

    // Создаем бот с мидлварой для мокирования scene.enter
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
      return next();
    });

    // Настраиваем бот с мок-хранилищем
    setupInstagramScraperBot(bot, mockStorage, mockConfig);
  });

  it("should enter project scene when /projects command is called", async () => {
    // Создаем объект Update для имитации команды /projects
    const update: Update = {
      update_id: 123457,
      message: {
        message_id: 2,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: 12345,
          type: 'private',
          first_name: 'Test',
          username: 'testuser'
        },
        from: {
          id: 123456789,
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
    await bot.handleUpdate(update);

    // Проверяем, что был вызван метод scene.enter с правильным именем сцены
    expect(mockSceneEnter).toHaveBeenCalledWith("instagram_scraper_projects");
  });

  it("should enter competitor scene when /competitors command is called", async () => {
    // Создаем объект Update для имитации команды /competitors
    const update: Update = {
      update_id: 123459,
      message: {
        message_id: 4,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: 12345,
          type: 'private',
          first_name: 'Test',
          username: 'testuser'
        },
        from: {
          id: 123456789,
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
    await bot.handleUpdate(update);

    // Проверяем, что был вызван метод scene.enter с правильным именем сцены
    expect(mockSceneEnter).toHaveBeenCalledWith("instagram_scraper_competitors");
  });

  it("should enter project scene when '📊 Проекты' message is received", async () => {
    // Создаем объект Update для имитации текстового сообщения
    const update: Update = {
      update_id: 123460,
      message: {
        message_id: 5,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: 12345,
          type: 'private',
          first_name: 'Test',
          username: 'testuser'
        },
        from: {
          id: 123456789,
          is_bot: false,
          first_name: 'Test',
          username: 'testuser'
        },
        text: '📊 Проекты'
      }
    };

    // Вызываем обработчик текстового сообщения
    await bot.handleUpdate(update);

    // Проверяем, что был вызван метод scene.enter с правильным именем сцены
    expect(mockSceneEnter).toHaveBeenCalledWith("instagram_scraper_projects");
  });

  it("should enter competitor scene when '🔍 Конкуренты' message is received", async () => {
    // Создаем объект Update для имитации текстового сообщения
    const update: Update = {
      update_id: 123461,
      message: {
        message_id: 6,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: 12345,
          type: 'private',
          first_name: 'Test',
          username: 'testuser'
        },
        from: {
          id: 123456789,
          is_bot: false,
          first_name: 'Test',
          username: 'testuser'
        },
        text: '🔍 Конкуренты'
      }
    };

    // Вызываем обработчик текстового сообщения
    await bot.handleUpdate(update);

    // Проверяем, что был вызван метод scene.enter с правильным именем сцены
    expect(mockSceneEnter).toHaveBeenCalledWith("instagram_scraper_competitors");
  });
});
