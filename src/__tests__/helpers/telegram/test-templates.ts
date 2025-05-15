/**
 * @file Шаблоны для типичных сценариев тестирования
 * @description Содержит функции для создания типичных сценариев тестирования
 */

import { SceneTester } from "./scene-tester";
import { ScraperSceneStep } from "../../../types";
import { createMockUser, createMockProject, createMockCompetitor } from "../../helpers/mocks";
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
      const mockUser = createMockUser({
        id: 1,
        telegram_id: 123456789,
        username: "testuser"
      });

      const mockProject = createMockProject({
        id: 1,
        user_id: 1,
        name: "New Project"
      });

      sceneTester.updateAdapter({
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        createProject: jest.fn().mockResolvedValue(mockProject),
      });

      // Обновляем контекст с нужным шагом
      sceneTester.updateContext({
        messageText: "New Project",
        sessionData: {
          step: ScraperSceneStep.CREATE_PROJECT,
          user: mockUser,
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
      const mockUser = createMockUser({
        id: 1,
        telegram_id: 123456789,
        username: "testuser"
      });

      sceneTester.updateAdapter({
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        createProject: jest.fn().mockRejectedValue(new Error("Database error")),
      });

      // Обновляем контекст с нужным шагом
      sceneTester.updateContext({
        messageText: "New Project",
        sessionData: {
          step: ScraperSceneStep.CREATE_PROJECT,
          user: mockUser,
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
      const mockUser = createMockUser({
        id: 1,
        telegram_id: 123456789,
        username: "testuser"
      });

      const mockCompetitor = createMockCompetitor({
        id: 1,
        project_id: 1,
        username: "competitor",
        instagram_url: "https://instagram.com/competitor"
      });

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
      const mockUser = createMockUser({
        id: 1,
        telegram_id: 123456789,
        username: "testuser"
      });

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
