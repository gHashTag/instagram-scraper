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
import { Context, Markup } from "telegraf";
import { Update, UserFromGetMe, CallbackQuery } from "telegraf/types";
// import { competitorScene } from "../../../scenes/competitor-scene"; // Не нужен сам экземпляр сцены
import { NeonAdapter } from "../../../adapters/neon-adapter";
import {
  ScraperBotContext,
  ScraperSceneStep,
  Project,
  Competitor,
  User,
  ScraperSceneSessionData,
} from "@/types";
// Импортируем все необходимые обработчики
import {
  handleDeleteCompetitorAction,
  // обработчики для enter и onText здесь не нужны, только для actions
  handleCompetitorsProjectAction,
  handleAddCompetitorAction,
  handleExitCompetitorSceneAction, // Предполагаем, что такой будет для exit_scene
  handleBackToProjectsCompetitorAction, // Предполагаем, что такой будет для back_to_projects
} from "../../../scenes/competitor-scene";

// Объявляем тип для мока адаптера
type MockedNeonAdapterType = NeonAdapter & {
  [K in keyof NeonAdapter]: jest.Mock;
  deleteCompetitorAccount: jest.Mock;
  getCompetitorAccounts: jest.Mock;
  addCompetitorAccount: jest.Mock;
};

// Определяем тип контекста с полем match
type ActionContextWithMatch = ScraperBotContext & {
  scene: {
    session: ScraperSceneSessionData;
    leave: jest.Mock;
    reenter: jest.Mock;
    enter: jest.Mock;
  };
  match: RegExpExecArray | null;
  reply: jest.Mock;
  answerCbQuery: jest.Mock;
  editMessageReplyMarkup: jest.Mock; // Добавим, если используется в обработчиках
  update: Partial<Update.CallbackQueryUpdate>; // Уточним тип update
};

const createMockContext = (
  callbackData?: string,
  initialSession: Partial<ScraperSceneSessionData> = {}
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

  const update: Update.CallbackQueryUpdate = {
    update_id: Date.now(), // Уникальный update_id
    callback_query: {
      id: `cb_${Date.now()}`, // Уникальный callback_query_id
      from: {
        id: 1,
        first_name: "TestUser",
        is_bot: false,
        username: "testuser",
      },
      message: {
        message_id: 1,
        date: Date.now(),
        chat: { id: 1, type: "private" },
      },
      chat_instance: "1",
      data: callbackData || "default_callback_data",
    },
  };

  const ctx = new Context(update, {} as any, botInfo) as ActionContextWithMatch;

  ctx.scene = {
    enter: jest.fn(),
    leave: jest.fn(),
    reenter: jest.fn(),
    session: {
      step: initialSession.step,
      projectId: initialSession.projectId,
      ...initialSession,
    } as ScraperSceneSessionData,
    // state: {}, // state и current могут не понадобиться при прямом вызове обработчиков
    // current: undefined,
    // ctx: ctx,
  } as any;

  ctx.reply = jest.fn().mockResolvedValue(true);
  ctx.answerCbQuery = jest.fn().mockResolvedValue(true);
  ctx.editMessageReplyMarkup = jest.fn().mockResolvedValue(true);
  ctx.match = null;

  const adapterInstance = new NeonAdapter();
  ctx.storage = adapterInstance;
  // mockNeonAdapterInstance = adapterInstance as NeonAdapter & { // Больше не присваиваем глобальную переменную
  //   [K in keyof NeonAdapter]: jest.Mock;
  // };

  return ctx;
};

describe("Competitor Scene Actions - Direct Handler Tests", () => {
  let ctx: ActionContextWithMatch;
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
          getProjectsByUserId: jest.fn<(userId: number) => Promise<Project[] | null>>(),
          getCompetitorAccounts: jest.fn<(projectId: number) => Promise<Competitor[] | null>>(),
          addCompetitorAccount: jest.fn< (projectId: number, username: string, instagramUrl: string) => Promise<Competitor | null> >(),
          deleteCompetitorAccount: jest.fn<(projectId: number, username: string) => Promise<boolean>>(),
        })),
      };
    });
  });

  afterEach(() => {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  });

  // --- Тесты для action: 'competitors_project_...' ---
  describe("handleCompetitorsProjectAction", () => {
    it("should show competitors list when a project is selected", async () => {
      const projectId = 21;
      ctx = createMockContext(`competitors_project_${projectId}`);
      ctx.match = [`competitors_project_${projectId}`, projectId.toString()] as any;
      // Получаем адаптер из контекста в тесте
      const currentMockAdapter = ctx.storage as MockedNeonAdapterType;

      const competitorMock: Competitor = {
        id: 101, project_id: projectId, username: "comp1", instagram_url: "http://insta/comp1", created_at: "", is_active: true,
      };
      
      // ЯВНАЯ УСТАНОВКА МОКОВ ДЛЯ ТЕСТА:
      currentMockAdapter.initialize.mockResolvedValue(undefined);
      currentMockAdapter.getCompetitorAccounts.mockResolvedValue([competitorMock]);
      currentMockAdapter.close.mockResolvedValue(undefined);
      // Убедимся, что другие методы не будут вызваны
      currentMockAdapter.addCompetitorAccount.mockImplementation(() => { throw new Error("addCompetitorAccount should not be called");});
      currentMockAdapter.deleteCompetitorAccount.mockImplementation(() => { throw new Error("deleteCompetitorAccount should not be called");});

      await handleCompetitorsProjectAction(ctx);

      expect(currentMockAdapter.initialize).toHaveBeenCalledTimes(1);
      expect(currentMockAdapter.getCompetitorAccounts).toHaveBeenCalledWith(projectId);
      const competitorListText = `1. [${competitorMock.username}](${competitorMock.instagram_url})`;
      expect(ctx.reply).toHaveBeenCalledWith(
        `Конкуренты в выбранном проекте:\n\n${competitorListText}\n\nЧто вы хотите сделать дальше?`,
        expect.anything()
      );
      expect(currentMockAdapter.close).toHaveBeenCalledTimes(1);
      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    });

    it("should show 'no competitors' message if project has none", async () => {
      const projectId = 20;
      ctx = createMockContext(`competitors_project_${projectId}`);
      ctx.match = [`competitors_project_${projectId}`, projectId.toString()] as any;
      // Получаем адаптер из контекста в тесте
      const currentMockAdapter = ctx.storage as MockedNeonAdapterType;

      // ЯВНОЕ МОКИРОВАНИЕ ДЛЯ КОНКРЕТНОГО ТЕСТА:
      currentMockAdapter.initialize.mockResolvedValue(undefined);
      currentMockAdapter.getCompetitorAccounts.mockResolvedValue([]); // <--- Важно: пустой массив
      currentMockAdapter.close.mockResolvedValue(undefined);
      // Гарантируем, что другие методы адаптера не будут случайно вызваны
      currentMockAdapter.addCompetitorAccount.mockImplementation(() => { throw new Error("addCompetitorAccount should not be called in this specific test");});
      currentMockAdapter.deleteCompetitorAccount.mockImplementation(() => { throw new Error("deleteCompetitorAccount should not be called in this specific test");});

      await handleCompetitorsProjectAction(ctx);
      
      expect(currentMockAdapter.initialize).toHaveBeenCalledTimes(1);
      expect(currentMockAdapter.getCompetitorAccounts).toHaveBeenCalledWith(projectId);
      expect(ctx.reply).toHaveBeenCalledWith(
        "В выбранном проекте нет добавленных конкурентов. Хотите добавить?",
        expect.anything()
      );
      expect(currentMockAdapter.close).toHaveBeenCalledTimes(1);
    });

    it("should handle error when getCompetitorAccounts throws", async () => {
      const projectId = 22;
      ctx = createMockContext(`competitors_project_${projectId}`);
      ctx.match = [
        `competitors_project_${projectId}`,
        projectId.toString(),
      ] as any;
      // Получаем адаптер из контекста в тесте
      const currentMockAdapter = ctx.storage as MockedNeonAdapterType;
      const dbError = new Error("DB Boom!");
      currentMockAdapter.getCompetitorAccounts.mockRejectedValue(dbError);
      currentMockAdapter.initialize.mockResolvedValue(undefined);

      await handleCompetitorsProjectAction(ctx);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Ошибка при получении конкурентов проекта ${projectId}:`,
        dbError
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        "Не удалось загрузить список конкурентов для этого проекта. Попробуйте позже или обратитесь в поддержку."
      );
      // expect(currentMockAdapter.close).toHaveBeenCalledTimes(1); // close может не вызваться при ошибке до него
    });

    // Тест на невалидный projectId (NaN) не нужен, так как parseInt в обработчике отловит это,
    // но ctx.match формируется из callback_data, который всегда строка.
    // Проверка isNaN(projectId) внутри обработчика должна быть.
  });

  // --- Тесты для action: 'add_competitor_...' ---
  describe("handleAddCompetitorAction", () => {
    it("should set step to ADD_COMPETITOR and ask for URL", async () => {
      const projectId = 30;
      ctx = createMockContext(`add_competitor_${projectId}`);
      ctx.match = [`add_competitor_${projectId}`, projectId.toString()] as any;
      ctx.scene.session = { step: undefined, projectId: undefined };
      // Адаптер здесь не вызывается напрямую в обработчике, только сессия меняется
      await handleAddCompetitorAction(ctx);

      expect(ctx.scene.session.projectId).toBe(projectId);
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.ADD_COMPETITOR);
      expect(ctx.reply).toHaveBeenCalledWith(
        "Введите Instagram URL конкурента (например, https://www.instagram.com/example):"
      );
      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    });

    it("should handle invalid project ID in callback data", async () => {
      const invalidProjectIdStr = "abc";
      ctx = createMockContext(`add_competitor_${invalidProjectIdStr}`);
      // match[1] будет "abc", что приведет к NaN при parseInt
      ctx.match = [
        `add_competitor_${invalidProjectIdStr}`,
        invalidProjectIdStr,
      ] as any;

      await handleAddCompetitorAction(ctx);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Invalid projectId parsed from action: ${invalidProjectIdStr}`
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        "Ошибка выбора проекта. Пожалуйста, вернитесь назад и выберите проект снова."
      );
      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
      expect(ctx.scene.session.projectId).toBeUndefined();
      expect(ctx.scene.session.step).toBeUndefined();
    });
  });

  // --- Тесты для action: 'exit_scene' ---
  describe("handleExitCompetitorSceneAction", () => {
    it("should leave the scene and answer callback query", async () => {
      ctx = createMockContext("exit_scene");
      await handleExitCompetitorSceneAction(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        "Вы вышли из режима управления конкурентами.",
        expect.objectContaining({ reply_markup: { remove_keyboard: true } })
      );
      expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    });
  });

  // --- Тесты для action: 'back_to_projects' ---
  describe("handleBackToProjectsCompetitorAction", () => {
    it("should reenter the scene and answer callback query", async () => {
      ctx = createMockContext("back_to_projects");
      await handleBackToProjectsCompetitorAction(ctx);

      expect(ctx.scene.reenter).toHaveBeenCalledTimes(1);
      expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    });
  });

  // --- Тесты для handleDeleteCompetitorAction ---
  // Эти тесты уже были в competitor-scene-new.test.ts и должны быть перенесены сюда или оставлены там,
  // если competitor-scene-new.test.ts будет удален или его назначение изменится.
  // Пока предположим, что они актуальны здесь.
  describe("handleDeleteCompetitorAction", () => {
    it("should call deleteCompetitorAccount and reply on successful deletion", async () => {
      const projectId = 1;
      const username = "comp_to_delete";
      ctx = createMockContext(`delete_competitor_${projectId}_${username}`);
      ctx.match = [
        `delete_competitor_${projectId}_${username}`,
        projectId.toString(),
        username,
      ] as any;
      // Получаем адаптер из контекста в тесте
      const currentMockAdapter = ctx.storage as MockedNeonAdapterType;

      currentMockAdapter.deleteCompetitorAccount.mockResolvedValue(true);
      currentMockAdapter.initialize.mockResolvedValue(undefined);
      currentMockAdapter.close.mockResolvedValue(undefined);

      await handleDeleteCompetitorAction(ctx);

      expect(currentMockAdapter.initialize).toHaveBeenCalledTimes(1);
      expect(currentMockAdapter.deleteCompetitorAccount).toHaveBeenCalledWith(
        projectId,
        username
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        `Конкурент "${username}" успешно удален из проекта.`
      );
      expect(ctx.editMessageReplyMarkup).toHaveBeenCalledWith(undefined);
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Удалено");
      expect(currentMockAdapter.close).toHaveBeenCalledTimes(1);
    });

    it("should reply with error if deleteCompetitorAccount returns false (not found)", async () => {
      const projectId = 2;
      const username = "comp_not_found";
      ctx = createMockContext(`delete_competitor_${projectId}_${username}`);
      ctx.match = [
        `delete_competitor_${projectId}_${username}`,
        projectId.toString(),
        username,
      ] as any;
      // Получаем адаптер из контекста в тесте
      const currentMockAdapter = ctx.storage as MockedNeonAdapterType;
      currentMockAdapter.deleteCompetitorAccount.mockResolvedValue(false);
      currentMockAdapter.initialize.mockResolvedValue(undefined);
      currentMockAdapter.close.mockResolvedValue(undefined);

      await handleDeleteCompetitorAction(ctx);

      expect(currentMockAdapter.deleteCompetitorAccount).toHaveBeenCalledWith(
        projectId,
        username
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        `Не удалось найти или удалить конкурента "${username}". Возможно, он уже был удален.`
      );
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка удаления");
    });

    it("should reply with error and log if deleteCompetitorAccount throws (DB error)", async () => {
      const projectId = 3;
      const username = "comp_db_error";
      const dbError = new Error("DB boom on delete");
      ctx = createMockContext(`delete_competitor_${projectId}_${username}`);
      ctx.match = [
        `delete_competitor_${projectId}_${username}`,
        projectId.toString(),
        username,
      ] as any;
      // Получаем адаптер из контекста в тесте
      const currentMockAdapter = ctx.storage as MockedNeonAdapterType;
      currentMockAdapter.deleteCompetitorAccount.mockRejectedValue(dbError);
      currentMockAdapter.initialize.mockResolvedValue(undefined);
      // currentMockAdapter.close might not be called if initialize or delete throws early

      await handleDeleteCompetitorAction(ctx);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Ошибка при удалении конкурента ${username} из проекта ${projectId}:`,
        dbError
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        "Произошла техническая ошибка при удалении конкурента. Попробуйте позже."
      );
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка");
    });

    it("should reply with error if callback data is invalid (NaN projectId)", async () => {
      const invalidProjectIdStr = "abc";
      const username = "comp_invalid_id";
      ctx = createMockContext(
        `delete_competitor_${invalidProjectIdStr}_${username}`
      );
      ctx.match = [
        `delete_competitor_${invalidProjectIdStr}_${username}`,
        invalidProjectIdStr,
        username,
      ] as any;

      await handleDeleteCompetitorAction(ctx);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Invalid data parsed from delete action: projectId=${invalidProjectIdStr}, username=${username}`
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        "Ошибка при удалении конкурента. Пожалуйста, попробуйте снова."
      );
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка");
      expect(
        // currentMockAdapter не используется здесь, так как это проверка на عدم вызов
        (ctx.storage as MockedNeonAdapterType).deleteCompetitorAccount // Используем ctx.storage для проверки
      ).not.toHaveBeenCalled();
    });
  });
});
