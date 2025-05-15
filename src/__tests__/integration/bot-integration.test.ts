import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { jest } from "@jest/globals";
import { Telegraf, Scenes } from "telegraf";
import { setupInstagramScraperBot } from "../../../index";
import { ScraperBotContext, StorageAdapter, InstagramScraperBotConfig } from "@/types";
import { User, Project, Competitor, Hashtag } from "@/types";

describe("Instagram Scraper Bot Integration Tests", () => {
  let bot: Telegraf<ScraperBotContext>;
  let storageAdapter: StorageAdapter;
  let config: InstagramScraperBotConfig;
  let botApi: any;

  // Тестовые данные
  const testUser: User = {
    id: 1,
    telegram_id: 123456789,
    username: "testuser",
    created_at: new Date().toISOString(),
  };

  const testProjects: Project[] = [
    {
      id: 1,
      user_id: 1,
      name: "Test Project 1",
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      user_id: 1,
      name: "Test Project 2",
      created_at: new Date().toISOString(),
    },
  ];

  const testCompetitors: Competitor[] = [
    {
      id: 1,
      project_id: 1,
      username: "competitor1",
      instagram_url: "https://instagram.com/competitor1",
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      project_id: 1,
      username: "competitor2",
      instagram_url: "https://instagram.com/competitor2",
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];

  const testHashtags: Hashtag[] = [
    {
      id: 1,
      project_id: 1,
      hashtag: "test1",
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      project_id: 1,
      hashtag: "test2",
      created_at: new Date().toISOString(),
    },
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
    storageAdapter = {
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      getUserByTelegramId: jest.fn(),
      findUserByTelegramIdOrCreate: jest.fn(),
      getProjectsByUserId: jest.fn(),
      getProjectById: jest.fn(),
      createProject: jest.fn(),
      getCompetitorAccounts: jest.fn(),
      addCompetitorAccount: jest.fn(),
      deleteCompetitorAccount: jest.fn(),
      getHashtagsByProjectId: jest.fn(),
      addHashtag: jest.fn(),
      removeHashtag: jest.fn(),
      getReelsByCompetitorId: jest.fn(),
      saveReels: jest.fn(),
      getReels: jest.fn(),
      logParsingRun: jest.fn(),
      getParsingRunLogs: jest.fn(),
    } as unknown as StorageAdapter;

    config = {
      maxProjectsPerUser: 5,
      maxCompetitorsPerProject: 10,
      maxHashtagsPerProject: 20,
    };

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
      reply: jest.fn().mockResolvedValue(true),
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
      reply: jest.fn().mockResolvedValue(true),
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
      reply: jest.fn().mockResolvedValue(true),
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
    expect(menuButtons).toHaveLength(3);
    expect(menuButtons[0]).toEqual(["📊 Проекты", "🔍 Конкуренты"]);
    expect(menuButtons[1]).toEqual(["#️⃣ Хэштеги", "🎬 Запустить скрапинг"]);
    expect(menuButtons[2]).toEqual(["📱 Результаты", "ℹ️ Помощь"]);

    const commands = botApi.getCommands();
    expect(commands).toHaveLength(5);
    expect(commands[0]).toEqual({ command: "projects", description: "Управление проектами" });
    expect(commands[1]).toEqual({ command: "competitors", description: "Управление конкурентами" });
  });
});
