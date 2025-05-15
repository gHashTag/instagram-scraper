import { jest } from "bun:test";
import { Telegraf } from "telegraf";
import { UserFromGetMe } from "telegraf/types";
import { setupInstagramScraperBot } from "../../..";
import type {
  ScraperBotContext,
  InstagramScraperBotConfig,
  StorageAdapter,
} from "../../types";
import { createMockStorageAdapter, MockedStorageAdapterType } from "./types";
import { createMockUser, createMockProject, createMockCompetitor, createMockHashtag } from "./mocks";

// Определяем тип SpyInstance для использования в тестах
export type SpyInstance<T extends any[] = any[], R = any> = {
  mock: {
    calls: T[][];
    results: { type: string; value: R }[];
    instances: any[];
    invocationCallOrder: number[];
    lastCall: T[];
    clear: () => void;
  };
};

// Константы для тестов
export const USER_ID_FOR_TESTING = 123456789;
export const CHAT_ID_FOR_TESTING = 12345;

// Конфигурация для тестового бота
export const TEST_BOT_CONFIG: InstagramScraperBotConfig = {
  telegramBotToken: "test-e2e-bot-token",
  apifyClientToken: "test-token",
};

// Информация о тестовом боте
export const TEST_BOT_INFO: UserFromGetMe = {
  id: 987654321, // ID бота
  is_bot: true,
  first_name: "TestE2EBot",
  username: "TestE2EBot_username",
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
};

/**
 * Настраивает тестовое окружение для e2e тестов
 */
export function setupE2ETestEnvironment() {
  // Создаем моки для пользователя и проектов
  const mockUser = createMockUser({
    id: 1,
    telegram_id: USER_ID_FOR_TESTING,
    username: "testuser",
    first_name: "Test",
    last_name: "User"
  });

  const mockProjects = [
    createMockProject({
      id: 1,
      user_id: 1,
      name: "Test Project 1"
    }),
    createMockProject({
      id: 2,
      user_id: 1,
      name: "Test Project 2"
    })
  ];

  const mockCompetitors = [
    createMockCompetitor({
      id: 1,
      project_id: 1,
      username: "competitor1",
      instagram_url: "https://instagram.com/competitor1"
    }),
    createMockCompetitor({
      id: 2,
      project_id: 1,
      username: "competitor2",
      instagram_url: "https://instagram.com/competitor2"
    })
  ];

  const mockHashtags = [
    createMockHashtag({
      id: 1,
      project_id: 1,
      hashtag: "test1"
    }),
    createMockHashtag({
      id: 2,
      project_id: 1,
      hashtag: "test2"
    })
  ];

  // Создаем бот и моки для методов Telegram API
  const bot = new Telegraf<ScraperBotContext>("test-bot-token");
  const mockGetMe = jest.fn().mockResolvedValue(TEST_BOT_INFO);
  const mockSceneEnter = jest.fn();
  const mockSceneLeave = jest.fn();
  const mockSceneReenter = jest.fn();
  const mockSendMessage = jest.fn().mockResolvedValue({
    message_id: 100,
    from: TEST_BOT_INFO,
    chat: {
      id: CHAT_ID_FOR_TESTING,
      type: 'private',
      first_name: 'Test',
      username: 'testuser'
    },
    date: Math.floor(Date.now() / 1000),
    text: 'Mocked response'
  });
  const mockEditMessageText = jest.fn().mockResolvedValue({
    message_id: 100,
    from: TEST_BOT_INFO,
    chat: {
      id: CHAT_ID_FOR_TESTING,
      type: 'private',
      first_name: 'Test',
      username: 'testuser'
    },
    date: Math.floor(Date.now() / 1000),
    text: 'Mocked edited message'
  });
  const mockAnswerCbQuery = jest.fn().mockResolvedValue(true);

  // Настраиваем бот
  bot.telegram.getMe = mockGetMe;
  bot.telegram.sendMessage = mockSendMessage;
  bot.telegram.editMessageText = mockEditMessageText;
  bot.telegram.answerCbQuery = mockAnswerCbQuery;

  // Инициализируем сессию для бота
  bot.use((ctx: any, next) => {
    ctx.session = {};
    ctx.scene = {
      enter: mockSceneEnter,
      leave: mockSceneLeave,
      reenter: mockSceneReenter,
      session: {}
    };
    return next();
  });

  // Создаем мок для хранилища
  const mockStorage = createMockStorageAdapter();

  // Настраиваем поведение моков адаптера по умолчанию
  (mockStorage.initialize as jest.Mock).mockResolvedValue(undefined);
  (mockStorage.close as jest.Mock).mockResolvedValue(undefined);
  (mockStorage.findUserByTelegramIdOrCreate as jest.Mock).mockResolvedValue(mockUser);
  (mockStorage.getUserByTelegramId as jest.Mock).mockResolvedValue(mockUser);
  (mockStorage.getProjectsByUserId as jest.Mock).mockResolvedValue(mockProjects);
  (mockStorage.getProjectById as jest.Mock).mockResolvedValue(mockProjects[0]);
  (mockStorage.createProject as jest.Mock).mockImplementation((userId, name) => {
    const newProject = createMockProject({
      id: mockProjects.length + 1,
      user_id: userId,
      name
    });
    return Promise.resolve(newProject);
  });
  (mockStorage.getCompetitorAccounts as jest.Mock).mockResolvedValue(mockCompetitors);
  (mockStorage.addCompetitorAccount as jest.Mock).mockImplementation((projectId, username, instagramUrl) => {
    const newCompetitor = createMockCompetitor({
      id: mockCompetitors.length + 1,
      project_id: projectId,
      username,
      instagram_url: instagramUrl
    });
    return Promise.resolve(newCompetitor);
  });
  (mockStorage.deleteCompetitorAccount as jest.Mock).mockResolvedValue(true);
  (mockStorage.getHashtagsByProjectId as jest.Mock).mockResolvedValue(mockHashtags);
  (mockStorage.addHashtag as jest.Mock).mockImplementation((projectId, hashtag) => {
    const newHashtag = createMockHashtag({
      id: mockHashtags.length + 1,
      project_id: projectId,
      hashtag
    });
    return Promise.resolve(newHashtag);
  });
  (mockStorage.removeHashtag as jest.Mock).mockResolvedValue();

  // Настраиваем бота с мок-адаптером и конфигурацией
  setupInstagramScraperBot(bot, mockStorage, TEST_BOT_CONFIG);

  return {
    bot,
    mockStorage,
    mockUser,
    mockProjects,
    mockCompetitors,
    mockHashtags,
    mockGetMe,
    mockSceneEnter,
    mockSceneLeave,
    mockSceneReenter,
    mockSendMessage,
    mockEditMessageText,
    mockAnswerCbQuery
  };
}
