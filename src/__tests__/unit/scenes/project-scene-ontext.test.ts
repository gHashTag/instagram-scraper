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
// Импортируем экспортированный обработчик
import { handleProjectText } from "../../../scenes/project-scene";

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
    mockAdapter = new (NeonAdapter as any)() as MockNeonAdapter;
    // bot и stage больше не нужны для этих тестов, так как мы тестируем обработчик напрямую
    // bot = new Telegraf<ScraperBotContext>("test-token");
    // stage = new Scenes.Stage<ScraperBotContext>([projectScene as any]);
    // bot.use(stage.middleware());
    mockConsoleError = jest.fn();
    console.error = mockConsoleError;
    // bot.use((projectScene as any).middleware()); // Это тоже больше не нужно
  });

  afterEach(() => {
    // No explicit restore needed for jest.fn() based mockConsoleError
  });

  // --- Тесты для Обработчика Текстовых Сообщений (handleProjectText) ---
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
      id: 99,
      user_id: mockUser.id,
      name: projectName,
      created_at: new Date().toISOString(),
      is_active: true,
    };

    const ctx = createTestContext(
      projectName,
      {},
      { step: ScraperSceneStep.CREATE_PROJECT },
      {
        initialize: jest.fn().mockResolvedValue(undefined),
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        createProject: jest.fn().mockResolvedValue(createdProject),
      }
    );

    await handleProjectText(ctx);

    expect(mockAdapter.initialize).toHaveBeenCalledTimes(1);
    expect(mockAdapter.getUserByTelegramId).toHaveBeenCalledWith(54321);
    expect(mockAdapter.createProject).toHaveBeenCalledWith(
      mockUser.id,
      projectName
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining(`Проект "${projectName}" успешно создан!`), // Убрал reenter, так как сцена сама не реентерит, а показывает кнопки
      expect.any(Object) // Проверяем, что клавиатура была передана
    );
    expect(ctx.scene.session.step).toBeUndefined();
    // expect(ctx.scene.reenter).toHaveBeenCalledTimes(1); // reenter убрали, так как тестируем изолированно
  });

  it("should show error if project name is too short when step is CREATE_PROJECT", async () => {
    const shortProjectName = "P1";
    const ctx = createTestContext(
      shortProjectName,
      {},
      { step: ScraperSceneStep.CREATE_PROJECT }
    );

    await handleProjectText(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      "Название проекта должно содержать не менее 3 символов. Попробуйте еще раз:"
    );
    expect(mockAdapter.createProject).not.toHaveBeenCalled();
    // expect(ctx.scene.reenter).not.toHaveBeenCalled(); // reenter не должен вызываться
  });

  it("should show error if user not found when step is CREATE_PROJECT", async () => {
    const projectName = "Another Project";
    const ctx = createTestContext(
      projectName,
      {},
      { step: ScraperSceneStep.CREATE_PROJECT },
      {
        initialize: jest.fn().mockResolvedValue(undefined),
        getUserByTelegramId: jest.fn().mockResolvedValue(null), // Пользователь не найден
        createProject: jest.fn(),
      }
    );

    await handleProjectText(ctx);

    expect(ctx.reply).toHaveBeenCalledWith("Ошибка: пользователь не найден.");
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
    expect(mockAdapter.createProject).not.toHaveBeenCalled();
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
        initialize: jest.fn().mockResolvedValue(undefined),
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        createProject: jest.fn().mockResolvedValue(null), // createProject вернул null
      }
    );

    await handleProjectText(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      "Ошибка при создании проекта. Попробуйте позже."
    );
    expect(ctx.scene.session.step).toBeUndefined();
    // expect(ctx.scene.reenter).toHaveBeenCalledTimes(1); // reenter убрали
  });

  it("should handle error if createProject throws when step is CREATE_PROJECT", async () => {
    const projectName = "Risky Project";
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
        initialize: jest.fn().mockResolvedValue(undefined),
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        createProject: jest.fn().mockRejectedValue(dbError),
      }
    );

    await handleProjectText(ctx);

    expect(mockConsoleError).toHaveBeenCalledWith(
      "Ошибка при создании проекта:",
      dbError
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      "Произошла ошибка при создании проекта. Пожалуйста, попробуйте позже."
    );
    expect(ctx.scene.session.step).toBeUndefined(); // Шаг должен сбрасываться
    // expect(ctx.scene.reenter).toHaveBeenCalledTimes(1); // reenter убрали
  });

  it("should do nothing if step is not CREATE_PROJECT", async () => {
    const someText = "Hello there";
    const ctx = createTestContext(
      someText,
      {}, // No specific update overrides needed
      { step: ScraperSceneStep.PROJECT_LIST } // Different step
    );

    await handleProjectText(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      "Я не понимаю эту команду. Используйте кнопки для управления проектами."
    );
    expect(mockAdapter.createProject).not.toHaveBeenCalled();
  });
});
