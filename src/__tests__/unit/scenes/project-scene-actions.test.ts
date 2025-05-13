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
// Импортируем экспортированные обработчики
import {
  handleExitSceneAction,
  handleCreateProjectAction,
  handleBackToProjectsAction,
  handleSelectProjectAction,
  handleManageHashtagsAction,
} from "../../../scenes/project-scene";

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
    // mockAdapter инициализируется в createTestContext для каждого теста
  });

  afterEach(() => {
    // console.error = originalConsoleError;
  });

  // Тест для handleExitSceneAction
  it("should leave the scene on 'exit_scene' action", async () => {
    const ctx = createTestContext({
      callback_query: { data: "exit_scene" },
    });
    await handleExitSceneAction(ctx);
    expect(ctx.answerCbQuery).toHaveBeenCalled();
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
  });

  // Тест для handleCreateProjectAction
  it("should prompt for project name on 'create_project' action", async () => {
    const ctx = createTestContext(
      { callback_query: { data: "create_project" } },
      { step: undefined } // Начальное состояние шага
    );
    await handleCreateProjectAction(ctx);
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith(
      "Введите название нового проекта (минимум 3 символа):"
    );
    expect(ctx.scene.session.step).toBe(ScraperSceneStep.CREATE_PROJECT);
  });

  // Тест для handleBackToProjectsAction
  it("should re-enter the scene on 'back_to_projects' action", async () => {
    const ctx = createTestContext({
      callback_query: { data: "back_to_projects" },
    });
    await handleBackToProjectsAction(ctx);
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    expect(ctx.scene.reenter).toHaveBeenCalledTimes(1);
  });

  // Тест для handleSelectProjectAction (успешный случай)
  it("should show project menu if project exists on project_(\d+) action", async () => {
    const projectId = 789;
    const mockProject: Project = {
      id: projectId,
      name: "Selected Project",
      user_id: 123,
      created_at: new Date().toISOString(),
      is_active: true,
    };
    const ctx = createTestContext(
      { callback_query: { data: `project_${projectId}` } },
      {},
      {
        initialize: jest.fn().mockResolvedValue(undefined),
        getProjectById: jest.fn().mockResolvedValue(mockProject),
      }
    );
    // Устанавливаем ctx.match вручную, так как это делается middleware в Telegraf
    ctx.match = [
      `project_${projectId}`,
      projectId.toString(),
    ] as RegExpExecArray;

    await handleSelectProjectAction(ctx);

    expect(mockAdapter.initialize).toHaveBeenCalledTimes(1);
    expect(mockAdapter.getProjectById).toHaveBeenCalledWith(projectId);
    expect(ctx.reply).toHaveBeenCalledWith(
      `Проект "${mockProject.name}". Выберите действие:`,
      expect.any(Object) // Проверка клавиатуры
    );
  });

  // Тест для handleSelectProjectAction (проект не найден)
  it("should show error and re-enter if project not found on project_(\d+) action", async () => {
    const projectId = 101;
    const ctx = createTestContext(
      { callback_query: { data: `project_${projectId}` } },
      {},
      {
        initialize: jest.fn().mockResolvedValue(undefined),
        getProjectById: jest.fn().mockResolvedValue(null), // Проект не найден
      }
    );
    ctx.match = [
      `project_${projectId}`,
      projectId.toString(),
    ] as RegExpExecArray;

    await handleSelectProjectAction(ctx);

    expect(mockAdapter.getProjectById).toHaveBeenCalledWith(projectId);
    expect(ctx.reply).toHaveBeenCalledWith(
      "Проект не найден. Возможно, он был удален."
    );
    expect(ctx.scene.reenter).toHaveBeenCalledTimes(1);
  });

  // Тест для handleManageHashtagsAction
  it("should enter hashtag scene on manage_hashtags_(\d+) action", async () => {
    const projectId = 202;
    const ctx = createTestContext(
      { callback_query: { data: `manage_hashtags_${projectId}` } },
      { projectId: undefined } // Убедимся, что projectId в сессии будет установлен
    );
    ctx.match = [
      `manage_hashtags_${projectId}`,
      projectId.toString(),
    ] as RegExpExecArray;

    await handleManageHashtagsAction(ctx);

    expect(ctx.scene.session.projectId).toBe(projectId);
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_hashtags");
  });
});
