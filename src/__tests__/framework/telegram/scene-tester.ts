/**
 * @file Тестер для Telegram-сцен
 * @description Содержит класс для тестирования Telegram-сцен
 */

import { jest, describe, it, beforeEach, afterEach } from "bun:test";
import { MockedTelegramContext, MockedStorageAdapter, SceneTestOptions } from "./types";
import { createMockContext, createMockAdapter, resetAllMocks } from "./mocks";

/**
 * Класс для тестирования Telegram-сцен
 */
export class SceneTester<T = any> {
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
   * Создает экземпляр тестера для Telegram-сцены
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
   * Создает тестовый набор для сцены
   * @param testCases Тестовые случаи
   */
  createTestSuite(testCases: Array<{
    name: string;
    setup?: (tester: SceneTester<T>) => void;
    test: (scene: T, context: MockedTelegramContext, adapter: MockedStorageAdapter) => Promise<void>;
  }>): void {
    describe(`${this.sceneName} Tests`, () => {
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

      // Создаем тесты для каждого тестового случая
      testCases.forEach(testCase => {
        it(testCase.name, async () => {
          // Выполняем настройку, если она указана
          if (testCase.setup) {
            testCase.setup(this);
          }

          // Выполняем тест
          await testCase.test(scene, this.mockContext, this.mockAdapter);
        });
      });
    });
  }

  /**
   * Создает тест для метода enter сцены
   * @param options Опции для теста
   */
  testEnter(options: {
    setup?: (tester: SceneTester<T>) => void;
    assertions: (scene: T, context: MockedTelegramContext, adapter: MockedStorageAdapter) => void;
  }): void {
    this.createTestSuite([
      {
        name: "should handle enter correctly",
        setup: options.setup,
        test: async (scene: T, context: MockedTelegramContext, adapter: MockedStorageAdapter) => {
          // Вызываем метод enter
          if ((scene as any).enter) {
            await (scene as any).enter(context);
          }

          // Выполняем проверки
          options.assertions(scene, context, adapter);
        }
      }
    ]);
  }

  /**
   * Создает тест для метода leave сцены
   * @param options Опции для теста
   */
  testLeave(options: {
    setup?: (tester: SceneTester<T>) => void;
    assertions: (scene: T, context: MockedTelegramContext, adapter: MockedStorageAdapter) => void;
  }): void {
    this.createTestSuite([
      {
        name: "should handle leave correctly",
        setup: options.setup,
        test: async (scene: T, context: MockedTelegramContext, adapter: MockedStorageAdapter) => {
          // Вызываем метод leave
          if ((scene as any).leave) {
            await (scene as any).leave(context);
          }

          // Выполняем проверки
          options.assertions(scene, context, adapter);
        }
      }
    ]);
  }
}
