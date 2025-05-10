/**
 * Фабрика для создания тестовых контекстов Telegram бота
 */
// import { Markup } from "telegraf"
// import { SceneContext } from "telegraf/typings/scenes"
// import { Update } from "telegraf/typings/core/types/typegram"
import type { ScraperBotContext } from "@/types"; // Раскомментировано и исправлен путь
import { ScraperSceneStep } from "@/types"; // Раскомментировано и исправлен путь
import { vi } from "vitest";

interface MockStorageOptions {
  initialize?: typeof vi.fn;
  close?: typeof vi.fn;
  getUserByTelegramId?: typeof vi.fn;
  getProjectsByUserId?: typeof vi.fn;
  createProject?: typeof vi.fn;
  getHashtagsByProjectId?: typeof vi.fn;
  getCompetitorsByProjectId?: typeof vi.fn;
  getCompetitorAccounts?: typeof vi.fn;
  addCompetitorAccount?: typeof vi.fn;
  addHashtag?: typeof vi.fn;
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
    options.storageOptions?.initialize || vi.fn().mockResolvedValue(undefined);
  const mockClose =
    options.storageOptions?.close || vi.fn().mockResolvedValue(undefined);
  const mockGetUserByTelegramId =
    options.storageOptions?.getUserByTelegramId ||
    vi.fn().mockResolvedValue(null);
  const mockGetProjectsByUserId =
    options.storageOptions?.getProjectsByUserId ||
    vi.fn().mockResolvedValue([]);
  const mockCreateProject =
    options.storageOptions?.createProject || vi.fn().mockResolvedValue(null);
  const mockGetCompetitorAccounts =
    options.storageOptions?.getCompetitorAccounts ||
    vi.fn().mockResolvedValue([]);
  const mockAddCompetitorAccount =
    options.storageOptions?.addCompetitorAccount ||
    vi.fn().mockResolvedValue(null);
  const mockAddHashtag =
    options.storageOptions?.addHashtag || vi.fn().mockResolvedValue(null);

  // Создаем сессию сцены
  const sceneSession = options.sceneSession || {
    step: options.sceneStep,
  };

  // Создаем базовый контекст
  const context: Partial<ScraperBotContext> = {
    reply: vi.fn().mockResolvedValue({}),
    answerCbQuery: vi.fn().mockResolvedValue(true),
    scene: {
      enter: vi.fn(),
      leave: vi.fn().mockResolvedValue({}),
      reenter: vi.fn().mockResolvedValue({}),
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
      getProjectById: vi.fn().mockResolvedValue(null) as any,
      getTrackingHashtags: vi.fn().mockResolvedValue([]) as any,
      saveReels: vi.fn().mockResolvedValue(0) as any,
      getReels: vi.fn().mockResolvedValue([]) as any,
      logParsingRun: vi.fn().mockResolvedValue({}) as any,
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
      getUserByTelegramId: vi.fn().mockResolvedValue({
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
      getProjectsByUserId: vi.fn().mockResolvedValue(projects),
    },
  });
}
