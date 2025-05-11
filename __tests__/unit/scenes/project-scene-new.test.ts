// --- УНИКАЛЬНЫЙ КОММЕНТАРИЙ ДЛЯ ПРОВЕРКИ ПЕРЕЗАПИСИ (v12 - linter fixes p2) ---
import { describe, expect, jest, beforeEach, it } from "bun:test"; // Возвращаем 'it'
// import { createMockContext } from "../../../__tests__/__mocks__/context-factory"; // Больше не используется здесь
import { Scenes, Context, Telegram } from "telegraf"; // Telegraf удален
import { Update, Message, UserFromGetMe } from "telegraf/types";

import { projectScene } from "../../../src/scenes/project-scene"; // ИСПРАВЛЕН ПУТЬ
import { ScraperBotContext } from "../../../src/types"; // StorageAdapter удален
import { NeonAdapter } from "../../../src/adapters/neon-adapter"; // ИСПРАВЛЕН ПУТЬ
import { ScraperSceneSessionData } from "../../../src/types"; // ИСПРАВЛЕН ПУТЬ
// Импортируем функцию для генерации клавиатуры
import { generateProjectsKeyboard } from "../../../src/scenes/components/project-keyboard";

/* // Закомментируем createMockNeonAdapter, так как он не используется и может вызывать ошибки типов
const createMockNeonAdapter = () => ({
  initialize: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  getUserByTelegramId: jest.fn(),
  getProjectsByUserId: jest.fn(),
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
});
*/

describe("Project Scene NEW (Dependency Injection - Full Replace)", () => {
  beforeEach(() => {
    // Очищаем beforeEach, так как вся инициализация теперь локальна для TEMP TEST
    // или если будут другие тесты, они будут настраивать свои моки.
  });

  describe("enter handler", () => {
    // Оставляем и исправляем новый тест, который проверяет сценарий "нет проектов"
    it("should handle 'no projects' scenario on enter", async () => {
      // Изменяем test на it и уточняем имя
      const specificMockAdapterInstance = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getUserByTelegramId: jest
          .fn()
          .mockResolvedValue({ id: 1, telegram_id: 123, username: "testuser" }), // Пользователь существует
        getProjectsByUserId: jest.fn().mockResolvedValue([]), // У пользователя нет проектов
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

      const localCtx = new Context(
        localUpdate,
        localMockTelegram,
        localBotInfo
      ) as ScraperBotContext;

      localCtx.scene = {
        enter: jest.fn() as any,
        leave: jest.fn().mockResolvedValue(true) as any,
        reenter: jest.fn() as any,
        session: {} as ScraperSceneSessionData,
        state: {},
        scenes: new Map(),
        options: {} as any,
        current: undefined,
        reset: jest.fn() as any,
        leaving: false,
      } as any as Scenes.SceneContextScene<
        ScraperBotContext,
        ScraperSceneSessionData
      >;

      localCtx.storage = specificMockAdapterInstance as any;
      localCtx.reply = jest.fn().mockResolvedValue({} as Message.TextMessage);

      await projectScene.enterMiddleware()(localCtx, async () => {});

      expect(
        specificMockAdapterInstance.initialize as jest.Mock
      ).toHaveBeenCalled();
      expect(localCtx.reply).toHaveBeenCalledWith(
        "У вас пока нет проектов. Хотите создать новый?",
        expect.objectContaining({})
      );
    });

    // Новый тест для сценария с существующими проектами
    it("should display existing projects on enter", async () => {
      const mockProjects = [
        {
          id: 1,
          name: "Проект Альфа",
          user_id: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true,
        },
        {
          id: 2,
          name: "Проект Бета",
          user_id: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true,
        },
      ];

      const specificMockAdapterInstance = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getUserByTelegramId: jest
          .fn()
          .mockResolvedValue({ id: 1, telegram_id: 123, username: "testuser" }),
        getProjectsByUserId: jest.fn().mockResolvedValue(mockProjects), // Возвращаем тестовые проекты
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

      const localCtx = new Context(
        localUpdate,
        localMockTelegram,
        localBotInfo
      ) as ScraperBotContext;

      localCtx.scene = {
        enter: jest.fn() as any,
        leave: jest.fn().mockResolvedValue(true) as any,
        reenter: jest.fn() as any,
        session: {} as ScraperSceneSessionData,
        state: {},
        scenes: new Map(),
        options: {} as any,
        current: undefined,
        reset: jest.fn() as any,
        leaving: false,
      } as any as Scenes.SceneContextScene<
        ScraperBotContext,
        ScraperSceneSessionData
      >;

      localCtx.storage = specificMockAdapterInstance as any;
      localCtx.reply = jest.fn().mockResolvedValue({} as Message.TextMessage);

      await projectScene.enterMiddleware()(localCtx, async () => {});

      expect(
        specificMockAdapterInstance.initialize as jest.Mock
      ).toHaveBeenCalled();
      expect(localCtx.reply).toHaveBeenCalledWith(
        "Ваши проекты:",
        expect.objectContaining({
          reply_markup: generateProjectsKeyboard(mockProjects).reply_markup,
        })
      );
    });
  });

  /* // Блок text handler все еще закомментирован */
});
