import { mock, jest } from "bun:test";

// Этот экземпляр будет использоваться и в тестах для проверки вызовов
export const mockNeonAdapterInstance = {
  initialize: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  getUserByTelegramId: jest.fn(),
  getProjectsByUserId: jest.fn(),
  createProject: jest.fn(),
  getProjectById: jest.fn(),
  getHashtagsByProjectId: jest.fn(),
  addHashtag: jest.fn(),
  removeHashtag: jest.fn(),
  getCompetitorAccounts: jest.fn(),
  addCompetitorAccount: jest.fn(),
  deleteCompetitorAccount: jest.fn(),
  findUserByTelegramIdOrCreate: jest.fn(),
  getReelsByCompetitorId: jest.fn(),
  getReelsByHashtag: jest.fn(),
  getReelsByProjectId: jest.fn(),
  saveReels: jest.fn(),
  saveParsingRunLog: jest.fn(),
  getParsingRunLogs: jest.fn(),
  getParsingRunLogById: jest.fn(),
};

// Этот конструктор также может быть экспортирован, если нужно его проверять из тестов
export const mockNeonAdapterConstructor = jest.fn(
  () => mockNeonAdapterInstance
);

// Используем АБСОЛЮТНЫЙ путь к мокируемому модулю
mock.module(
  "/Users/playra/instagram-scraper-bot/src/adapters/neon-adapter.ts",
  () => ({
    NeonAdapter: mockNeonAdapterConstructor,
  })
);

// Для отладки, чтобы видеть, что этот файл выполняется
console.log(
  "bun:test --- PRELOAD setup-mocks.ts EXECUTED (using ABSOLUTE path) ---"
);
