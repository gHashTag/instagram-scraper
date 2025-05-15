/**
 * @file Шаблоны для типичных сценариев тестирования
 * @description Содержит функции для создания типичных сценариев тестирования
 */

import { SceneTester } from "./scene-tester";
import { User, Project, Competitor, Hashtag, ScraperSceneStep } from "../../../types";
import { jest } from "bun:test";

/**
 * Создает шаблон для тестирования создания проекта
 * @param sceneTester Тестер сцены
 * @param textHandlerName Имя обработчика текстовых сообщений
 */
export function createProjectCreationTestTemplate<T>(
  sceneTester: SceneTester<T>,
  textHandlerName: keyof T
): void {
  describe("Project Creation", () => {
    beforeEach(() => {
      sceneTester.resetMocks();
    });

    it("should create a project successfully", async () => {
      // Настраиваем моки для успешного сценария
      const mockUser: User = {
        id: 1,
        telegram_id: 123456789,
        username: "testuser",
        created_at: new Date().toISOString(),
        is_active: true
      };

      const mockProject: Project = {
        id: 1,
        user_id: 1,
        name: "New Project",
        created_at: new Date().toISOString(),
        is_active: true
      };

      sceneTester.updateAdapter({
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        createProject: jest.fn().mockResolvedValue(mockProject),
      });

      // Обновляем контекст с нужным шагом
      sceneTester.updateContext({
        messageText: "New Project",
        sessionData: {
          step: ScraperSceneStep.CREATE_PROJECT,
          userId: 1,
        },
      });

      // Вызываем обработчик текстового сообщения
      await sceneTester.callSceneMethod(textHandlerName, sceneTester.getContext());

      // Проверяем, что были вызваны нужные методы
      expect(sceneTester.getAdapter().getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(sceneTester.getAdapter().createProject).toHaveBeenCalledWith(1, "New Project");
      expect(sceneTester.getContext().reply).toHaveBeenCalledWith(expect.stringContaining("успешно создан"));
      expect(sceneTester.getAdapter().close).toHaveBeenCalled();
    });

    it("should handle error during project creation", async () => {
      // Настраиваем моки для сценария с ошибкой
      const mockUser: User = {
        id: 1,
        telegram_id: 123456789,
        username: "testuser",
        created_at: new Date().toISOString(),
        is_active: true
      };

      sceneTester.updateAdapter({
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        createProject: jest.fn().mockRejectedValue(new Error("Database error")),
      });

      // Обновляем контекст с нужным шагом
      sceneTester.updateContext({
        messageText: "New Project",
        sessionData: {
          step: ScraperSceneStep.CREATE_PROJECT,
          userId: 1,
        },
      });

      // Вызываем обработчик текстового сообщения
      await sceneTester.callSceneMethod(textHandlerName, sceneTester.getContext());

      // Проверяем, что были вызваны нужные методы
      expect(sceneTester.getAdapter().getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(sceneTester.getAdapter().createProject).toHaveBeenCalledWith(1, "New Project");
      expect(sceneTester.getContext().reply).toHaveBeenCalledWith(expect.stringContaining("ошибка"));
      expect(sceneTester.getAdapter().close).toHaveBeenCalled();
    });
  });
}

/**
 * Создает шаблон для тестирования добавления конкурента
 * @param sceneTester Тестер сцены
 * @param textHandlerName Имя обработчика текстовых сообщений
 */
export function createCompetitorAdditionTestTemplate<T>(
  sceneTester: SceneTester<T>,
  textHandlerName: keyof T
): void {
  describe("Competitor Addition", () => {
    beforeEach(() => {
      sceneTester.resetMocks();
    });

    it("should add a competitor successfully", async () => {
      // Настраиваем моки для успешного сценария
      const mockUser: User = {
        id: 1,
        telegram_id: 123456789,
        username: "testuser",
        created_at: new Date().toISOString(),
        is_active: true
      };

      const mockCompetitor: Competitor = {
        id: 1,
        project_id: 1,
        username: "competitor",
        created_at: new Date().toISOString(),
        is_active: true
      };

      sceneTester.updateAdapter({
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        addCompetitorAccount: jest.fn().mockResolvedValue(mockCompetitor),
      });

      // Обновляем контекст с нужным шагом
      sceneTester.updateContext({
        messageText: "competitor",
        sessionData: {
          step: ScraperSceneStep.ADD_COMPETITOR,
          projectId: 1,
        },
      });

      // Вызываем обработчик текстового сообщения
      await sceneTester.callSceneMethod(textHandlerName, sceneTester.getContext());

      // Проверяем, что были вызваны нужные методы
      expect(sceneTester.getAdapter().getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(sceneTester.getAdapter().addCompetitorAccount).toHaveBeenCalledWith(1, "competitor");
      expect(sceneTester.getContext().reply).toHaveBeenCalledWith(expect.stringContaining("успешно добавлен"));
      expect(sceneTester.getAdapter().close).toHaveBeenCalled();
    });

    it("should handle error during competitor addition", async () => {
      // Настраиваем моки для сценария с ошибкой
      const mockUser: User = {
        id: 1,
        telegram_id: 123456789,
        username: "testuser",
        created_at: new Date().toISOString(),
        is_active: true
      };

      sceneTester.updateAdapter({
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        addCompetitorAccount: jest.fn().mockRejectedValue(new Error("Database error")),
      });

      // Обновляем контекст с нужным шагом
      sceneTester.updateContext({
        messageText: "competitor",
        sessionData: {
          step: ScraperSceneStep.ADD_COMPETITOR,
          projectId: 1,
        },
      });

      // Вызываем обработчик текстового сообщения
      await sceneTester.callSceneMethod(textHandlerName, sceneTester.getContext());

      // Проверяем, что были вызваны нужные методы
      expect(sceneTester.getAdapter().getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(sceneTester.getAdapter().addCompetitorAccount).toHaveBeenCalledWith(1, "competitor");
      expect(sceneTester.getContext().reply).toHaveBeenCalledWith(expect.stringContaining("ошибка"));
      expect(sceneTester.getAdapter().close).toHaveBeenCalled();
    });
  });
}
