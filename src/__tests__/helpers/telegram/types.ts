/**
 * @file Типы для тестирования Telegram-сцен
 * @description Содержит типы и интерфейсы для создания моков и тестирования Telegram-сцен
 */

import { StorageAdapter, ScraperSceneSessionData, ScraperBotContext } from "../../../types";
import { Mock } from "bun:test";

/**
 * Тип для мокированного контекста Telegraf
 */
export type MockedTelegramContext = ScraperBotContext & {
  scene: {
    enter: Mock<(...args: any[]) => any>;
    leave: Mock<(...args: any[]) => any>;
    reenter: Mock<(...args: any[]) => any>;
    session: Partial<ScraperSceneSessionData>;
  };
  from?: { id: number; username?: string; first_name?: string; last_name?: string };
  callbackQuery?: { data: string; id: string; } & any;
  answerCbQuery: Mock<(...args: any[]) => any>;
  match?: RegExpExecArray;
  message?: { text?: string; } & any;
  reply: Mock<(...args: any[]) => any>;
  storage?: any;
};

/**
 * Тип для мокированного адаптера хранилища
 */
export type MockedStorageAdapter = {
  [K in keyof StorageAdapter]: Mock<(...args: any[]) => any>;
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
  sessionData?: Partial<ScraperSceneSessionData>;
}

/**
 * Опции для создания мокированного адаптера хранилища
 */
export interface MockAdapterOptions {
  /** Мок для метода initialize */
  initialize?: Mock<(...args: any[]) => any>;
  /** Мок для метода close */
  close?: Mock<(...args: any[]) => any>;
  /** Мок для метода getUserByTelegramId */
  getUserByTelegramId?: Mock<(...args: any[]) => any>;
  /** Мок для метода findUserByTelegramIdOrCreate */
  findUserByTelegramIdOrCreate?: Mock<(...args: any[]) => any>;
  /** Мок для метода getProjectsByUserId */
  getProjectsByUserId?: Mock<(...args: any[]) => any>;
  /** Мок для метода getProjectById */
  getProjectById?: Mock<(...args: any[]) => any>;
  /** Мок для метода createProject */
  createProject?: Mock<(...args: any[]) => any>;
  /** Мок для метода getCompetitorAccounts */
  getCompetitorAccounts?: Mock<(...args: any[]) => any>;
  /** Мок для метода addCompetitorAccount */
  addCompetitorAccount?: Mock<(...args: any[]) => any>;
  /** Мок для метода deleteCompetitorAccount */
  deleteCompetitorAccount?: Mock<(...args: any[]) => any>;
  /** Мок для метода getHashtagsByProjectId */
  getHashtagsByProjectId?: Mock<(...args: any[]) => any>;
  /** Мок для метода addHashtag */
  addHashtag?: Mock<(...args: any[]) => any>;
  /** Мок для метода removeHashtag */
  removeHashtag?: Mock<(...args: any[]) => any>;
  /** Мок для метода getParsingRunLogs */
  getParsingRunLogs?: Mock<(...args: any[]) => any>;
  /** Мок для метода getParsingRunLogById */
  getParsingRunLogById?: Mock<(...args: any[]) => any>;
  /** Мок для метода saveParsingRunLog */
  saveParsingRunLog?: Mock<(...args: any[]) => any>;
  /** Мок для метода getReelsByCompetitorId */
  getReelsByCompetitorId?: Mock<(...args: any[]) => any>;
  /** Мок для метода getReelsByHashtag */
  getReelsByHashtag?: Mock<(...args: any[]) => any>;
  /** Мок для метода getReelsByProjectId */
  getReelsByProjectId?: Mock<(...args: any[]) => any>;
  /** Мок для метода saveReels */
  saveReels?: Mock<(...args: any[]) => any>;
  /** Мок для метода ensureConnection */
  ensureConnection?: Mock<(...args: any[]) => any>;
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
  sceneConstructor?: new (adapter: StorageAdapter) => T;
  /** Экземпляр сцены */
  sceneInstance?: T;
}
