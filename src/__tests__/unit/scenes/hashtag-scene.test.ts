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
import { Update, UserFromGetMe, CallbackQuery, Message } from "telegraf/types";
import {
  hashtagScene,
  // TODO: Экспортировать обработчики, если будем их тестировать напрямую
} from "../../../scenes/hashtag-scene";
import { NeonAdapter } from "../../../adapters/neon-adapter";
import {
  ScraperBotContext,
  ScraperSceneSessionData,
  ScraperSceneStep,
  Project,
  Hashtag,
} from "@/types";

// Мокируем NeonAdapter
mock.module("../../../adapters/neon-adapter", () => {
  return {
    NeonAdapter: jest.fn().mockImplementation(() => ({
      initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      getUserByTelegramId: jest.fn(),
      getProjectById: jest.fn(),
      getHashtagsByProjectId: jest.fn(),
      addHashtag: jest.fn(),
      removeHashtag: jest.fn(),
    })),
  };
});

let mockNeonAdapterInstance: NeonAdapter & {
  [K in keyof NeonAdapter]: jest.Mock;
};

// Тип для контекста с нужными полями для сцен
type SceneTestContext = ScraperBotContext & {
  scene: {
    enter: jest.Mock;
    leave: jest.Mock;
    reenter: jest.Mock;
    session: ScraperSceneSessionData;
    // Добавляем другие поля, если они используются в сцене, например, current
    current?: Scenes.Scene<SceneTestContext>;
  };
  reply: jest.Mock;
  editMessageReplyMarkup: jest.Mock;
  deleteMessage: jest.Mock;
  answerCbQuery: jest.Mock;
  match?: RegExpExecArray | null; // Для action-хендлеров
  message?: Partial<Message.TextMessage>; // Для on('text') хендлеров
  update?: Partial<Update.CallbackQueryUpdate | Update.MessageUpdate>; // Для общего update объекта
};

const createMockSceneContext = (
  initialSession: Partial<ScraperSceneSessionData> = {}
): SceneTestContext => {
  const botInfo: UserFromGetMe = {
    id: 12345,
    is_bot: true,
    first_name: "TestBot",
    username: "TestBot",
    can_join_groups: true,
    can_read_all_group_messages: true,
    supports_inline_queries: true,
  };

  // Создаем базовый контекст Telegraf
  // Мы не передаем реальный update объект в Context конструктор здесь,
  // так как он будет специфичен для каждого теста (message, callback_query)
  const ctx = new Context(
    { update_id: 1 } as Update,
    {} as any,
    botInfo
  ) as SceneTestContext;

  // Мокируем специфичные для сцены методы и свойства
  ctx.scene = {
    enter: jest.fn(),
    leave: jest.fn(),
    reenter: jest.fn(),
    session: { ...initialSession } as ScraperSceneSessionData,
    current: hashtagScene as any, // Предполагаем, что hashtagScene - это объект сцены
  };
  ctx.reply = jest.fn().mockResolvedValue(true);
  ctx.editMessageReplyMarkup = jest.fn().mockResolvedValue(true);
  ctx.deleteMessage = jest.fn().mockResolvedValue(true);
  ctx.answerCbQuery = jest.fn().mockResolvedValue(true);

  const adapterInstance = new NeonAdapter();
  ctx.storage = adapterInstance;
  mockNeonAdapterInstance = adapterInstance as NeonAdapter & {
    [K in keyof NeonAdapter]: jest.Mock;
  };

  return ctx;
};

describe("hashtagScene", () => {
  let ctx: SceneTestContext;
  const mockProjectId = 123;
  const mockProject: Partial<Project> = {
    id: mockProjectId,
    name: "Test Project",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // ctx будет создаваться в каждом describe блоке или тесте по необходимости
  });

  describe("enter handler", () => {
    it("should reply with no hashtags message if projectId is not in session", async () => {
      ctx = createMockSceneContext(); // Без projectId в сессии
      await hashtagScene.enter(ctx, jest.fn());
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("проект не определен")
      );
      expect(ctx.scene.leave).toHaveBeenCalled();
      expect(mockNeonAdapterInstance.initialize).not.toHaveBeenCalled();
    });

    it("should display hashtags if found for the project", async () => {
      ctx = createMockSceneContext({ projectId: mockProjectId });
      const mockHashtags: Hashtag[] = [
        {
          id: 1,
          project_id: mockProjectId,
          hashtag: "tag1",
          created_at: new Date(),
        },
        {
          id: 2,
          project_id: mockProjectId,
          hashtag: "tag2",
          created_at: new Date(),
        },
      ];
      mockNeonAdapterInstance.getProjectById.mockResolvedValue(
        mockProject as Project
      );
      mockNeonAdapterInstance.getHashtagsByProjectId.mockResolvedValue(
        mockHashtags
      );

      await hashtagScene.enter(ctx, jest.fn());

      expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
      expect(
        mockNeonAdapterInstance.getHashtagsByProjectId
      ).toHaveBeenCalledWith(mockProjectId);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining(`Хештеги в проекте "${mockProject.name}"`),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              [
                expect.objectContaining({
                  text: "🗑️ Удалить #tag1",
                  callback_data: `delete_hashtag_${mockProjectId}_tag1`,
                }),
              ],
              [
                expect.objectContaining({
                  text: "🗑️ Удалить #tag2",
                  callback_data: `delete_hashtag_${mockProjectId}_tag2`,
                }),
              ],
              [
                expect.objectContaining({
                  text: "Добавить хештег",
                  callback_data: `add_hashtag_${mockProjectId}`,
                }),
              ],
              [
                expect.objectContaining({
                  text: "Назад к проекту",
                  callback_data: `project_${mockProjectId}`,
                }),
              ],
            ]),
          }),
        })
      );
      expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
    });

    it("should display 'no hashtags' message and add/back buttons if no hashtags found", async () => {
      ctx = createMockSceneContext({ projectId: mockProjectId });
      mockNeonAdapterInstance.getProjectById.mockResolvedValue(
        mockProject as Project
      );
      mockNeonAdapterInstance.getHashtagsByProjectId.mockResolvedValue([]); // Пустой массив

      await hashtagScene.enter(ctx, jest.fn());

      expect(mockNeonAdapterInstance.initialize).toHaveBeenCalledTimes(1);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining(
          `нет отслеживаемых хештегов. Хотите добавить первый?`
        ),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: [
              [
                expect.objectContaining({
                  text: "Добавить хештег",
                  callback_data: `add_hashtag_${mockProjectId}`,
                }),
              ],
              [
                expect.objectContaining({
                  text: "Назад к проекту",
                  callback_data: `project_${mockProjectId}`,
                }),
              ],
            ],
          }),
        })
      );
      expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
    });

    it("should handle error if getHashtagsByProjectId fails", async () => {
      ctx = createMockSceneContext({ projectId: mockProjectId });
      const dbError = new Error("DB Error on getHashtags");
      mockNeonAdapterInstance.getProjectById.mockResolvedValue(
        mockProject as Project
      );
      mockNeonAdapterInstance.getHashtagsByProjectId.mockRejectedValue(dbError);
      const consoleErrorSpy = spyOn(console, "error").mockImplementation(
        () => {}
      );

      await hashtagScene.enter(ctx, jest.fn());

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Не удалось загрузить список хештегов")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Ошибка при получении хештегов"),
        dbError
      );
      expect(mockNeonAdapterInstance.close).toHaveBeenCalledTimes(1);
      consoleErrorSpy.mockRestore();
    });
  });

  // TODO: Тесты для action(/add_hashtag_(\d+)/)
  // TODO: Тесты для on('text') - обработка ввода хештега
  // TODO: Тесты для action(/delete_hashtag_(\d+)_(.+)/)
  // TODO: Тесты для action(/project_(\d+)/) - назад к проекту
  // TODO: Тесты для action(/cancel_hashtag_input_(\d+)/)
});
