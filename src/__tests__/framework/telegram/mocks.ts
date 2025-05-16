/**
 * @file Моки для тестирования Telegram-сцен
 * @description Содержит функции для создания моков контекста и адаптера хранилища
 */

import { jest } from "bun:test";
import { MockContextOptions, MockedTelegramContext, MockAdapterOptions, MockedStorageAdapter } from "./types";

/**
 * Создает мокированный контекст Telegraf для тестирования
 * @param options Опции для создания контекста
 * @returns Мокированный контекст Telegraf
 */
export function createMockContext(options: MockContextOptions = {}): MockedTelegramContext {
  const {
    userId = 123456789,
    username = "testuser",
    firstName = "Test",
    lastName = "User",
    messageText = "Test message",
    callbackQueryData,
    matchData,
    sessionData = {},
    ...additionalOptions
  } = options;

  // Создаем базовый контекст
  const ctx = {
    scene: {
      enter: jest.fn(),
      reenter: jest.fn(),
      leave: jest.fn(),
      session: {
        ...sessionData,
      },
    },
    reply: jest.fn().mockResolvedValue({}),
    from: userId ? {
      id: userId,
      username,
      first_name: firstName,
      last_name: lastName
    } : undefined,
    answerCbQuery: jest.fn().mockResolvedValue(true),
    sendChatAction: jest.fn().mockResolvedValue(true),
    editMessageText: jest.fn().mockResolvedValue({}),
    editMessageReplyMarkup: jest.fn().mockResolvedValue({}),
    deleteMessage: jest.fn().mockResolvedValue(true),
    ...additionalOptions
  } as MockedTelegramContext;

  // Добавляем callbackQuery, если он указан
  if (callbackQueryData) {
    ctx.callbackQuery = {
      data: callbackQueryData,
      id: "123",
      from: { id: userId, username, first_name: firstName, last_name: lastName },
      chat_instance: "test_instance",
      message: {
        message_id: 1,
        chat: { id: userId, type: "private" }
      }
    } as any;
  }

  // Добавляем match, если он указан
  if (matchData) {
    ctx.match = matchData as unknown as RegExpExecArray;
  }

  // Добавляем message, если указан текст сообщения
  if (messageText) {
    ctx.message = {
      text: messageText,
      chat: { id: userId, type: "private" },
      from: { id: userId, username, first_name: firstName, last_name: lastName },
      message_id: 1,
      date: Math.floor(Date.now() / 1000)
    } as any;
  }

  return ctx;
}

/**
 * Создает мокированный адаптер хранилища для тестирования
 * @param options Опции для создания адаптера
 * @returns Мокированный адаптер хранилища
 */
export function createMockAdapter(options: MockAdapterOptions = {}): MockedStorageAdapter {
  // Создаем базовый адаптер с моками для всех методов
  const adapter = {
    initialize: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    executeQuery: jest.fn().mockResolvedValue({ rows: [] }),
  } as unknown as MockedStorageAdapter;

  // Переопределяем методы, если они указаны в опциях
  Object.entries(options).forEach(([key, value]) => {
    if (value && key in adapter) {
      (adapter as any)[key] = value;
    } else if (value) {
      (adapter as any)[key] = value;
    }
  });

  return adapter;
}

/**
 * Сбрасывает все моки
 */
export function resetAllMocks(): void {
  jest.clearAllMocks();
}

/**
 * Создает мок для инлайн-клавиатуры
 * @param buttons Массив кнопок или массив массивов кнопок
 * @returns Мок инлайн-клавиатуры
 */
export function createInlineKeyboardMock(buttons: Array<Array<{ text: string, callback_data: string }> | { text: string, callback_data: string }>): any {
  // Преобразуем массив кнопок в массив массивов кнопок, если это необходимо
  const keyboard = buttons.map(row => {
    if (Array.isArray(row)) {
      return row;
    } else {
      return [row];
    }
  });

  return {
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
}

/**
 * Создает мок для кнопки "Назад"
 * @param callbackData Данные для callback_query
 * @returns Мок кнопки "Назад"
 */
export function createBackButtonMock(callbackData: string): any {
  return createInlineKeyboardMock([
    { text: "« Назад", callback_data: callbackData }
  ]);
}
