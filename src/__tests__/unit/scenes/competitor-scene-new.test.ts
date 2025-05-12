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
import { Update, UserFromGetMe, CallbackQuery, Message } from "telegraf/types";
// Импортируем сцену и обработчик
import {
  competitorScene,
  handleDeleteCompetitorAction,
} from "../../../scenes/competitor-scene";
import { NeonAdapter } from "../../../adapters/neon-adapter";
import { ScraperBotContext, ScraperSceneSessionData } from "@/types";

// --- МОКИРОВАНИЕ ЗАВИСИМОСТЕЙ ---

// Мокируем NeonAdapter
mock.module("../../../adapters/neon-adapter", () => {
  return {
    NeonAdapter: jest.fn().mockImplementation(() => ({
      initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      getUserByTelegramId: jest.fn(),
      getProjectsByUserId: jest.fn(),
      getCompetitorAccounts: jest.fn(),
      addCompetitorAccount: jest.fn(),
      deleteCompetitorAccount: jest.fn(),
    })),
  };
});

// Моки Telegraf/Scenes больше не нужны, т.к. тестируем обработчик напрямую

// --- КОНЕЦ МОКИРОВАНИЯ ---

let mockNeonAdapterInstance: NeonAdapter & {
  [K in keyof NeonAdapter]: jest.Mock;
};

type ActionContextWithMatch = ScraperBotContext & {
  scene: { session: ScraperSceneSessionData };
  match: RegExpExecArray | null;
  editMessageReplyMarkup: jest.Mock;
};

const createMockContext = (
  update: Update.CallbackQueryUpdate
): ActionContextWithMatch => {
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
  ) as ActionContextWithMatch;

  // Базовые моки сцены могут все еще понадобиться, если обработчик их использует
  ctx.scene = {
    enter: jest.fn(),
    leave: jest.fn(),
    reenter: jest.fn(),
    session: {} as ScraperSceneSessionData,
    state: {},
    current: competitorScene as any, // Указываем текущую сцену
    ctx: ctx,
  } as any;

  ctx.reply = jest.fn();
  ctx.answerCbQuery = jest.fn().mockResolvedValue(true);
  ctx.editMessageReplyMarkup = jest.fn().mockResolvedValue(true);
  ctx.match = null; // match будет установлен в тесте

  const adapterInstance = new NeonAdapter();
  ctx.storage = adapterInstance;
  mockNeonAdapterInstance = adapterInstance as NeonAdapter & {
    [K in keyof NeonAdapter]: jest.Mock;
  };

  return ctx;
};

const createMockCallbackQueryMessage = (
  msg: Partial<Message.TextMessage> = {}
): Message.TextMessage => ({
  message_id: 1,
  date: Math.floor(Date.now() / 1000),
  chat: { id: 1, type: "private", first_name: "Test", username: "testuser" },
  from: { id: 12345, is_bot: true, first_name: "TestBot", username: "TestBot" },
  text: "Mock message text",
  ...msg,
});

describe("competitorScene Actions", () => {
  describe("handleDeleteCompetitorAction handler", () => {
    // Тестируем экспортированный обработчик
    let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
      consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
      jest.clearAllMocks();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it("should call deleteCompetitorAccount and reply on successful deletion", async () => {
      const projectId = 456;
      const username = "user_to_delete";
      const update: Update.CallbackQueryUpdate = {
        update_id: 30,
        callback_query: {
          id: "cb1_delete_success",
          from: {
            id: 1,
            first_name: "Test",
            is_bot: false,
            username: "testuser",
            language_code: "en",
          },
          message: createMockCallbackQueryMessage(),
          chat_instance: "1",
          data: `delete_competitor_${projectId}_${username}`,
        } as CallbackQuery.DataQuery,
      };
      const ctx: ActionContextWithMatch = createMockContext(update);
      const callbackData = (update.callback_query as CallbackQuery.DataQuery)
        .data;
      ctx.match = /delete_competitor_(\d+)_(.+)/.exec(callbackData);

      if (!ctx.match) {
        throw new Error(
          "Regex did not match in test setup for successful deletion"
        );
      }

      mockNeonAdapterInstance.deleteCompetitorAccount.mockResolvedValue(true);
      await handleDeleteCompetitorAction(
        ctx as ScraperBotContext & { match: RegExpExecArray }
      );

      expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
      expect(
        mockNeonAdapterInstance.deleteCompetitorAccount
      ).toHaveBeenCalledWith(projectId, username);
      expect(ctx.reply).toHaveBeenCalledWith(
        `Конкурент "${username}" успешно удален из проекта.`
      );
      expect(ctx.editMessageReplyMarkup).toHaveBeenCalledWith(undefined);
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Удалено");
      expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should reply with error if deleteCompetitorAccount returns false (not found)", async () => {
      const projectId = 789;
      const username = "user_not_found";
      const update: Update.CallbackQueryUpdate = {
        update_id: 31,
        callback_query: {
          id: "cb2_delete_notfound",
          from: {
            id: 1,
            first_name: "Test",
            is_bot: false,
            username: "testuser",
            language_code: "en",
          },
          message: createMockCallbackQueryMessage(),
          chat_instance: "1",
          data: `delete_competitor_${projectId}_${username}`,
        } as CallbackQuery.DataQuery,
      };
      const ctx: ActionContextWithMatch = createMockContext(update);
      const callbackData = (update.callback_query as CallbackQuery.DataQuery)
        .data;
      ctx.match = /delete_competitor_(\d+)_(.+)/.exec(callbackData);

      if (!ctx.match) {
        throw new Error(
          "Regex did not match in test setup for 'not found' case"
        );
      }

      mockNeonAdapterInstance.deleteCompetitorAccount.mockResolvedValue(false);
      await handleDeleteCompetitorAction(
        ctx as ScraperBotContext & { match: RegExpExecArray }
      );

      expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
      expect(
        mockNeonAdapterInstance.deleteCompetitorAccount
      ).toHaveBeenCalledWith(projectId, username);
      expect(ctx.reply).toHaveBeenCalledWith(
        `Не удалось найти или удалить конкурента "${username}". Возможно, он уже был удален.`
      );
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка удаления");
      expect(ctx.editMessageReplyMarkup).not.toHaveBeenCalled();
      expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should reply with error and log if deleteCompetitorAccount throws (DB error)", async () => {
      const projectId = 101;
      const username = "user_db_error";
      const update: Update.CallbackQueryUpdate = {
        update_id: 32,
        callback_query: {
          id: "cb3_delete_dberror",
          from: {
            id: 1,
            first_name: "Test",
            is_bot: false,
            username: "testuser",
            language_code: "en",
          },
          message: createMockCallbackQueryMessage(),
          chat_instance: "1",
          data: `delete_competitor_${projectId}_${username}`,
        } as CallbackQuery.DataQuery,
      };
      const ctx: ActionContextWithMatch = createMockContext(update);
      const callbackData = (update.callback_query as CallbackQuery.DataQuery)
        .data;
      ctx.match = /delete_competitor_(\d+)_(.+)/.exec(callbackData);

      if (!ctx.match) {
        throw new Error(
          "Regex did not match in test setup for 'DB error' case"
        );
      }

      const dbError = new Error("Database connection lost");
      mockNeonAdapterInstance.deleteCompetitorAccount.mockImplementation(
        async () => {
          throw dbError;
        }
      );
      mockNeonAdapterInstance.initialize.mockResolvedValue(undefined);

      await handleDeleteCompetitorAction(
        ctx as ScraperBotContext & { match: RegExpExecArray }
      );

      expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
      expect(
        mockNeonAdapterInstance.deleteCompetitorAccount
      ).toHaveBeenCalledWith(projectId, username);
      expect(ctx.reply).toHaveBeenCalledWith(
        "Произошла техническая ошибка при удалении конкурента. Попробуйте позже."
      );
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка");
      expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Ошибка при удалении конкурента ${username} из проекта ${projectId}:`,
        dbError
      );
    });

    it("should reply with error if callback data is invalid (NaN projectId)", async () => {
      const username = "user_invalid_id";
      const update: Update.CallbackQueryUpdate = {
        update_id: 33,
        callback_query: {
          id: "cb4_delete_invalid",
          from: {
            id: 1,
            first_name: "Test",
            is_bot: false,
            username: "testuser",
            language_code: "en",
          },
          message: createMockCallbackQueryMessage(),
          chat_instance: "1",
          data: `delete_competitor_NaN_${username}`,
        } as CallbackQuery.DataQuery,
      };
      const ctx: ActionContextWithMatch = createMockContext(update);
      const callbackData = (update.callback_query as CallbackQuery.DataQuery)
        .data;
      ctx.match = /delete_competitor_(\d+)_(.+)/.exec(callbackData);

      if (!ctx.match) {
        console.warn(
          "Warning: Regex did not match for NaN test, this is unexpected for data `delete_competitor_NaN_...`"
        );
        ctx.match = ["fake_match_for_NaN", "NaN", username] as any;
      }
      await handleDeleteCompetitorAction(
        ctx as ScraperBotContext & { match: RegExpExecArray }
      );

      expect(mockNeonAdapterInstance.initialize).not.toHaveBeenCalled();
      expect(
        mockNeonAdapterInstance.deleteCompetitorAccount
      ).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        "Ошибка при удалении конкурента. Пожалуйста, попробуйте снова."
      );
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Invalid data parsed from delete action: projectId=NaN, username=${username}`
      );
    });
  });
});
