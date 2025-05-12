import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { mock } from "bun:test";
import { Context, Scenes, Telegraf } from "telegraf";
import { Update } from "telegraf/types";
import { projectScene } from "../../../scenes/project-scene";
import {
  ScraperBotContext,
  ScraperSceneSessionData,
  ScraperSceneStep,
  User,
  Project,
} from "../../../types";
import { NeonAdapter } from "../../../adapters/neon-adapter";

// Мокируем модуль адаптера
mock.module("../../../adapters/neon-adapter", () => {
  return {
    NeonAdapter: jest.fn().mockImplementation(() => ({
      initialize: jest.fn(),
      getUserByTelegramId: jest.fn(),
      getProjectsByUserId: jest.fn(),
      getProjectById: jest.fn(),
      createProject: jest.fn(),
    })),
  };
});

// Мокируем модуль сцен
mock.module("telegraf/scenes", () => {
  return {
    Scenes: Scenes,
    Context: Context,
    Stage: {
      middleware: jest.fn(() => (_ctx: any, next: any) => next()),
      enter: jest.fn(),
    },
    BaseScene: class {
      enter = jest.fn();
      leave = jest.fn();
      enterMiddleware = jest
        .fn()
        .mockImplementation(() => (_ctx: any, next: any) => next());
      middleware = jest
        .fn()
        .mockImplementation(() => (_ctx: any, next: any) => next());
      action = jest.fn();
      on = jest.fn();
    },
  };
});

// Мокируем Markup
mock.module("telegraf", () => {
  return {
    Telegraf: Telegraf,
    Context: Context,
    Scenes: Scenes,
    Markup: {
      button: {
        callback: jest.fn((text, data) => ({ text, callback_data: data })),
      },
      inlineKeyboard: jest.fn((buttons) => ({
        inline_keyboard: buttons,
      })),
      keyboard: jest.fn(),
      removeKeyboard: jest.fn(() => ({ remove_keyboard: true })),
      forceReply: jest.fn(),
    },
  };
});

// Определяем тип для мока адаптера
type MockNeonAdapter = {
  initialize: jest.Mock;
  getUserByTelegramId: jest.Mock;
  getProjectsByUserId: jest.Mock;
  getProjectById: jest.Mock;
  createProject: jest.Mock;
};

// --- Глобальные переменные для тестов ---
let bot: Telegraf<ScraperBotContext>;
let stage: Scenes.Stage<ScraperBotContext>;
let mockAdapter: MockNeonAdapter;
// Используем jest.Mock для console.error, так как spyOn нестабилен
let mockConsoleError: jest.Mock<any>;

// Функция для создания тестового контекста
const createTestContext = (
  update: Partial<Update> = {},
  sceneSession?: Partial<ScraperSceneSessionData>,
  adapterMethods?: Partial<MockNeonAdapter>
): ScraperBotContext => {
  const mockUpdate = {
    update_id: 1,
    ...update,
  } as Update;

  const currentMockAdapter = new NeonAdapter() as unknown as MockNeonAdapter;
  if (adapterMethods) {
    Object.assign(currentMockAdapter, adapterMethods);
  }
  mockAdapter = currentMockAdapter;

  const mockTelegram = new Telegraf("fake-token").telegram;
  const mockBotInfo = {
    id: 1,
    is_bot: true,
    first_name: "TestBot",
    username: "TestBot",
  } as any;

  const ctx = new Context(
    mockUpdate,
    mockTelegram,
    mockBotInfo
  ) as ScraperBotContext;

  ctx.storage = mockAdapter as unknown as NeonAdapter;

  ctx.scene = {
    enter: jest.fn(),
    leave: jest.fn(),
    reenter: jest.fn(),
    session: {
      __scenes: {},
      step: undefined,
      currentProjectId: undefined,
      ...sceneSession,
    } as ScraperSceneSessionData,
    current: projectScene as any,
    state: {},
    ctx: ctx,
    scenes: new Map(),
    options: undefined,
    parent: undefined,
    ttl: undefined,
    steps: undefined,
    cursor: 0,
    wizard: undefined,
    reset: jest.fn(),
    leaving: false,
  } as any;

  ctx.reply = jest.fn();
  ctx.answerCbQuery = jest.fn();

  return ctx;
};

describe("Project Scene - Enter Handler Unit Tests", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockAdapter = new NeonAdapter() as unknown as MockNeonAdapter;
    bot = new Telegraf<ScraperBotContext>("test-token");
    stage = new Scenes.Stage<ScraperBotContext>([projectScene]);
    bot.use(stage.middleware());

    // Используем mock.fn() для console.error
    mockConsoleError = jest.fn();
    console.error = mockConsoleError;

    bot.use(projectScene.middleware());
  });

  afterEach(() => {
    // Восстанавливаем оригинальный console.error, если нужно, или просто проверяем вызовы
    // console.error = originalConsoleError; // Если сохраняли оригинал
    // mockConsoleError.mockRestore(); // Не нужно, так как это mock.fn()
  });

  // --- Тесты для projectScene.enter ---

  it("should initialize adapter and show 'no projects' message if user exists but has no projects", async () => {
    const mockUser: User = {
      id: 1,
      telegram_id: 54321,
      username: "test",
      created_at: new Date().toISOString(),
      is_active: true,
    };
    const ctx = createTestContext(
      {
        message: {
          chat: {
            id: 12345,
            type: "private",
            first_name: "Test",
            username: "testuser",
          },
          from: { id: 54321, is_bot: false, first_name: "Test" },
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          text: "/start",
        },
      },
      {},
      {
        initialize: jest.fn().mockResolvedValue(undefined),
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        getProjectsByUserId: jest.fn().mockResolvedValue([]),
      }
    );

    const enterMiddleware = projectScene.enterMiddleware();
    await enterMiddleware(ctx, jest.fn());

    expect(mockAdapter.initialize).toHaveBeenCalledTimes(1);
    expect(mockAdapter.getUserByTelegramId).toHaveBeenCalledWith(54321);
    expect(mockAdapter.getProjectsByUserId).toHaveBeenCalledWith(mockUser.id);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("У вас пока нет проектов."),
      expect.any(Object)
    );
    expect(ctx.scene.session.step).toBe(ScraperSceneStep.PROJECT_LIST);
  });

  it("should initialize adapter and show projects list if user exists and has projects", async () => {
    const mockUser: User = {
      id: 1,
      telegram_id: 54321,
      username: "test",
      created_at: new Date().toISOString(),
      is_active: true,
    };
    const mockProjects: Project[] = [
      {
        id: 1,
        name: "Project Alpha",
        user_id: mockUser.id,
        created_at: new Date().toISOString(),
        is_active: true,
      },
      {
        id: 2,
        name: "Project Beta",
        user_id: mockUser.id,
        created_at: new Date().toISOString(),
        is_active: true,
      },
    ];
    const ctx = createTestContext(
      {
        message: {
          chat: {
            id: 12345,
            type: "private",
            first_name: "Test",
            username: "testuser",
          },
          from: { id: 54321, is_bot: false, first_name: "Test" },
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          text: "/start",
        },
      },
      {},
      {
        initialize: jest.fn().mockResolvedValue(undefined),
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        getProjectsByUserId: jest.fn().mockResolvedValue(mockProjects),
      }
    );

    const enterMiddleware = projectScene.enterMiddleware();
    await enterMiddleware(ctx, jest.fn());

    expect(mockAdapter.initialize).toHaveBeenCalledTimes(1);
    expect(mockAdapter.getUserByTelegramId).toHaveBeenCalledWith(54321);
    expect(mockAdapter.getProjectsByUserId).toHaveBeenCalledWith(mockUser.id);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Ваши проекты:"),
      expect.objectContaining({
        inline_keyboard: expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({ callback_data: "project_1" }),
          ]),
          expect.arrayContaining([
            expect.objectContaining({ callback_data: "project_2" }),
          ]),
        ]),
      })
    );
    expect(ctx.scene.session.step).toBe(ScraperSceneStep.PROJECT_LIST);
  });

  it("should show error message if adapter.initialize fails", async () => {
    const initError = new Error("Init failed");
    const ctx = createTestContext(
      {
        message: {
          chat: {
            id: 12345,
            type: "private",
            first_name: "Test",
            username: "testuser",
          },
          from: { id: 54321, is_bot: false, first_name: "Test" },
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          text: "/start",
        },
      },
      {},
      {
        initialize: jest.fn().mockRejectedValue(initError),
        getUserByTelegramId: jest.fn(),
        getProjectsByUserId: jest.fn(),
      }
    );

    const enterMiddleware = projectScene.enterMiddleware();
    await enterMiddleware(ctx, jest.fn());

    expect(mockAdapter.initialize).toHaveBeenCalledTimes(1);
    expect(mockAdapter.getUserByTelegramId).not.toHaveBeenCalled();
    expect(mockAdapter.getProjectsByUserId).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      "Произошла ошибка при инициализации. Попробуйте позже."
    );
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
    expect(mockConsoleError).toHaveBeenCalledWith(
      "Error initializing adapter:",
      initError
    );
  });

  it("should show error and leave scene if user is not found", async () => {
    const ctx = createTestContext(
      {
        message: {
          chat: {
            id: 12345,
            type: "private",
            first_name: "Test",
            username: "testuser",
          },
          from: { id: 54321, is_bot: false, first_name: "Test" },
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          text: "/start",
        },
      },
      {},
      {
        initialize: jest.fn().mockResolvedValue(undefined),
        getUserByTelegramId: jest.fn().mockResolvedValue(null),
        getProjectsByUserId: jest.fn(),
      }
    );

    const enterMiddleware = projectScene.enterMiddleware();
    await enterMiddleware(ctx, jest.fn());

    expect(mockAdapter.initialize).toHaveBeenCalledTimes(1);
    expect(mockAdapter.getUserByTelegramId).toHaveBeenCalledWith(54321);
    expect(mockAdapter.getProjectsByUserId).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      "Не удалось найти вашего пользователя. Пожалуйста, используйте /start для регистрации."
    );
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
  });

  it("should show error and leave scene if getProjectsByUserId fails", async () => {
    const mockUser: User = {
      id: 1,
      telegram_id: 54321,
      username: "test",
      created_at: new Date().toISOString(),
      is_active: true,
    };
    const projectsError = new Error("DB error");
    const ctx = createTestContext(
      {
        message: {
          chat: {
            id: 12345,
            type: "private",
            first_name: "Test",
            username: "testuser",
          },
          from: { id: 54321, is_bot: false, first_name: "Test" },
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          text: "/start",
        },
      },
      {},
      {
        initialize: jest.fn().mockResolvedValue(undefined),
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        getProjectsByUserId: jest.fn().mockRejectedValue(projectsError),
      }
    );

    const enterMiddleware = projectScene.enterMiddleware();
    await enterMiddleware(ctx, jest.fn());

    expect(mockAdapter.initialize).toHaveBeenCalledTimes(1);
    expect(mockAdapter.getUserByTelegramId).toHaveBeenCalledWith(54321);
    expect(mockAdapter.getProjectsByUserId).toHaveBeenCalledWith(mockUser.id);
    expect(ctx.reply).toHaveBeenCalledWith(
      "Произошла ошибка при загрузке проектов. Попробуйте позже."
    );
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
    expect(mockConsoleError).toHaveBeenCalledWith(
      "Error fetching projects:",
      projectsError
    );
  });
});
