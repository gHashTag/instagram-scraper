/**
 * @file Тестер для последовательностей действий в Telegram-сценах
 * @description Содержит класс для тестирования последовательностей действий в Telegram-сценах
 */

import { jest, describe, it, beforeEach, afterEach } from "bun:test";
import { MockedTelegramContext, MockedStorageAdapter, SceneTestOptions, SequenceStep } from "./types";
import { createMockContext, createMockAdapter, resetAllMocks } from "./mocks";

/**
 * Класс для тестирования последовательностей действий в Telegram-сценах
 */
export class SequenceTester<T = any> {
  /** Имя сцены */
  private sceneName: string;
  /** Путь к файлу сцены */
  private sceneFilePath: string;
  /** Конструктор сцены */
  private sceneConstructor?: new (adapter: any, ...args: any[]) => T;
  /** Экземпляр сцены */
  private sceneInstance?: T;
  /** Дополнительные аргументы для конструктора сцены */
  private constructorArgs: any[];
  /** Мокированный контекст Telegraf */
  private mockContext: MockedTelegramContext;
  /** Мокированный адаптер хранилища */
  private mockAdapter: MockedStorageAdapter;

  /**
   * Создает экземпляр тестера для последовательностей действий в Telegram-сценах
   * @param options Опции для тестирования сцены
   */
  constructor(options: SceneTestOptions<T>) {
    this.sceneName = options.sceneName;
    this.sceneFilePath = options.sceneFilePath;
    this.sceneConstructor = options.sceneConstructor;
    this.sceneInstance = options.sceneInstance;
    this.constructorArgs = options.constructorArgs || [];
    this.mockContext = createMockContext();
    this.mockAdapter = createMockAdapter();
  }

  /**
   * Создает экземпляр сцены
   * @returns Экземпляр сцены
   */
  createScene(): T {
    if (this.sceneInstance) {
      return this.sceneInstance;
    }

    if (!this.sceneConstructor) {
      throw new Error("Не указан конструктор сцены");
    }

    return new this.sceneConstructor(this.mockAdapter, ...this.constructorArgs);
  }

  /**
   * Устанавливает мокированный контекст
   * @param context Мокированный контекст
   */
  setContext(context: MockedTelegramContext): void {
    this.mockContext = context;
  }

  /**
   * Получает мокированный контекст
   * @returns Мокированный контекст
   */
  getContext(): MockedTelegramContext {
    return this.mockContext;
  }

  /**
   * Устанавливает мокированный адаптер хранилища
   * @param adapter Мокированный адаптер хранилища
   */
  setAdapter(adapter: MockedStorageAdapter): void {
    this.mockAdapter = adapter;
  }

  /**
   * Получает мокированный адаптер хранилища
   * @returns Мокированный адаптер хранилища
   */
  getAdapter(): MockedStorageAdapter {
    return this.mockAdapter;
  }

  /**
   * Сбрасывает все моки
   */
  resetMocks(): void {
    resetAllMocks();
  }

  /**
   * Тестирует последовательность действий
   * @param sequenceName Название последовательности
   * @param steps Шаги последовательности
   */
  testSequence(sequenceName: string, steps: SequenceStep<T>[]): void {
    describe(`${this.sceneName} - ${sequenceName}`, () => {
      let scene: T;

      beforeEach(() => {
        // Сбрасываем все моки перед каждым тестом
        this.resetMocks();
        
        // Создаем экземпляр сцены
        scene = this.createScene();
        
        // Добавляем адаптер в контекст
        this.mockContext.storage = this.mockAdapter;
      });

      afterEach(() => {
        // Очищаем все моки после каждого теста
        this.resetMocks();
      });

      // Создаем тест для последовательности
      it(`should execute ${sequenceName} sequence correctly`, async () => {
        // Выполняем каждый шаг последовательности
        for (const step of steps) {
          // Сбрасываем моки перед каждым шагом
          jest.clearAllMocks();
          
          // Выполняем действие
          await step.action(this);
          
          // Выполняем проверки
          step.assertions(this);
        }
      });
    });
  }

  /**
   * Создает шаг для отправки текстового сообщения
   * @param text Текст сообщения
   * @returns Шаг последовательности
   */
  createTextMessageStep(text: string): SequenceStep<T> {
    return {
      name: `Send text message: "${text}"`,
      action: async (tester: SequenceTester<T>) => {
        // Обновляем контекст с новым текстовым сообщением
        const context = tester.getContext();
        context.message = {
          ...context.message,
          text
        };
        
        // Вызываем обработчик текстовых сообщений
        if ((tester.createScene() as any).onText) {
          await (tester.createScene() as any).onText(context);
        }
      },
      assertions: () => {
        // Проверки будут определены в тесте
      }
    };
  }

  /**
   * Создает шаг для отправки callback query
   * @param data Данные callback query
   * @returns Шаг последовательности
   */
  createCallbackQueryStep(data: string): SequenceStep<T> {
    return {
      name: `Send callback query: "${data}"`,
      action: async (tester: SequenceTester<T>) => {
        // Обновляем контекст с новым callback query
        const context = tester.getContext();
        context.callbackQuery = {
          ...context.callbackQuery,
          data
        };
        
        // Вызываем обработчик callback query
        const scene = tester.createScene() as any;
        
        // Ищем обработчик для данного callback query
        const handlers = Object.entries(scene).filter(([key, value]) => {
          return typeof value === "function" && key.startsWith("on") && key !== "onText";
        });
        
        // Вызываем первый подходящий обработчик
        for (const [, handler] of handlers) {
          try {
            await handler(context);
            break;
          } catch (error) {
            // Игнорируем ошибки, так как обработчик может не подходить для данного callback query
          }
        }
      },
      assertions: () => {
        // Проверки будут определены в тесте
      }
    };
  }

  /**
   * Создает шаг для входа в сцену
   * @returns Шаг последовательности
   */
  createEnterSceneStep(): SequenceStep<T> {
    return {
      name: `Enter scene: "${this.sceneName}"`,
      action: async (tester: SequenceTester<T>) => {
        // Вызываем метод enter
        const scene = tester.createScene() as any;
        if (scene.enter) {
          await scene.enter(tester.getContext());
        }
      },
      assertions: () => {
        // Проверки будут определены в тесте
      }
    };
  }
}
