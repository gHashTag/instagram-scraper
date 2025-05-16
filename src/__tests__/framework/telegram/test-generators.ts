/**
 * @file Генераторы тестов для Telegram-сцен
 * @description Содержит функции для генерации типовых тестов для Telegram-сцен
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { MockedTelegramContext, MockedStorageAdapter } from "./types";
import { createMockContext, createMockAdapter, resetAllMocks } from "./mocks";
import * as assertions from "./assertions";

/**
 * Генерирует тесты для обработчика текстовых сообщений
 * @param options Опции для генерации тестов
 */
export function generateTextHandlerTests<T = any>(options: {
  /** Название тестового набора */
  name: string;
  /** Экземпляр сцены */
  scene: T;
  /** Функция для получения обработчика текстовых сообщений */
  getHandler: (scene: T) => (ctx: any) => Promise<void>;
  /** Тестовые случаи */
  cases: Array<{
    /** Название теста */
    name: string;
    /** Текст сообщения */
    text: string;
    /** Настройка контекста */
    setupContext?: (ctx: MockedTelegramContext) => void;
    /** Настройка адаптера */
    setupAdapter?: (adapter: MockedStorageAdapter) => void;
    /** Проверки */
    assertions: (ctx: MockedTelegramContext, adapter: MockedStorageAdapter) => void;
  }>;
}): void {
  const { name, scene, getHandler, cases } = options;

  describe(`${name} - Text Handler Tests`, () => {
    let mockContext: MockedTelegramContext;
    let mockAdapter: MockedStorageAdapter;
    const handler = getHandler(scene);

    beforeEach(() => {
      // Сбрасываем все моки перед каждым тестом
      resetAllMocks();
      
      // Создаем мокированный контекст и адаптер
      mockContext = createMockContext();
      mockAdapter = createMockAdapter();
      
      // Добавляем адаптер в контекст
      mockContext.storage = mockAdapter;
    });

    afterEach(() => {
      // Очищаем все моки после каждого теста
      resetAllMocks();
    });

    // Создаем тесты для каждого тестового случая
    cases.forEach(testCase => {
      it(testCase.name, async () => {
        // Устанавливаем текст сообщения
        mockContext.message = {
          ...mockContext.message,
          text: testCase.text
        };
        
        // Выполняем настройку контекста, если она указана
        if (testCase.setupContext) {
          testCase.setupContext(mockContext);
        }
        
        // Выполняем настройку адаптера, если она указана
        if (testCase.setupAdapter) {
          testCase.setupAdapter(mockAdapter);
        }
        
        // Вызываем обработчик
        await handler(mockContext);
        
        // Выполняем проверки
        testCase.assertions(mockContext, mockAdapter);
      });
    });
  });
}

/**
 * Генерирует тесты для обработчика callback query
 * @param options Опции для генерации тестов
 */
export function generateCallbackQueryHandlerTests<T = any>(options: {
  /** Название тестового набора */
  name: string;
  /** Экземпляр сцены */
  scene: T;
  /** Функция для получения обработчика callback query */
  getHandler: (scene: T) => (ctx: any) => Promise<void>;
  /** Тестовые случаи */
  cases: Array<{
    /** Название теста */
    name: string;
    /** Данные callback query */
    callbackData: string;
    /** Настройка контекста */
    setupContext?: (ctx: MockedTelegramContext) => void;
    /** Настройка адаптера */
    setupAdapter?: (adapter: MockedStorageAdapter) => void;
    /** Проверки */
    assertions: (ctx: MockedTelegramContext, adapter: MockedStorageAdapter) => void;
  }>;
}): void {
  const { name, scene, getHandler, cases } = options;

  describe(`${name} - Callback Query Handler Tests`, () => {
    let mockContext: MockedTelegramContext;
    let mockAdapter: MockedStorageAdapter;
    const handler = getHandler(scene);

    beforeEach(() => {
      // Сбрасываем все моки перед каждым тестом
      resetAllMocks();
      
      // Создаем мокированный контекст и адаптер
      mockContext = createMockContext();
      mockAdapter = createMockAdapter();
      
      // Добавляем адаптер в контекст
      mockContext.storage = mockAdapter;
    });

    afterEach(() => {
      // Очищаем все моки после каждого теста
      resetAllMocks();
    });

    // Создаем тесты для каждого тестового случая
    cases.forEach(testCase => {
      it(testCase.name, async () => {
        // Устанавливаем данные callback query
        mockContext.callbackQuery = {
          ...mockContext.callbackQuery,
          data: testCase.callbackData
        };
        
        // Выполняем настройку контекста, если она указана
        if (testCase.setupContext) {
          testCase.setupContext(mockContext);
        }
        
        // Выполняем настройку адаптера, если она указана
        if (testCase.setupAdapter) {
          testCase.setupAdapter(mockAdapter);
        }
        
        // Вызываем обработчик
        await handler(mockContext);
        
        // Выполняем проверки
        testCase.assertions(mockContext, mockAdapter);
      });
    });
  });
}

/**
 * Генерирует тесты для метода enter сцены
 * @param options Опции для генерации тестов
 */
export function generateEnterTests<T = any>(options: {
  /** Название тестового набора */
  name: string;
  /** Экземпляр сцены */
  scene: T;
  /** Тестовые случаи */
  cases: Array<{
    /** Название теста */
    name: string;
    /** Настройка контекста */
    setupContext?: (ctx: MockedTelegramContext) => void;
    /** Настройка адаптера */
    setupAdapter?: (adapter: MockedStorageAdapter) => void;
    /** Проверки */
    assertions: (ctx: MockedTelegramContext, adapter: MockedStorageAdapter) => void;
  }>;
}): void {
  const { name, scene, cases } = options;

  describe(`${name} - Enter Tests`, () => {
    let mockContext: MockedTelegramContext;
    let mockAdapter: MockedStorageAdapter;

    beforeEach(() => {
      // Сбрасываем все моки перед каждым тестом
      resetAllMocks();
      
      // Создаем мокированный контекст и адаптер
      mockContext = createMockContext();
      mockAdapter = createMockAdapter();
      
      // Добавляем адаптер в контекст
      mockContext.storage = mockAdapter;
    });

    afterEach(() => {
      // Очищаем все моки после каждого теста
      resetAllMocks();
    });

    // Создаем тесты для каждого тестового случая
    cases.forEach(testCase => {
      it(testCase.name, async () => {
        // Выполняем настройку контекста, если она указана
        if (testCase.setupContext) {
          testCase.setupContext(mockContext);
        }
        
        // Выполняем настройку адаптера, если она указана
        if (testCase.setupAdapter) {
          testCase.setupAdapter(mockAdapter);
        }
        
        // Вызываем метод enter
        if ((scene as any).enter) {
          await (scene as any).enter(mockContext);
        }
        
        // Выполняем проверки
        testCase.assertions(mockContext, mockAdapter);
      });
    });
  });
}
