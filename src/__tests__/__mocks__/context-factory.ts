/**
 * Фабрика для создания тестовых контекстов Telegram бота
 */
import type { ScraperBotContext } from "../../types";
import { ScraperSceneStep } from "../../types";
import { jest } from "bun:test";

interface MockStorageOptions {
  initialize?: jest.Mock;
  close?: jest.Mock;
  getUserByTelegramId?: jest.Mock;
  getProjectsByUserId?: jest.Mock;
  createProject?: jest.Mock;
  getHashtagsByProjectId?: jest.Mock;
  getCompetitorsByProjectId?: jest.Mock;
  getCompetitorAccounts?: jest.Mock;
  addCompetitorAccount?: jest.Mock;
  addHashtag?: jest.Mock;
  findUserByTelegramIdOrCreate?: jest.Mock;
  removeHashtag?: jest.Mock;
  deleteCompetitorAccount?: jest.Mock;
}

interface ContextOptions {
  telegramId?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  storageOptions?: MockStorageOptions;
  message?: any;
  callbackQuery?: any;
  sceneStep?: ScraperSceneStep;
  sceneSession?: any;
}

/**
 * Создает мок-контекст для тестирования
 */
export function createMockContext(
  options: ContextOptions = {}
): Partial<ScraperBotContext> {
  // Значения по умолчанию
  const telegramId = options.telegramId || 123456789;
  const username = options.username || "test_user";
  const firstName = options.firstName || "Test";
  const lastName = options.lastName || "User";

  // Создаем моки функций хранилища
  const mockInitialize =
    options.storageOptions?.initialize || jest.fn().mockResolvedValue(undefined);
  const mockClose =
    options.storageOptions?.close || jest.fn().mockResolvedValue(undefined);
  const mockGetUserByTelegramId =
    options.storageOptions?.getUserByTelegramId ||
    jest.fn().mockResolvedValue(null);
  const mockGetProjectsByUserId =
    options.storageOptions?.getProjectsByUserId ||
    jest.fn().mockResolvedValue([]);
  const mockCreateProject =
    options.storageOptions?.createProject || jest.fn().mockResolvedValue(null);
  const mockGetCompetitorAccounts =
    options.storageOptions?.getCompetitorAccounts ||
    jest.fn().mockResolvedValue([]);
  const mockAddCompetitorAccount =
    options.storageOptions?.addCompetitorAccount ||
    jest.fn().mockResolvedValue(null);
  const mockAddHashtag =
    options.storageOptions?.addHashtag || jest.fn().mockResolvedValue(null);
  const mockFindUserByTelegramIdOrCreate =
    options.storageOptions?.findUserByTelegramIdOrCreate ||
    jest.fn().mockResolvedValue(null);
  const mockRemoveHashtag =
    options.storageOptions?.removeHashtag || jest.fn().mockResolvedValue(null);
  const mockDeleteCompetitorAccount =
    options.storageOptions?.deleteCompetitorAccount || jest.fn().mockResolvedValue(null);

  // Создаем сессию сцены
  const sceneSession = options.sceneSession || {
    step: options.sceneStep,
  };

  // Создаем базовый контекст
  const context: Partial<ScraperBotContext> = {
    reply: jest.fn().mockResolvedValue({}),
    answerCbQuery: jest.fn().mockResolvedValue(true),
    scene: {
      enter: jest.fn(),
      leave: jest.fn().mockResolvedValue({}),
      reenter: jest.fn().mockResolvedValue({}),
      session: sceneSession,
    } as any,
    from: {
      id: telegramId,
      is_bot: false,
      username,
      first_name: firstName,
      last_name: lastName,
    },
    storage: {
      initialize: mockInitialize as any,
      close: mockClose as any,
      getUserByTelegramId: mockGetUserByTelegramId as any,
      getProjectsByUserId: mockGetProjectsByUserId as any,
      createProject: mockCreateProject as any,
      getCompetitorAccounts: mockGetCompetitorAccounts as any,
      addCompetitorAccount: mockAddCompetitorAccount as any,
      addHashtag: mockAddHashtag as any,
      getProjectById: jest.fn().mockResolvedValue(null) as any,
      getHashtagsByProjectId: jest.fn().mockResolvedValue([]) as any,
      saveReels: jest.fn().mockResolvedValue(0) as any,
      getReelsByProjectId: jest.fn().mockResolvedValue([]) as any,
      saveParsingRunLog: jest.fn().mockResolvedValue({}) as any,
      findUserByTelegramIdOrCreate: mockFindUserByTelegramIdOrCreate as any,
      removeHashtag: mockRemoveHashtag as any,
      deleteCompetitorAccount: mockDeleteCompetitorAccount as any,
    },
    ...(options.message && { message: options.message }),
    ...(options.callbackQuery && { callbackQuery: options.callbackQuery }),
  };

  return context;
}

/**
 * Создает контекст с зарегистрированным пользователем
 */
export function createContextWithUser(
  userId: number,
  telegramId: number,
  options: Partial<ContextOptions> = {}
): Partial<ScraperBotContext> {
  return createMockContext({
    ...options,
    telegramId,
    storageOptions: {
      ...options.storageOptions,
      getUserByTelegramId: jest.fn().mockResolvedValue({
        id: userId,
        telegram_id: telegramId,
        username: options.username || "test_user",
      }),
    },
  });
}

/**
 * Создает контекст с проектами пользователя
 */
export function createContextWithProjects(
  userId: number,
  telegramId: number,
  projects: any[],
  options: Partial<ContextOptions> = {}
): Partial<ScraperBotContext> {
  return createContextWithUser(userId, telegramId, {
    ...options,
    storageOptions: {
      ...options.storageOptions,
      getProjectsByUserId: jest.fn().mockResolvedValue(projects),
    },
  });
}
