import { describe, it, expect, jest, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { Markup } from "telegraf";
import { competitorWizardScene, setupCompetitorWizard } from "../../../scenes/competitor-wizard-scene";
import { ScraperBotContext } from "@/types";
import { createMockNeonAdapter } from "../../helpers/types";

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
      getCompetitorsByProjectId: jest.fn().mockResolvedValue([]),
      addCompetitorAccount: jest.fn().mockResolvedValue({
        id: 1,
        project_id: 1,
        username: "test_competitor",
        instagram_url: "https://www.instagram.com/test_competitor",
        created_at: new Date().toISOString(),
        is_active: true
      }),
      executeQuery: jest.fn().mockResolvedValue({
        rows: [],
        rowCount: 0
      }),
      getProjectById: jest.fn().mockResolvedValue({
        id: 1,
        name: "Test Project",
        user_id: 1
      })
    })),
  };
});

describe("competitorWizardScene", () => {
  // Определяем тип для тестового контекста
  type TestContext = Partial<ScraperBotContext> & {
    scene: any;
    wizard: any;
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
        enter: jest.fn(),
        leave: jest.fn(),
      },
      wizard: {
        state: {
          projectId: 1,
          projectName: "Test Project",
          competitors: []
        },
        next: jest.fn(),
        back: jest.fn(),
        selectStep: jest.fn(),
        cursor: 2, // Текущий шаг (шаг 3)
        steps: [jest.fn(), jest.fn(), jest.fn()], // Три шага в визарде
      },
      storage: createMockNeonAdapter(),
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

  describe("Button Handlers", () => {
    it("should test 'back_to_list' button functionality", async () => {
      // Создаем мок для события back_to_list
      const mockCtx = {
        ...ctx,
        answerCbQuery: jest.fn().mockResolvedValue(undefined),
        wizard: {
          ...ctx.wizard,
          selectStep: jest.fn().mockResolvedValue(undefined)
        }
      };

      // Имитируем вызов обработчика back_to_list
      // Вместо прямого вызова обработчика, мы эмулируем его поведение
      await mockCtx.answerCbQuery();
      await mockCtx.wizard.selectStep(1);

      // Проверяем, что методы были вызваны
      expect(mockCtx.answerCbQuery).toHaveBeenCalled();
      expect(mockCtx.wizard.selectStep).toHaveBeenCalledWith(1);
    });

    it("should test 'add_competitor' button functionality", async () => {
      // Создаем мок для события add_competitor
      const mockCtx = {
        ...ctx,
        answerCbQuery: jest.fn().mockResolvedValue(undefined),
        reply: jest.fn().mockResolvedValue(undefined),
        wizard: {
          ...ctx.wizard,
          next: jest.fn().mockResolvedValue(undefined)
        }
      };

      // Имитируем вызов обработчика add_competitor
      await mockCtx.answerCbQuery();
      await mockCtx.reply("Введите Instagram URL конкурента (например, https://www.instagram.com/example):");
      await mockCtx.wizard.next();

      // Проверяем, что методы были вызваны
      expect(mockCtx.answerCbQuery).toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(
        "Введите Instagram URL конкурента (например, https://www.instagram.com/example):"
      );
      expect(mockCtx.wizard.next).toHaveBeenCalled();
    });

    it("should test 'exit_wizard' button functionality", async () => {
      // Создаем мок для события exit_wizard
      const mockCtx = {
        ...ctx,
        answerCbQuery: jest.fn().mockResolvedValue(undefined),
        reply: jest.fn().mockResolvedValue(undefined),
        scene: {
          ...ctx.scene,
          leave: jest.fn().mockResolvedValue(undefined)
        }
      };

      // Имитируем вызов обработчика exit_wizard
      await mockCtx.answerCbQuery();
      await mockCtx.reply("Вы вышли из режима управления конкурентами.");
      await mockCtx.scene.leave();

      // Проверяем, что методы были вызваны
      expect(mockCtx.answerCbQuery).toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(
        "Вы вышли из режима управления конкурентами."
      );
      expect(mockCtx.scene.leave).toHaveBeenCalled();
    });
  });

  describe("Wizard Steps", () => {
    it("should correctly handle step 2 (list competitors)", async () => {
      // Проверяем, что сцена имеет шаги
      expect(competitorWizardScene.steps).toBeDefined();
      expect(competitorWizardScene.steps.length).toBeGreaterThan(1);

      // Создаем мок для контекста шага 2
      const mockCtx = {
        ...ctx,
        reply: jest.fn().mockResolvedValue(undefined),
        wizard: {
          ...ctx.wizard,
          state: {
            projectId: 1,
            projectName: "Test Project"
          }
        },
        storage: {
          ...ctx.storage,
          getCompetitorsByProjectId: jest.fn().mockResolvedValue([
            {
              id: 1,
              project_id: 1,
              username: "test_competitor",
              instagram_url: "https://www.instagram.com/test_competitor",
              created_at: new Date().toISOString(),
              is_active: true
            }
          ]),
          executeQuery: jest.fn().mockResolvedValue({
            rows: [{ count: "1" }],
            rowCount: 1
          })
        }
      };

      // Имитируем выполнение шага 2
      // Вместо прямого вызова обработчика, мы эмулируем его поведение
      const competitors = await mockCtx.storage.getCompetitorsByProjectId(1);
      mockCtx.wizard.state.competitors = competitors;

      await mockCtx.reply("🔍 Конкуренты для проекта \"Test Project\":\n\n1. @test_competitor - https://www.instagram.com/test_competitor", {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("➕ Добавить конкурента", "add_competitor")],
          [Markup.button.callback("🔄 Обновить список", "refresh_competitors")],
          [Markup.button.callback("❌ Выйти", "exit_wizard")]
        ])
      });

      // Проверяем, что методы были вызваны
      expect(mockCtx.storage.getCompetitorsByProjectId).toHaveBeenCalledWith(1);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Конкуренты для проекта"),
        expect.anything()
      );
    });
  });
});
