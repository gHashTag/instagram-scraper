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
import { Context, Markup } from "telegraf";
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
  match: RegExpExecArray | null; // Добавляем match сюда
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
  // Используем новый тип ActionContextWithMatch
  const ctx = new Context(
    update as Update,
    {} as any,
    botInfo
  ) as ActionContextWithMatch;

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

  ctx.match = null; // Инициализируем как null

  const adapterInstance = new NeonAdapter();
  ctx.storage = adapterInstance;
  mockNeonAdapterInstance = adapterInstance as NeonAdapter & {
    [K in keyof NeonAdapter]: jest.Mock;
  };

  return ctx;
};

describe("Competitor Scene Actions", () => {
  // Используем ActionContextWithMatch
  let ctx: ActionContextWithMatch;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    ctx = createMockContext({});
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
    jest.clearAllMocks();
    mockNeonAdapterInstance = new NeonAdapter() as NeonAdapter & {
      [K in keyof NeonAdapter]: jest.Mock;
    };
    if (ctx) {
      ctx.storage = mockNeonAdapterInstance;
    }
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // --- Тесты для action: 'competitors_project_...' ---
  describe("action: 'competitors_project_...'", () => {
    it("should show competitors list when a project is selected", async () => {
      const projectId = 21;
      const update = {
        update_id: 3,
        callback_query: {
          id: "cb3_action_list",
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
          data: `competitors_project_${projectId}`,
        },
      };
      ctx = createMockContext(update);
      ctx.match = [
        `competitors_project_${projectId}`,
        projectId.toString(),
      ] as any;

      const competitorMock: Competitor = {
        id: 101,
        project_id: projectId,
        username: "comp1",
        instagram_url: "url1",
        created_at: "",
        is_active: true,
      };
      mockNeonAdapterInstance.getCompetitorAccounts.mockResolvedValue([
        competitorMock,
      ]);

      await competitorScene.middleware()(ctx, async () => {});

      expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
      expect(
        mockNeonAdapterInstance.getCompetitorAccounts
      ).toHaveBeenCalledWith(projectId);

      const expectedCompetitorList = [
        `${competitorMock.username} - ${competitorMock.instagram_url}`,
      ].join("\\n");

      expect(ctx.reply).toHaveBeenCalledWith(
        `Конкуренты в выбранном проекте:\\n\\n${expectedCompetitorList}`,
        expect.objectContaining({
          parse_mode: "Markdown",
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: "🗑️ Удалить",
                  callback_data: `delete_competitor_${projectId}_${competitorMock.username}`,
                }),
              ]),
              expect.arrayContaining([
                expect.objectContaining({
                  text: "Добавить конкурента",
                  callback_data: `add_competitor_${projectId}`,
                }),
              ]),
              expect.arrayContaining([
                expect.objectContaining({
                  text: "Назад к проектам",
                  callback_data: "back_to_projects",
                }),
              ]),
              expect.arrayContaining([
                expect.objectContaining({
                  text: "Выйти",
                  callback_data: "exit_scene",
                }),
              ]),
            ]),
          }),
        })
      );

      expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    });

    it("should show 'no competitors' message if project has none", async () => {
      const projectId = 20;
      const update = {
        update_id: 2,
        callback_query: {
          id: "cb2_action_no_comp",
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
          data: `competitors_project_${projectId}`,
        },
      };
      ctx = createMockContext(update);
      ctx.match = [
        `competitors_project_${projectId}`,
        projectId.toString(),
      ] as any;

      mockNeonAdapterInstance.getCompetitorAccounts.mockResolvedValue([]);

      await competitorScene.middleware()(ctx, async () => {});

      expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
      expect(
        mockNeonAdapterInstance.getCompetitorAccounts
      ).toHaveBeenCalledWith(projectId);
      expect(ctx.reply).toHaveBeenCalledWith(
        "В выбранном проекте нет добавленных конкурентов. Хотите добавить?",
        {
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "Добавить конкурента",
                `add_competitor_${projectId}`
              ),
            ],
            [Markup.button.callback("Назад к проектам", "back_to_projects")],
            [Markup.button.callback("Выйти", "exit_scene")],
          ]).reply_markup,
        }
      );
      expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    });

    it("should handle error when getCompetitorAccounts throws", async () => {
      const projectId = 22;
      const update = {
        update_id: 4,
        callback_query: {
          id: "cb4_action_comp_error",
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
          data: `competitors_project_${projectId}`,
        },
      };
      ctx = createMockContext(update);
      ctx.match = [
        `competitors_project_${projectId}`,
        projectId.toString(),
      ] as any;

      const error = new Error("DB error on getCompetitors");
      mockNeonAdapterInstance.initialize.mockResolvedValue(undefined);
      mockNeonAdapterInstance.getCompetitorAccounts.mockRejectedValue(error);

      await competitorScene.middleware()(ctx, async () => {});

      expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
      expect(
        mockNeonAdapterInstance.getCompetitorAccounts
      ).toHaveBeenCalledWith(projectId);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Ошибка при получении конкурентов для проекта 22:",
        error
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        "Произошла ошибка при получении конкурентов. Пожалуйста, попробуйте позже."
      );
      expect(mockNeonAdapterInstance.close).not.toHaveBeenCalled();
      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    });

    it("should handle invalid project ID in callback data", async () => {
      const update = {
        update_id: 3,
        callback_query: {
          id: "cb3_action_list",
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
          data: "competitors_project_invalid",
        },
      };
      ctx = createMockContext(update);
      ctx.match = ["competitors_project_invalid", "invalid"] as any;

      await competitorScene.middleware()(ctx, async () => {});

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Invalid project ID in competitors_project_ action: invalid"
      );
      expect(mockNeonAdapterInstance.initialize).not.toHaveBeenCalled();
    });
  });

  // --- Тесты для action: 'add_competitor_...' ---
  describe("action: 'add_competitor_...'", () => {
    it("should set step to ADD_COMPETITOR and ask for URL", async () => {
      const projectId = 30;
      const update = {
        update_id: 5,
        callback_query: {
          id: "cb5_action_add_comp",
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
          data: `add_competitor_${projectId}`,
        },
      };
      ctx = createMockContext(update);
      ctx.match = [`add_competitor_${projectId}`, projectId.toString()] as any;

      await competitorScene.middleware()(ctx, async () => {});

      expect(ctx.scene.session.step).toBe(ScraperSceneStep.ADD_COMPETITOR);
      expect(ctx.scene.session.projectId).toBe(projectId);
      expect(ctx.reply).toHaveBeenCalledWith(
        "Введите Instagram URL конкурента (например, https://www.instagram.com/example):"
      );
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    it("should handle invalid project ID in callback data", async () => {
      const update = {
        update_id: 5,
        callback_query: {
          id: "cb5_action_add_comp",
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
          data: "add_competitor_invalid",
        },
      };
      ctx = createMockContext(update);
      ctx.match = ["add_competitor_invalid", "invalid"] as any;

      await competitorScene.middleware()(ctx, async () => {});

      expect(ctx.scene.session.step).toBeUndefined();
      expect(ctx.scene.session.projectId).toBeUndefined();
      expect(ctx.reply).toHaveBeenCalledWith(
        "Произошла ошибка. Неверный ID проекта."
      );
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка ID проекта");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Invalid project ID in add_competitor_ action: invalid"
      );
    });
  });

  // --- Тесты для action: 'exit_scene' ---
  describe("action: 'exit_scene'", () => {
    it("should leave the scene and answer callback query", async () => {
      const update: Update.CallbackQueryUpdate = {
        update_id: 6,
        callback_query: {
          id: "cb6_action_exit",
          from: {
            id: 1,
            first_name: "Test",
            is_bot: false,
            username: "testuser",
            language_code: "en",
          },
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
              id: 12345,
              first_name: "TestBot",
              is_bot: true,
              username: "TestBot",
            },
            text: "Сообщение",
          },
          chat_instance: "1",
          data: "exit_scene",
        },
      };
      ctx = createMockContext(update);

      await competitorScene.middleware()(ctx, async () => {});

      expect(ctx.answerCbQuery).toHaveBeenCalled();
      expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
      expect(ctx.reply).not.toHaveBeenCalled();
    });
  });

  // --- Тесты для action: 'back_to_projects' ---
  describe("action: 'back_to_projects'", () => {
    it("should reenter the scene and answer callback query", async () => {
      const update: Update.CallbackQueryUpdate = {
        update_id: 7,
        callback_query: {
          id: "cb7_action_back",
          from: {
            id: 1,
            first_name: "Test",
            is_bot: false,
            username: "testuser",
            language_code: "en",
          },
          message: {
            message_id: 2,
            date: Math.floor(Date.now() / 1000),
            chat: {
              id: 1,
              type: "private",
              first_name: "Test",
              username: "testuser",
            },
            from: {
              id: 12345,
              first_name: "TestBot",
              is_bot: true,
              username: "TestBot",
            },
            text: "Другое сообщение",
          },
          chat_instance: "1",
          data: "back_to_projects",
        },
      };
      ctx = createMockContext(update);

      await competitorScene.middleware()(ctx, async () => {});

      expect(ctx.answerCbQuery).toHaveBeenCalled();
      expect(ctx.scene.reenter).toHaveBeenCalledTimes(1);
      expect(ctx.reply).not.toHaveBeenCalled();
    });
  });
});
