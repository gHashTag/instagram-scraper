/**
 * @file Генераторы тестов для Telegram-сцен
 * @description Содержит функции для генерации тестов для обработчиков входа, действий и текстовых сообщений
 */

import { User, Project, ScraperSceneStep } from "../../../types";
import { SceneTester } from "./scene-tester";
import { jest } from "bun:test";

/**
 * Генерирует тесты для обработчика входа в сцену
 * @param sceneTester Тестер сцены
 * @param enterHandlerName Имя обработчика входа в сцену
 */
export function generateEnterHandlerTests<T>(
  sceneTester: SceneTester<T>,
  enterHandlerName: keyof T = "enterHandler" as keyof T
): void {
  describe("Enter Handler", () => {
    beforeEach(() => {
      sceneTester.resetMocks();
    });

    it("should handle successful scene entry", async () => {
      // Настраиваем моки для успешного сценария
      const mockUser: User = {
        id: 1,
        telegram_id: 123456789,
        username: "testuser",
        created_at: new Date().toISOString(),
        is_active: true
      };

      const mockProjects: Project[] = [
        {
          id: 1,
          user_id: 1,
          name: "Test Project",
          created_at: new Date().toISOString(),
          is_active: true
        },
      ];

      sceneTester.updateAdapter({
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
        getProjectsByUserId: jest.fn().mockResolvedValue(mockProjects),
      });

      // Вызываем обработчик входа в сцену
      await sceneTester.callSceneMethod(enterHandlerName, sceneTester.getContext());

      // Проверяем, что были вызваны нужные методы
      expect(sceneTester.getAdapter().getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(sceneTester.getAdapter().getProjectsByUserId).toHaveBeenCalledWith(1);
      expect(sceneTester.getContext().reply).toHaveBeenCalled();
      expect(sceneTester.getAdapter().close).toHaveBeenCalled();
    });

    it("should handle error when user is not found", async () => {
      // Настраиваем моки для сценария с ошибкой
      sceneTester.updateAdapter({
        getUserByTelegramId: jest.fn().mockResolvedValue(null),
      });

      // Вызываем обработчик входа в сцену
      await sceneTester.callSceneMethod(enterHandlerName, sceneTester.getContext());

      // Проверяем, что были вызваны нужные методы
      expect(sceneTester.getAdapter().getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(sceneTester.getContext().reply).toHaveBeenCalledWith(expect.stringContaining("ошибка"));
      expect(sceneTester.getContext().scene.leave).toHaveBeenCalled();
      expect(sceneTester.getAdapter().close).toHaveBeenCalled();
    });

    // Дополнительные тесты можно добавить здесь
  });
}

/**
 * Генерирует тесты для обработчика действия
 * @param sceneTester Тестер сцены
 * @param actionHandlerName Имя обработчика действия
 * @param actionName Название действия (для описания теста)
 */
export function generateActionHandlerTests<T>(
  sceneTester: SceneTester<T>,
  actionHandlerName: keyof T,
  actionName: string
): void {
  describe(`Action Handler - ${actionName}`, () => {
    beforeEach(() => {
      sceneTester.resetMocks();
    });

    it("should handle successful action", async () => {
      // Настраиваем моки для успешного сценария
      const mockUser: User = {
        id: 1,
        telegram_id: 123456789,
        username: "testuser",
        created_at: new Date().toISOString(),
        is_active: true
      };

      sceneTester.updateAdapter({
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
      });

      // Обновляем контекст с данными для callback query
      sceneTester.updateContext({
        callbackQueryData: `${actionName}_1`,
        matchData: [`${actionName}_1`, "1"],
      });

      // Вызываем обработчик действия
      await sceneTester.callSceneMethod(actionHandlerName, sceneTester.getContext());

      // Проверяем, что были вызваны нужные методы
      expect(sceneTester.getContext().answerCbQuery).toHaveBeenCalled();
      expect(sceneTester.getAdapter().close).toHaveBeenCalled();
    });

    it("should handle error scenario", async () => {
      // Настраиваем моки для сценария с ошибкой
      sceneTester.updateAdapter({
        getUserByTelegramId: jest.fn().mockResolvedValue(null),
      });

      // Обновляем контекст с данными для callback query
      sceneTester.updateContext({
        callbackQueryData: `${actionName}_1`,
        matchData: [`${actionName}_1`, "1"],
      });

      // Вызываем обработчик действия
      await sceneTester.callSceneMethod(actionHandlerName, sceneTester.getContext());

      // Проверяем, что были вызваны нужные методы
      expect(sceneTester.getContext().answerCbQuery).toHaveBeenCalled();
      expect(sceneTester.getAdapter().close).toHaveBeenCalled();
    });

    // Дополнительные тесты можно добавить здесь
  });
}

/**
 * Генерирует тесты для обработчика текстовых сообщений
 * @param sceneTester Тестер сцены
 * @param textHandlerName Имя обработчика текстовых сообщений
 * @param stepName Название шага (для описания теста)
 * @param stepValue Значение шага из ScraperSceneStep
 */
export function generateTextHandlerTests<T>(
  sceneTester: SceneTester<T>,
  textHandlerName: keyof T,
  stepName: string,
  stepValue: ScraperSceneStep
): void {
  describe(`Text Handler - ${stepName}`, () => {
    beforeEach(() => {
      sceneTester.resetMocks();
    });

    it(`should do nothing if step is not ${stepName}`, async () => {
      // Обновляем контекст с другим шагом
      sceneTester.updateContext({
        messageText: "Test input",
        sessionData: {
          step: "NONE" as any,
          projectId: 1,
        },
      });

      // Вызываем обработчик текстового сообщения
      await sceneTester.callSceneMethod(textHandlerName, sceneTester.getContext());

      // Проверяем, что не были вызваны методы адаптера
      expect(sceneTester.getAdapter().getUserByTelegramId).not.toHaveBeenCalled();
      expect(sceneTester.getContext().reply).not.toHaveBeenCalled();
      expect(sceneTester.getAdapter().close).not.toHaveBeenCalled();
    });

    it("should handle successful text input", async () => {
      // Настраиваем моки для успешного сценария
      const mockUser: User = {
        id: 1,
        telegram_id: 123456789,
        username: "testuser",
        created_at: new Date().toISOString(),
        is_active: true
      };

      sceneTester.updateAdapter({
        getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
      });

      // Обновляем контекст с нужным шагом
      sceneTester.updateContext({
        messageText: "Test input",
        sessionData: {
          step: stepValue,
          projectId: 1,
        },
      });

      // Вызываем обработчик текстового сообщения
      await sceneTester.callSceneMethod(textHandlerName, sceneTester.getContext());

      // Проверяем, что были вызваны нужные методы
      expect(sceneTester.getAdapter().getUserByTelegramId).toHaveBeenCalledWith(123456789);
      expect(sceneTester.getContext().reply).toHaveBeenCalled();
      expect(sceneTester.getAdapter().close).toHaveBeenCalled();
    });

    // Дополнительные тесты можно добавить здесь
  });
}
