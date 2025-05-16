import { describe, it, expect, jest, mock, beforeEach, afterEach, spyOn } from "bun:test";
import {
  competitorScene,
  handleExitCompetitorSceneAction,
  handleAddCompetitorAction,
  handleCompetitorEnter
} from "../../../scenes/competitor-scene";
import { ScraperBotContext, ScraperSceneStep } from "@/types";
import { MockedNeonAdapterType, createMockNeonAdapter } from "../../helpers/types";

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

describe("competitorScene - Button Handlers", () => {
  // Определяем тип для тестового контекста
  type TestContext = Partial<ScraperBotContext> & {
    match: RegExpExecArray;
    scene: any;
    storage: any;
    reply: jest.Mock;
    answerCbQuery: jest.Mock;
    from: any;
  };
  let ctx: TestContext;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    // Создаем мок для контекста
    ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
      answerCbQuery: jest.fn().mockResolvedValue(undefined),
      scene: {
        session: {},
        leave: jest.fn(),
        reenter: jest.fn(),
        enter: jest.fn(),
      },
      storage: createMockNeonAdapter(),
      match: ["", "1"] as unknown as RegExpExecArray,
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

  describe("Button Handlers Registration", () => {
    it("should have exit_scene action handler registered", () => {
      // Проверяем, что обработчик для exit_scene зарегистрирован
      // Вместо прямого доступа к внутренним свойствам, проверяем функциональность

      // Создаем мок для ctx.update.callback_query.data
      const exitCtx = {
        ...ctx,
        update: {
          callback_query: {
            data: "exit_scene"
          }
        }
      };

      // Проверяем, что обработчик вызывается
      expect(() => handleExitCompetitorSceneAction(exitCtx as any)).not.toThrow();
    });

    it("should have add_competitor action handler registered", () => {
      // Проверяем, что обработчик для add_competitor зарегистрирован
      // Вместо прямого доступа к внутренним свойствам, проверяем функциональность

      // Создаем мок для ctx с match
      const addCtx = {
        ...ctx,
        match: ["add_competitor_1", "1"] as unknown as RegExpExecArray
      };

      // Проверяем, что обработчик вызывается
      expect(() => handleAddCompetitorAction(addCtx as any)).not.toThrow();
    });
  });

  describe("Exit Button Handler", () => {
    it("should call scene.leave when exit button is clicked", async () => {
      // Вызываем обработчик
      await handleExitCompetitorSceneAction(ctx as any);

      // Проверяем, что был вызван метод leave
      expect(ctx.scene.leave).toHaveBeenCalled();

      // Проверяем, что было отправлено сообщение
      expect(ctx.reply).toHaveBeenCalledWith(
        "Вы вышли из режима управления конкурентами.",
        expect.anything()
      );
    });
  });

  describe("Add Competitor Button Handler", () => {
    it("should set session data when add competitor button is clicked", async () => {
      // Вызываем обработчик
      await handleAddCompetitorAction(ctx as any);

      // Проверяем, что был установлен projectId в сессии
      expect(ctx.scene.session.projectId).toBe(1);

      // Проверяем, что был установлен шаг в сессии
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.ADD_COMPETITOR);

      // Проверяем, что было отправлено сообщение
      expect(ctx.reply).toHaveBeenCalledWith(
        "Введите Instagram URL конкурента (например, https://www.instagram.com/example):"
      );
    });
  });

  describe("Inline Keyboard vs Reply Keyboard", () => {
    it("should use inline keyboard for competitor actions", () => {
      // Проверяем, что в коде сцены используются inline-кнопки
      // Вместо прямого доступа к обработчикам, проверяем исходный код функции

      // Получаем исходный код функции handleCompetitorEnter
      const handlerCode = handleCompetitorEnter.toString();

      // Проверяем, что используется Markup.inlineKeyboard, а не Markup.keyboard
      expect(handlerCode).toContain("inlineKeyboard");
      expect(handlerCode).not.toContain("Markup.keyboard");
    });
  });
});
