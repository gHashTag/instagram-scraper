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
  } as MockedTelegramContext;

  // Добавляем callbackQuery, если он указан
  if (callbackQueryData) {
    ctx.callbackQuery = {
      data: callbackQueryData,
      id: "123",
      from: { id: userId, username, first_name: firstName, last_name: lastName },
      chat_instance: "test_instance",
      game_short_name: "test_game",
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
      chat: { id: 123456, type: "private" },
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
    getUserByTelegramId: jest.fn(),
    findUserByTelegramIdOrCreate: jest.fn(),
    getProjectsByUserId: jest.fn(),
    getProjectById: jest.fn(),
    createProject: jest.fn(),
    getCompetitorAccounts: jest.fn(),
    addCompetitorAccount: jest.fn(),
    deleteCompetitorAccount: jest.fn(),
    getHashtagsByProjectId: jest.fn(),
    addHashtag: jest.fn(),
    removeHashtag: jest.fn(),
    getParsingRunLogs: jest.fn(),
    getParsingRunLogById: jest.fn(),
    saveParsingRunLog: jest.fn(),
    getReelsByCompetitorId: jest.fn(),
    getReelsByHashtag: jest.fn(),
    getReelsByProjectId: jest.fn(),
    saveReels: jest.fn(),
    ensureConnection: jest.fn(),
    logParsingRun: jest.fn(),
    // Добавляем недостающие методы
    createUser: jest.fn(),
    getTrackingHashtags: jest.fn(),
    getReels: jest.fn(),
  } as unknown as MockedStorageAdapter;

  // Переопределяем методы, если они указаны в опциях
  Object.entries(options).forEach(([key, value]) => {
    if (value && key in adapter) {
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
