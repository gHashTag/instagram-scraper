import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach, // Добавляем afterEach на всякий случай, если понадобится
  jest,
  mock,
  spyOn,
} from "bun:test";
import { Context, Markup } from "telegraf";
import { Update, UserFromGetMe } from "telegraf/types";
import { competitorScene } from "../../../scenes/competitor-scene";
import { NeonAdapter } from "../../../adapters/neon-adapter";
import {
  ScraperBotContext,
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
  const ctx = new Context(
    update as Update,
    {} as any,
    botInfo
  ) as ScraperBotContext & { scene: { session: ScraperSceneSessionData } };

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

  const adapterInstance = new NeonAdapter();
  ctx.storage = adapterInstance;
  mockNeonAdapterInstance = adapterInstance as NeonAdapter & {
    [K in keyof NeonAdapter]: jest.Mock;
  };

  return ctx;
};

describe("competitorScene - Enter Handler", () => {
  let ctx: ScraperBotContext & { scene: { session: ScraperSceneSessionData } };
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>; // Объявляем здесь для использования в afterEach

  beforeEach(() => {
    ctx = createMockContext({}); // Создаем базовый контекст, специфичный для теста будет создан в it()
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {}); // Мокируем console.error
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore(); // Восстанавливаем после каждого теста
  });

  it("should reply and leave if user is not registered", async () => {
    const update = {
      update_id: 16,
      from: { id: 1 },
      message: undefined,
      callback_query: {
        id: "cb1_enter_no_user",
        from: {
          id: 1,
          first_name: "Test",
          is_bot: false,
          username: "testuser",
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 1, type: "private" },
        },
        chat_instance: "1",
        data: "some_enter_data",
      },
    };
    ctx = createMockContext(update);
    mockNeonAdapterInstance.getUserByTelegramId.mockResolvedValue(null);

    await competitorScene.enterMiddleware()(ctx, async () => {});

    expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
    expect(mockNeonAdapterInstance.getUserByTelegramId).toHaveBeenCalledWith(1);
    expect(ctx.reply).toHaveBeenCalledWith(
      "Вы не зарегистрированы. Пожалуйста, используйте /start для начала работы."
    );
    expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
  });

  it("should reply and leave if user has no projects", async () => {
    const update = {
      update_id: 17,
      from: { id: 1 },
      message: undefined,
      callback_query: {
        id: "cb1_enter_no_projects",
        from: {
          id: 1,
          first_name: "Test",
          is_bot: false,
          username: "testuser",
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 1, type: "private" },
        },
        chat_instance: "1",
        data: "some_enter_data",
      },
    };
    ctx = createMockContext(update);
    const userMock: User = {
      id: 1,
      telegram_id: 1,
      username: "testuser",
      created_at: new Date().toISOString(),
      is_active: true,
    };

    mockNeonAdapterInstance.getUserByTelegramId.mockResolvedValue(userMock);
    mockNeonAdapterInstance.getProjectsByUserId.mockResolvedValue(null); // или []

    await competitorScene.enterMiddleware()(ctx, async () => {});

    expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
    expect(mockNeonAdapterInstance.getUserByTelegramId).toHaveBeenCalledWith(1);
    expect(mockNeonAdapterInstance.getProjectsByUserId).toHaveBeenCalledWith(
      userMock.id
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      "У вас нет проектов. Создайте проект с помощью команды /projects"
    );
    expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
  });

  it("should offer to add competitor if user has one project with no competitors", async () => {
    const update = {
      update_id: 18,
      from: { id: 1 },
      message: undefined,
      callback_query: {
        id: "cb1_enter_one_project_no_comp",
        from: {
          id: 1,
          first_name: "Test",
          is_bot: false,
          username: "testuser",
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 1, type: "private" },
        },
        chat_instance: "1",
        data: "some_enter_data",
      },
    };
    ctx = createMockContext(update);
    const userMock: User = {
      id: 1,
      telegram_id: 1,
      username: "testuser",
      created_at: new Date().toISOString(),
      is_active: true,
    };
    const projectMock: Project = {
      id: 10,
      user_id: 1,
      name: "Test Project",
      created_at: new Date().toISOString(),
      is_active: true,
    };

    mockNeonAdapterInstance.getUserByTelegramId.mockResolvedValue(userMock);
    mockNeonAdapterInstance.getProjectsByUserId.mockResolvedValue([
      projectMock,
    ]);
    mockNeonAdapterInstance.getCompetitorAccounts.mockResolvedValue([]); // Нет конкурентов

    await competitorScene.enterMiddleware()(ctx, async () => {});

    expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
    expect(mockNeonAdapterInstance.getUserByTelegramId).toHaveBeenCalledWith(1);
    expect(mockNeonAdapterInstance.getProjectsByUserId).toHaveBeenCalledWith(
      userMock.id
    );
    expect(mockNeonAdapterInstance.getCompetitorAccounts).toHaveBeenCalledWith(
      projectMock.id
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      `В проекте \"${projectMock.name}\" нет добавленных конкурентов. Хотите добавить?`,
      {
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "Добавить конкурента",
              `add_competitor_${projectMock.id}`
            ),
          ],
          [Markup.button.callback("Выйти", "exit_scene")],
        ]).reply_markup,
      }
    );
    expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
    expect(ctx.scene.leave).not.toHaveBeenCalled(); // Не должен выходить из сцены
  });

  it("should show competitors list with delete buttons if user has one project with competitors", async () => {
    const update = {
      update_id: 19,
      from: { id: 1 },
      message: undefined,
      callback_query: {
        id: "cb1_enter_one_project_with_comp",
        from: {
          id: 1,
          first_name: "Test",
          is_bot: false,
          username: "testuser",
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 1, type: "private" },
        },
        chat_instance: "1",
        data: "some_enter_data",
      },
    };
    ctx = createMockContext(update);
    const userMock: User = {
      id: 1,
      telegram_id: 1,
      username: "testuser",
      created_at: new Date().toISOString(),
      is_active: true,
    };
    const projectMock: Project = {
      id: 1,
      user_id: 1,
      name: "Test Project",
      created_at: new Date().toISOString(),
      is_active: true,
    };
    const competitorMock: Competitor = {
      id: 101,
      project_id: 1,
      username: "test_competitor",
      instagram_url: "http://insta/test_competitor",
      created_at: new Date().toISOString(),
      is_active: true,
    };

    mockNeonAdapterInstance.getUserByTelegramId.mockResolvedValue(userMock);
    mockNeonAdapterInstance.getProjectsByUserId.mockResolvedValue([
      projectMock,
    ]);
    mockNeonAdapterInstance.getCompetitorAccounts.mockResolvedValue([
      competitorMock,
    ]);

    await competitorScene.enterMiddleware()(ctx, async () => {});

    expect(mockNeonAdapterInstance.getCompetitorAccounts).toHaveBeenCalledWith(
      1
    );
    // Исправляем проверку ctx.reply
    const replyCalls = (ctx.reply as jest.Mock).mock.calls;
    expect(replyCalls.length).toBe(1);
    expect(replyCalls[0][0]).toContain('Конкуренты в проекте \"Test Project\"');
    expect(replyCalls[0][1]).toEqual(
      expect.objectContaining({
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🗑️ Удалить test_competitor",
                callback_data: "delete_competitor_1_test_competitor",
              },
            ],
            [
              {
                text: "Добавить конкурента",
                callback_data: "add_competitor_1",
              },
            ],
            [{ text: "Выйти", callback_data: "exit_scene" }],
          ],
        },
      })
    );
    expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
    expect(ctx.scene.leave).not.toHaveBeenCalled();
  });

  it("should ask to select a project if user has multiple projects", async () => {
    const update = {
      update_id: 20,
      from: { id: 1 },
      message: undefined,
      callback_query: {
        id: "cb1_enter_multi_projects",
        from: {
          id: 1,
          first_name: "Test",
          is_bot: false,
          username: "testuser",
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 1, type: "private" },
        },
        chat_instance: "1",
        data: "some_enter_data",
      },
    };
    ctx = createMockContext(update);
    const userMock: User = {
      id: 1,
      telegram_id: 1,
      username: "testuser",
      created_at: new Date().toISOString(),
      is_active: true,
    };
    const projectMocks: Project[] = [
      {
        id: 10,
        user_id: 1,
        name: "Project Alpha",
        created_at: new Date().toISOString(),
        is_active: true,
      },
      {
        id: 11,
        user_id: 1,
        name: "Project Beta",
        created_at: new Date().toISOString(),
        is_active: true,
      },
    ];

    mockNeonAdapterInstance.getUserByTelegramId.mockResolvedValue(userMock);
    mockNeonAdapterInstance.getProjectsByUserId.mockResolvedValue(projectMocks);

    await competitorScene.enterMiddleware()(ctx, async () => {});

    expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
    expect(mockNeonAdapterInstance.getProjectsByUserId).toHaveBeenCalledWith(
      userMock.id
    );
    expect(
      mockNeonAdapterInstance.getCompetitorAccounts
    ).not.toHaveBeenCalled(); // Не должен вызываться

    const expectedProjectButtons = projectMocks.map((project) => [
      Markup.button.callback(project.name, `competitors_project_${project.id}`),
    ]);
    expectedProjectButtons.push([
      Markup.button.callback("Выйти", "exit_scene"),
    ]);

    expect(ctx.reply).toHaveBeenCalledWith(
      "Выберите проект для просмотра конкурентов:",
      {
        reply_markup: Markup.inlineKeyboard(expectedProjectButtons)
          .reply_markup,
      }
    );
    expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
    expect(ctx.scene.leave).not.toHaveBeenCalled();
  });

  it("should handle error during adapter.initialize", async () => {
    const update = {
      update_id: 21,
      from: { id: 1 },
      message: undefined,
      callback_query: {
        id: "cb1_enter_init_error",
        from: {
          id: 1,
          first_name: "Test",
          is_bot: false,
          username: "testuser",
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 1, type: "private" },
        },
        chat_instance: "1",
        data: "some_enter_data",
      },
    };
    ctx = createMockContext(update);
    // consoleErrorSpy мокируется в beforeEach

    const initError = new Error("Init failed");
    mockNeonAdapterInstance.initialize.mockRejectedValue(initError);

    await competitorScene.enterMiddleware()(ctx, async () => {});

    expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      // Используем переменную шпиона
      "Ошибка при получении конкурентов:",
      initError
    );
    // Исправляем проверку ctx.reply
    const replyCallsInit = (ctx.reply as jest.Mock).mock.calls;
    expect(replyCallsInit.length).toBe(1);
    expect(replyCallsInit[0][0]).toContain(
      "Не удалось загрузить данные для управления конкурентами"
    );

    expect(mockNeonAdapterInstance.close).not.toHaveBeenCalled(); // Не должен вызываться, если initialize упал
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
  });

  it("should handle error during adapter.getProjectsByUserId", async () => {
    const update = {
      update_id: 1,
      from: { id: 1 },
      message: undefined,
      callback_query: {
        id: "cb1_enter_projects_error",
        from: {
          id: 1,
          first_name: "Test",
          is_bot: false,
          username: "testuser",
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 1, type: "private" },
        },
        chat_instance: "1",
        data: "some_enter_data",
      },
    };
    ctx = createMockContext(update);
    // consoleErrorSpy мокируется в beforeEach
    const userMock: User = {
      id: 1,
      telegram_id: 1,
      username: "testuser",
      created_at: new Date().toISOString(),
      is_active: true,
    };
    const projectsError = new Error("GetProjects failed");

    mockNeonAdapterInstance.initialize.mockResolvedValue(undefined);
    mockNeonAdapterInstance.getUserByTelegramId.mockResolvedValue(userMock);
    mockNeonAdapterInstance.getProjectsByUserId.mockRejectedValue(
      projectsError
    );

    await competitorScene.enterMiddleware()(ctx, async () => {});

    expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
    expect(mockNeonAdapterInstance.getUserByTelegramId).toHaveBeenCalledWith(1);
    expect(mockNeonAdapterInstance.getProjectsByUserId).toHaveBeenCalledWith(
      userMock.id
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      // Используем переменную шпиона
      "Ошибка при получении конкурентов:",
      projectsError
    );
    // Исправляем проверку ctx.reply
    const replyCallsProj = (ctx.reply as jest.Mock).mock.calls;
    expect(replyCallsProj.length).toBe(1);
    expect(replyCallsProj[0][0]).toContain(
      "Не удалось загрузить данные для управления конкурентами"
    );

    expect(mockNeonAdapterInstance.close).not.toHaveBeenCalled(); // Не должен вызываться, если getProjectsByUserId упал
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
  });
});

// Другие describe блоки для actions и on text будут в других файлах
