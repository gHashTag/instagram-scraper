import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { mock } from "bun:test";
import { Context, Scenes, Telegraf } from "telegraf";
import { Update, Message, Chat, User as TelegramUser } from "telegraf/types";
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
let mockConsoleError: jest.Mock;

// Define a base message type excluding problematic fields and ensuring private chat
type BaseMessageType = Omit<
  Message.TextMessage,
  "edit_date" | "chat" | "author_signature" | "from"
> & {
  chat: Chat.PrivateChat;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    language_code?: string;
  };
};

// Функция для создания тестового контекста
const createTestContext = (
  messageText: string | undefined = undefined,
  updateOverrides: Partial<Update.MessageUpdate<Message.TextMessage>> = {},
  sceneSession?: Partial<ScraperSceneSessionData>,
  adapterMethods?: Partial<MockNeonAdapter>
): ScraperBotContext => {
  // Base message with corrected types
  const baseMessage: BaseMessageType = {
    message_id: 1,
    chat: {
      id: 12345,
      type: "private",
      first_name: "Test",
      username: "testuser",
    },
    date: Math.floor(Date.now() / 1000),
    from: {
      id: 54321,
      is_bot: false,
      first_name: "Test",
      language_code: "en",
    },
    text: messageText ?? "",
  };

  // Construct the final message ensuring problematic fields are strictly undefined
  // and chat is PrivateChat, and from matches TelegramUser structure
  const finalMessage: Message.TextMessage & {
    edit_date: undefined;
    author_signature: undefined;
    chat: Chat.PrivateChat;
    from: TelegramUser;
  } = {
    ...(baseMessage as Message.TextMessage),
    ...(updateOverrides.message || {}),
    text: messageText ?? updateOverrides.message?.text ?? "",
    chat: {
      ...(baseMessage.chat as Chat.PrivateChat),
      ...(updateOverrides.message?.chat || {}),
      type: "private",
    } as Chat.PrivateChat,
    from: {
      id: baseMessage.from.id,
      is_bot: baseMessage.from.is_bot,
      first_name: baseMessage.from.first_name,
      last_name: updateOverrides.message?.from?.last_name,
      username: updateOverrides.message?.from?.username,
      language_code:
        baseMessage.from.language_code ??
        updateOverrides.message?.from?.language_code,
      is_premium: updateOverrides.message?.from?.is_premium,
      added_to_attachment_menu:
        updateOverrides.message?.from?.added_to_attachment_menu,
    } as TelegramUser,
    edit_date: undefined,
    author_signature: undefined,
  };

  // Create the mock update
  const mockUpdate: Update.MessageUpdate<Message.TextMessage> = {
    update_id: 1,
    message: finalMessage,
    // Apply other updateOverrides, excluding message which is handled by finalMessage
    ...Object.fromEntries(
      Object.entries(updateOverrides).filter(([key]) => key !== "message")
    ),
  };

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
      step: sceneSession?.step ?? undefined,
      currentProjectId: sceneSession?.currentProjectId ?? undefined,
      ...sceneSession,
    },
    current: projectScene as any, // Cast to any to avoid type issues with mock
    state: {},
    ctx: ctx, // self-reference
    scenes: new Map(),
    options: undefined, // Satisfy StageScene
    parent: undefined, // Satisfy StageScene
    ttl: undefined, // Satisfy StageScene
    steps: undefined,
    cursor: 0,
    wizard: undefined,
    reset: jest.fn(),
    leaving: false,
    selectStep: jest.fn(), // Add missing mock for selectStep
    next: jest.fn(), // Add missing mock for next
    back: jest.fn(), // Add missing mock for back
  } as any; // Cast to any for simplicity with mock structure

  ctx.reply = jest.fn();
  ctx.answerCbQuery = jest.fn();

  return ctx;
};

describe("Project Scene - On Text Handler Unit Tests", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    // Reinitialize mockAdapter for each test
    mockAdapter = new (NeonAdapter as any)() as MockNeonAdapter;
    bot = new Telegraf<ScraperBotContext>("test-token");
    stage = new Scenes.Stage<ScraperBotContext>([projectScene as any]); // Cast scene
    bot.use(stage.middleware());
    mockConsoleError = jest.fn();
    console.error = mockConsoleError;
    bot.use((projectScene as any).middleware()); // Cast scene
  });

  afterEach(() => {
    // No explicit restore needed for jest.fn() based mockConsoleError
  });

  // --- Тесты для Обработчика Текстовых Сообщений (on('text')) ---
  it("should create project and re-enter scene if step is CREATE_PROJECT and name is valid", async () => {
    const projectName = "New Awesome Project";
    const mockUser: User = {
      id: 1,
      telegram_id: 54321,
      username: "test",
      created_at: new Date().toISOString(),
      is_active: true,
    };
    const createdProject: Project = {
      id: 5,
      name: projectName,
      user_id: mockUser.id,
      created_at: new Date().toISOString(),
      is_active: true,
    };

    const ctx = createTestContext(
      projectName,
      {}, // No specific update overrides needed for this text message
      { step: ScraperSceneStep.CREATE_PROJECT },
      {
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        createProject: jest.fn().mockResolvedValue(createdProject),
      }
    );

    // Correctly access the 'on' handler from the mocked BaseScene instance
    const onTextHandler = (projectScene as any).on.mock.calls.find(
      (call: any) => call[0] === "text"
    )?.[1];

    if (onTextHandler) {
      await onTextHandler(ctx, jest.fn());
    } else {
      throw new Error("on('text') handler not found on mock scene");
    }

    expect(mockAdapter.getUserByTelegramId).toHaveBeenCalledWith(54321);
    expect(mockAdapter.createProject).toHaveBeenCalledWith(
      mockUser.id,
      projectName
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      `Проект "${projectName}" успешно создан!`
    );
    expect(ctx.scene.reenter).toHaveBeenCalledTimes(1);
    expect(ctx.scene.session.step).toBeUndefined();
  });

  it("should show error if project name is too short when step is CREATE_PROJECT", async () => {
    const shortProjectName = "No";
    const ctx = createTestContext(
      shortProjectName,
      {},
      { step: ScraperSceneStep.CREATE_PROJECT }
    );

    const onTextHandler = (projectScene as any).on.mock.calls.find(
      (call: any) => call[0] === "text"
    )?.[1];

    if (onTextHandler) {
      await onTextHandler(ctx, jest.fn());
    } else {
      throw new Error("on('text') handler not found on mock scene");
    }

    expect(mockAdapter.getUserByTelegramId).not.toHaveBeenCalled();
    expect(mockAdapter.createProject).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      "Название проекта должно быть длиннее 3 символов. Попробуйте еще раз:"
    );
    expect(ctx.scene.session.step).toBe(ScraperSceneStep.CREATE_PROJECT);
    expect(ctx.scene.reenter).not.toHaveBeenCalled();
  });

  it("should show error if user not found when step is CREATE_PROJECT", async () => {
    const projectName = "Another Project";
    const ctx = createTestContext(
      projectName,
      {},
      { step: ScraperSceneStep.CREATE_PROJECT },
      { getUserByTelegramId: jest.fn().mockResolvedValue(null) }
    );

    const onTextHandler = (projectScene as any).on.mock.calls.find(
      (call: any) => call[0] === "text"
    )?.[1];

    if (onTextHandler) {
      await onTextHandler(ctx, jest.fn());
    } else {
      throw new Error("on('text') handler not found on mock scene");
    }

    expect(mockAdapter.getUserByTelegramId).toHaveBeenCalledWith(54321);
    expect(mockAdapter.createProject).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      "Не удалось найти вашего пользователя. Пожалуйста, используйте /start для регистрации."
    );
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
  });

  it("should show error if createProject returns null when step is CREATE_PROJECT", async () => {
    const projectName = "Yet Another Project";
    const mockUser: User = {
      id: 1,
      telegram_id: 54321,
      username: "test",
      created_at: new Date().toISOString(),
      is_active: true,
    };
    const ctx = createTestContext(
      projectName,
      {},
      { step: ScraperSceneStep.CREATE_PROJECT },
      {
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        createProject: jest.fn().mockResolvedValue(null),
      }
    );

    const onTextHandler = (projectScene as any).on.mock.calls.find(
      (call: any) => call[0] === "text"
    )?.[1];

    if (onTextHandler) {
      await onTextHandler(ctx, jest.fn());
    } else {
      throw new Error("on('text') handler not found on mock scene");
    }

    expect(mockAdapter.getUserByTelegramId).toHaveBeenCalledWith(54321);
    expect(mockAdapter.createProject).toHaveBeenCalledWith(
      mockUser.id,
      projectName
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      `Не удалось создать проект "${projectName}". Попробуйте еще раз или обратитесь в поддержку.`
    );
    expect(ctx.scene.session.step).toBe(ScraperSceneStep.CREATE_PROJECT);
  });

  it("should handle error if createProject throws when step is CREATE_PROJECT", async () => {
    const projectName = "Project Fail";
    const mockUser: User = {
      id: 1,
      telegram_id: 54321,
      username: "test",
      created_at: new Date().toISOString(),
      is_active: true,
    };
    const dbError = new Error("Database insert failed");
    const ctx = createTestContext(
      projectName,
      {},
      { step: ScraperSceneStep.CREATE_PROJECT },
      {
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        createProject: jest.fn().mockRejectedValue(dbError),
      }
    );

    const onTextHandler = (projectScene as any).on.mock.calls.find(
      (call: any) => call[0] === "text"
    )?.[1];

    if (onTextHandler) {
      await onTextHandler(ctx, jest.fn());
    } else {
      throw new Error("on('text') handler not found on mock scene");
    }

    expect(mockAdapter.getUserByTelegramId).toHaveBeenCalledWith(54321);
    expect(mockAdapter.createProject).toHaveBeenCalledWith(
      mockUser.id,
      projectName
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      "Произошла ошибка при создании проекта. Пожалуйста, попробуйте позже."
    );
    expect(mockConsoleError).toHaveBeenCalledWith(
      "Ошибка при создании проекта в текстовом обработчике:",
      dbError
    );
    expect(ctx.scene.session.step).toBe(ScraperSceneStep.CREATE_PROJECT);
  });

  it("should do nothing if step is not CREATE_PROJECT", async () => {
    const someText = "Just some text";
    const ctx = createTestContext(
      someText,
      {}, // No specific update overrides needed
      { step: ScraperSceneStep.PROJECT_LIST } // Different step
    );

    const onTextHandler = (projectScene as any).on.mock.calls.find(
      (call: any) => call[0] === "text"
    )?.[1];

    let wasCalled = false;
    if (onTextHandler) {
      await onTextHandler(ctx, jest.fn());
      wasCalled = true;
    }

    // Check if the handler was even registered and called
    // If the step is not CREATE_PROJECT, the handler might not do anything,
    // so we check that critical mocks like reply or adapter calls were NOT made.
    expect(wasCalled).toBe(true); // Ensure the handler was found and invoked
    expect(mockAdapter.createProject).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});
