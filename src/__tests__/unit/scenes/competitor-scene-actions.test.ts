import { describe, it, expect, jest, mock, beforeEach, afterEach, spyOn } from "bun:test";
import {
  handleDeleteCompetitorAction,
  handleCompetitorsProjectAction,
  handleAddCompetitorAction,
  handleExitCompetitorSceneAction,
  handleBackToProjectsCompetitorAction
} from "../../../scenes/competitor-scene";
// NeonAdapter импорт не нужен, так как мы используем createMockNeonAdapter
import { ScraperBotContext, Competitor, ScraperSceneStep } from "@/types";
import { MockedNeonAdapterType, createMockNeonAdapter } from "../../helpers/types";
import { createMockCompetitor } from "../../helpers/mocks";

// Мокируем зависимости
mock.module("../../../logger", () => {
  return {
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    },
  };
});

// Мокируем NeonAdapter
mock.module("../../../adapters/neon-adapter", () => {
  return {
    NeonAdapter: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      deleteCompetitorAccount: jest.fn(),
      getCompetitorAccounts: jest.fn(),
    })),
  };
});

// Используем импортированный тип MockedNeonAdapterType

describe("competitorScene - Action Handlers", () => {
  // Определяем тип для тестового контекста
  // Используем Partial<ScraperBotContext> вместо полного типа, чтобы не требовать все свойства
  type TestContext = Partial<ScraperBotContext> & {
    match: RegExpExecArray;
    customSceneEnterMock?: jest.Mock;
    scene: any;
    storage: any;
    reply: jest.Mock;
    editMessageReplyMarkup: jest.Mock;
    answerCbQuery: jest.Mock;
    from: any;
  };
  let ctx: TestContext;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    // Создаем мок для контекста
    ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      answerCbQuery: jest.fn().mockResolvedValue(undefined),
      scene: {
        session: {},
        leave: jest.fn(),
        reenter: jest.fn(),
        enter: jest.fn(),
      },
      storage: createMockNeonAdapter(),
      match: ["", "1", "testuser"] as unknown as RegExpExecArray,
      from: {
        id: 123456789,
        username: "testuser",
        first_name: "Test",
        last_name: "User",
        is_bot: false,
      },
      // Добавляем все необходимые свойства для ScraperBotContext
      telegram: {} as any,
      update: {} as any,
      botInfo: {} as any,
      config: {} as any,
      scraperConfig: {} as any,
    } as TestContext;

    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("handleDeleteCompetitorAction", () => {
    it("should delete competitor and show success message", async () => {
      // Мокируем результат запроса deleteCompetitorAccount
      (ctx.storage as MockedNeonAdapterType).deleteCompetitorAccount.mockResolvedValue(true);

      // Вызываем обработчик
      await handleDeleteCompetitorAction(ctx as any);

      // Проверяем, что был вызван метод initialize
      expect((ctx.storage as MockedNeonAdapterType).initialize).toHaveBeenCalled();

      // Проверяем, что был вызван метод deleteCompetitorAccount с правильными параметрами
      expect((ctx.storage as MockedNeonAdapterType).deleteCompetitorAccount).toHaveBeenCalledWith(1, "testuser");

      // Проверяем, что был вызван метод reply с сообщением об успешном удалении
      expect(ctx.reply).toHaveBeenCalledWith(
        'Конкурент "testuser" успешно удален из проекта.'
      );

      // Проверяем, что был вызван метод editMessageReplyMarkup
      expect(ctx.editMessageReplyMarkup).toHaveBeenCalledWith(undefined);

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Удалено");

      // Проверяем, что был вызван метод close
      expect((ctx.storage as MockedNeonAdapterType).close).toHaveBeenCalled();
    });

    it("should show error message if competitor not found", async () => {
      // Мокируем результат запроса deleteCompetitorAccount
      (ctx.storage as MockedNeonAdapterType).deleteCompetitorAccount.mockResolvedValue(false);

      // Вызываем обработчик
      await handleDeleteCompetitorAction(ctx as any);

      // Проверяем, что был вызван метод initialize
      expect((ctx.storage as MockedNeonAdapterType).initialize).toHaveBeenCalled();

      // Проверяем, что был вызван метод deleteCompetitorAccount с правильными параметрами
      expect((ctx.storage as MockedNeonAdapterType).deleteCompetitorAccount).toHaveBeenCalledWith(1, "testuser");

      // Проверяем, что был вызван метод reply с сообщением об ошибке
      expect(ctx.reply).toHaveBeenCalledWith(
        'Не удалось найти или удалить конкурента "testuser". Возможно, он уже был удален.'
      );

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка удаления");

      // Проверяем, что был вызван метод close
      expect((ctx.storage as MockedNeonAdapterType).close).toHaveBeenCalled();
    });

    it("should handle error when deleteCompetitorAccount throws", async () => {
      // Мокируем ошибку в запросе deleteCompetitorAccount
      (ctx.storage as MockedNeonAdapterType).deleteCompetitorAccount.mockRejectedValue(new Error("Database error"));

      // Вызываем обработчик
      await handleDeleteCompetitorAction(ctx as any);

      // Проверяем, что был вызван метод initialize
      expect((ctx.storage as MockedNeonAdapterType).initialize).toHaveBeenCalled();

      // Проверяем, что был вызван метод deleteCompetitorAccount с правильными параметрами
      expect((ctx.storage as MockedNeonAdapterType).deleteCompetitorAccount).toHaveBeenCalledWith(1, "testuser");

      // Проверяем, что был вызван console.error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Ошибка при удалении конкурента testuser из проекта 1:"),
        expect.any(Error)
      );

      // Проверяем, что был вызван метод reply с сообщением об ошибке
      expect(ctx.reply).toHaveBeenCalledWith(
        "Произошла техническая ошибка при удалении конкурента. Попробуйте позже."
      );

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка");

      // Проверяем, что был вызван метод close
      expect((ctx.storage as MockedNeonAdapterType).close).toHaveBeenCalled();
    });

    it("should handle invalid data in match", async () => {
      // Устанавливаем невалидные данные в match
      ctx.match = ["", "invalid", ""] as unknown as RegExpExecArray;

      // Вызываем обработчик
      await handleDeleteCompetitorAction(ctx as any);

      // Проверяем, что был вызван console.error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid data parsed from delete action:")
      );

      // Проверяем, что был вызван метод reply с сообщением об ошибке
      expect(ctx.reply).toHaveBeenCalledWith(
        "Ошибка при удалении конкурента. Пожалуйста, попробуйте снова."
      );

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalledWith("Ошибка");

      // Проверяем, что не был вызван метод initialize
      expect((ctx.storage as MockedNeonAdapterType).initialize).not.toHaveBeenCalled();
    });
  });

  describe("handleCompetitorsProjectAction", () => {
    beforeEach(() => {
      // Устанавливаем match для projectId
      ctx.match = ["competitors_project_1", "1"] as unknown as RegExpExecArray;
    });

    it("should show competitors list when project has competitors", async () => {
      // Мокируем результат запроса getCompetitorAccounts
      const mockCompetitors: Competitor[] = [
        createMockCompetitor({ id: 1, project_id: 1, username: "competitor1", instagram_url: "https://instagram.com/competitor1" }),
        createMockCompetitor({ id: 2, project_id: 1, username: "competitor2", instagram_url: "https://instagram.com/competitor2" })
      ];
      (ctx.storage as MockedNeonAdapterType).getCompetitorAccounts.mockResolvedValue(mockCompetitors);

      // Вызываем обработчик
      await handleCompetitorsProjectAction(ctx as any);

      // Проверяем, что был вызван метод initialize
      expect((ctx.storage as MockedNeonAdapterType).initialize).toHaveBeenCalled();

      // Проверяем, что был вызван метод getCompetitorAccounts с правильным параметром
      expect((ctx.storage as MockedNeonAdapterType).getCompetitorAccounts).toHaveBeenCalledWith(1);

      // Проверяем, что был вызван метод reply с сообщением со списком конкурентов
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Конкуренты в выбранном проекте:"),
        expect.anything()
      );

      // Проверяем, что был вызван метод close
      expect((ctx.storage as MockedNeonAdapterType).close).toHaveBeenCalled();

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    it("should show add competitor message when project has no competitors", async () => {
      // Мокируем результат запроса getCompetitorAccounts
      (ctx.storage as MockedNeonAdapterType).getCompetitorAccounts.mockResolvedValue([]);

      // Вызываем обработчик
      await handleCompetitorsProjectAction(ctx as any);

      // Проверяем, что был вызван метод initialize
      expect((ctx.storage as MockedNeonAdapterType).initialize).toHaveBeenCalled();

      // Проверяем, что был вызван метод getCompetitorAccounts с правильным параметром
      expect((ctx.storage as MockedNeonAdapterType).getCompetitorAccounts).toHaveBeenCalledWith(1);

      // Проверяем, что был вызван метод reply с сообщением о добавлении конкурента
      expect(ctx.reply).toHaveBeenCalledWith(
        "В выбранном проекте нет добавленных конкурентов. Хотите добавить?",
        expect.anything()
      );

      // Проверяем, что был вызван метод close
      expect((ctx.storage as MockedNeonAdapterType).close).toHaveBeenCalled();

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    it("should handle error when getCompetitorAccounts throws", async () => {
      // Мокируем ошибку в запросе getCompetitorAccounts
      (ctx.storage as MockedNeonAdapterType).getCompetitorAccounts.mockRejectedValue(new Error("Database error"));

      // Вызываем обработчик
      await handleCompetitorsProjectAction(ctx as any);

      // Проверяем, что был вызван метод initialize
      expect((ctx.storage as MockedNeonAdapterType).initialize).toHaveBeenCalled();

      // Проверяем, что был вызван метод getCompetitorAccounts с правильным параметром
      expect((ctx.storage as MockedNeonAdapterType).getCompetitorAccounts).toHaveBeenCalledWith(1);

      // Проверяем, что был вызван console.error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Ошибка при получении конкурентов проекта 1:"),
        expect.any(Error)
      );

      // Проверяем, что был вызван метод reply с сообщением об ошибке
      expect(ctx.reply).toHaveBeenCalledWith(
        "Не удалось загрузить список конкурентов для этого проекта. Попробуйте позже или обратитесь в поддержку."
      );

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });
  });

  describe("handleAddCompetitorAction", () => {
    beforeEach(() => {
      // Устанавливаем match для projectId
      ctx.match = ["add_competitor_1", "1"] as unknown as RegExpExecArray;
    });

    it("should set session data and prompt for competitor URL", async () => {
      // Вызываем обработчик
      await handleAddCompetitorAction(ctx as any);

      // Проверяем, что был установлен projectId в сессии
      expect(ctx.scene.session.projectId).toBe(1);

      // Проверяем, что был установлен шаг в сессии
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.ADD_COMPETITOR);

      // Проверяем, что был вызван метод reply с запросом URL
      expect(ctx.reply).toHaveBeenCalledWith(
        "Введите Instagram URL конкурента (например, https://www.instagram.com/example):"
      );

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    it("should handle invalid projectId", async () => {
      // Устанавливаем невалидный projectId в match
      ctx.match = ["add_competitor_invalid", "invalid"] as unknown as RegExpExecArray;

      // Вызываем обработчик
      await handleAddCompetitorAction(ctx as any);

      // Проверяем, что был вызван console.error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid projectId parsed from action:")
      );

      // Проверяем, что был вызван метод reply с сообщением об ошибке
      expect(ctx.reply).toHaveBeenCalledWith(
        "Ошибка выбора проекта. Пожалуйста, вернитесь назад и выберите проект снова."
      );

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();

      // Проверяем, что не был установлен projectId в сессии
      expect(ctx.scene.session.projectId).toBeUndefined();
    });
  });

  describe("handleExitCompetitorSceneAction", () => {
    it("should leave scene and show message", async () => {
      // Вызываем обработчик
      await handleExitCompetitorSceneAction(ctx as any);

      // Проверяем, что был вызван метод reply с сообщением
      expect(ctx.reply).toHaveBeenCalledWith(
        "Вы вышли из режима управления конкурентами.",
        expect.anything()
      );

      // Проверяем, что был вызван метод leave
      expect(ctx.scene.leave).toHaveBeenCalled();

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    it("should enter project scene if currentProjectId is set", async () => {
      // Устанавливаем currentProjectId в сессии
      ctx.scene.session.currentProjectId = 1;

      // Вызываем обработчик
      await handleExitCompetitorSceneAction(ctx as any);

      // Проверяем, что был вызван метод reply с сообщением
      expect(ctx.reply).toHaveBeenCalledWith(
        "Вы вышли из режима управления конкурентами.",
        expect.anything()
      );

      // Проверяем, что был вызван метод leave
      expect(ctx.scene.leave).toHaveBeenCalled();

      // Проверяем, что был вызван метод enter с правильными параметрами
      expect(ctx.scene.enter).toHaveBeenCalledWith(
        "projectScene",
        { projectId: 1 }
      );

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });
  });

  describe("handleBackToProjectsCompetitorAction", () => {
    it("should enter projects scene", async () => {
      // Вызываем обработчик
      await handleBackToProjectsCompetitorAction(ctx as any);

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();

      // Проверяем, что был вызван метод enter с правильным параметром
      expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");
    });

    it("should use customSceneEnterMock if provided", async () => {
      // Создаем мок для customSceneEnterMock
      const customSceneEnterMock = jest.fn();
      ctx.customSceneEnterMock = customSceneEnterMock;

      // Вызываем обработчик
      await handleBackToProjectsCompetitorAction(ctx as any);

      // Проверяем, что был вызван метод answerCbQuery
      expect(ctx.answerCbQuery).toHaveBeenCalled();

      // Проверяем, что был вызван customSceneEnterMock с правильным параметром
      expect(customSceneEnterMock).toHaveBeenCalledWith("instagram_scraper_projects");

      // Проверяем, что не был вызван метод enter
      expect(ctx.scene.enter).not.toHaveBeenCalled();
    });
  });
});
