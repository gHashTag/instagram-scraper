import { describe, it, expect, beforeEach, jest, mock, spyOn } from "bun:test";
import { Context, Markup } from "telegraf"; // Оставляем только используемые Context и Markup
import {
  Update,
  UserFromGetMe,
  CallbackQuery,
  Message,
  Chat,
  User as TelegrafUser,
} from "telegraf/types"; // Импортируем нужные типы более гранулярно
import { competitorScene } from "../../../scenes/competitor-scene";
import { NeonAdapter } from "../../../adapters/neon-adapter";
import {
  ScraperBotContext,
  ScraperSceneStep,
  Project,
  Competitor,
  User,
  ScraperSceneSessionData,
} from "@/types"; // Заменен CompetitorAccount на Competitor

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
    })),
  };
});

// mockNeonAdapterInstance будет хранить мокнутый экземпляр NeonAdapter
// Мы знаем, что его методы - это jest.Mock, и сам он ведет себя как мок.
// Используем пересечение типов для лучшей типизации.
let mockNeonAdapterInstance: NeonAdapter & {
  [K in keyof NeonAdapter]: jest.Mock;
};

const createMockContext = (
  update: Partial<Update.CallbackQueryUpdate | Update.MessageUpdate>
) => {
  const botInfo: UserFromGetMe = {
    // Дополнены поля для UserFromGetMe
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

  // Когда NeonAdapter мокнут через mock.module, new NeonAdapter() возвращает мокнутый экземпляр.
  const adapterInstance = new NeonAdapter();
  ctx.storage = adapterInstance;
  // Приводим к нашему более точному типу для mockNeonAdapterInstance
  mockNeonAdapterInstance = adapterInstance as NeonAdapter & {
    [K in keyof NeonAdapter]: jest.Mock;
  };

  return ctx;
};

describe("competitorScene", () => {
  let ctx: ScraperBotContext & { scene: { session: ScraperSceneSessionData } };

  beforeEach(() => {
    // Так как mockImplementation создает новый объект с новыми jest.fn() при каждом new NeonAdapter(),
    // нам нужно убедиться, что мы используем свежий экземпляр mockNeonAdapterInstance в каждом тесте.
    // Это достигается вызовом createMockContext() в каждом it-блоке, который пересоздаст mockNeonAdapterInstance.
  });

  describe("enter handler", () => {
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
      // mockNeonAdapterInstance устанавливается внутри createMockContext
      // Используем его напрямую, так как он уже правильно типизирован

      mockNeonAdapterInstance.getUserByTelegramId.mockResolvedValue(null);

      await competitorScene.enterMiddleware()(ctx, async () => {});

      expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
      expect(mockNeonAdapterInstance.getUserByTelegramId).toHaveBeenCalledWith(
        1
      );
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
      expect(mockNeonAdapterInstance.getUserByTelegramId).toHaveBeenCalledWith(
        1
      );
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
      expect(mockNeonAdapterInstance.getUserByTelegramId).toHaveBeenCalledWith(
        1
      );
      expect(mockNeonAdapterInstance.getProjectsByUserId).toHaveBeenCalledWith(
        userMock.id
      );
      expect(
        mockNeonAdapterInstance.getCompetitorAccounts
      ).toHaveBeenCalledWith(projectMock.id);
      expect(ctx.reply).toHaveBeenCalledWith(
        `В проекте "${projectMock.name}" нет добавленных конкурентов. Хотите добавить?`,
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

    it("should list competitors if user has one project with competitors", async () => {
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
        id: 10,
        user_id: 1,
        name: "Test Project",
        created_at: new Date().toISOString(),
        is_active: true,
      };
      const competitorMocks: Competitor[] = [
        {
          id: 100,
          project_id: 10,
          username: "comp1",
          instagram_url: "https://instagram.com/comp1",
          created_at: new Date().toISOString(),
          is_active: true,
        },
        {
          id: 101,
          project_id: 10,
          username: "comp2",
          instagram_url: "https://instagram.com/comp2",
          created_at: new Date().toISOString(),
          is_active: true,
        },
      ];

      mockNeonAdapterInstance.getUserByTelegramId.mockResolvedValue(userMock);
      mockNeonAdapterInstance.getProjectsByUserId.mockResolvedValue([
        projectMock,
      ]);
      mockNeonAdapterInstance.getCompetitorAccounts.mockResolvedValue(
        competitorMocks
      );

      await competitorScene.enterMiddleware()(ctx, async () => {});

      expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
      expect(
        mockNeonAdapterInstance.getCompetitorAccounts
      ).toHaveBeenCalledWith(projectMock.id);

      const expectedCompetitorList = competitorMocks
        .map((c, i) => `${i + 1}. [${c.username}](${c.instagram_url})`)
        .join("\n");

      expect(ctx.reply).toHaveBeenCalledWith(
        `Конкуренты в проекте "${projectMock.name}":\n\n${expectedCompetitorList}`,
        {
          parse_mode: "Markdown",
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
      mockNeonAdapterInstance.getProjectsByUserId.mockResolvedValue(
        projectMocks
      );

      await competitorScene.enterMiddleware()(ctx, async () => {});

      expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
      expect(mockNeonAdapterInstance.getProjectsByUserId).toHaveBeenCalledWith(
        userMock.id
      );
      expect(
        mockNeonAdapterInstance.getCompetitorAccounts
      ).not.toHaveBeenCalled(); // Не должен вызываться

      const expectedProjectButtons = projectMocks.map((project) => [
        Markup.button.callback(
          project.name,
          `competitors_project_${project.id}`
        ),
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
      const consoleErrorSpy = spyOn(console, "error").mockImplementation(
        () => {}
      ); // Используем импортированный spyOn

      const initError = new Error("Init failed");
      mockNeonAdapterInstance.initialize.mockRejectedValue(initError);

      await competitorScene.enterMiddleware()(ctx, async () => {});

      expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        "Ошибка при получении конкурентов:",
        initError
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        "Произошла ошибка при получении конкурентов. Пожалуйста, попробуйте позже."
      );
      expect(mockNeonAdapterInstance.close).not.toHaveBeenCalled(); // Не должен вызываться, если initialize упал
      expect(ctx.scene.leave).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore(); // Восстанавливаем оригинальный console.error
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
      const consoleErrorSpy = spyOn(console, "error").mockImplementation(
        () => {}
      );
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
      expect(mockNeonAdapterInstance.getUserByTelegramId).toHaveBeenCalledWith(
        1
      );
      expect(mockNeonAdapterInstance.getProjectsByUserId).toHaveBeenCalledWith(
        userMock.id
      );
      expect(console.error).toHaveBeenCalledWith(
        "Ошибка при получении конкурентов:",
        projectsError
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        "Произошла ошибка при получении конкурентов. Пожалуйста, попробуйте позже."
      );
      expect(mockNeonAdapterInstance.close).not.toHaveBeenCalled(); // Не должен вызываться, если getProjectsByUserId упал
      expect(ctx.scene.leave).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore();
    });

    // TODO: Добавить остальные тесты для enter handler и других частей сцены
  });

  describe("action handlers", () => {
    it("competitors_project_(\\d+): should offer to add competitor if selected project has no competitors", async () => {
      const projectId = 20;
      const update = {
        update_id: 2,
        from: { id: 1 },
        message: undefined,
        callback_query: {
          id: "cb2_enter_no_comp",
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
      ((ctx as any).match as RegExpExecArray) = [
        `competitors_project_${projectId}`,
        projectId.toString(),
      ] as any; // Мокируем ctx.match, приводим ctx к any

      mockNeonAdapterInstance.getCompetitorAccounts.mockResolvedValue([]); // Нет конкурентов

      // Для вызова action handler, используем middleware(), а не enterMiddleware()
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

    it("competitors_project_(\\d+): should list competitors if selected project has competitors", async () => {
      const projectId = 21;
      const update = {
        update_id: 3,
        from: { id: 1 },
        message: undefined,
        callback_query: {
          id: "cb3_enter_one_project_with_comp",
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
      ((ctx as any).match as RegExpExecArray) = [
        `competitors_project_${projectId}`,
        projectId.toString(),
      ] as any;

      const competitorMocks: Competitor[] = [
        {
          id: 200,
          project_id: projectId,
          username: "compA",
          instagram_url: "https://instagram.com/compA",
          created_at: new Date().toISOString(),
          is_active: true,
        },
        {
          id: 201,
          project_id: projectId,
          username: "compB",
          instagram_url: "https://instagram.com/compB",
          created_at: new Date().toISOString(),
          is_active: true,
        },
      ];
      mockNeonAdapterInstance.getCompetitorAccounts.mockResolvedValue(
        competitorMocks
      );

      await competitorScene.middleware()(ctx, async () => {});

      expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
      expect(
        mockNeonAdapterInstance.getCompetitorAccounts
      ).toHaveBeenCalledWith(projectId);

      const expectedCompetitorList = competitorMocks
        .map((c, i) => `${i + 1}. [${c.username}](${c.instagram_url})`)
        .join("\n");

      expect(ctx.reply).toHaveBeenCalledWith(
        `Конкуренты в выбранном проекте:\n\n${expectedCompetitorList}`,
        {
          parse_mode: "Markdown",
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

    it("competitors_project_(\\d+): should handle error during adapter.getCompetitorAccounts", async () => {
      const projectId = 22;
      const update = {
        update_id: 4,
        from: { id: 1 },
        message: undefined,
        callback_query: {
          id: "cb4_enter_comp_error",
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
      ((ctx as any).match as RegExpExecArray) = [
        `competitors_project_${projectId}`,
        projectId.toString(),
      ] as any;
      const consoleErrorSpy = spyOn(console, "error").mockImplementation(
        () => {}
      );
      const competitorsError = new Error("GetCompetitors failed");

      mockNeonAdapterInstance.initialize.mockResolvedValue(undefined);
      mockNeonAdapterInstance.getCompetitorAccounts.mockRejectedValue(
        competitorsError
      );

      await competitorScene.middleware()(ctx, async () => {});

      expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
      expect(
        mockNeonAdapterInstance.getCompetitorAccounts
      ).toHaveBeenCalledWith(projectId);
      expect(console.error).toHaveBeenCalledWith(
        `Ошибка при получении конкурентов проекта ${projectId}:`,
        competitorsError
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        "Произошла ошибка при получении конкурентов. Пожалуйста, попробуйте позже."
      );
      expect(mockNeonAdapterInstance.close).not.toHaveBeenCalled();
      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore();
    });

    it("add_competitor_(\\d+): should set session step and prompt for URL", async () => {
      const projectId = 30;
      const update = {
        update_id: 5,
        from: { id: 1 },
        message: undefined,
        callback_query: {
          id: "cb5_enter_add_comp",
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
      ((ctx as any).match as RegExpExecArray) = [
        `add_competitor_${projectId}`,
        projectId.toString(),
      ] as any;

      await competitorScene.middleware()(ctx, async () => {});

      expect(ctx.scene.session.projectId).toBe(projectId);
      expect(ctx.reply).toHaveBeenCalledWith(
        "Введите Instagram URL конкурента (например, https://www.instagram.com/example):"
      );
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.ADD_COMPETITOR);
      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
      // Проверяем, что адаптер не вызывался
      expect(mockNeonAdapterInstance.initialize).not.toHaveBeenCalled();
      expect(mockNeonAdapterInstance.close).not.toHaveBeenCalled();
    });

    it("exit_scene: should reply, leave scene, and answer callback query", async () => {
      const update: Update.CallbackQueryUpdate = {
        update_id: 6,
        callback_query: {
          id: "cb6_enter_exit_scene",
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
            text: "Сообщение с кнопками",
          },
          chat_instance: "1",
          data: "exit_scene",
        },
      };
      ctx = createMockContext(update);

      await competitorScene.middleware()(ctx, async () => {});

      expect(ctx.reply).toHaveBeenCalledWith(
        "Вы вышли из режима управления конкурентами.",
        { reply_markup: { remove_keyboard: true } }
      );
      expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    });

    it("back_to_projects: should reenter scene and answer callback query", async () => {
      const update: Update.CallbackQueryUpdate = {
        update_id: 7,
        callback_query: {
          id: "cb7_enter_back_to_projects",
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
            text: "Другое сообщение с кнопками",
          },
          chat_instance: "1",
          data: "back_to_projects",
        },
      };
      ctx = createMockContext(update);

      await competitorScene.middleware()(ctx, async () => {});

      expect(ctx.scene.reenter).toHaveBeenCalledTimes(1);
      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    });

    it("should reply with error if URL is invalid", async () => {
      const update = {
        update_id: 8,
        from: { id: 1 },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 1, type: "private" },
          text: "невалидный урл",
        },
        callback_query: undefined,
      };
      ctx = createMockContext(update);
      ctx.scene.session.step = ScraperSceneStep.ADD_COMPETITOR;
      ctx.scene.session.projectId = 41;

      await competitorScene.middleware()(ctx, async () => {});

      expect(ctx.reply).toHaveBeenCalledWith(
        "Пожалуйста, введите корректный URL Instagram-аккаунта (например, https://www.instagram.com/example):"
      );
      expect(mockNeonAdapterInstance.initialize).not.toHaveBeenCalled();
      expect(ctx.scene.reenter).not.toHaveBeenCalled(); // Не должен быть reenter, просто ответ
    });

    it("should successfully add a competitor", async () => {
      const projectId = 42;
      const instagramUrl = "https://www.instagram.com/newcompetitor/";
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

      // Шпионим за console.error
      const consoleErrorSpy = spyOn(console, "error").mockImplementation(
        () => {}
      );

      // Логгеры для вызовов методов адаптера
      const initializeCalledLog = jest.fn();
      const addCompetitorCalledLog = jest.fn();

      const competitorMock: Competitor = {
        id: 300,
        project_id: projectId,
        username: username,
        instagram_url: instagramUrl,
        created_at: new Date().toISOString(),
        is_active: true,
      };
      // mockNeonAdapterInstance.initialize.mockResolvedValue(undefined); // Убираем старый мок
      // mockNeonAdapterInstance.addCompetitorAccount.mockResolvedValue(competitorMock); // Убираем старый мок

      // Используем mockImplementation для полного контроля
      mockNeonAdapterInstance.initialize.mockImplementation(async () => {
        initializeCalledLog();
        return Promise.resolve(undefined);
      });

      mockNeonAdapterInstance.addCompetitorAccount.mockImplementation(
        async (pId, uName, iUrl) => {
          addCompetitorCalledLog(pId, uName, iUrl);
          return Promise.resolve(competitorMock);
        }
      );

      // Проверяем, что методы существуют на моке ПЕРЕД вызовом middleware
      expect(typeof mockNeonAdapterInstance.initialize).toBe("function");
      expect(typeof mockNeonAdapterInstance.addCompetitorAccount).toBe(
        "function"
      );

      await competitorScene.middleware()(ctx, async () => {});

      // Проверяем, что console.error НЕ был вызван
      expect(console.error).not.toHaveBeenCalled();

      // Проверяем наши логгеры
      expect(initializeCalledLog).toHaveBeenCalledTimes(1);
      expect(addCompetitorCalledLog).toHaveBeenCalledTimes(1);
      expect(addCompetitorCalledLog).toHaveBeenCalledWith(
        projectId,
        username,
        instagramUrl
      );

      // Проверяем остальные ожидания, которые зависят от успешного вызова addCompetitorAccount
      expect(ctx.reply).toHaveBeenCalledWith(
        `Конкурент @${username} успешно добавлен!`,
        {
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "Посмотреть всех конкурентов",
                `competitors_project_${projectId}`
              ),
            ],
            [
              Markup.button.callback(
                "Добавить еще конкурента",
                `add_competitor_${projectId}`
              ),
            ],
            [Markup.button.callback("Выйти", "exit_scene")],
          ]).reply_markup,
        }
      );
      expect(ctx.scene.session.step).toBeUndefined();
      expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);

      // Восстанавливаем console.error
      consoleErrorSpy.mockRestore();
    });

    it("should reply with error if username cannot be extracted from URL", async () => {
      const projectId = 43;
      const invalidInstagramUrl = "https://www.instagram.com/";
      const update: Update.MessageUpdate = {
        update_id: 10,
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          chat: {
            id: 1,
            type: "private",
            first_name: "UserFromUrlTestFinal",
            username: "userfromurltestfinal",
          },
          from: {
            id: 1,
            first_name: "Test",
            is_bot: false,
            username: "testuser",
            language_code: "en",
          },
          text: invalidInstagramUrl,
        },
      };
      ctx = createMockContext(update as Update.MessageUpdate);
      ctx.scene.session.step = ScraperSceneStep.ADD_COMPETITOR;
      ctx.scene.session.projectId = projectId;

      await competitorScene.middleware()(ctx, async () => {});

      expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
      expect(ctx.reply).toHaveBeenCalledWith(
        "Не удалось извлечь имя пользователя из URL. Пожалуйста, проверьте URL и попробуйте снова."
      );
      expect(
        mockNeonAdapterInstance.addCompetitorAccount
      ).not.toHaveBeenCalled();
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.ADD_COMPETITOR); // Шаг не должен сбрасываться
      expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
    });

    it("should handle null response from adapter.addCompetitorAccount", async () => {
      const projectId = 44;
      const instagramUrl = "https://www.instagram.com/failadd/";
      const username = "failadd";
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

      // Логгеры для вызовов методов адаптера
      const initializeCalledLog = jest.fn();
      const addCompetitorCalledLog = jest.fn();

      mockNeonAdapterInstance.initialize.mockImplementation(async () => {
        initializeCalledLog();
        return Promise.resolve(undefined);
      });

      mockNeonAdapterInstance.addCompetitorAccount.mockImplementation(
        async (pId, uName, iUrl) => {
          addCompetitorCalledLog(pId, uName, iUrl);
          return Promise.resolve(null); // Возвращаем null, как и ожидается в этом тесте
        }
      );

      await competitorScene.middleware()(ctx, async () => {});

      expect(initializeCalledLog).toHaveBeenCalledTimes(1);
      expect(addCompetitorCalledLog).toHaveBeenCalledTimes(1);
      expect(addCompetitorCalledLog).toHaveBeenCalledWith(
        projectId,
        username,
        instagramUrl
      );

      expect(ctx.reply).toHaveBeenCalledWith(
        "Ошибка при добавлении конкурента. Попробуйте позже."
      );
      expect(ctx.scene.session.step).toBeUndefined();
      expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
    });

    it("should handle error thrown by adapter.addCompetitorAccount", async () => {
      const projectId = 45;
      const instagramUrl = "https://www.instagram.com/throwerror/";
      const username = "throwerror";
      const update: Update.MessageUpdate = {
        update_id: 12,
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          chat: {
            id: 1,
            type: "private",
            first_name: "ThrowErrorUser",
            username: "throwerroruser",
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

      const addError = new Error("DB insert failed");
      const consoleErrorSpy = spyOn(console, "error").mockImplementation(
        () => {}
      );

      // Логгеры для вызовов методов адаптера
      const initializeCalledLog = jest.fn();
      const addCompetitorCalledLog = jest.fn();

      mockNeonAdapterInstance.initialize.mockImplementation(async () => {
        initializeCalledLog();
        return Promise.resolve(undefined);
      });

      mockNeonAdapterInstance.addCompetitorAccount.mockImplementation(
        async (pId, uName, iUrl) => {
          addCompetitorCalledLog(pId, uName, iUrl);
          return Promise.reject(addError); // Отклоняем промис, как и ожидается в этом тесте
        }
      );

      await competitorScene.middleware()(ctx, async () => {});

      expect(initializeCalledLog).toHaveBeenCalledTimes(1);
      expect(addCompetitorCalledLog).toHaveBeenCalledTimes(1);
      expect(addCompetitorCalledLog).toHaveBeenCalledWith(
        projectId,
        username,
        instagramUrl
      );

      expect(console.error).toHaveBeenCalledWith(
        "Ошибка при добавлении конкурента в сцене:",
        addError
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        "Произошла внутренняя ошибка при добавлении конкурента. Попробуйте позже."
      );
      expect(ctx.scene.session.step).toBeUndefined();
      expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
      consoleErrorSpy.mockRestore();
    });

    it("should handle error during adapter.initialize (within on text)", async () => {
      const projectId = 46;
      const instagramUrl = "https://www.instagram.com/initfail/";
      const update: Update.MessageUpdate = {
        update_id: 13,
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          chat: {
            id: 1,
            type: "private",
            first_name: "UserInitFailTestFinal",
            username: "userinitfailtestfinal",
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

      const initError = new Error("Initialize failed in onText");
      mockNeonAdapterInstance.initialize.mockRejectedValue(initError);
      // Убедимся, что addCompetitorAccount не будет успешно вызван
      mockNeonAdapterInstance.addCompetitorAccount.mockResolvedValue(null);
      const consoleErrorSpy = spyOn(console, "error").mockImplementation(
        () => {}
      );

      await competitorScene.middleware()(ctx, async () => {});

      expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
      // addCompetitorAccount не должен быть вызван, если initialize падает до извлечения username
      expect(
        mockNeonAdapterInstance.addCompetitorAccount
      ).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        "Ошибка при добавлении конкурента в сцене:",
        initError
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        "Произошла внутренняя ошибка при добавлении конкурента. Попробуйте позже."
      );
      expect(ctx.scene.session.step).toBeUndefined();
      // close должен быть вызван из блока finally, даже если initialize упал
      expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
      consoleErrorSpy.mockRestore();
    });

    // TODO: Добавить остальные тесты для action handler и других частей сцены
  });

  describe("on text handler (add competitor URL)", () => {
    it("should do nothing if session step is not ADD_COMPETITOR", async () => {
      const update = {
        update_id: 14,
        from: { id: 1 },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 1, type: "private" },
          text: "https://instagram.com/someuser",
        },
        callback_query: undefined,
      };
      ctx = createMockContext(update);
      ctx.scene.session.step = undefined; // Устанавливаем другой шаг или undefined
      ctx.scene.session.projectId = 40;

      await competitorScene.middleware()(ctx, async () => {});

      // Проверяем, что ключевые методы не были вызваны
      expect(ctx.reply).not.toHaveBeenCalled();
      expect(mockNeonAdapterInstance.initialize).not.toHaveBeenCalled();
      expect(
        mockNeonAdapterInstance.addCompetitorAccount
      ).not.toHaveBeenCalled();
      expect(mockNeonAdapterInstance.close).not.toHaveBeenCalled();
      // answerCbQuery не вызывается для текстовых сообщений, если только это не часть специальной логики
    });

    it("should reply with error and reenter if projectId is missing in session", async () => {
      const update = {
        update_id: 15,
        from: { id: 1 },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 1, type: "private" },
          text: "https://instagram.com/someuser",
        },
        callback_query: undefined,
      };
      ctx = createMockContext(update);
      ctx.scene.session.step = ScraperSceneStep.ADD_COMPETITOR;
      ctx.scene.session.projectId = undefined; // projectId отсутствует

      await competitorScene.middleware()(ctx, async () => {});

      expect(ctx.reply).toHaveBeenCalledWith(
        "Ошибка: не указан проект. Начните сначала."
      );
      expect(ctx.scene.reenter).toHaveBeenCalledTimes(1);
      expect(mockNeonAdapterInstance.initialize).not.toHaveBeenCalled();
    });

    // TODO: Добавить остальные тесты для on text handler
  });
});
