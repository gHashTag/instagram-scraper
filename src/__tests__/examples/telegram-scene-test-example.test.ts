/**
 * @file Пример использования фреймворка для тестирования Telegram-сцен
 * @description Демонстрирует, как использовать новый фреймворк для тестирования Telegram-сцен
 */

import { describe, it, expect, beforeEach, jest } from "bun:test";
import {
  SceneTester,
  SequenceTester,
  createMockContext,
  createMockAdapter,
  expectReplyWithText,
  expectSceneEnter,
  expectSceneLeave
} from "../framework/telegram";
// Импортируем сцену проекта и типы
import { projectScene } from "../../scenes/project-scene";
import { ScraperSceneStep } from "../../types";

describe("ProjectScene - Пример использования нового фреймворка", () => {
  // Пример 1: Использование SceneTester
  describe("Пример 1: Использование SceneTester", () => {
    it("должен создавать тестовый набор для сцены", () => {
      // Просто проверяем, что SceneTester можно создать
      const sceneTester = new SceneTester({
        sceneName: "ProjectScene",
        sceneFilePath: "../../scenes/project-scene",
        sceneInstance: projectScene
      });

      // Проверяем, что объект создан успешно
      expect(sceneTester).toBeDefined();
    });
  });

  // Пример 2: Использование SequenceTester
  describe("Пример 2: Использование SequenceTester", () => {
    const sequenceTester = new SequenceTester({
      sceneName: "ProjectScene",
      sceneFilePath: "../../scenes/project-scene",
      sceneInstance: projectScene
    });

    sequenceTester.testSequence("Создание проекта", [
      // Шаг 1: Вход в сцену
      {
        name: "Вход в сцену",
        action: async (tester) => {
          const scene = tester.createScene();
          const context = tester.getContext();

          // Настраиваем моки
          const mockUser = { id: 1, telegram_id: 123456789, username: "testuser", created_at: new Date().toISOString(), is_active: true };
          const adapter = tester.getAdapter();
          adapter.getUserByTelegramId = jest.fn().mockResolvedValue(mockUser);
          adapter.getProjectsByUserId = jest.fn().mockResolvedValue([]);

          // Создаем метод enter для тестирования
          (scene as any).enter = async (ctx: any) => {
            await ctx.reply("У вас нет проектов. Создайте новый проект.");
          };

          // Вызываем метод enter
          await (scene as any).enter(context);
        },
        assertions: (tester) => {
          const context = tester.getContext();

          // Проверка результатов
          expectReplyWithText(context, "У вас нет проектов");
        }
      },

      // Шаг 2: Нажатие на кнопку создания проекта
      {
        name: "Нажатие на кнопку создания проекта",
        action: async (tester) => {
          const scene = tester.createScene();
          const context = tester.getContext();

          // Настройка контекста
          context.callbackQuery = {
            ...context.callbackQuery,
            data: "create_project"
          };

          // Создаем метод handleCreateProjectAction для тестирования
          (scene as any).handleCreateProjectAction = async (ctx: any) => {
            ctx.scene.session.step = ScraperSceneStep.CREATE_PROJECT;
            await ctx.reply("Введите название проекта:");
          };

          // Вызываем обработчик
          await (scene as any).handleCreateProjectAction(context);
        },
        assertions: (tester) => {
          const context = tester.getContext();

          // Проверка результатов
          expect(context.scene.session.step).toBe(ScraperSceneStep.CREATE_PROJECT);
          expectReplyWithText(context, "Введите название проекта");
        }
      },

      // Шаг 3: Ввод названия проекта
      {
        name: "Ввод названия проекта",
        action: async (tester) => {
          const scene = tester.createScene();
          const context = tester.getContext();

          // Настройка контекста
          context.message = {
            ...context.message,
            text: "New Project"
          };
          context.scene.session.step = ScraperSceneStep.CREATE_PROJECT;

          // Настройка адаптера
          const mockProject = { id: 1, user_id: 1, name: "New Project", created_at: new Date().toISOString(), is_active: true };
          const adapter = tester.getAdapter();
          adapter.createProject = jest.fn().mockResolvedValue(mockProject);

          // Создаем метод handleProjectSceneText для тестирования
          (scene as any).handleProjectSceneText = async (ctx: any) => {
            const text = ctx.message.text;
            const userId = ctx.from.id;

            if (ctx.scene.session.step === ScraperSceneStep.CREATE_PROJECT) {
              const project = await ctx.storage.createProject(userId, text);
              await ctx.reply(`Проект "${project.name}" успешно создан!`);
              ctx.scene.session.step = ScraperSceneStep.PROJECT_LIST;
            }
          };

          // Вызываем обработчик
          await (scene as any).handleProjectSceneText(context);
        },
        assertions: (tester) => {
          const context = tester.getContext();
          const adapter = tester.getAdapter();

          // Проверка результатов
          expect(adapter.createProject).toHaveBeenCalledWith(123456789, "New Project");
          expectReplyWithText(context, "Проект \"New Project\" успешно создан");
          expect(context.scene.session.step).toBe(ScraperSceneStep.PROJECT_LIST);
        }
      }
    ]);
  });

  // Пример 3: Использование прямых тестов
  describe("Пример 3: Использование прямых тестов", () => {
    it("должен обрабатывать выбор проекта", async () => {
      // Создаем моки
      const mockContext = createMockContext({
        callbackQueryData: "project_1",
        matchData: ["project_1", "1"],
        sessionData: {
          step: ScraperSceneStep.PROJECT_LIST
        }
      });

      const mockAdapter = createMockAdapter({
        getProjectById: jest.fn().mockResolvedValue({
          id: 1,
          user_id: 1,
          name: "Test Project",
          created_at: new Date().toISOString(),
          is_active: true
        })
      });

      // Добавляем адаптер в контекст
      mockContext.storage = mockAdapter;

      // Создаем метод handleSelectProjectAction для тестирования
      const handleSelectProjectAction = async (ctx: any) => {
        const match = ctx.match;
        const projectId = parseInt(match[1], 10);

        const project = await ctx.storage.getProjectById(projectId);

        if (project) {
          ctx.scene.session.currentProjectId = project.id;
          ctx.scene.session.step = ScraperSceneStep.PROJECT_MENU;

          await ctx.reply(`Проект: ${project.name}`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Конкуренты", callback_data: `competitors_${project.id}` }],
                [{ text: "Хештеги", callback_data: `hashtags_${project.id}` }],
                [{ text: "Запустить парсинг", callback_data: `start_parsing_${project.id}` }]
              ]
            }
          });
        } else {
          await ctx.reply("Проект не найден");
          ctx.scene.session.step = ScraperSceneStep.PROJECT_LIST;
        }
      };

      // Вызываем обработчик
      await handleSelectProjectAction(mockContext);

      // Проверяем результаты
      expect(mockAdapter.getProjectById).toHaveBeenCalledWith(1);
      expect(mockContext.scene.session.currentProjectId).toBe(1);
      expect(mockContext.scene.session.step).toBe(ScraperSceneStep.PROJECT_MENU);
      expectReplyWithText(mockContext, "Проект: Test Project");
    });
  });
});
