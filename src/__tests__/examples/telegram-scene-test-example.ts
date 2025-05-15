/**
 * @file Пример использования фреймворка для тестирования Telegram-сцен
 * @description Демонстрирует, как использовать фреймворк для тестирования Telegram-сцен
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { 
  SceneTester, 
  SceneSequenceTester, 
  expectSceneStep, 
  expectMessageContaining, 
  expectInlineKeyboardWithButtons,
  createProjectCreationTestTemplate
} from "../helpers/telegram";
import { ProjectScene } from "../../scenes/project-scene";
import { ScraperSceneStep } from "../../types";

describe("ProjectScene - Пример использования фреймворка", () => {
  let sceneTester: SceneTester<ProjectScene>;

  beforeEach(() => {
    // Создаем тестер сцены
    sceneTester = new SceneTester({
      sceneName: "ProjectScene",
      sceneFilePath: "../../scenes/project-scene",
      sceneConstructor: ProjectScene
    });
    
    // Сбрасываем все моки перед каждым тестом
    sceneTester.resetMocks();
  });

  // Пример 1: Использование генераторов тестов
  describe("Пример 1: Использование генераторов тестов", () => {
    it("должен генерировать тесты для обработчика входа в сцену", () => {
      // Настраиваем моки для успешного сценария
      const mockUser = { id: 1, telegram_id: 123456789, username: "testuser", created_at: new Date().toISOString(), is_active: true };
      const mockProjects = [{ id: 1, user_id: 1, name: "Test Project", created_at: new Date().toISOString(), is_active: true }];

      sceneTester.updateAdapter({
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        getProjectsByUserId: jest.fn().mockResolvedValue(mockProjects),
      });

      // Вызываем обработчик входа в сцену
      return sceneTester.callSceneMethod("enterHandler", sceneTester.getContext()).then(() => {
        // Проверяем, что были вызваны нужные методы
        expect(sceneTester.getAdapter().getUserByTelegramId).toHaveBeenCalledWith(123456789);
        expect(sceneTester.getAdapter().getProjectsByUserId).toHaveBeenCalledWith(1);
        expect(sceneTester.getContext().reply).toHaveBeenCalled();
        expect(sceneTester.getAdapter().close).toHaveBeenCalled();
      });
    });
  });

  // Пример 2: Использование SceneSequenceTester
  describe("Пример 2: Использование SceneSequenceTester", () => {
    it("должен тестировать последовательность действий", async () => {
      // Настраиваем моки
      const mockUser = { id: 1, telegram_id: 123456789, username: "testuser", created_at: new Date().toISOString(), is_active: true };
      const mockProject = { id: 1, user_id: 1, name: "New Project", created_at: new Date().toISOString(), is_active: true };

      sceneTester.updateAdapter({
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        getProjectsByUserId: jest.fn().mockResolvedValue([]),
        createProject: jest.fn().mockResolvedValue(mockProject),
      });

      // Создаем тестер последовательностей
      const sequenceTester = new SceneSequenceTester(sceneTester);

      // Добавляем шаги в последовательность
      sequenceTester
        .addSceneEnter(
          "Вход в сцену",
          "enterHandler",
          {},
          (tester) => {
            expectMessageContaining(tester.getContext(), "У вас нет проектов");
          }
        )
        .addButtonClick(
          "Нажатие на кнопку создания проекта",
          "create_project",
          "handleCreateProjectAction" as keyof ProjectScene,
          {},
          (tester) => {
            expectSceneStep(tester.getContext(), ScraperSceneStep.CREATE_PROJECT);
            expectMessageContaining(tester.getContext(), "Введите название проекта");
          }
        )
        .addTextInput(
          "Ввод названия проекта",
          "New Project",
          "handleProjectSceneText" as keyof ProjectScene,
          {
            sessionData: {
              step: ScraperSceneStep.CREATE_PROJECT
            }
          },
          (tester) => {
            expectMessageContaining(tester.getContext(), "Проект успешно создан");
          }
        );

      // Запускаем последовательность
      await sequenceTester.run();
    });
  });

  // Пример 3: Использование шаблонов тестов
  describe("Пример 3: Использование шаблонов тестов", () => {
    // Создаем шаблон для тестирования создания проекта
    createProjectCreationTestTemplate(
      sceneTester,
      "handleProjectSceneText" as keyof ProjectScene
    );
  });

  // Пример 4: Использование утилит для проверки состояния
  describe("Пример 4: Использование утилит для проверки состояния", () => {
    it("должен проверять состояние сцены", async () => {
      // Настраиваем моки
      const mockUser = { id: 1, telegram_id: 123456789, username: "testuser", created_at: new Date().toISOString(), is_active: true };
      const mockProject = { id: 1, user_id: 1, name: "Test Project", created_at: new Date().toISOString(), is_active: true };

      sceneTester.updateAdapter({
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        getProjectById: jest.fn().mockResolvedValue(mockProject),
      });

      // Обновляем контекст
      sceneTester.updateContext({
        callbackQueryData: "project_1",
        matchData: ["project_1", "1"],
        sessionData: {
          step: ScraperSceneStep.PROJECT_LIST,
        }
      });

      // Вызываем метод сцены
      await sceneTester.callSceneMethod("handleSelectProjectAction", sceneTester.getContext());

      // Проверяем состояние сцены
      expectSceneStep(sceneTester.getContext(), ScraperSceneStep.PROJECT_MENU);
      expectMessageContaining(sceneTester.getContext(), "Test Project");
      expectInlineKeyboardWithButtons(sceneTester.getContext(), ["Конкуренты", "Хештеги", "Запустить парсинг"]);
    });
  });
});
