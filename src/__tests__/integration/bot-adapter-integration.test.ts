import { describe, it, expect, beforeEach } from "bun:test";
import { jest } from "@jest/globals";
import { Telegraf } from "telegraf";
import { setupInstagramScraperBot } from "../../../index";
import { ScraperBotContext, StorageAdapter, InstagramScraperBotConfig } from "@/types";
import { createMockUser, createMockProject } from "../helpers/mocks";
import { createMockStorageAdapter } from "../helpers/types";

describe("Bot and Adapter Integration Tests", () => {
  let bot: Telegraf<ScraperBotContext>;
  let storageAdapter: StorageAdapter;
  let config: InstagramScraperBotConfig;
  // botApi не используется

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

  // Тестовые конкуренты (закомментировано, так как не используется)
  /*
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
  */

  // Тестовые хештеги (закомментировано, так как не используется)
  /*
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
  */

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
    setupInstagramScraperBot(bot, storageAdapter, config);
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
      reply: jest.fn().mockImplementation(() => Promise.resolve()),
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
      reply: jest.fn().mockImplementation(() => Promise.resolve()),
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
      reply: jest.fn().mockImplementation(() => Promise.resolve()),
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
    // Создаем новый контекст с необходимыми свойствами
    const competitorCtx = {
      ...ctx,
      message: { text: "test-competitor" }
    };
    await handleCompetitorText(competitorCtx as any);

    // Проверяем, что адаптер был инициализирован
    expect(storageAdapter.initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод getUserByTelegramId
    expect(storageAdapter.getUserByTelegramId).toHaveBeenCalledWith(123456789);

    // Проверяем, что был вызван метод addCompetitorAccount
    expect(storageAdapter.addCompetitorAccount).toHaveBeenCalled();

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
      reply: jest.fn().mockImplementation(() => Promise.resolve()),
      storage: storageAdapter,
      scraperConfig: config,
    } as unknown as ScraperBotContext;

    // Импортируем функцию handleHashtagTextInput напрямую
    const { handleHashtagTextInput } = await import("../../../src/scenes/hashtag-scene");

    // Вызываем обработчик текстовых сообщений напрямую
    // Создаем новый контекст с необходимыми свойствами
    const hashtagCtx = {
      ...ctx,
      message: { text: "test-hashtag" }
    };
    await handleHashtagTextInput(hashtagCtx as any);

    // Проверяем, что адаптер был инициализирован
    expect(storageAdapter.initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод addHashtag
    expect(storageAdapter.addHashtag).toHaveBeenCalled();

    // Проверяем, что адаптер был закрыт
    expect(storageAdapter.close).toHaveBeenCalled();
  });
});
