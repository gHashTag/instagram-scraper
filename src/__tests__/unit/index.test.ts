import { describe, it, expect, mock, beforeEach } from "bun:test";
import { jest } from "bun:test";
import { Telegraf } from "telegraf";
import { setupInstagramScraperBot } from "../../../index";
import { ScraperBotContext, InstagramScraperBotConfig, StorageAdapter } from "@/types";
import { createMockStorageAdapter } from "../helpers/types";

// Мокируем сцены
mock.module("../../../src/scenes/project-scene", () => ({
  projectScene: {
    name: "instagram_scraper_projects",
    middleware: () => {},
  },
}));

mock.module("../../../src/scenes/competitor-scene", () => ({
  competitorScene: {
    name: "instagram_scraper_competitors",
    middleware: () => {},
  },
}));

mock.module("../../../src/scenes/hashtag-scene", () => ({
  hashtagScene: {
    name: "instagram_scraper_hashtags",
    middleware: () => {},
  },
}));

describe("Instagram Scraper Bot Setup", () => {
  let bot: Telegraf<ScraperBotContext>;
  let storageAdapter: StorageAdapter;
  let config: InstagramScraperBotConfig;

  beforeEach(() => {
    // Создаем мок-объекты для тестов
    bot = {
      use: jest.fn(),
      command: jest.fn(),
      hears: jest.fn(),
      launch: jest.fn(),
      catch: jest.fn(),
    } as unknown as Telegraf<ScraperBotContext>;

    storageAdapter = createMockStorageAdapter();

    config = {
      telegramBotToken: "test-token",
      apifyClientToken: "test-apify-token",
    } as InstagramScraperBotConfig;

    // Мокируем Scenes.Stage
    mock.module("telegraf", () => ({
      Scenes: {
        Stage: function() {
          return {
            middleware: () => () => {}
          };
        }
      }
    }));
  });

  it("should initialize the bot with storage adapter and config", () => {
    // Вызываем функцию setupInstagramScraperBot
    setupInstagramScraperBot(bot, storageAdapter, config);

    // Проверяем, что middleware для доступа к хранилищу и конфигурации был добавлен
    expect(bot.use).toHaveBeenCalledTimes(2); // Один раз для middleware, один раз для stage
  });

  it("should register scenes", () => {
    // Вызываем функцию setupInstagramScraperBot
    setupInstagramScraperBot(bot, storageAdapter, config);

    // Проверяем, что bot.use был вызван дважды (один раз для middleware, один раз для stage)
    expect(bot.use).toHaveBeenCalledTimes(2);
  });

  it("should register command handlers", () => {
    // Вызываем функцию setupInstagramScraperBot
    setupInstagramScraperBot(bot, storageAdapter, config);

    // Проверяем, что обработчики команд были зарегистрированы
    expect(bot.command).toHaveBeenCalledWith("projects", expect.any(Function));
    expect(bot.command).toHaveBeenCalledWith("competitors", expect.any(Function));
  });

  it("should enter project scene when /projects command is called", () => {
    // Вызываем функцию setupInstagramScraperBot
    setupInstagramScraperBot(bot, storageAdapter, config);

    // Получаем обработчик команды projects
    const projectsHandlerCall = (bot.command as jest.Mock).mock.calls.find(
      call => call[0] === "projects"
    );

    // Проверяем, что обработчик был найден
    expect(projectsHandlerCall).toBeDefined();
    const projectsHandler = projectsHandlerCall![1];

    // Создаем мок-контекст
    const ctx = {
      scene: {
        enter: jest.fn()
      }
    };

    // Вызываем обработчик
    projectsHandler(ctx);

    // Проверяем, что был вызван метод enter с правильным именем сцены
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");
  });

  it("should enter competitor scene when /competitors command is called", () => {
    // Вызываем функцию setupInstagramScraperBot
    setupInstagramScraperBot(bot, storageAdapter, config);

    // Получаем обработчик команды competitors
    const competitorsHandlerCall = (bot.command as jest.Mock).mock.calls.find(
      call => call[0] === "competitors"
    );

    // Проверяем, что обработчик был найден
    expect(competitorsHandlerCall).toBeDefined();
    const competitorsHandler = competitorsHandlerCall![1];

    // Создаем мок-контекст
    const ctx = {
      scene: {
        enter: jest.fn()
      }
    };

    // Вызываем обработчик
    competitorsHandler(ctx);

    // Проверяем, что был вызван метод enter с правильным именем сцены
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_competitors");
  });

  it("should register text message handlers", () => {
    // Вызываем функцию setupInstagramScraperBot
    setupInstagramScraperBot(bot, storageAdapter, config);

    // Проверяем, что обработчики текстовых сообщений были зарегистрированы
    expect(bot.hears).toHaveBeenCalledWith("📊 Проекты", expect.any(Function));
    expect(bot.hears).toHaveBeenCalledWith("🔍 Конкуренты", expect.any(Function));
  });

  it("should enter project scene when '📊 Проекты' message is received", () => {
    // Вызываем функцию setupInstagramScraperBot
    setupInstagramScraperBot(bot, storageAdapter, config);

    // Получаем обработчик текстового сообщения
    const projectsHandlerCall = (bot.hears as jest.Mock).mock.calls.find(
      call => call[0] === "📊 Проекты"
    );

    // Проверяем, что обработчик был найден
    expect(projectsHandlerCall).toBeDefined();
    const projectsHandler = projectsHandlerCall![1];

    // Создаем мок-контекст
    const ctx = {
      scene: {
        enter: jest.fn()
      }
    };

    // Вызываем обработчик
    projectsHandler(ctx);

    // Проверяем, что был вызван метод enter с правильным именем сцены
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");
  });

  it("should enter competitor scene when '🔍 Конкуренты' message is received", () => {
    // Вызываем функцию setupInstagramScraperBot
    setupInstagramScraperBot(bot, storageAdapter, config);

    // Получаем обработчик текстового сообщения
    const competitorsHandlerCall = (bot.hears as jest.Mock).mock.calls.find(
      call => call[0] === "🔍 Конкуренты"
    );

    // Проверяем, что обработчик был найден
    expect(competitorsHandlerCall).toBeDefined();
    const competitorsHandler = competitorsHandlerCall![1];

    // Создаем мок-контекст
    const ctx = {
      scene: {
        enter: jest.fn()
      }
    };

    // Вызываем обработчик
    competitorsHandler(ctx);

    // Проверяем, что был вызван метод enter с правильным именем сцены
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_competitors");
  });

  it("should return API with scene entry methods", () => {
    // Вызываем функцию setupInstagramScraperBot
    const api = setupInstagramScraperBot(bot, storageAdapter, config);

    // Проверяем, что API содержит методы для входа в сцены
    expect(api.enterProjectScene()).toBe("instagram_scraper_projects");
    expect(api.enterCompetitorScene()).toBe("instagram_scraper_competitors");
  });

  it("should return API with menu buttons", () => {
    // Вызываем функцию setupInstagramScraperBot
    const api = setupInstagramScraperBot(bot, storageAdapter, config);

    // Проверяем, что API содержит кнопки для меню
    const menuButtons = api.getMenuButtons();
    // Проверяем только первые две кнопки, так как количество может меняться
    expect(menuButtons.length).toBeGreaterThanOrEqual(3);
    expect(menuButtons[0]).toEqual(["📊 Проекты", "🔍 Конкуренты"]);
    expect(menuButtons[1]).toEqual(["#️⃣ Хэштеги", "🎬 Запустить скрапинг"]);
  });

  it("should return API with commands for registration", () => {
    // Вызываем функцию setupInstagramScraperBot
    const api = setupInstagramScraperBot(bot, storageAdapter, config);

    // Проверяем, что API содержит команды для регистрации в Telegram
    const commands = api.getCommands();
    // Проверяем только первые две команды, так как количество может меняться
    expect(commands.length).toBeGreaterThanOrEqual(5);
    expect(commands[0]).toEqual({ command: "projects", description: "Управление проектами" });
    expect(commands[1]).toEqual({ command: "competitors", description: "Управление конкурентами" });
  });

  it("should pass storage adapter and config to middleware", () => {
    // Вызываем функцию setupInstagramScraperBot
    setupInstagramScraperBot(bot, storageAdapter, config);

    // Получаем middleware, который был передан в bot.use
    const middleware = (bot.use as any).mock.calls[0][0];

    // Создаем мок-контекст и next-функцию
    const ctx = {} as ScraperBotContext;
    const next = jest.fn();

    // Вызываем middleware
    middleware(ctx, next);

    // Проверяем, что storage и scraperConfig были добавлены в контекст
    expect(ctx.storage).toBe(storageAdapter);
    expect(ctx.scraperConfig).toBe(config);
    expect(next).toHaveBeenCalled();
  });
});
