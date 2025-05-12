import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { mock } from "bun:test";
import { Context, Scenes, Telegraf } from "telegraf";
import { Update, CallbackQuery, Message } from "telegraf/types";
import { projectScene } from "../../../scenes/project-scene";
import {
  ScraperBotContext,
  ScraperSceneSessionData,
  ScraperSceneStep,
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
const { BaseScene: ActualBaseScene, Stage: ActualStage } = Scenes;
mock.module("telegraf/scenes", () => {
  return {
    __esModule: true,
    Scenes: {
      Stage: ActualStage,
      BaseScene: ActualBaseScene,
      Context: Context,
    },
  };
});

// Мокируем Markup
mock.module("telegraf", () => {
  return {
    __esModule: true,
    Telegraf: Telegraf,
    Context: Context,
    Scenes: { Stage: ActualStage, BaseScene: ActualBaseScene },
    Markup: {
      button: {
        callback: jest.fn((text, data) => ({ text, callback_data: data })),
      },
      inlineKeyboard: jest.fn((buttons) => ({
        inline_keyboard: buttons.flat(),
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
let mockAdapter: MockNeonAdapter;
let mockConsoleError: jest.Mock<any>;

// Функция для создания тестового контекста
const createTestContext = (
  partialUpdateData: { callback_query?: Partial<CallbackQuery.DataQuery> } = {},
  sceneSession?: Partial<ScraperSceneSessionData>,
  adapterMethods?: Partial<MockNeonAdapter>
): ScraperBotContext => {
  // --- Base Mocks ---
  const baseUser = {
    id: 54321,
    is_bot: false,
    first_name: "Test",
    language_code: "en",
    username: "testuser",
  };
  const baseChat = {
    id: 12345,
    type: "private" as const,
    first_name: "Test",
    username: "testuser",
  };
  const baseMessage: Message.TextMessage = {
    message_id: 1,
    chat: baseChat,
    date: Math.floor(Date.now() / 1000),
    from: baseUser,
    text: "Original message text",
  };

  // --- Build CallbackQuery (DataQuery) ---
  const baseCallbackQuery: CallbackQuery.DataQuery = {
    id: "test-cb-id",
    from: baseUser,
    chat_instance: "test-chat-instance",
    data: "", // Гарантируем наличие data
    message: baseMessage, // По умолчанию используем baseMessage
  };

  // Создаем финальный callback_query, мержим с partialUpdateData, если оно есть
  const finalCallbackQuery: CallbackQuery.DataQuery = {
    ...baseCallbackQuery,
    ...(partialUpdateData.callback_query ?? {}), // Применяем переданные изменения
    // Убедимся, что message тоже правильно смержился, если был передан частично
    message: partialUpdateData.callback_query?.message
      ? ({
          ...baseMessage,
          ...partialUpdateData.callback_query.message,
        } as Message.TextMessage)
      : baseMessage,
  };

  // --- Build Update --- (Теперь используем finalCallbackQuery)
  const mockUpdate: Update.CallbackQueryUpdate = {
    update_id: 1,
    callback_query: finalCallbackQuery,
  };

  // --- Rest of the context setup ---
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

  // Используем SceneContextScene
  ctx.scene = {
    enter: jest.fn(),
    leave: jest.fn(),
    reenter: jest.fn(),
    session: {
      __scenes: {},
      step: sceneSession?.step ?? ScraperSceneStep.PROJECT_LIST,
      currentProjectId: sceneSession?.currentProjectId ?? undefined,
      ...(sceneSession ?? {}),
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
    // Добавим методы, если они нужны для SceneContextScene
  } as unknown as Scenes.SceneContextScene<
    ScraperBotContext,
    ScraperSceneSessionData
  >;

  ctx.reply = jest.fn();
  ctx.answerCbQuery = jest.fn();
  ctx.editMessageText = jest.fn();
  ctx.match = null;

  return ctx;
};

describe("Project Scene - Action Handlers Unit Tests", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockConsoleError = jest.fn();
    console.error = mockConsoleError;
    // No bot/stage setup needed
  });

  afterEach(() => {
    // Можно восстановить console.error, если необходимо
    // console.error = originalConsoleError;
  });

  const runActionHandler = async (
    ctx: ScraperBotContext,
    actionName: string
  ) => {
    // ... (Set ctx.match for regex actions)
    if (actionName.startsWith("project_")) {
      const match = actionName.match(/project_(\d+)/);
      if (match) {
        ctx.match = match as RegExpExecArray;
      }
    }
    // Ensure callback_query data is set for non-regex actions + Type Guard
    if (
      !ctx.match &&
      ctx.updateType === "callback_query" &&
      "callback_query" in ctx.update &&
      ctx.update.callback_query &&
      "data" in ctx.update.callback_query
    ) {
      ctx.update.callback_query.data = actionName;
    }

    await projectScene.middleware()(ctx, jest.fn()); // Call the scene's main middleware
  };

  it("should leave the scene on 'exit_scene' action", async () => {
    const ctx = createTestContext({
      callback_query: { data: "exit_scene" },
    });

    await runActionHandler(ctx, "exit_scene");

    expect(ctx.answerCbQuery).toHaveBeenCalled();
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
  });

  it("should prompt for project name on 'create_project' action", async () => {
    const ctx = createTestContext({
      callback_query: { data: "create_project" },
    });

    await runActionHandler(ctx, "create_project");

    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith(
      "Введите название нового проекта (минимум 3 символа):"
    );
    expect(ctx.scene.session.step).toBe(ScraperSceneStep.CREATE_PROJECT);
  });

  it("should re-enter the scene on 'back_to_projects' action", async () => {
    const ctx = createTestContext({
      callback_query: { data: "back_to_projects" },
    });

    await runActionHandler(ctx, "back_to_projects");

    expect(ctx.answerCbQuery).toHaveBeenCalled();
    expect(ctx.scene.reenter).toHaveBeenCalledTimes(1);
  });

  it("should reply with project menu on 'project_(\d+)' action", async () => {
    const projectId = 42;
    const mockProject: Project = {
      id: projectId,
      name: "Test Project",
      user_id: 1,
      created_at: new Date().toISOString(),
      is_active: true,
    };
    const mockKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Mock Button", callback_data: "mock_data" }],
        ],
      },
    };
    mock.module("../../../scenes/components/project-keyboard", () => ({
      generateProjectMenuKeyboard: jest.fn().mockReturnValue(mockKeyboard),
      generateProjectsKeyboard: jest.fn(),
      generateNewProjectKeyboard: jest.fn(),
    }));

    const ctx = createTestContext(
      { callback_query: { data: `project_${projectId}` } },
      { step: ScraperSceneStep.PROJECT_LIST },
      { getProjectById: jest.fn().mockResolvedValue(mockProject) }
    );

    await runActionHandler(ctx, `project_${projectId}`);

    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    expect(mockAdapter.getProjectById).toHaveBeenCalledWith(projectId);
    expect(ctx.reply).toHaveBeenCalledWith(
      `Проект "${mockProject.name}". Выберите действие:`,
      mockKeyboard
    );
    expect(ctx.scene.enter).not.toHaveBeenCalled();
    expect(ctx.scene.session.currentProjectId).toBeUndefined();
  });

  it("should show error and re-enter if project not found on 'project_(\d+)' action", async () => {
    const projectId = 99;
    const ctx = createTestContext(
      { callback_query: { data: `project_${projectId}` } },
      { step: ScraperSceneStep.PROJECT_LIST },
      { getProjectById: jest.fn().mockResolvedValue(null) }
    );

    await runActionHandler(ctx, `project_${projectId}`);

    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    expect(mockAdapter.getProjectById).toHaveBeenCalledWith(projectId);
    expect(ctx.reply).toHaveBeenCalledWith(
      "Проект не найден. Возможно, он был удален."
    );
    expect(ctx.scene.enter).not.toHaveBeenCalled();
    expect(ctx.scene.session.step).toBe(ScraperSceneStep.PROJECT_LIST);
    expect(ctx.scene.reenter).toHaveBeenCalledTimes(1);
  });

  it("should show error if getProjectById fails on 'project_(\d+)' action", async () => {
    const projectId = 101;
    const dbError = new Error("Database connection failed");
    const ctx = createTestContext(
      { callback_query: { data: `project_${projectId}` } },
      { step: ScraperSceneStep.PROJECT_LIST },
      { getProjectById: jest.fn().mockRejectedValue(dbError) }
    );

    await runActionHandler(ctx, `project_${projectId}`);

    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    expect(mockAdapter.getProjectById).toHaveBeenCalledWith(projectId);
    expect(ctx.reply).toHaveBeenCalledWith(
      "Произошла ошибка при получении данных проекта. Пожалуйста, попробуйте позже."
    );
    expect(mockConsoleError).toHaveBeenCalledWith(
      `Ошибка при получении проекта ${projectId}:`,
      dbError
    );
    expect(ctx.scene.enter).not.toHaveBeenCalled();
    expect(ctx.scene.session.step).toBe(ScraperSceneStep.PROJECT_LIST);
  });
});
