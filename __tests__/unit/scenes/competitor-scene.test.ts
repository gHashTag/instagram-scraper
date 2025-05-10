import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ScraperBotContext } from "@/types"; // Раскомментировано и исправлен путь
import { ScraperSceneStep } from "@/types"; // Добавляем ScraperSceneStep
import {
  createMockContext,
  createContextWithProjects,
} from "../../../__tests__/__mocks__/context-factory";
import {
  enterHandler,
  competitorsProjectHandler,
  addCompetitorHandler,
  textMessageHandler,
  exitSceneHandler,
  backToProjectsHandler,
} from "../../../__tests__/__mocks__/competitor-scene-handlers";

// Импортируем наш модуль для тестирования
import "../../setup";

describe("Competitor Scene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enter handler", () => {
    it("should exit when user is not found", async () => {
      // Создаем базовый контекст без пользователя
      const ctx = createMockContext();

      // Вызываем обработчик напрямую
      await enterHandler(ctx as ScraperBotContext);

      // Проверяем вызовы функций
      expect(ctx.storage?.initialize).toHaveBeenCalled();
      expect(ctx.storage?.getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(ctx.reply).toHaveBeenCalledWith(
        "Вы не зарегистрированы. Пожалуйста, используйте /start для начала работы."
      );
      expect(ctx.scene?.leave).toHaveBeenCalled();
      expect(ctx.storage?.close).toHaveBeenCalled();
    });

    it("should exit when user has no projects", async () => {
      // Создаем контекст с пользователем без проектов
      const ctx = createContextWithProjects(1, 123456789, []);

      // Вызываем обработчик напрямую
      await enterHandler(ctx as ScraperBotContext);

      // Проверяем вызовы функций
      expect(ctx.storage?.initialize).toHaveBeenCalled();
      expect(ctx.storage?.getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(ctx.storage?.getProjectsByUserId).toHaveBeenCalledWith(1);
      expect(ctx.reply).toHaveBeenCalledWith(
        "У вас нет проектов. Создайте проект с помощью команды /projects"
      );
      expect(ctx.scene?.leave).toHaveBeenCalled();
      expect(ctx.storage?.close).toHaveBeenCalled();
    });

    it("should show competitors when user has only one project", async () => {
      // Создаем контекст с пользователем и одним проектом
      const projects = [{ id: 1, name: "Test Project", is_active: true }];
      const competitors = [
        {
          id: 1,
          username: "competitor1",
          instagram_url: "https://instagram.com/competitor1",
        },
        {
          id: 2,
          username: "competitor2",
          instagram_url: "https://instagram.com/competitor2",
        },
      ];

      const ctx = createContextWithProjects(1, 123456789, projects, {
        storageOptions: {
          getCompetitorAccounts: vi.fn().mockResolvedValue(competitors),
        },
      });

      // Вызываем обработчик напрямую
      await enterHandler(ctx as ScraperBotContext);

      // Проверяем вызовы функций
      expect(ctx.storage?.initialize).toHaveBeenCalled();
      expect(ctx.storage?.getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(ctx.storage?.getProjectsByUserId).toHaveBeenCalledWith(1);
      expect(ctx.storage?.getCompetitorAccounts).toHaveBeenCalledWith(1);
      // Проверяем, что отображается список конкурентов
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Конкуренты в проекте"),
        expect.objectContaining({
          parse_mode: "Markdown",
          reply_markup: expect.anything(),
        })
      );
      // Проверяем, что сессия установлена правильно
      if (ctx.scene && ctx.scene.session) {
        expect(ctx.scene.session.step).toBe(ScraperSceneStep.ADD_COMPETITOR);
        expect(ctx.scene.session.projectId).toBe(1);
      } else {
        // Если мы ожидаем, что сессия должна быть здесь, добавим fail()
        expect.fail(
          "ctx.scene или ctx.scene.session не определены, хотя должны быть"
        );
      }
      expect(ctx.storage?.close).toHaveBeenCalled();
    });

    it("should show add competitor option when no competitors in project", async () => {
      // Создаем контекст с пользователем и одним проектом без конкурентов
      const projects = [{ id: 1, name: "Test Project", is_active: true }];

      const ctx = createContextWithProjects(1, 123456789, projects, {
        storageOptions: {
          getCompetitorAccounts: vi.fn().mockResolvedValue([]),
        },
      });

      // Вызываем обработчик напрямую
      await enterHandler(ctx as ScraperBotContext);

      // Проверяем вызовы функций
      expect(ctx.storage?.initialize).toHaveBeenCalled();
      expect(ctx.storage?.getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(ctx.storage?.getProjectsByUserId).toHaveBeenCalledWith(1);
      expect(ctx.storage?.getCompetitorAccounts).toHaveBeenCalledWith(1);
      // Проверяем, что предлагается добавить конкурентов
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("нет добавленных конкурентов"),
        expect.objectContaining({
          reply_markup: expect.anything(),
        })
      );
      expect(ctx.storage?.close).toHaveBeenCalled();
    });

    it("should show project selection when user has multiple projects", async () => {
      // Создаем контекст с пользователем и несколькими проектами
      const projects = [
        { id: 1, name: "Project 1", is_active: true },
        { id: 2, name: "Project 2", is_active: true },
      ];

      const ctx = createContextWithProjects(1, 123456789, projects);

      // Вызываем обработчик напрямую
      await enterHandler(ctx as ScraperBotContext);

      // Проверяем вызовы функций
      expect(ctx.storage?.initialize).toHaveBeenCalled();
      expect(ctx.storage?.getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(ctx.storage?.getProjectsByUserId).toHaveBeenCalledWith(1);
      // Проверяем, что предлагается выбрать проект
      expect(ctx.reply).toHaveBeenCalledWith(
        "Выберите проект для просмотра конкурентов:",
        expect.objectContaining({
          reply_markup: expect.anything(),
        })
      );
      expect(ctx.storage?.close).toHaveBeenCalled();
    });
  });

  describe("action handlers", () => {
    it("should handle competitors_project_X action", async () => {
      // Создаем контекст с конкурентами
      const ctx = createMockContext({
        storageOptions: {
          getCompetitorAccounts: vi.fn().mockResolvedValue([
            {
              id: 1,
              username: "competitor1",
              instagram_url: "https://instagram.com/competitor1",
            },
          ]),
        },
      });

      // Вызываем обработчик действия напрямую
      await competitorsProjectHandler(ctx as ScraperBotContext, 1);

      // Проверяем вызовы функций
      expect(ctx.storage?.initialize).toHaveBeenCalled();
      expect(ctx.storage?.getCompetitorAccounts).toHaveBeenCalledWith(1);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining("Конкуренты в выбранном проекте"),
        expect.objectContaining({
          parse_mode: "Markdown",
          reply_markup: expect.anything(),
        })
      );
      expect(ctx.answerCbQuery).toHaveBeenCalled();
      expect(ctx.storage?.close).toHaveBeenCalled();
    });

    it("should handle add_competitor_X action", async () => {
      // Создаем базовый контекст
      const ctx = createMockContext();

      // Вызываем обработчик действия напрямую
      await addCompetitorHandler(ctx as ScraperBotContext, 1);

      // Проверяем вызовы функций
      expect(ctx.reply).toHaveBeenCalledWith(
        "Введите Instagram URL конкурента (например, https://www.instagram.com/example):"
      );
      expect(ctx.scene?.session?.step).toBe(ScraperSceneStep.ADD_COMPETITOR);
      expect(ctx.scene?.session?.projectId).toBe(1);
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    it("should handle exit_scene action", async () => {
      // Создаем базовый контекст
      const ctx = createMockContext();

      // Вызываем обработчик напрямую
      await exitSceneHandler(ctx as ScraperBotContext);

      // Проверяем результат
      expect(ctx.answerCbQuery).toHaveBeenCalledWith(
        "Выход из режима управления конкурентами"
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        "Вы вышли из режима управления конкурентами",
        expect.objectContaining({
          reply_markup: { remove_keyboard: true },
        })
      );
      expect(ctx.scene?.leave).toHaveBeenCalled();
    });

    it("should handle back_to_projects action", async () => {
      // Создаем базовый контекст
      const ctx = createMockContext();

      // Вызываем обработчик напрямую
      await backToProjectsHandler(ctx as ScraperBotContext);

      // Проверяем результат
      expect(ctx.answerCbQuery).toHaveBeenCalled();
      expect(ctx.scene?.reenter).toHaveBeenCalled();
    });
  });

  describe("text message handler", () => {
    it("should ask to re-enter when no session step", async () => {
      const ctx = createMockContext();
      // Удаляем шаг из сессии, чтобы симулировать неправильное состояние
      if (ctx.scene && ctx.scene.session) {
        delete ctx.scene.session.step;
      }

      await textMessageHandler(ctx as ScraperBotContext);
      expect(ctx.reply).toHaveBeenCalledWith(
        "Что-то пошло не так. Пожалуйста, попробуйте снова войти в раздел управления конкурентами."
      );
    });

    it("should add competitor when in ADD_COMPETITOR step", async () => {
      const projectId = 1;
      const competitorUrl = "https://www.instagram.com/valid_user";
      const competitorUsername = "valid_user";

      const mockAddCompetitorAccount = vi.fn().mockResolvedValue({
        id: 1,
        project_id: projectId,
        username: competitorUsername,
        instagram_url: competitorUrl,
      });

      const ctx = createMockContext({
        sceneStep: ScraperSceneStep.ADD_COMPETITOR,
        sceneSession: { projectId, step: ScraperSceneStep.ADD_COMPETITOR }, // Явно устанавливаем шаг в сессии
        message: { text: competitorUrl },
        storageOptions: {
          addCompetitorAccount: mockAddCompetitorAccount, // Используем обновленный мок
        },
      });
      // if (ctx.scene && ctx.scene.session) { // Эта проверка была избыточна, т.к. sceneSession передается
      //     ctx.scene.session.projectId = projectId;
      // }

      await textMessageHandler(ctx as ScraperBotContext);

      expect(ctx.storage?.initialize).toHaveBeenCalled();
      expect(mockAddCompetitorAccount).toHaveBeenCalledWith(
        projectId,
        competitorUsername,
        competitorUrl
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        `Конкурент \"${competitorUsername}\" успешно добавлен.`
      );
      // Проверяем, что шаг сброшен
      if (ctx.scene && ctx.scene.session) {
        expect(ctx.scene.session.step).toBeUndefined();
      }
      expect(ctx.storage?.close).toHaveBeenCalled();
    });

    it("should handle invalid URL when in ADD_COMPETITOR step", async () => {
      const ctx = createMockContext({
        sceneStep: ScraperSceneStep.ADD_COMPETITOR, // Используем ScraperSceneStep
        message: { text: "invalid_url" },
      });

      await textMessageHandler(ctx as ScraperBotContext);
      expect(ctx.reply).toHaveBeenCalledWith(
        "Неверный URL Instagram. Пожалуйста, введите корректный URL (например, https://www.instagram.com/example)."
      );
    });

    it("should handle unknown text messages", async () => {
      // Настраиваем контекст без активного шага
      const ctx = createMockContext({
        message: {
          text: "Случайное сообщение",
        },
      });

      // Вызываем обработчик текстового сообщения напрямую
      await textMessageHandler(ctx as ScraperBotContext);

      // Проверяем сообщение о непонятной команде
      expect(ctx.reply).toHaveBeenCalledWith(
        "Я не понимаю эту команду. Используйте кнопки для управления конкурентами."
      );
    });
  });
});
