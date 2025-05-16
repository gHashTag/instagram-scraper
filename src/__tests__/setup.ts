import { beforeEach, afterEach, jest } from "bun:test";

// Создаем базовые моки
export const telegrafMocks = {
  use: jest.fn(),
  launch: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn(),
  command: jest.fn(),
  hears: jest.fn(),
  action: jest.fn(),
  on: jest.fn(),
  telegram: {
    sendMessage: jest.fn(),
    setMyCommands: jest.fn(),
  },
};

export const scenesMocks = {
  enter: jest.fn(),
  leave: jest.fn(),
  command: jest.fn(),
  action: jest.fn(),
  on: jest.fn(),
  emit: jest.fn(),
};

// Создаем моки для Telegraf
export const MockTelegraf = jest.fn().mockImplementation(() => telegrafMocks);

export const MockMarkup = {
  inlineKeyboard: jest.fn().mockImplementation((buttons) => ({
    reply_markup: { inline_keyboard: buttons },
  })),
  button: {
    callback: jest.fn().mockImplementation((text, data) => ({
      text,
      callback_data: data,
    })),
  },
};

export const MockScenes = {
  BaseScene: jest.fn().mockImplementation(() => scenesMocks),
  Stage: jest.fn().mockImplementation(() => ({
    middleware: jest.fn(),
  })),
};

// Мокируем функции скрапера
export const scraperMocks = {
  scrapeInstagramReels: jest
    .fn()
    .mockResolvedValue([
      { reels_url: "https://instagram.com/p/123", views_count: 100000 },
    ]),
  convertToStorageReel: jest
    .fn()
    .mockImplementation((reel, projectId, sourceType, sourceId) => ({
      project_id: projectId,
      source_type: sourceType,
      source_id: sourceId,
      reels_url: reel.url,
      views_count: reel.viewCount,
      parsed_at: new Date(),
    })),
};

// Настройка перед каждым тестом
beforeEach(() => {
  jest.clearAllMocks();
});

// Очистка после каждого теста
afterEach(() => {
  jest.restoreAllMocks();
});

// Устанавливаем глобальную переменную для Neon
(global as any).__NEON_CONNECTION_STRING__ =
  "postgresql://fake:fake@fake.neon.tech/fake";
