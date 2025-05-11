// --- УНИКАЛЬНЫЙ КОММЕНТАРИЙ ДЛЯ ПРОВЕРКИ ПЕРЕЗАПИСИ (v22 - answerCbQuery returns Promise<true>) ---
import { describe, expect, jest, beforeEach, it, mock } from "bun:test";
// import { mockDeep, DeepMocked } from "vitest-mock-extended"; // Пока закомментируем
import { Scenes, Context, Telegram } from "telegraf";
// import { SceneContext } from "telegraf/scenes"; // Удаляем, так как не используется
import { Update, Message, UserFromGetMe } from "telegraf/types";

import { projectScene } from "../../../src/scenes/project-scene";
import { NeonAdapter } from "../../../src/adapters/neon-adapter";
import {
  Project,
  User,
  ScraperSceneSessionData,
  ScraperSceneStep,
  ScraperBotContext,
} from "../../../src/types";
import { generateProjectsKeyboard } from "../../../src/scenes/components/project-keyboard";

// Определение кастомного типа контекста для тестов
// Расширяем ScraperBotContext, делая storage обязательным и добавляя моки для reply/answerCbQuery
type TestScraperBotContext = Omit<
  ScraperBotContext,
  | "storage"
  | "scene"
  | "reply"
  | "answerCbQuery"
  | "telegram"
  | "update"
  | "botInfo"
  | "state"
  | "match"
> & {
  storage: NeonAdapter;
  scene: Scenes.SceneContextScene<
    TestScraperBotContext,
    ScraperSceneSessionData
  >;
  reply: jest.Mock;
  answerCbQuery: jest.Mock<(text?: string, extra?: any) => Promise<true>>;
  telegram: Telegram;
  update: Update;
  botInfo: UserFromGetMe;
  state: any;
  match?: RegExpExecArray;
};

describe("Project Scene NEW (Dependency Injection - Full Replace)", () => {
  beforeEach(() => {
    // Очищаем beforeEach, так как вся инициализация теперь локальна для TEMP TEST
    // или если будут другие тесты, они будут настраивать свои моки.
  });

  describe("enter handler", () => {
    it("should handle 'no projects' scenario on enter", async () => {
      const specificMockAdapterInstance = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getUserByTelegramId: jest
          .fn()
          .mockResolvedValue({ id: 1, telegram_id: 123, username: "testuser" }),
        getProjectsByUserId: jest.fn().mockResolvedValue([]),
        close: jest.fn().mockResolvedValue(undefined),
        createProject: jest.fn(),
        getProjectById: jest.fn(),
        addCompetitorAccount: jest.fn(),
        getCompetitorAccounts: jest.fn(),
        addHashtag: jest.fn(),
        getTrackingHashtags: jest.fn(),
        saveReels: jest.fn(),
        getReels: jest.fn(),
        logParsingRun: jest.fn(),
        createUser: jest.fn(),
      } as unknown as NeonAdapter;

      const localMockTelegram = {
        sendMessage: jest.fn().mockResolvedValue({} as Message.TextMessage),
      } as unknown as Telegram;

      const localBotInfo: UserFromGetMe = {
        id: 1,
        is_bot: true as const,
        first_name: "TestBot",
        username: "TestBot",
        can_join_groups: true,
        can_read_all_group_messages: true,
        supports_inline_queries: true,
      };

      const localUpdate: Update.MessageUpdate = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 123, type: "private", first_name: "TestUser" },
          date: Date.now() / 1000,
          from: { id: 123, is_bot: false, first_name: "TestUser" },
          text: "some text",
          edit_date: undefined,
        },
      };

      let localCtx = new Context(
        localUpdate,
        localMockTelegram,
        localBotInfo
      ) as TestScraperBotContext;
      localCtx.storage = specificMockAdapterInstance;
      localCtx.reply = jest.fn().mockResolvedValue({} as Message.TextMessage);
      localCtx.answerCbQuery = jest.fn().mockResolvedValue(true) as jest.Mock<
        (text?: string, extra?: any) => Promise<true>
      >;

      localCtx.scene = {
        enter: jest.fn(),
        leave: jest.fn().mockResolvedValue(true),
        reenter: jest.fn(),
        session: {} as ScraperSceneSessionData,
        state: {} as any,
        scenes: new Map(),
        options: {} as any,
        current: undefined,
        reset: jest.fn(),
        leaving: false,
      } as unknown as Scenes.SceneContextScene<
        TestScraperBotContext,
        ScraperSceneSessionData
      >;

      await projectScene.enterMiddleware()(localCtx as any, async () => {});

      expect(specificMockAdapterInstance.initialize).toHaveBeenCalled();
      expect(localCtx.reply).toHaveBeenCalledWith(
        "У вас пока нет проектов. Хотите создать новый?",
        expect.objectContaining({})
      );
    });

    it("should display existing projects on enter", async () => {
      const mockProjects: Project[] = [
        {
          id: 1,
          name: "Проект Альфа",
          user_id: 1,
          created_at: new Date().toISOString(),
          is_active: true,
        },
        {
          id: 2,
          name: "Проект Бета",
          user_id: 1,
          created_at: new Date().toISOString(),
          is_active: true,
        },
      ];
      const specificMockAdapterInstance = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getUserByTelegramId: jest
          .fn()
          .mockResolvedValue({ id: 1, telegram_id: 123, username: "testuser" }),
        getProjectsByUserId: jest.fn().mockResolvedValue(mockProjects),
        close: jest.fn().mockResolvedValue(undefined),
        createProject: jest.fn(),
        getProjectById: jest.fn(),
        addCompetitorAccount: jest.fn(),
        getCompetitorAccounts: jest.fn(),
        addHashtag: jest.fn(),
        getTrackingHashtags: jest.fn(),
        saveReels: jest.fn(),
        getReels: jest.fn(),
        logParsingRun: jest.fn(),
        createUser: jest.fn(),
      } as unknown as NeonAdapter;

      const localMockTelegram = {
        sendMessage: jest.fn().mockResolvedValue({} as Message.TextMessage),
      } as unknown as Telegram;

      const localBotInfo: UserFromGetMe = {
        id: 1,
        is_bot: true as const,
        first_name: "TestBot",
        username: "TestBot",
        can_join_groups: true,
        can_read_all_group_messages: true,
        supports_inline_queries: true,
      };

      const localUpdate: Update.MessageUpdate = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 123, type: "private", first_name: "TestUser" },
          date: Date.now() / 1000,
          from: { id: 123, is_bot: false, first_name: "TestUser" },
          text: "some text",
          edit_date: undefined,
        },
      };

      let localCtx = new Context(
        localUpdate,
        localMockTelegram,
        localBotInfo
      ) as TestScraperBotContext;
      localCtx.storage = specificMockAdapterInstance;
      localCtx.reply = jest.fn().mockResolvedValue({} as Message.TextMessage);
      localCtx.answerCbQuery = jest.fn().mockResolvedValue(true) as jest.Mock<
        (text?: string, extra?: any) => Promise<true>
      >;
      (specificMockAdapterInstance as any).getProjectsByUserId = jest
        .fn()
        .mockResolvedValue(mockProjects);

      localCtx.scene = {
        enter: jest.fn(),
        leave: jest.fn().mockResolvedValue(true),
        reenter: jest.fn(),
        session: {} as ScraperSceneSessionData,
        state: {} as any,
        scenes: new Map(),
        options: {} as any,
        current: undefined,
        reset: jest.fn(),
        leaving: false,
      } as unknown as Scenes.SceneContextScene<
        TestScraperBotContext,
        ScraperSceneSessionData
      >;

      await projectScene.enterMiddleware()(localCtx as any, async () => {});

      expect(specificMockAdapterInstance.initialize).toHaveBeenCalled();
      expect(localCtx.reply).toHaveBeenCalledWith(
        "Ваши проекты:",
        expect.objectContaining({
          reply_markup: generateProjectsKeyboard(mockProjects).reply_markup,
        })
      );
    });

    it("should handle error during adapter.initialize on enter", async () => {
      const errorMessage = "Initialize error";
      const specificMockAdapterInstance = {
        initialize: jest.fn().mockRejectedValue(new Error(errorMessage)),
        getUserByTelegramId: jest.fn(),
        getProjectsByUserId: jest.fn(),
        close: jest.fn(),
        createProject: jest.fn(),
        getProjectById: jest.fn(),
        addCompetitorAccount: jest.fn(),
        getCompetitorAccounts: jest.fn(),
        addHashtag: jest.fn(),
        getTrackingHashtags: jest.fn(),
        saveReels: jest.fn(),
        getReels: jest.fn(),
        logParsingRun: jest.fn(),
        createUser: jest.fn(),
      } as unknown as NeonAdapter;

      const localMockTelegram = {
        sendMessage: jest.fn().mockResolvedValue({} as Message.TextMessage),
      } as unknown as Telegram;

      const localBotInfo: UserFromGetMe = {
        id: 1,
        is_bot: true as const,
        first_name: "TestBot",
        username: "TestBot",
        can_join_groups: true,
        can_read_all_group_messages: true,
        supports_inline_queries: true,
      };

      const localUpdate: Update.MessageUpdate = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 123, type: "private", first_name: "TestUser" },
          date: Date.now() / 1000,
          from: { id: 123, is_bot: false, first_name: "TestUser" },
          text: "some text",
          edit_date: undefined,
        },
      };

      let localCtx = new Context(
        localUpdate,
        localMockTelegram,
        localBotInfo
      ) as TestScraperBotContext;
      localCtx.storage = specificMockAdapterInstance;
      localCtx.reply = jest.fn().mockResolvedValue({} as Message.TextMessage);
      localCtx.answerCbQuery = jest.fn().mockResolvedValue(true) as jest.Mock<
        (text?: string, extra?: any) => Promise<true>
      >;

      const mockSceneLeave = jest.fn().mockResolvedValue(true);
      localCtx.scene = {
        enter: jest.fn(),
        leave: mockSceneLeave,
        reenter: jest.fn(),
        session: {} as ScraperSceneSessionData,
        state: {} as any,
        scenes: new Map(),
        options: {} as any,
        current: undefined,
        reset: jest.fn(),
        leaving: false,
      } as unknown as Scenes.SceneContextScene<
        TestScraperBotContext,
        ScraperSceneSessionData
      >;

      const originalConsoleError = console.error;
      const consoleErrorMock = mock();
      console.error = consoleErrorMock;

      await projectScene.enterMiddleware()(localCtx as any, async () => {});

      expect(specificMockAdapterInstance.initialize).toHaveBeenCalled();
      expect(localCtx.reply).toHaveBeenCalledWith(
        "Произошла ошибка при получении проектов. Пожалуйста, попробуйте позже."
      );
      expect(mockSceneLeave).toHaveBeenCalled();
      console.error = originalConsoleError;
    });

    it("should handle user not found on enter", async () => {
      const specificMockAdapterInstance = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getUserByTelegramId: jest.fn().mockResolvedValue(null),
        getProjectsByUserId: jest.fn(),
        close: jest.fn(),
        createProject: jest.fn(),
        getProjectById: jest.fn(),
        addCompetitorAccount: jest.fn(),
        getCompetitorAccounts: jest.fn(),
        addHashtag: jest.fn(),
        getTrackingHashtags: jest.fn(),
        saveReels: jest.fn(),
        getReels: jest.fn(),
        logParsingRun: jest.fn(),
        createUser: jest.fn(),
      } as unknown as NeonAdapter;

      const localMockTelegram = {
        sendMessage: jest.fn().mockResolvedValue({} as Message.TextMessage),
      } as unknown as Telegram;

      const localBotInfo: UserFromGetMe = {
        id: 1,
        is_bot: true as const,
        first_name: "TestBot",
        username: "TestBot",
        can_join_groups: true,
        can_read_all_group_messages: true,
        supports_inline_queries: true,
      };

      const localUpdate: Update.MessageUpdate = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 123, type: "private", first_name: "TestUser" },
          date: Date.now() / 1000,
          from: { id: 123, is_bot: false, first_name: "TestUser" },
          text: "some text",
          edit_date: undefined,
        },
      };

      let localCtx = new Context(
        localUpdate,
        localMockTelegram,
        localBotInfo
      ) as TestScraperBotContext;
      localCtx.storage = specificMockAdapterInstance;
      localCtx.reply = jest.fn().mockResolvedValue({} as Message.TextMessage);
      localCtx.answerCbQuery = jest.fn().mockResolvedValue(true) as jest.Mock<
        (text?: string, extra?: any) => Promise<true>
      >;

      const mockSceneLeave = jest.fn().mockResolvedValue(true);
      localCtx.scene = {
        enter: jest.fn(),
        leave: mockSceneLeave,
        reenter: jest.fn(),
        session: {} as ScraperSceneSessionData,
        state: {} as any,
        scenes: new Map(),
        options: {} as any,
        current: undefined,
        reset: jest.fn(),
        leaving: false,
      } as unknown as Scenes.SceneContextScene<
        TestScraperBotContext,
        ScraperSceneSessionData
      >;

      await projectScene.enterMiddleware()(localCtx as any, async () => {});

      expect(specificMockAdapterInstance.initialize).toHaveBeenCalled();
      expect(
        specificMockAdapterInstance.getUserByTelegramId
      ).toHaveBeenCalledWith(123);
      expect(localCtx.reply).toHaveBeenCalledWith(
        "Вы не зарегистрированы. Пожалуйста, используйте сначала основные команды бота."
      );
      expect(mockSceneLeave).toHaveBeenCalled();
    });

    it("should handle error during getProjectsByUserId on enter", async () => {
      const errorMessage = "Get projects error";
      const mockUser: User = {
        id: 1,
        telegram_id: 123,
        username: "testuser",
        created_at: new Date().toISOString(),
        is_active: true,
      };

      const specificMockAdapterInstance = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        getProjectsByUserId: jest
          .fn()
          .mockRejectedValue(new Error(errorMessage)),
        close: jest.fn(),
        createProject: jest.fn(),
        getProjectById: jest.fn(),
        addCompetitorAccount: jest.fn(),
        getCompetitorAccounts: jest.fn(),
        addHashtag: jest.fn(),
        getTrackingHashtags: jest.fn(),
        saveReels: jest.fn(),
        getReels: jest.fn(),
        logParsingRun: jest.fn(),
        createUser: jest.fn(),
      } as unknown as NeonAdapter;

      const localMockTelegram = {
        sendMessage: jest.fn().mockResolvedValue({} as Message.TextMessage),
      } as unknown as Telegram;

      const localBotInfo: UserFromGetMe = {
        id: 1,
        is_bot: true as const,
        first_name: "TestBot",
        username: "TestBot",
        can_join_groups: true,
        can_read_all_group_messages: true,
        supports_inline_queries: true,
      };

      const localUpdate: Update.MessageUpdate = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 123, type: "private", first_name: "TestUser" },
          date: Date.now() / 1000,
          from: { id: 123, is_bot: false, first_name: "TestUser" },
          text: "some text",
          edit_date: undefined,
        },
      };

      let localCtx = new Context(
        localUpdate,
        localMockTelegram,
        localBotInfo
      ) as TestScraperBotContext;
      localCtx.storage = specificMockAdapterInstance;
      localCtx.reply = jest.fn().mockResolvedValue({} as Message.TextMessage);
      localCtx.answerCbQuery = jest.fn().mockResolvedValue(true) as jest.Mock<
        (text?: string, extra?: any) => Promise<true>
      >;

      const mockSceneLeave = jest.fn().mockResolvedValue(true);
      localCtx.scene = {
        enter: jest.fn(),
        leave: mockSceneLeave,
        reenter: jest.fn(),
        session: {} as ScraperSceneSessionData,
        state: {} as any,
        scenes: new Map(),
        options: {} as any,
        current: undefined,
        reset: jest.fn(),
        leaving: false,
      } as unknown as Scenes.SceneContextScene<
        TestScraperBotContext,
        ScraperSceneSessionData
      >;

      const originalConsoleError = console.error;
      const consoleErrorMock = mock();
      console.error = consoleErrorMock;

      await projectScene.enterMiddleware()(localCtx as any, async () => {});

      expect(localCtx.reply).toHaveBeenCalledWith(
        "Произошла ошибка при получении проектов. Пожалуйста, попробуйте позже."
      );
      expect(mockSceneLeave).toHaveBeenCalled();
      console.error = originalConsoleError;
    });
  });

  describe("action handlers", () => {
    it("should handle 'exit_scene' action", async () => {
      const localMockTelegram = {
        sendMessage: jest.fn().mockResolvedValue({} as Message.TextMessage),
        answerCbQuery: jest.fn().mockResolvedValue(true),
      } as unknown as Telegram;

      const localBotInfo: UserFromGetMe = {
        id: 1,
        is_bot: true as const,
        first_name: "TestBot",
        username: "TestBot",
        can_join_groups: true,
        can_read_all_group_messages: true,
        supports_inline_queries: true,
      };

      const localUpdate: Update.CallbackQueryUpdate = {
        update_id: 1,
        callback_query: {
          id: "test_callback_id_exit",
          from: {
            id: 123,
            is_bot: false,
            first_name: "TestUser",
            username: "TestUser",
          },
          message: {
            message_id: 1,
            chat: {
              id: 123,
              type: "private",
              first_name: "TestUser",
              username: "TestUser",
            },
            date: Math.floor(Date.now() / 1000),
            text: "Сообщение с кнопкой выхода",
          },
          chat_instance: "test_chat_instance_exit",
          data: "exit_scene",
        },
      };

      let localCtx = new Context(
        localUpdate,
        localMockTelegram,
        localBotInfo
      ) as TestScraperBotContext;
      localCtx.storage = { initialize: jest.fn() } as any;
      localCtx.reply = jest.fn().mockResolvedValue({} as Message.TextMessage);
      localCtx.answerCbQuery = jest.fn().mockResolvedValue(true) as jest.Mock<
        (text?: string, extra?: any) => Promise<true>
      >;

      const mockSceneLeave = jest.fn().mockResolvedValue(true);
      localCtx.scene = {
        enter: jest.fn(),
        leave: mockSceneLeave,
        reenter: jest.fn(),
        session: {} as ScraperSceneSessionData,
        state: {} as any,
        scenes: new Map(),
        options: {} as any,
        current: undefined,
        reset: jest.fn(),
        leaving: false,
      } as unknown as Scenes.SceneContextScene<
        TestScraperBotContext,
        ScraperSceneSessionData
      >;

      await projectScene.middleware()(localCtx as any, async () => {});

      expect(localCtx.answerCbQuery).toHaveBeenCalled();
      expect(localCtx.reply).toHaveBeenCalledWith(
        "Вы вышли из режима управления проектами",
        { reply_markup: { remove_keyboard: true } }
      );
      expect(mockSceneLeave).toHaveBeenCalled();
    });

    it("should handle 'create_project' action", async () => {
      const localMockTelegram = {
        sendMessage: jest.fn().mockResolvedValue({} as Message.TextMessage),
        answerCbQuery: jest.fn().mockResolvedValue(true),
      } as unknown as Telegram;

      const localBotInfo: UserFromGetMe = {
        id: 1,
        is_bot: true as const,
        first_name: "TestBot",
        username: "TestBot",
        can_join_groups: true,
        can_read_all_group_messages: true,
        supports_inline_queries: true,
      };

      const localUpdate: Update.CallbackQueryUpdate = {
        update_id: 1,
        callback_query: {
          id: "test_callback_id_create",
          from: {
            id: 123,
            is_bot: false,
            first_name: "TestUser",
            username: "TestUser",
          },
          message: {
            message_id: 1,
            chat: {
              id: 123,
              type: "private",
              first_name: "TestUser",
              username: "TestUser",
            },
            date: Math.floor(Date.now() / 1000),
            text: "Сообщение с кнопкой создания",
          },
          chat_instance: "test_chat_instance_create",
          data: "create_project",
        },
      };

      let localCtx = new Context(
        localUpdate,
        localMockTelegram,
        localBotInfo
      ) as TestScraperBotContext;
      localCtx.storage = { initialize: jest.fn() } as any;
      localCtx.reply = jest.fn().mockResolvedValue({} as Message.TextMessage);
      localCtx.answerCbQuery = jest.fn().mockResolvedValue(true) as jest.Mock<
        (text?: string, extra?: any) => Promise<true>
      >;

      const mockSceneSession = {
        step: undefined,
        currentProjectId: undefined,
        messagesToDelete: [],
        projectData: { name: "", competitors: [] },
        competitorData: { username: "", hashtags: [] },
        __scenes: {},
      } as ScraperSceneSessionData;
      localCtx.scene = {
        enter: jest.fn(),
        leave: jest.fn().mockResolvedValue(true),
        reenter: jest.fn(),
        session: mockSceneSession,
        state: {} as any,
        scenes: new Map(),
        options: {} as any,
        current: undefined,
        reset: jest.fn(),
        leaving: false,
      } as unknown as Scenes.SceneContextScene<
        TestScraperBotContext,
        ScraperSceneSessionData
      >;

      await projectScene.middleware()(localCtx as any, async () => {});

      expect(localCtx.answerCbQuery).toHaveBeenCalled();
      expect(localCtx.reply).toHaveBeenCalledWith(
        "Введите название нового проекта (например, 'Мой косметологический центр'):"
      );
      expect(localCtx.scene.session.step).toBe(ScraperSceneStep.ADD_PROJECT);
    });

    it("should handle 'back_to_projects' action", async () => {
      const localMockTelegram = {
        sendMessage: jest.fn().mockResolvedValue({} as Message.TextMessage),
        answerCbQuery: jest.fn().mockResolvedValue(true),
      } as unknown as Telegram;

      const localBotInfo: UserFromGetMe = {
        id: 1,
        is_bot: true as const,
        first_name: "TestBot",
        username: "TestBot",
        can_join_groups: true,
        can_read_all_group_messages: true,
        supports_inline_queries: true,
      };

      const localUpdate: Update.CallbackQueryUpdate = {
        update_id: 1,
        callback_query: {
          id: "test_callback_id_back",
          from: {
            id: 123,
            is_bot: false,
            first_name: "TestUser",
            username: "TestUser",
          },
          message: {
            message_id: 1,
            chat: {
              id: 123,
              type: "private",
              first_name: "TestUser",
              username: "TestUser",
            },
            date: Math.floor(Date.now() / 1000),
            text: "Сообщение с кнопкой назад",
          },
          chat_instance: "test_chat_instance_back",
          data: "back_to_projects",
        },
      };

      let localCtx = new Context(
        localUpdate,
        localMockTelegram,
        localBotInfo
      ) as TestScraperBotContext;
      localCtx.storage = { initialize: jest.fn() } as any;
      localCtx.answerCbQuery = jest.fn().mockResolvedValue(true) as jest.Mock<
        (text?: string, extra?: any) => Promise<true>
      >;

      const mockSceneReenter = jest.fn().mockResolvedValue(true);
      localCtx.scene = {
        enter: jest.fn(),
        leave: jest.fn().mockResolvedValue(true),
        reenter: mockSceneReenter,
        session: {} as ScraperSceneSessionData,
        state: {} as any,
        scenes: new Map(),
        options: {} as any,
        current: undefined,
        reset: jest.fn(),
        leaving: false,
      } as unknown as Scenes.SceneContextScene<
        TestScraperBotContext,
        ScraperSceneSessionData
      >;

      await projectScene.middleware()(localCtx as any, async () => {});

      expect(localCtx.answerCbQuery).toHaveBeenCalled();
      expect(mockSceneReenter).toHaveBeenCalled();
    });
  });

  /* // Блок text handler все еще закомментирован */
});
