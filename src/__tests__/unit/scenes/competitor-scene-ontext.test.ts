import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
  mock,
  spyOn,
} from "bun:test";
import { Context } from "telegraf";
import { Update, UserFromGetMe } from "telegraf/types";
import { competitorScene } from "../../../scenes/competitor-scene";
import { NeonAdapter } from "../../../adapters/neon-adapter";
import {
  ScraperBotContext,
  ScraperSceneStep,
  Project,
  Competitor,
  User,
  ScraperSceneSessionData,
} from "@/types";

// Мокируем NeonAdapter
mock.module("../../../adapters/neon-adapter", () => {
  return {
    NeonAdapter: jest.fn().mockImplementation(() => ({
      initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      getUserByTelegramId:
        jest.fn<(telegramId: number) => Promise<User | null>>(),
      getProjectsByUserId:
        jest.fn<(userId: number) => Promise<Project[] | null>>(),
      getCompetitorAccounts:
        jest.fn<(projectId: number) => Promise<Competitor[] | null>>(),
      addCompetitorAccount:
        jest.fn<
          (
            projectId: number,
            username: string,
            instagramUrl: string
          ) => Promise<Competitor | null>
        >(),
      removeCompetitor: jest.fn(),
    })),
  };
});

let mockNeonAdapterInstance: NeonAdapter & {
  [K in keyof NeonAdapter]: jest.Mock;
};

// Определяем тип контекста с полем match
type ActionContextWithMatch = ScraperBotContext & {
  scene: { session: ScraperSceneSessionData };
  match: RegExpExecArray | null;
};

// Базовый тип контекста без match
type BasicContext = ScraperBotContext & {
  scene: { session: ScraperSceneSessionData };
};

const createMockContext = (
  update: Partial<Update.CallbackQueryUpdate | Update.MessageUpdate>
) => {
  const botInfo: UserFromGetMe = {
    id: 12345,
    is_bot: true,
    first_name: "TestBot",
    username: "TestBot",
    can_join_groups: true,
    can_read_all_group_messages: true,
    supports_inline_queries: true,
  };
  const ctx = new Context(update as Update, {} as any, botInfo) as BasicContext;

  ctx.scene = {
    enter: jest.fn(),
    leave: jest.fn(),
    reenter: jest.fn(),
    session: {
      step: undefined,
      projectId: undefined,
    } as ScraperSceneSessionData,
    state: {},
    current: undefined,
    ctx: ctx,
  } as any;

  ctx.reply = jest.fn();
  ctx.answerCbQuery = jest.fn().mockResolvedValue(true);
  (ctx as ActionContextWithMatch).match = null;

  const adapterInstance = new NeonAdapter();
  ctx.storage = adapterInstance;
  mockNeonAdapterInstance = adapterInstance as NeonAdapter & {
    [K in keyof NeonAdapter]: jest.Mock;
  };

  return ctx;
};

// --- Тесты для on text handler ---
describe("competitorScene - On Text Handler (ADD_COMPETITOR step)", () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let ctx: BasicContext; // Используем базовый тип

  beforeEach(() => {
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
    jest.clearAllMocks();
    mockNeonAdapterInstance = new NeonAdapter() as NeonAdapter & {
      [K in keyof NeonAdapter]: jest.Mock;
    };
    // ctx создается в it()
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should reply with error if URL is invalid", async () => {
    const update = {
      update_id: 8,
      message: {
        message_id: 1,
        date: Date.now(),
        chat: { id: 1, type: "private" },
        text: "невалидный урл",
        from: { id: 1, is_bot: false, first_name: "Test" },
      },
    };
    ctx = createMockContext(update);
    ctx.scene.session.step = ScraperSceneStep.ADD_COMPETITOR;
    ctx.scene.session.projectId = 41;

    // Для on text используем middleware
    await competitorScene.middleware()(ctx, async () => {});

    expect(ctx.reply).toHaveBeenCalledWith(
      "Пожалуйста, введите корректный URL Instagram-аккаунта (например, https://www.instagram.com/example):"
    );
    expect(mockNeonAdapterInstance.initialize).not.toHaveBeenCalled();
    expect(ctx.scene.reenter).not.toHaveBeenCalled();
  });

  it("should successfully add a competitor", async () => {
    const projectId = 42;
    const instagramUrl = "https://www.instagram.com/newcompetitor";
    const username = "newcompetitor";
    const update: Update.MessageUpdate = {
      update_id: 9,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: 1,
          type: "private",
          first_name: "Test",
          username: "testuser",
        },
        from: {
          id: 1,
          first_name: "Test",
          is_bot: false,
          username: "testuser",
          language_code: "en",
        },
        text: instagramUrl,
      },
    };
    ctx = createMockContext(update);
    ctx.scene.session.step = ScraperSceneStep.ADD_COMPETITOR;
    ctx.scene.session.projectId = projectId;

    const competitorMock: Competitor = {
      id: 300,
      project_id: projectId,
      username: username,
      instagram_url: instagramUrl,
      created_at: new Date().toISOString(),
      is_active: true,
    };
    const userMock: User = {
      id: 1,
      telegram_id: 1,
      username: "testuser",
      created_at: new Date().toISOString(),
      is_active: true,
    };
    mockNeonAdapterInstance.getUserByTelegramId.mockResolvedValue(userMock);
    mockNeonAdapterInstance.addCompetitorAccount.mockResolvedValue(
      competitorMock
    );

    // Для on text используем middleware
    await competitorScene.middleware()(ctx, async () => {});

    expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
    expect(mockNeonAdapterInstance.getUserByTelegramId).toHaveBeenCalledWith(1);
    expect(mockNeonAdapterInstance.addCompetitorAccount).toHaveBeenCalledWith(
      projectId,
      username,
      instagramUrl
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining(`Конкурент @${username} успешно добавлен!`),
      expect.anything()
    );
    expect(ctx.scene.session.step).toBeUndefined();
    expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should handle null response from adapter.addCompetitorAccount", async () => {
    const projectId = 44;
    const instagramUrl = "https://www.instagram.com/failadd";
    const update: Update.MessageUpdate = {
      update_id: 11,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: 1,
          type: "private",
          first_name: "FailAddUser",
          username: "failadduser",
        },
        from: {
          id: 1,
          first_name: "Test",
          is_bot: false,
          username: "testuser",
          language_code: "en",
        },
        text: instagramUrl,
      },
    };
    ctx = createMockContext(update);
    ctx.scene.session.step = ScraperSceneStep.ADD_COMPETITOR;
    ctx.scene.session.projectId = projectId;

    const userMockNull: User = {
      id: 1,
      telegram_id: 1,
      username: "failadduser",
      created_at: new Date().toISOString(),
      is_active: true,
    };
    mockNeonAdapterInstance.getUserByTelegramId.mockResolvedValue(userMockNull);
    mockNeonAdapterInstance.addCompetitorAccount.mockResolvedValue(null);

    // Для on text используем middleware
    await competitorScene.middleware()(ctx, async () => {});

    expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
    expect(mockNeonAdapterInstance.addCompetitorAccount).toHaveBeenCalledWith(
      projectId,
      "failadd",
      instagramUrl
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Ошибка при добавлении конкурента")
    );
    expect(ctx.scene.session.step).toBeUndefined();
    expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should handle error when getUserByTelegramId throws in on text handler", async () => {
    const update: Update.MessageUpdate = {
      update_id: 30,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 123, type: "private", first_name: "TestUserError" },
        from: { id: 456, is_bot: false, first_name: "UserError" },
        text: "https://www.instagram.com/somevalidurl",
      },
    };
    ctx = createMockContext(update);
    ctx.scene.session.step = ScraperSceneStep.ADD_COMPETITOR;
    ctx.scene.session.projectId = 50;

    const userError = new Error("GetUser failed");
    mockNeonAdapterInstance.getUserByTelegramId.mockRejectedValue(userError);

    // Для on text используем middleware
    await competitorScene.middleware()(ctx, async () => {});

    expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
    expect(mockNeonAdapterInstance.getUserByTelegramId).toHaveBeenCalledWith(
      456
    );
    expect(mockNeonAdapterInstance.addCompetitorAccount).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Ошибка при добавлении конкурента в сцене:",
      userError
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      "Произошла внутренняя ошибка при добавлении конкурента. Попробуйте позже."
    );
    expect(ctx.scene.session.step).toBeUndefined();
    expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
    expect(ctx.scene.leave).not.toHaveBeenCalled();
  });

  it("should handle error when addCompetitorAccount throws in on text handler", async () => {
    const update: Update.MessageUpdate = {
      update_id: 31,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 124, type: "private", first_name: "TestUserDBError" },
        from: { id: 457, is_bot: false, first_name: "UserDBError" },
        text: "https://www.instagram.com/dbfail",
      },
    };
    ctx = createMockContext(update);
    ctx.scene.session.step = ScraperSceneStep.ADD_COMPETITOR;
    ctx.scene.session.projectId = 51;

    const userMock: User = {
      id: 2,
      telegram_id: 457,
      username: "UserDBError",
      created_at: new Date().toISOString(),
      is_active: true,
    };
    mockNeonAdapterInstance.getUserByTelegramId.mockResolvedValue(userMock);
    const dbError = new Error("DB insert failed");
    mockNeonAdapterInstance.addCompetitorAccount.mockRejectedValue(dbError);

    // Для on text используем middleware
    await competitorScene.middleware()(ctx, async () => {});

    expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
    expect(mockNeonAdapterInstance.getUserByTelegramId).toHaveBeenCalledWith(
      457
    );
    expect(mockNeonAdapterInstance.addCompetitorAccount).toHaveBeenCalledWith(
      51,
      "dbfail",
      "https://www.instagram.com/dbfail"
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Ошибка при добавлении конкурента в сцене:",
      dbError
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      "Произошла внутренняя ошибка при добавлении конкурента. Попробуйте позже."
    );
    expect(ctx.scene.session.step).toBeUndefined();
    expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
    expect(ctx.scene.leave).not.toHaveBeenCalled();
  });
});
