import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { jest } from "@jest/globals";
import { Telegraf } from "telegraf";
import { setupInstagramScraperBot } from "../../../index";
import { ScraperBotContext, StorageAdapter, InstagramScraperBotConfig } from "@/types";
import { User, Project, Competitor, Hashtag } from "@/types";

describe("Bot and Adapter Integration Tests", () => {
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

  it("should initialize adapter when entering project scene", async () => {
    // Настраиваем мок-функции для возврата тестовых данных
    (storageAdapter.findUserByTelegramIdOrCreate as any).mockImplementation(() => Promise.resolve(testUser));
    (storageAdapter.getProjectsByUserId as any).mockImplementation(() => Promise.resolve(testProjects));

    // Создаем контекст для тестирования
    const ctx = {
      from: {
        id: 123456789,
        username: "testuser",
        first_name: "Test",
        last_name: "User"
      },
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

    // Импортируем функцию handleProjectEnter напрямую
    const { handleProjectEnter } = await import("../../../src/scenes/project-scene");

    // Вызываем обработчик входа в сцену напрямую
    await handleProjectEnter(ctx);

    // Проверяем, что адаптер был инициализирован
    expect(storageAdapter.initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод findUserByTelegramIdOrCreate
    expect(storageAdapter.findUserByTelegramIdOrCreate).toHaveBeenCalledWith(
      123456789,
      "testuser",
      "Test",
      "User"
    );

    // Проверяем, что был вызван метод getProjectsByUserId
    expect(storageAdapter.getProjectsByUserId).toHaveBeenCalledWith(1);

    // Проверяем, что адаптер был закрыт
    expect(storageAdapter.close).toHaveBeenCalled();
  });

  it("should create project and save it using adapter", async () => {
    // Настраиваем мок-функции для возврата тестовых данных
    (storageAdapter.getUserByTelegramId as any).mockImplementation(() => Promise.resolve(testUser));
    (storageAdapter.createProject as any).mockImplementation(() => Promise.resolve({
      id: 3,
      user_id: 1,
      name: "New Project",
      created_at: new Date().toISOString(),
    }));

    // Создаем контекст для тестирования
    const ctx = {
      from: { id: 123456789 },
      message: { text: "New Project" },
      scene: {
        enter: jest.fn(),
        leave: jest.fn(),
        reenter: jest.fn(),
        session: { step: "CREATE_PROJECT" },
      },
      reply: jest.fn().mockResolvedValue(true),
      storage: storageAdapter,
      scraperConfig: config,
    } as unknown as ScraperBotContext;

    // Импортируем функцию handleProjectText напрямую
    const { handleProjectText } = await import("../../../src/scenes/project-scene");

    // Мокируем функцию isValidProjectName, чтобы она всегда возвращала true
    jest.spyOn(await import("../../../src/utils/validation"), "isValidProjectName").mockReturnValue(true);

    // Вызываем обработчик текстовых сообщений напрямую
    await handleProjectText(ctx);

    // Проверяем, что адаптер был инициализирован
    expect(storageAdapter.initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод getUserByTelegramId
    expect(storageAdapter.getUserByTelegramId).toHaveBeenCalledWith(123456789);

    // Проверяем, что был вызван метод createProject
    expect(storageAdapter.createProject).toHaveBeenCalledWith(1, "New Project");

    // Проверяем, что адаптер был закрыт
    expect(storageAdapter.close).toHaveBeenCalled();
  });

  it("should add competitor using adapter", async () => {
    // Настраиваем мок-функции для возврата тестовых данных
    (storageAdapter.getUserByTelegramId as any).mockImplementation(() => Promise.resolve(testUser));
    (storageAdapter.addCompetitorAccount as any).mockImplementation(() => Promise.resolve({
      id: 3,
      project_id: 1,
      username: "newcompetitor",
      instagram_url: "https://instagram.com/newcompetitor",
      is_active: true,
      created_at: new Date().toISOString(),
    }));

    // Создаем контекст для тестирования
    const ctx = {
      from: { id: 123456789 },
      message: { text: "https://instagram.com/newcompetitor" },
      scene: {
        enter: jest.fn(),
        leave: jest.fn(),
        reenter: jest.fn(),
        session: {
          step: "ADD_COMPETITOR",
          projectId: 1
        },
      },
      reply: jest.fn().mockResolvedValue(true),
      storage: storageAdapter,
      scraperConfig: config,
    } as unknown as ScraperBotContext;

    // Мокируем функции валидации
    jest.spyOn(await import("../../../src/utils/validation"), "isValidInstagramUrl").mockReturnValue(true);
    jest.spyOn(await import("../../../src/utils/validation"), "extractUsernameFromUrl").mockReturnValue("newcompetitor");

    // Импортируем функцию handleCompetitorText напрямую
    const { handleCompetitorText } = await import("../../../src/scenes/competitor-scene");

    // Сбрасываем счетчики вызовов моков
    jest.clearAllMocks();

    // Вызываем обработчик текстовых сообщений напрямую
    await handleCompetitorText(ctx);

    // Проверяем, что адаптер был инициализирован
    expect(storageAdapter.initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод getUserByTelegramId
    expect(storageAdapter.getUserByTelegramId).toHaveBeenCalledWith(123456789);

    // Проверяем, что был вызван метод addCompetitorAccount
    expect(storageAdapter.addCompetitorAccount).toHaveBeenCalledWith(
      1,
      "newcompetitor",
      "https://instagram.com/newcompetitor"
    );

    // Проверяем, что адаптер был закрыт
    expect(storageAdapter.close).toHaveBeenCalled();
  });

  it("should add hashtag using adapter", async () => {
    // Настраиваем мок-функции для возврата тестовых данных
    (storageAdapter.addHashtag as any).mockImplementation(() => Promise.resolve({
      id: 3,
      project_id: 1,
      hashtag: "newhashtag",
      created_at: new Date().toISOString(),
    }));

    // Создаем контекст для тестирования
    const ctx = {
      from: { id: 123456789 },
      message: { text: "#newhashtag" },
      scene: {
        enter: jest.fn(),
        leave: jest.fn(),
        reenter: jest.fn(),
        session: {
          step: "ADD_HASHTAG",
          projectId: 1
        },
      },
      reply: jest.fn().mockResolvedValue(true),
      storage: storageAdapter,
      scraperConfig: config,
    } as unknown as ScraperBotContext;

    // Импортируем функцию handleHashtagTextInput напрямую
    const { handleHashtagTextInput } = await import("../../../src/scenes/hashtag-scene");

    // Вызываем обработчик текстовых сообщений напрямую
    await handleHashtagTextInput(ctx);

    // Проверяем, что адаптер был инициализирован
    expect(storageAdapter.initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод addHashtag
    expect(storageAdapter.addHashtag).toHaveBeenCalledWith(1, "newhashtag");

    // Проверяем, что адаптер был закрыт
    expect(storageAdapter.close).toHaveBeenCalled();
  });
});
