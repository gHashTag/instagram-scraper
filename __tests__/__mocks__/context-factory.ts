/**
 * Фабрика для создания тестовых контекстов Telegram бота
 */
import { vi } from "vitest"
import type { ScraperBotContext } from "../../types"
import { ScraperSceneStep } from "../../types"

interface MockStorageOptions {
  initialize?: typeof vi.fn
  close?: typeof vi.fn
  getUserByTelegramId?: typeof vi.fn
  getProjectsByUserId?: typeof vi.fn
  createProject?: typeof vi.fn
  getHashtagsByProjectId?: typeof vi.fn
  getCompetitorsByProjectId?: typeof vi.fn
  getCompetitorAccounts?: typeof vi.fn
  createCompetitor?: typeof vi.fn
  createHashtag?: typeof vi.fn
}

interface ContextOptions {
  telegramId?: number
  username?: string
  firstName?: string
  lastName?: string
  storageOptions?: MockStorageOptions
  message?: any
  callbackQuery?: any
  sceneStep?: ScraperSceneStep
  sceneSession?: any
}

/**
 * Создает мок-контекст для тестирования
 */
export function createMockContext(
  options: ContextOptions = {}
): Partial<ScraperBotContext> {
  // Значения по умолчанию
  const telegramId = options.telegramId || 123456789
  const username = options.username || "test_user"
  const firstName = options.firstName || "Test"
  const lastName = options.lastName || "User"

  // Создаем моки функций хранилища
  const mockInitialize =
    options.storageOptions?.initialize || vi.fn().mockResolvedValue(undefined)
  const mockClose =
    options.storageOptions?.close || vi.fn().mockResolvedValue(undefined)
  const mockGetUserByTelegramId =
    options.storageOptions?.getUserByTelegramId ||
    vi.fn().mockResolvedValue(null)
  const mockGetProjectsByUserId =
    options.storageOptions?.getProjectsByUserId || vi.fn().mockResolvedValue([])
  const mockCreateProject =
    options.storageOptions?.createProject || vi.fn().mockResolvedValue(null)
  const mockGetHashtagsByProjectId =
    options.storageOptions?.getHashtagsByProjectId ||
    vi.fn().mockResolvedValue([])
  const mockGetCompetitorsByProjectId =
    options.storageOptions?.getCompetitorsByProjectId ||
    vi.fn().mockResolvedValue([])
  const mockGetCompetitorAccounts =
    options.storageOptions?.getCompetitorAccounts ||
    vi.fn().mockResolvedValue([])
  const mockCreateCompetitor =
    options.storageOptions?.createCompetitor || vi.fn().mockResolvedValue(null)
  const mockCreateHashtag =
    options.storageOptions?.createHashtag || vi.fn().mockResolvedValue(null)

  // Создаем сессию сцены
  const sceneSession = options.sceneSession || {
    step: options.sceneStep,
  }

  // Создаем базовый контекст
  const context: Partial<ScraperBotContext> = {
    reply: vi.fn().mockResolvedValue({}),
    answerCbQuery: vi.fn().mockResolvedValue(true),
    scene: {
      enter: vi.fn(),
      leave: vi.fn().mockResolvedValue({}),
      reenter: vi.fn().mockResolvedValue({}),
      session: sceneSession,
    },
    from: {
      id: telegramId,
      username,
      first_name: firstName,
      last_name: lastName,
    },
    storage: {
      initialize: mockInitialize,
      close: mockClose,
      getUserByTelegramId: mockGetUserByTelegramId,
      getProjectsByUserId: mockGetProjectsByUserId,
      createProject: mockCreateProject,
      getHashtagsByProjectId: mockGetHashtagsByProjectId,
      getCompetitorsByProjectId: mockGetCompetitorsByProjectId,
      getCompetitorAccounts: mockGetCompetitorAccounts,
      createCompetitor: mockCreateCompetitor,
      createHashtag: mockCreateHashtag,
    },
  }

  // Добавляем сообщение, если оно есть
  if (options.message) {
    context.message = options.message
  }

  // Добавляем callbackQuery, если он есть
  if (options.callbackQuery) {
    context.callbackQuery = options.callbackQuery
  }

  return context
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
  })
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
  })
}
