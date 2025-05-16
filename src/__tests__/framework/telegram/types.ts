/**
 * @file Типы для тестирования Telegram-сцен
 * @description Содержит типы и интерфейсы для создания моков и тестирования Telegram-сцен
 */

import { Mock } from "bun:test";

/**
 * Тип для мокированного контекста Telegraf
 */
export type MockedTelegramContext = {
  scene: {
    enter: Mock<(...args: any[]) => any>;
    leave: Mock<(...args: any[]) => any>;
    reenter: Mock<(...args: any[]) => any>;
    session: any;
  };
  from?: { id: number; username?: string; first_name?: string; last_name?: string };
  callbackQuery?: { data: string; id: string; } & any;
  answerCbQuery: Mock<(...args: any[]) => any>;
  match?: RegExpExecArray;
  message?: { text?: string; } & any;
  reply: Mock<(...args: any[]) => any>;
  storage?: any;
  [key: string]: any;
};

/**
 * Тип для мокированного адаптера хранилища
 */
export type MockedStorageAdapter = {
  [key: string]: Mock<(...args: any[]) => any>;
};

/**
 * Опции для создания мокированного контекста
 */
export interface MockContextOptions {
  /** ID пользователя */
  userId?: number;
  /** Имя пользователя */
  username?: string;
  /** Имя пользователя */
  firstName?: string;
  /** Фамилия пользователя */
  lastName?: string;
  /** Текст сообщения */
  messageText?: string;
  /** Данные для callback query */
  callbackQueryData?: string;
  /** Данные для match (RegExpExecArray) */
  matchData?: string[];
  /** Данные для session */
  sessionData?: any;
  /** Дополнительные свойства контекста */
  [key: string]: any;
}

/**
 * Опции для создания мокированного адаптера хранилища
 */
export interface MockAdapterOptions {
  /** Мок для метода initialize */
  initialize?: Mock<(...args: any[]) => any>;
  /** Мок для метода close */
  close?: Mock<(...args: any[]) => any>;
  /** Дополнительные методы адаптера */
  [key: string]: Mock<(...args: any[]) => any> | undefined;
}

/**
 * Опции для тестирования сцены
 */
export interface SceneTestOptions<T = any> {
  /** Имя сцены */
  sceneName: string;
  /** Путь к файлу сцены */
  sceneFilePath: string;
  /** Конструктор сцены или экземпляр сцены */
  sceneConstructor?: new (adapter: any, ...args: any[]) => T;
  /** Экземпляр сцены */
  sceneInstance?: T;
  /** Дополнительные аргументы для конструктора сцены */
  constructorArgs?: any[];
}

/**
 * Тип для шага в последовательности тестирования
 */
export interface SequenceStep<T> {
  /** Название шага */
  name: string;
  /** Действие, которое нужно выполнить */
  action: (tester: any) => Promise<void>;
  /** Проверки, которые нужно выполнить после действия */
  assertions: (tester: any) => void;
}
