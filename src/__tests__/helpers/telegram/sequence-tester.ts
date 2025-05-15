/**
 * @file Класс для тестирования последовательностей действий
 * @description Содержит класс SceneSequenceTester для тестирования последовательностей действий
 */

import { SceneTester } from "./scene-tester";
import { MockContextOptions } from "./types";

/**
 * Класс для тестирования последовательностей действий в сцене
 */
export class SceneSequenceTester<T> {
  private sceneTester: SceneTester<T>;
  private steps: Array<{
    name: string;
    action: (tester: SceneTester<T>) => Promise<void>;
    assertions: (tester: SceneTester<T>) => void;
  }> = [];

  /**
   * Создает экземпляр тестера последовательностей
   * @param sceneTester Тестер сцены
   */
  constructor(sceneTester: SceneTester<T>) {
    this.sceneTester = sceneTester;
  }

  /**
   * Добавляет шаг в последовательность
   * @param name Название шага
   * @param action Действие, которое нужно выполнить
   * @param assertions Проверки, которые нужно выполнить после действия
   */
  addStep(
    name: string,
    action: (tester: SceneTester<T>) => Promise<void>,
    assertions: (tester: SceneTester<T>) => void
  ): SceneSequenceTester<T> {
    this.steps.push({ name, action, assertions });
    return this;
  }

  /**
   * Добавляет шаг с вводом текста
   * @param name Название шага
   * @param text Текст, который нужно ввести
   * @param handlerName Имя обработчика текста
   * @param contextOptions Дополнительные опции для контекста
   * @param assertions Проверки, которые нужно выполнить после действия
   */
  addTextInput(
    name: string,
    text: string,
    handlerName: keyof T,
    contextOptions: MockContextOptions = {},
    assertions: (tester: SceneTester<T>) => void
  ): SceneSequenceTester<T> {
    return this.addStep(
      name,
      async (tester) => {
        tester.updateContext({
          messageText: text,
          ...contextOptions
        });
        await tester.callSceneMethod(handlerName, tester.getContext());
      },
      assertions
    );
  }

  /**
   * Добавляет шаг с нажатием на кнопку
   * @param name Название шага
   * @param callbackData Данные callback_query
   * @param handlerName Имя обработчика действия
   * @param contextOptions Дополнительные опции для контекста
   * @param assertions Проверки, которые нужно выполнить после действия
   */
  addButtonClick(
    name: string,
    callbackData: string,
    handlerName: keyof T,
    contextOptions: MockContextOptions = {},
    assertions: (tester: SceneTester<T>) => void
  ): SceneSequenceTester<T> {
    return this.addStep(
      name,
      async (tester) => {
        tester.updateContext({
          callbackQueryData: callbackData,
          matchData: [callbackData, ...callbackData.split('_').slice(1)],
          ...contextOptions
        });
        await tester.callSceneMethod(handlerName, tester.getContext());
      },
      assertions
    );
  }

  /**
   * Добавляет шаг с входом в сцену
   * @param name Название шага
   * @param enterHandlerName Имя обработчика входа в сцену
   * @param contextOptions Дополнительные опции для контекста
   * @param assertions Проверки, которые нужно выполнить после действия
   */
  addSceneEnter(
    name: string,
    enterHandlerName: keyof T = "enterHandler" as keyof T,
    contextOptions: MockContextOptions = {},
    assertions: (tester: SceneTester<T>) => void
  ): SceneSequenceTester<T> {
    return this.addStep(
      name,
      async (tester) => {
        tester.updateContext(contextOptions);
        await tester.callSceneMethod(enterHandlerName, tester.getContext());
      },
      assertions
    );
  }

  /**
   * Запускает последовательность шагов
   */
  async run(): Promise<void> {
    this.sceneTester.resetMocks();
    
    for (const step of this.steps) {
      await step.action(this.sceneTester);
      step.assertions(this.sceneTester);
    }
  }

  /**
   * Генерирует тесты для последовательности
   * @param testName Название теста
   */
  generateTest(testName: string): void {
    it(testName, async () => {
      await this.run();
    });
  }
}
