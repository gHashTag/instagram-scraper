/**
 * @file Утилиты для проверки состояния сцены
 * @description Содержит функции для проверки состояния сцены и отправленных сообщений
 */

import { MockedTelegramContext } from "./types";
import { ScraperSceneStep } from "../../../types";

/**
 * Проверяет, что сцена находится на определенном шаге
 * @param ctx Мокированный контекст
 * @param step Ожидаемый шаг
 */
export function expectSceneStep(ctx: MockedTelegramContext, step: ScraperSceneStep): void {
  expect(ctx.scene.session.step).toBe(step);
}

/**
 * Проверяет, что было отправлено сообщение, содержащее указанный текст
 * @param ctx Мокированный контекст
 * @param text Текст, который должен содержаться в сообщении
 */
export function expectMessageContaining(ctx: MockedTelegramContext, text: string): void {
  expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining(text));
}

/**
 * Проверяет, что была отправлена инлайн-клавиатура с указанными кнопками
 * @param ctx Мокированный контекст
 * @param buttonTexts Тексты кнопок, которые должны присутствовать в клавиатуре
 */
export function expectInlineKeyboardWithButtons(ctx: MockedTelegramContext, buttonTexts: string[]): void {
  const calls = ctx.reply.mock.calls;
  let found = false;

  for (const call of calls) {
    if (call[1] && call[1].reply_markup && call[1].reply_markup.inline_keyboard) {
      const keyboard = call[1].reply_markup.inline_keyboard;
      const flatButtons = keyboard.flat().map((btn: any) => btn.text);
      
      const allButtonsPresent = buttonTexts.every(text => 
        flatButtons.some(btnText => btnText.includes(text))
      );
      
      if (allButtonsPresent) {
        found = true;
        break;
      }
    }
  }

  expect(found).toBe(true);
}

/**
 * Проверяет, что произошел переход на другую сцену
 * @param ctx Мокированный контекст
 * @param sceneName Имя сцены, на которую должен был произойти переход
 */
export function expectSceneTransition(ctx: MockedTelegramContext, sceneName: string): void {
  expect(ctx.scene.enter).toHaveBeenCalledWith(sceneName);
}

/**
 * Проверяет, что сцена была завершена
 * @param ctx Мокированный контекст
 */
export function expectSceneExit(ctx: MockedTelegramContext): void {
  expect(ctx.scene.leave).toHaveBeenCalled();
}

/**
 * Проверяет, что был вызван метод адаптера с указанными аргументами
 * @param ctx Мокированный контекст
 * @param methodName Имя метода адаптера
 * @param args Аргументы, с которыми должен был быть вызван метод
 */
export function expectAdapterMethodCalled(
  ctx: MockedTelegramContext, 
  methodName: string, 
  ...args: any[]
): void {
  expect(ctx.storage[methodName]).toHaveBeenCalledWith(...args);
}

/**
 * Проверяет, что был вызван метод закрытия соединения с адаптером
 * @param ctx Мокированный контекст
 */
export function expectConnectionClosed(ctx: MockedTelegramContext): void {
  expect(ctx.storage.close).toHaveBeenCalled();
}
