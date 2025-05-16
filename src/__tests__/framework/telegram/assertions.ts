/**
 * @file Утверждения для тестирования Telegram-сцен
 * @description Содержит функции для проверки вызовов методов контекста
 */

import { expect } from "bun:test";
import { MockedTelegramContext } from "./types";

/**
 * Проверяет, что был вызван метод reply с указанным текстом
 * @param ctx Мокированный контекст Telegraf
 * @param text Текст, который должен содержаться в ответе
 * @param options Опции для проверки
 */
export function expectReplyWithText(
  ctx: MockedTelegramContext,
  text: string | RegExp,
  options: { exact?: boolean; callIndex?: number } = {}
): void {
  const { exact = false, callIndex = 0 } = options;

  // Проверяем, что метод reply был вызван
  expect(ctx.reply).toHaveBeenCalled();

  // Получаем аргументы вызова
  const calls = ctx.reply.mock.calls;
  expect(calls.length).toBeGreaterThan(callIndex);
  
  const args = calls[callIndex];
  const replyText = args[0];

  // Проверяем текст ответа
  if (exact) {
    if (text instanceof RegExp) {
      expect(replyText).toMatch(text);
    } else {
      expect(replyText).toBe(text);
    }
  } else {
    if (text instanceof RegExp) {
      expect(replyText).toMatch(text);
    } else {
      expect(replyText).toContain(text);
    }
  }
}

/**
 * Проверяет, что был вызван метод reply с указанной клавиатурой
 * @param ctx Мокированный контекст Telegraf
 * @param keyboard Клавиатура, которая должна содержаться в ответе
 * @param options Опции для проверки
 */
export function expectReplyWithKeyboard(
  ctx: MockedTelegramContext,
  keyboard: any,
  options: { callIndex?: number } = {}
): void {
  const { callIndex = 0 } = options;

  // Проверяем, что метод reply был вызван
  expect(ctx.reply).toHaveBeenCalled();

  // Получаем аргументы вызова
  const calls = ctx.reply.mock.calls;
  expect(calls.length).toBeGreaterThan(callIndex);
  
  const args = calls[callIndex];
  const replyOptions = args[1];

  // Проверяем клавиатуру
  expect(replyOptions).toBeDefined();
  expect(replyOptions.reply_markup).toBeDefined();
  expect(replyOptions.reply_markup.inline_keyboard).toBeDefined();

  // Если передан конкретный keyboard, проверяем его
  if (keyboard) {
    expect(replyOptions.reply_markup.inline_keyboard).toEqual(keyboard);
  }
}

/**
 * Проверяет, что был вызван метод answerCbQuery с указанным текстом
 * @param ctx Мокированный контекст Telegraf
 * @param text Текст, который должен содержаться в ответе
 * @param options Опции для проверки
 */
export function expectAnswerCbQuery(
  ctx: MockedTelegramContext,
  text?: string | RegExp,
  options: { exact?: boolean; callIndex?: number } = {}
): void {
  const { exact = false, callIndex = 0 } = options;

  // Проверяем, что метод answerCbQuery был вызван
  expect(ctx.answerCbQuery).toHaveBeenCalled();

  // Если текст не указан, просто проверяем вызов
  if (!text) return;

  // Получаем аргументы вызова
  const calls = ctx.answerCbQuery.mock.calls;
  expect(calls.length).toBeGreaterThan(callIndex);
  
  const args = calls[callIndex];
  const answerText = args[0];

  // Проверяем текст ответа
  if (exact) {
    if (text instanceof RegExp) {
      expect(answerText).toMatch(text);
    } else {
      expect(answerText).toBe(text);
    }
  } else {
    if (text instanceof RegExp) {
      expect(answerText).toMatch(text);
    } else {
      expect(answerText).toContain(text);
    }
  }
}

/**
 * Проверяет, что был вызван метод scene.enter с указанной сценой
 * @param ctx Мокированный контекст Telegraf
 * @param sceneName Имя сцены
 * @param options Опции для проверки
 */
export function expectSceneEnter(
  ctx: MockedTelegramContext,
  sceneName: string,
  options: { callIndex?: number } = {}
): void {
  const { callIndex = 0 } = options;

  // Проверяем, что метод scene.enter был вызван
  expect(ctx.scene.enter).toHaveBeenCalled();

  // Получаем аргументы вызова
  const calls = ctx.scene.enter.mock.calls;
  expect(calls.length).toBeGreaterThan(callIndex);
  
  const args = calls[callIndex];
  const enteredSceneName = args[0];

  // Проверяем имя сцены
  expect(enteredSceneName).toBe(sceneName);
}

/**
 * Проверяет, что был вызван метод scene.leave
 * @param ctx Мокированный контекст Telegraf
 */
export function expectSceneLeave(ctx: MockedTelegramContext): void {
  expect(ctx.scene.leave).toHaveBeenCalled();
}

/**
 * Проверяет, что был вызван метод scene.reenter
 * @param ctx Мокированный контекст Telegraf
 */
export function expectSceneReenter(ctx: MockedTelegramContext): void {
  expect(ctx.scene.reenter).toHaveBeenCalled();
}

/**
 * Проверяет, что был вызван метод sendChatAction с указанным действием
 * @param ctx Мокированный контекст Telegraf
 * @param action Действие
 */
export function expectSendChatAction(
  ctx: MockedTelegramContext,
  action: string
): void {
  expect(ctx.sendChatAction).toHaveBeenCalledWith(action);
}

/**
 * Проверяет, что был вызван метод editMessageText с указанным текстом
 * @param ctx Мокированный контекст Telegraf
 * @param text Текст, который должен содержаться в ответе
 * @param options Опции для проверки
 */
export function expectEditMessageText(
  ctx: MockedTelegramContext,
  text: string | RegExp,
  options: { exact?: boolean; callIndex?: number } = {}
): void {
  const { exact = false, callIndex = 0 } = options;

  // Проверяем, что метод editMessageText был вызван
  expect(ctx.editMessageText).toHaveBeenCalled();

  // Получаем аргументы вызова
  const calls = ctx.editMessageText.mock.calls;
  expect(calls.length).toBeGreaterThan(callIndex);
  
  const args = calls[callIndex];
  const editText = args[0];

  // Проверяем текст ответа
  if (exact) {
    if (text instanceof RegExp) {
      expect(editText).toMatch(text);
    } else {
      expect(editText).toBe(text);
    }
  } else {
    if (text instanceof RegExp) {
      expect(editText).toMatch(text);
    } else {
      expect(editText).toContain(text);
    }
  }
}
