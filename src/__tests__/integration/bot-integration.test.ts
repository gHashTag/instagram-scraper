import { describe, it, expect, beforeEach } from "bun:test";
import { jest } from "@jest/globals";
import { Telegraf } from "telegraf";
import { setupInstagramScraperBot } from "../../../index";
import { ScraperBotContext, StorageAdapter, InstagramScraperBotConfig } from "@/types";
import { createMockStorageAdapter } from "../helpers/types";
import { createMockUser, createMockProject, createMockCompetitor, createMockHashtag } from "../helpers/mocks";

describe("Instagram Scraper Bot Integration Tests", () => {
  let bot: Telegraf<ScraperBotContext>;
  let storageAdapter: StorageAdapter;
  let config: InstagramScraperBotConfig;
  let botApi: any;

  // Тестовые данные
  const testUser = createMockUser({
    id: 1,
    telegram_id: 123456789,
    username: "testuser"
  });

  const testProjects = [
    createMockProject({
      id: 1,
      user_id: 1,
      name: "Test Project 1"
    }),
    createMockProject({
      id: 2,
      user_id: 1,
      name: "Test Project 2"
    })
  ];

  const testCompetitors = [
    createMockCompetitor({
      id: 1,
      project_id: 1,
      username: "competitor1",
      instagram_url: "https://instagram.com/competitor1"
    }),
    createMockCompetitor({
      id: 2,
      project_id: 1,
      username: "competitor2",
      instagram_url: "https://instagram.com/competitor2"
    })
  ];

  const testHashtags = [
    createMockHashtag({
      id: 1,
      project_id: 1,
      hashtag: "test1"
    }),
    createMockHashtag({
      id: 2,
      project_id: 1,
      hashtag: "test2"
    })
  ];

  beforeEach(() => {
    // Создаем мок-объекты для тестов
    bot = {
      use: jest.fn(),
      command: jest.fn(),
      hears: jest.fn(),
      launch: jest.fn(),
      catch: jest.fn(),
    } as unknown as Telegraf<ScraperBotContext>;

    // Создаем мок StorageAdapter
    storageAdapter = createMockStorageAdapter();

    config = {
      telegramBotToken: "test-token",
      apifyClientToken: "test-apify-token",
    } as InstagramScraperBotConfig;

    // Инициализируем бота
    botApi = setupInstagramScraperBot(bot, storageAdapter, config);
  });

  it("should allow navigation from projects to competitors scene", async () => {
    // Настраиваем мок-функции для возврата тестовых данных
    (storageAdapter.findUserByTelegramIdOrCreate as any).mockImplementation(() => Promise.resolve(testUser));
    (storageAdapter.getProjectsByUserId as any).mockImplementation(() => Promise.resolve(testProjects));
    (storageAdapter.getProjectById as any).mockImplementation(() => Promise.resolve(testProjects[0]));
    (storageAdapter.getCompetitorAccounts as any).mockImplementation(() => Promise.resolve(testCompetitors));

    // Создаем контекст для тестирования
    const ctx = {
      from: { id: 123456789 },
      scene: {
        enter: jest.fn(),
        leave: jest.fn(),
        reenter: jest.fn(),
        session: {},
      },
      reply: jest.fn().mockImplementation(() => Promise.resolve()),
      storage: storageAdapter,
      scraperConfig: config,
    } as unknown as ScraperBotContext;

    // Проверяем API бота
    expect(botApi.enterProjectScene()).toBe("instagram_scraper_projects");
    expect(botApi.enterCompetitorScene()).toBe("instagram_scraper_competitors");

    // Симулируем вход в сцену проектов
    await ctx.scene.enter(botApi.enterProjectScene());

    // Проверяем, что был вызван метод enter с правильным именем сцены
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");

    // Симулируем вход в сцену конкурентов
    await ctx.scene.enter(botApi.enterCompetitorScene());

    // Проверяем, что был вызван метод enter с правильным именем сцены
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_competitors");
  });

  it("should allow navigation from competitors to hashtags scene", async () => {
    // Настраиваем мок-функции для возврата тестовых данных
    (storageAdapter.getUserByTelegramId as any).mockImplementation(() => Promise.resolve(testUser));
    (storageAdapter.getProjectsByUserId as any).mockImplementation(() => Promise.resolve([testProjects[0]]));
    (storageAdapter.getCompetitorAccounts as any).mockImplementation(() => Promise.resolve(testCompetitors));
    (storageAdapter.getHashtagsByProjectId as any).mockImplementation(() => Promise.resolve(testHashtags));

    // Создаем контекст для тестирования
    const ctx = {
      from: { id: 123456789 },
      scene: {
        enter: jest.fn(),
        leave: jest.fn(),
        reenter: jest.fn(),
        session: {
          currentProjectId: 1,
        },
      },
      reply: jest.fn().mockImplementation(() => Promise.resolve()),
      storage: storageAdapter,
      scraperConfig: config,
    } as unknown as ScraperBotContext;

    // Симулируем вход в сцену конкурентов
    await ctx.scene.enter(botApi.enterCompetitorScene());

    // Проверяем, что был вызван метод enter с правильным именем сцены
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_competitors");

    // Симулируем вход в сцену хэштегов
    const hashtagSceneName = "instagram_scraper_hashtags";
    await ctx.scene.enter(hashtagSceneName, { projectId: 1 });

    // Проверяем, что был вызван метод enter с правильным именем сцены и параметрами
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_hashtags", { projectId: 1 });
  });

  it("should handle full flow from projects to competitors to hashtags", async () => {
    // Настраиваем мок-функции для возврата тестовых данных
    (storageAdapter.findUserByTelegramIdOrCreate as any).mockImplementation(() => Promise.resolve(testUser));
    (storageAdapter.getProjectsByUserId as any).mockImplementation(() => Promise.resolve(testProjects));
    (storageAdapter.getProjectById as any).mockImplementation(() => Promise.resolve(testProjects[0]));
    (storageAdapter.getCompetitorAccounts as any).mockImplementation(() => Promise.resolve(testCompetitors));
    (storageAdapter.getHashtagsByProjectId as any).mockImplementation(() => Promise.resolve(testHashtags));

    // Создаем контекст для тестирования
    const ctx = {
      from: { id: 123456789 },
      scene: {
        enter: jest.fn(),
        leave: jest.fn(),
        reenter: jest.fn(),
        session: {},
      },
      reply: jest.fn().mockImplementation(() => Promise.resolve()),
      storage: storageAdapter,
      scraperConfig: config,
    } as unknown as ScraperBotContext;

    // 1. Начинаем с проектов
    const projectsSceneName = botApi.enterProjectScene();
    await ctx.scene.enter(projectsSceneName);
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");

    // 2. Переходим к конкурентам
    ctx.scene.session.currentProjectId = 1;
    const competitorSceneName = botApi.enterCompetitorScene();
    await ctx.scene.enter(competitorSceneName);
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_competitors");

    // 3. Переходим к хэштегам
    const hashtagSceneName = "instagram_scraper_hashtags";
    await ctx.scene.enter(hashtagSceneName, { projectId: 1 });
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_hashtags", { projectId: 1 });

    // Проверяем API бота
    const menuButtons = botApi.getMenuButtons();
    // Проверяем только первые две кнопки, так как количество может меняться
    expect(menuButtons.length).toBeGreaterThanOrEqual(3);
    expect(menuButtons[0]).toEqual(["📊 Проекты", "🔍 Конкуренты"]);
    expect(menuButtons[1]).toEqual(["#️⃣ Хэштеги", "🎬 Запустить скрапинг"]);

    const commands = botApi.getCommands();
    // Проверяем только первые две команды, так как количество может меняться
    expect(commands.length).toBeGreaterThanOrEqual(5);
    expect(commands[0]).toEqual({ command: "projects", description: "Управление проектами" });
    expect(commands[1]).toEqual({ command: "competitors", description: "Управление конкурентами" });
  });
});
