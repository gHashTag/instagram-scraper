/**
 * @file Класс для тестирования Telegram-сцен
 * @description Содержит класс SceneTester для удобного тестирования Telegram-сцен
 */

import { createMockAdapter, createMockContext, resetAllMocks } from "./mocks";
import { MockAdapterOptions, MockContextOptions, MockedStorageAdapter, MockedTelegramContext, SceneTestOptions } from "./types";

/**
 * Класс для тестирования Telegram сцен
 */
export class SceneTester<T> {
  private scene: T;
  private mockAdapter: MockedStorageAdapter;
  private mockContext: MockedTelegramContext;

  /**
   * Создает экземпляр тестера сцены
   * @param options Опции для тестирования сцены
   * @param adapterOptions Опции для создания мокированного адаптера
   * @param contextOptions Опции для создания мокированного контекста
   */
  constructor(
    private options: SceneTestOptions<T>,
    adapterOptions: MockAdapterOptions = {},
    contextOptions: MockContextOptions = {}
  ) {
    // Создаем мокированный адаптер
    this.mockAdapter = createMockAdapter(adapterOptions);

    // Создаем мокированный контекст
    this.mockContext = createMockContext(contextOptions);

    // Добавляем адаптер в контекст
    this.mockContext.storage = this.mockAdapter;

    // Создаем или используем экземпляр сцены
    if (options.sceneInstance) {
      this.scene = options.sceneInstance as T;
    } else if (options.sceneConstructor) {
      this.scene = new options.sceneConstructor(this.mockAdapter) as T;
    } else {
      throw new Error("Необходимо указать либо sceneInstance, либо sceneConstructor");
    }
  }

  /**
   * Получает экземпляр сцены
   * @returns Экземпляр сцены
   */
  getScene(): T {
    return this.scene;
  }

  /**
   * Получает мокированный адаптер
   * @returns Мокированный адаптер
   */
  getAdapter(): MockedStorageAdapter {
    return this.mockAdapter;
  }

  /**
   * Получает мокированный контекст
   * @returns Мокированный контекст
   */
  getContext(): MockedTelegramContext {
    return this.mockContext;
  }

  /**
   * Обновляет мокированный контекст
   * @param options Опции для создания контекста
   * @returns Обновленный мокированный контекст
   */
  updateContext(options: MockContextOptions): MockedTelegramContext {
    this.mockContext = createMockContext({
      ...options,
    });

    // Добавляем адаптер в обновленный контекст
    this.mockContext.storage = this.mockAdapter;

    return this.mockContext;
  }

  /**
   * Обновляет мокированный адаптер
   * @param options Опции для создания адаптера
   * @returns Обновленный мокированный адаптер
   */
  updateAdapter(options: MockAdapterOptions): MockedStorageAdapter {
    Object.entries(options).forEach(([key, value]) => {
      if (value && key in this.mockAdapter) {
        (this.mockAdapter as any)[key] = value;
      }
    });
    return this.mockAdapter;
  }

  /**
   * Сбрасывает все моки
   */
  resetMocks(): void {
    resetAllMocks();
  }

  /**
   * Вызывает метод сцены
   * @param methodName Имя метода
   * @param args Аргументы метода
   * @returns Результат вызова метода
   */
  async callSceneMethod(methodName: keyof T, ...args: any[]): Promise<any> {
    if (typeof (this.scene as any)[methodName] !== "function") {
      throw new Error(`Метод ${String(methodName)} не найден в сцене ${this.options.sceneName}`);
    }
    return (this.scene as any)[methodName](...args);
  }
}
