import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
  mock,
  spyOn,
  vi,
} from "bun:test";
import { Context, Scenes } from "telegraf";
import {
  Update,
  UserFromGetMe,
  CallbackQuery,
  Message,
  Chat,
  User,
  SceneContextScene,
} from "telegraf/types";
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
import {
  handleHashtagEnter,
  handleAddHashtagAction,
  handleCancelHashtagInputAction,
  handleHashtagTextInput,
  handleDeleteHashtagAction,
  handleBackToProjectAction,
} from "../../../scenes/hashtag-scene";

// Сохраним тип для удобства приведения в тестах
type MockedNeonAdapterType = NeonAdapter & {
  [K in keyof NeonAdapter]: jest.Mock;
  getProjectById: jest.Mock;
  getHashtagsByProjectId: jest.Mock;
  addHashtag: jest.Mock;
  removeHashtag: jest.Mock;
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
  initialSession: Partial<ScraperSceneSessionData> = {},
  // Добавляем необязательный параметр для переопределения update
  updateOverride: Partial<Update.CallbackQueryUpdate | Update.MessageUpdate> = {
    update_id: 1,
  } // По умолчанию пустой update_id
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

  // Создаем контекст Telegraf, передавая ему updateOverride
  // Telegraf ожидает полный объект Update, поэтому мы его передаем.
  // Если updateOverride содержит message, то это Update.MessageUpdate.
  // Если callback_query, то Update.CallbackQueryUpdate.
  let currentUpdate: Update;
  if ((updateOverride as Update.MessageUpdate).message) {
    currentUpdate = updateOverride as Update.MessageUpdate;
  } else if ((updateOverride as Update.CallbackQueryUpdate).callback_query) {
    currentUpdate = updateOverride as Update.CallbackQueryUpdate;
  } else {
    currentUpdate = { update_id: 1 }; // Базовый, если ничего не передано
  }

  const ctx = new Context(
    currentUpdate, // Передаем полный и правильный объект update
    {} as any, // api
    botInfo
  ) as SceneTestContext;

  ctx.scene = {
    enter: jest.fn(),
    leave: jest.fn(),
    reenter: jest.fn(),
    session: { ...initialSession } as ScraperSceneSessionData,
  };
  ctx.reply = jest.fn().mockResolvedValue(true);
  ctx.editMessageReplyMarkup = jest.fn().mockResolvedValue(true);
  ctx.deleteMessage = jest.fn().mockResolvedValue(true);
  ctx.answerCbQuery = jest.fn().mockResolvedValue(true);

  const adapterInstance = new NeonAdapter();
  ctx.storage = adapterInstance;

  return ctx;
};

describe("hashtagScene", () => {
  let ctx: SceneTestContext;
  const mockProjectId = 123;
  const mockProject: Partial<Project> = {
    id: mockProjectId,
    name: "Test Project",
  };
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});

    mock.module("../../../adapters/neon-adapter", () => {
      return {
        NeonAdapter: jest.fn().mockImplementation(() => ({
          initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
          close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
          getUserByTelegramId: jest.fn<(telegramId: number) => Promise<User | null>>(),
          getProjectById: jest.fn<(projectId: number) => Promise<Project | null>>(),
          getProjectsByUserId: jest.fn<(userId: number) => Promise<Project[] | null>>(),
          createProject: jest.fn<(userId: number, name: string) => Promise<Project | null>>(),
          getHashtagsByProjectId: jest.fn<(projectId: number) => Promise<Hashtag[] | null>>(),
          addHashtag: jest.fn<(projectId: number, hashtag: string) => Promise<Hashtag | null>>(),
          removeHashtag: jest.fn<(projectId: number, hashtag: string) => Promise<void>>(),
        })),
      };
    });
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  });

  describe("enter handler", () => {
    it("should reply with no hashtags message if projectId is not in session", async () => {
      ctx = createMockSceneContext();
      await handleHashtagEnter(ctx as any);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("проект не определен")
      );
      expect(ctx.scene.leave).toHaveBeenCalled();
      expect(
        (ctx.storage as MockedNeonAdapterType).initialize
      ).not.toHaveBeenCalled();
    });

    it("should display hashtags if found for the project", async () => {
      ctx = createMockSceneContext({ projectId: mockProjectId });
      const currentMockAdapter = ctx.storage as MockedNeonAdapterType;
      
      const mockHashtags: Hashtag[] = [
        { id: 1, project_id: mockProjectId, hashtag: "cool", created_at: new Date().toISOString() },
        { id: 2, project_id: mockProjectId, hashtag: "awesome", created_at: new Date().toISOString() },
      ];

      // Явно устанавливаем моки ТОЛЬКО для этого теста
      currentMockAdapter.initialize.mockResolvedValue(undefined);
      currentMockAdapter.getProjectById.mockResolvedValue(mockProject as Project);
      currentMockAdapter.getHashtagsByProjectId.mockResolvedValue(mockHashtags);
      currentMockAdapter.close.mockResolvedValue(undefined);

      await handleHashtagEnter(ctx as any);

      expect(currentMockAdapter.initialize).toHaveBeenCalledTimes(1);
      expect(currentMockAdapter.getProjectById).toHaveBeenCalledWith(mockProjectId);
      expect(currentMockAdapter.getHashtagsByProjectId).toHaveBeenCalledWith(mockProjectId);

      // Удаляем логирование
      const expectedText = `Хештеги в проекте "${mockProject.name}":\n\n1. #cool\n2. #awesome\n\nЧто вы хотите сделать дальше?`;
      // const expectedKeyboard = expect.objectContaining({ // ... }); // Это было для лога, теперь не нужно
      
      expect(ctx.reply).toHaveBeenCalledWith(expectedText, expect.anything());
      expect(currentMockAdapter.close).toHaveBeenCalledTimes(1);
    });

    it("should display 'no hashtags' message and add/back buttons if no hashtags found", async () => {
      ctx = createMockSceneContext({ projectId: mockProjectId });
      const currentMockAdapter = ctx.storage as MockedNeonAdapterType;

      // ЯВНАЯ УСТАНОВКА МОКОВ ДЛЯ ТЕСТА:
      currentMockAdapter.initialize.mockResolvedValue(undefined);
      currentMockAdapter.getProjectById.mockResolvedValue(mockProject as Project);
      currentMockAdapter.getHashtagsByProjectId.mockResolvedValue([]); // <--- Ключевой момент: пустой массив
      currentMockAdapter.close.mockResolvedValue(undefined);

      await handleHashtagEnter(ctx as any);

      expect(currentMockAdapter.initialize).toHaveBeenCalledTimes(1);
      expect(currentMockAdapter.getProjectById).toHaveBeenCalledWith(mockProjectId);
      expect(currentMockAdapter.getHashtagsByProjectId).toHaveBeenCalledWith(mockProjectId);
      expect(ctx.reply).toHaveBeenCalledWith(
        `В проекте "${mockProject.name}" нет отслеживаемых хештегов. Хотите добавить первый?`,
        expect.anything()
      );
      expect(currentMockAdapter.close).toHaveBeenCalledTimes(1);
    });

    it("should handle error if getHashtagsByProjectId fails", async () => {
      ctx = createMockSceneContext({ projectId: mockProjectId });
      const currentMockAdapter = ctx.storage as MockedNeonAdapterType;
      const error = new Error("DB error");
      currentMockAdapter.getProjectById.mockResolvedValue(
        mockProject as Project
      );
      currentMockAdapter.getHashtagsByProjectId.mockRejectedValue(error);

      await handleHashtagEnter(ctx as any);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Ошибка при получении хештегов для проекта ${mockProjectId}:`,
        error
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        "Не удалось загрузить список хештегов. Попробуйте позже."
      );
      expect(currentMockAdapter.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("handleAddHashtagAction", () => {
    const mockProjectId = 123;

    it("should set step to ADD_HASHTAG, save projectId, and prompt for input", async () => {
      ctx = createMockSceneContext(
        { projectId: undefined }, 
        { callback_query: { data: `add_hashtag_${mockProjectId}` } } 
      );
      ctx.match = [`add_hashtag_${mockProjectId}`, mockProjectId.toString()] as RegExpExecArray;
      const currentMockAdapter = ctx.storage as MockedNeonAdapterType;

      // ЯВНАЯ УСТАНОВКА МОКОВ ДЛЯ ТЕСТА (хотя этот обработчик не должен вызывать адаптер):
      // Просто для гарантии, что никакие предыдущие моки не влияют.
      currentMockAdapter.initialize.mockImplementation(() => { throw new Error("initialize should not be called"); });
      currentMockAdapter.close.mockImplementation(() => { throw new Error("close should not be called"); });
      currentMockAdapter.getHashtagsByProjectId.mockImplementation(() => { throw new Error("getHashtagsByProjectId should not be called"); });
      // ... и так далее для других методов, если есть опасения

      await handleAddHashtagAction(ctx as any);

      expect(ctx.scene.session.projectId).toBe(mockProjectId);
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.ADD_HASHTAG);
      expect(ctx.reply).toHaveBeenCalledWith(
        "Введите хештег для добавления (без #):",
        expect.anything()
      );
      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    });

    it("should handle invalid projectId (NaN) from match in add_hashtag action", async () => {
      const invalidProjectIdStr = "invalidAsNaN";
      ctx = createMockSceneContext(
        { projectId: undefined },
        { callback_query: { data: `add_hashtag_${invalidProjectIdStr}` } }
      );
      ctx.match = [
        `add_hashtag_${invalidProjectIdStr}`,
        invalidProjectIdStr,
      ] as RegExpExecArray;

      await handleAddHashtagAction(ctx as any);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Invalid projectId parsed from add_hashtag action: ${invalidProjectIdStr}`
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        "Ошибка выбора проекта. Пожалуйста, вернитесь назад."
      );
      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
      expect(ctx.scene.session.projectId).toBeUndefined();
      expect(ctx.scene.session.step).toBeUndefined();
    });
  });

  describe("handleCancelHashtagInputAction", () => {
    const mockProjectId = 123;

    it("should delete message, reset step, answer callback, and reenter scene", async () => {
      const update: Update.CallbackQueryUpdate = {
        update_id: 4,
        callback_query: {
          id: "cb1",
          from: { id: 1, is_bot: false, first_name: "Test" },
          chat_instance: "chat1",
          data: `cancel_hashtag_input_${mockProjectId}`,
        } as CallbackQuery.DataQuery,
      };
      ctx = createMockSceneContext(
        { projectId: mockProjectId, step: ScraperSceneStep.ADD_HASHTAG },
        update
      );

      await handleCancelHashtagInputAction(ctx as any);

      expect(ctx.deleteMessage).toHaveBeenCalledTimes(1);
      expect(ctx.scene.session.step).toBeUndefined();
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ввод отменен.");
      expect(ctx.scene.reenter).toHaveBeenCalledTimes(1);
    });
  });

  describe("handleHashtagTextInput", () => {
    const mockProjectId = 123;
    const validHashtagInput = "newtag";
    // Определим базовый объект сообщения для переиспользования
    const baseMessage: Message.TextMessage = {
      message_id: 100,
      chat: {
        id: 123,
        type: "private",
        first_name: "Test",
      } as Chat.PrivateChat,
      from: { id: 1, is_bot: false, first_name: "Test" } as User,
      date: Math.floor(Date.now() / 1000),
      text: "", // Добавляем text
      // edit_date: undefined, // Убедимся, что edit_date нет или undefined
    };

    it("should ignore input if step is not ADD_HASHTAG", async () => {
      // Создаем update с нужным сообщением
      const update: Update.MessageUpdate = {
        update_id: 5,
        message: {
          ...baseMessage,
          text: validHashtagInput,
        } as Message.TextMessage,
      };
      ctx = createMockSceneContext(
        { projectId: mockProjectId, step: undefined }, // Не ожидаем ввод
        update // Передаем update
      );

      await handleHashtagTextInput(ctx as any);
      expect(
        (ctx.storage as MockedNeonAdapterType).initialize
      ).not.toHaveBeenCalled();
      expect(ctx.reply).not.toHaveBeenCalled();
    });

    it("should leave scene if projectId is not in session", async () => {
      const update: Update.MessageUpdate = {
        update_id: 6,
        message: {
          ...baseMessage,
          text: validHashtagInput,
        } as Message.TextMessage,
      };
      ctx = createMockSceneContext(
        { projectId: undefined, step: ScraperSceneStep.ADD_HASHTAG }, // projectId отсутствует
        update
      );

      await handleHashtagTextInput(ctx as any);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("проект не определен")
      );
      expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
      expect(ctx.scene.session.step).toBeUndefined();
    });

    it("should correctly process valid hashtag input (without #)", async () => {
      const update: Update.MessageUpdate = {
        update_id: 7,
        message: {
          ...baseMessage,
          text: validHashtagInput,
        } as Message.TextMessage,
      };
      ctx = createMockSceneContext(
        { projectId: mockProjectId, step: ScraperSceneStep.ADD_HASHTAG },
        update
      );
      (
        ctx.storage as MockedNeonAdapterType
      ).addHashtag.mockResolvedValue({
        id: 99,
        project_id: mockProjectId,
        hashtag: validHashtagInput,
        created_at: new Date(),
      });

      await handleHashtagTextInput(ctx as any);

      expect(
        (ctx.storage as MockedNeonAdapterType).initialize
      ).toHaveBeenCalledTimes(1);
      expect(
        (ctx.storage as MockedNeonAdapterType).addHashtag
      ).toHaveBeenCalledWith(mockProjectId, validHashtagInput);
      expect(ctx.reply).toHaveBeenCalledWith(
        `Хештег #${validHashtagInput} успешно добавлен.`
      );
      expect(
        (ctx.storage as MockedNeonAdapterType).close
      ).toHaveBeenCalledTimes(1);
      expect(ctx.scene.session.step).toBeUndefined();
      expect(ctx.scene.reenter).toHaveBeenCalledTimes(1);
    });

    it("should correctly process valid hashtag input (with #)", async () => {
      const inputWithHash = "#newtag";
      const update: Update.MessageUpdate = {
        update_id: 8,
        message: { ...baseMessage, text: inputWithHash } as Message.TextMessage,
      };
      ctx = createMockSceneContext(
        { projectId: mockProjectId, step: ScraperSceneStep.ADD_HASHTAG },
        update
      );
      (
        ctx.storage as MockedNeonAdapterType
      ).addHashtag.mockResolvedValue({
        id: 99,
        project_id: mockProjectId,
        hashtag: validHashtagInput,
        created_at: new Date(),
      });

      await handleHashtagTextInput(ctx as any);

      expect(
        (ctx.storage as MockedNeonAdapterType).addHashtag
      ).toHaveBeenCalledWith(mockProjectId, validHashtagInput);
      expect(ctx.reply).toHaveBeenCalledWith(
        `Хештег #${validHashtagInput} успешно добавлен.`
      );
      expect(ctx.scene.reenter).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["", "пустая строка"],
      ["  ", "пробелы"],
      ["a", "слишком короткий"],
      ["tag with space", "с пробелом"],
    ])(
      "should reply with validation error for invalid input: %s (%s)",
      async (invalidInput) => {
        const update: Update.MessageUpdate = {
          update_id: 9,
          message: {
            ...baseMessage,
            text: invalidInput,
          } as Message.TextMessage,
        };
        ctx = createMockSceneContext(
          { projectId: mockProjectId, step: ScraperSceneStep.ADD_HASHTAG },
          update
        );

        await handleHashtagTextInput(ctx as any);

        expect(ctx.reply).toHaveBeenCalledWith(
          expect.stringContaining("Некорректный хештег")
        );
        expect(
          (ctx.storage as MockedNeonAdapterType).initialize
        ).not.toHaveBeenCalled();
        expect(ctx.scene.reenter).not.toHaveBeenCalled();
        expect(ctx.scene.session.step).toBe(ScraperSceneStep.ADD_HASHTAG);
      }
    );

    it("should handle case where addHashtag returns null/false", async () => {
      const update: Update.MessageUpdate = {
        update_id: 10,
        message: {
          ...baseMessage,
          text: validHashtagInput,
        } as Message.TextMessage,
      };
      ctx = createMockSceneContext(
        { projectId: mockProjectId, step: ScraperSceneStep.ADD_HASHTAG },
        update
      );
      (
        ctx.storage as MockedNeonAdapterType
      ).addHashtag.mockResolvedValue(null);

      await handleHashtagTextInput(ctx as any);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Не удалось добавить хештег")
      );
      expect(
        (ctx.storage as MockedNeonAdapterType).close
      ).toHaveBeenCalledTimes(1);
      expect(ctx.scene.session.step).toBeUndefined();
      expect(ctx.scene.reenter).toHaveBeenCalledTimes(1);
    });

    it("should handle database error during addHashtag", async () => {
      const update: Update.MessageUpdate = {
        update_id: 11,
        message: {
          ...baseMessage,
          text: validHashtagInput,
        } as Message.TextMessage,
      };
      ctx = createMockSceneContext(
        { projectId: mockProjectId, step: ScraperSceneStep.ADD_HASHTAG },
        update
      );
      const dbError = new Error("DB Add Error");
      (
        ctx.storage as MockedNeonAdapterType
      ).addHashtag.mockRejectedValue(dbError);
      const consoleErrorSpy = spyOn(console, "error").mockImplementation(
        () => {}
      );

      await handleHashtagTextInput(ctx as any);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Произошла техническая ошибка")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Ошибка при добавлении хештега"),
        dbError
      );
      expect(
        (ctx.storage as MockedNeonAdapterType).close
      ).toHaveBeenCalledTimes(1);
      expect(ctx.scene.session.step).toBeUndefined();
      expect(ctx.scene.reenter).toHaveBeenCalledTimes(1);
      consoleErrorSpy.mockRestore();
    });
  });

  describe("handleDeleteHashtagAction", () => {
    const mockProjectId = 123;
    const mockHashtagToDelete = "tagToDelete";
    // Определяем update для callback_query, переиспользуем в тестах
    const update: Update.CallbackQueryUpdate = {
      update_id: 12, // Начнем с 12, можно менять для других тестов если нужно
      callback_query: {
        id: "cb1",
        from: { id: 1, is_bot: false, first_name: "Test" },
        chat_instance: "chat1",
        data: `delete_hashtag_${mockProjectId}_${mockHashtagToDelete}`,
      } as CallbackQuery.DataQuery,
    };

    it("should call removeHashtag and reenter scene on successful deletion", async () => {
      ctx = createMockSceneContext({ projectId: mockProjectId }, update);
      ctx.match = [
        `delete_hashtag_${mockProjectId}_${mockHashtagToDelete}`,
        mockProjectId.toString(),
        mockHashtagToDelete,
      ] as unknown as RegExpExecArray;
      (
        ctx.storage as MockedNeonAdapterType
      ).removeHashtag.mockResolvedValue(undefined);

      await handleDeleteHashtagAction(ctx as any);

      expect(
        (ctx.storage as MockedNeonAdapterType).initialize
      ).toHaveBeenCalledTimes(1);
      expect(
        (ctx.storage as MockedNeonAdapterType).removeHashtag
      ).toHaveBeenCalledWith(mockProjectId, mockHashtagToDelete);
      expect(ctx.reply).toHaveBeenCalledWith(
        `Хештег #${mockHashtagToDelete} удален.`
      );
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Удалено");
      expect(
        (ctx.storage as MockedNeonAdapterType).close
      ).toHaveBeenCalledTimes(1);
      expect(ctx.scene.reenter).toHaveBeenCalledTimes(1);
    });

    it("should handle invalid projectId or hashtag from match", async () => {
      const invalidUpdate: Update.CallbackQueryUpdate = {
        update_id: 13,
        // Создаем копию callback_query и меняем data
        callback_query: {
          ...update.callback_query,
          data: `delete_hashtag_invalid_`,
        } as CallbackQuery.DataQuery,
      };
      ctx = createMockSceneContext({}, invalidUpdate);
      ctx.match = [`delete_hashtag_invalid_`, "invalid", undefined] as any;
      const consoleErrorSpy = spyOn(console, "error").mockImplementation(
        () => {}
      );

      await handleDeleteHashtagAction(ctx as any);

      expect(ctx.reply).toHaveBeenCalledWith("Ошибка при удалении хештега.");
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка");
      expect(
        (ctx.storage as MockedNeonAdapterType).initialize
      ).not.toHaveBeenCalled(); // Исправлено: не должно быть вызвано
      expect(
        (ctx.storage as MockedNeonAdapterType).removeHashtag
      ).not.toHaveBeenCalled();
      expect(ctx.scene.reenter).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Invalid data parsed from delete hashtag action"
        )
      );
      consoleErrorSpy.mockRestore();
    });

    it("should handle database error during removeHashtag", async () => {
      // Используем тот же update, что и в успешном сценарии, так как данные валидны
      ctx = createMockSceneContext({ projectId: mockProjectId }, update);
      ctx.match = [
        `delete_hashtag_${mockProjectId}_${mockHashtagToDelete}`,
        mockProjectId.toString(),
        mockHashtagToDelete,
      ] as unknown as RegExpExecArray;
      const dbError = new Error("DB Delete Error");
      (
        ctx.storage as MockedNeonAdapterType
      ).removeHashtag.mockRejectedValue(dbError);
      const consoleErrorSpy = spyOn(console, "error").mockImplementation(
        () => {}
      );

      await handleDeleteHashtagAction(ctx as any);

      expect(ctx.reply).toHaveBeenCalledWith(
        "Произошла ошибка при удалении хештега."
      );
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Ошибка при удалении хештега"),
        dbError
      );
      expect(
        (ctx.storage as MockedNeonAdapterType).close
      ).toHaveBeenCalledTimes(1);
      expect(ctx.scene.reenter).toHaveBeenCalledTimes(1);
      consoleErrorSpy.mockRestore();
    });
  });

  describe("handleBackToProjectAction", () => {
    const mockProjectId = 123;
    // Определяем update для callback_query
    const update: Update.CallbackQueryUpdate = {
      update_id: 15,
      callback_query: {
        id: "cb1",
        from: { id: 1, is_bot: false, first_name: "Test" },
        chat_instance: "chat1",
        data: `project_${mockProjectId}`,
      } as CallbackQuery.DataQuery,
    };

    it("should leave the scene and reply with a message", async () => {
      ctx = createMockSceneContext({}, update); // Передаем update
      // ctx.match здесь не обязателен, так как он не используется в handleBackToProjectAction
      // Но установим для полноты, если вдруг понадобится в будущем
      ctx.match = [
        `project_${mockProjectId}`,
        mockProjectId.toString(),
      ] as unknown as RegExpExecArray;

      await handleBackToProjectAction(ctx as any);

      expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
      expect(ctx.reply).toHaveBeenCalledWith(
        "Возврат к управлению проектом..."
      );
      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    });
  });
});
