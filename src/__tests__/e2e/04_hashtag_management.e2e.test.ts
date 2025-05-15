import {
  describe,
  it,
  expect,
  beforeEach,
  mock,
  jest,
} from "bun:test";
import { Telegraf } from "telegraf";
import { setupInstagramScraperBot } from "../../..";
import { Update, UserFromGetMe } from "telegraf/types";
import type {
  ScraperBotContext,
  InstagramScraperBotConfig,
  StorageAdapter,
} from "../../types";
import { NeonAdapter } from "../../adapters/neon-adapter";
import { 
  User, 
  UserSchema, 
  Project, 
  ProjectSchema,
  Hashtag,
  HashtagSchema
} from "../../schemas";

// Определяем тип SpyInstance для использования в тестах
type SpyInstance<T extends any[] = any[], R = any> = {
  mock: {
    calls: T[][];
    results: { type: string; value: R }[];
    instances: any[];
    invocationCallOrder: number[];
    lastCall: T[];
    clear: () => void;
  };
};

// --- Определяем константы и моки здесь ---
const USER_ID_FOR_TESTING = 123456789;
const mockUser: User = {
  id: 1, // Внутренний ID пользователя в БД
  telegram_id: USER_ID_FOR_TESTING, // ID, с которым пользователь приходит в Update
  username: "testuser",
  created_at: new Date().toISOString(),
  is_active: true,
};

// Валидируем mockUser с помощью Zod
const validatedUser = UserSchema.parse(mockUser);

const mockProject: Project = {
  id: 1,
  user_id: 1,
  name: "Test Project",
  created_at: new Date().toISOString(),
  is_active: true,
};

// Валидируем mockProject с помощью Zod
const validatedProject = ProjectSchema.parse(mockProject);

const mockHashtags: Hashtag[] = [
  {
    id: 1,
    project_id: 1,
    hashtag: "test1",
    created_at: new Date().toISOString(),
    is_active: true,
  },
  {
    id: 2,
    project_id: 1,
    hashtag: "test2",
    created_at: new Date().toISOString(),
    is_active: true,
  },
];

// Валидируем mockHashtags с помощью Zod
const validatedHashtags = mockHashtags.map(hashtag => HashtagSchema.parse(hashtag));

describe.skip("E2E: Hashtag Management", () => {
  let bot: Telegraf<ScraperBotContext>;
  let mockAdapterInstance: StorageAdapter & {
    [key: string]: jest.Mock | SpyInstance<any[], any>;
  };
  let mockSendMessage: jest.Mock;
  let mockEditMessageText: jest.Mock;
  let mockAnswerCbQuery: jest.Mock;
  let mockGetMe: jest.Mock;

  const mockChatId = 12345;
  const mockUserIdFromUpdate = USER_ID_FOR_TESTING;

  const mockConfig: InstagramScraperBotConfig = {
    telegramBotToken: "test-e2e-bot-token",
    apifyClientToken: "test-token",
  };

  const mockBotInfo: UserFromGetMe = {
    id: 987654321, // ID бота
    is_bot: true,
    first_name: "TestE2EBot",
    username: "TestE2EBot_username",
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
  };

  beforeEach(async () => {
    mockGetMe = jest.fn().mockResolvedValue(mockBotInfo);

    bot = new Telegraf<ScraperBotContext>("test-bot-token");
    bot.telegram.getMe = mockGetMe;

    // Инициализируем сессию для бота
    bot.use((ctx: any, next) => {
      ctx.session = {};
      ctx.scene = {
        enter: jest.fn(),
        leave: jest.fn(),
        reenter: jest.fn(),
        session: {}
      };
      return next();
    });

    mockAdapterInstance = new (NeonAdapter as any)() as StorageAdapter & {
      [key: string]: jest.Mock | SpyInstance<any[], any>;
    };

    // Очистка моков перед каждым тестом
    Object.values(mockAdapterInstance).forEach((mockFn) => {
      if (typeof mockFn === "function" && mockFn.mock) {
        mockFn.mockClear();
      }
    });

    // Настройка поведения моков адаптера по умолчанию
    (mockAdapterInstance.initialize as jest.Mock).mockResolvedValue(undefined);
    (mockAdapterInstance.close as jest.Mock).mockResolvedValue(undefined);
    (mockAdapterInstance.findUserByTelegramIdOrCreate as jest.Mock).mockResolvedValue(validatedUser);
    (mockAdapterInstance.getProjectById as jest.Mock).mockResolvedValue(validatedProject);
    (mockAdapterInstance.getHashtagsByProjectId as jest.Mock).mockResolvedValue(validatedHashtags);
    (mockAdapterInstance.addHashtag as jest.Mock).mockImplementation((projectId, hashtag) => {
      const newHashtag: Hashtag = {
        id: mockHashtags.length + 1,
        project_id: projectId,
        hashtag,
        created_at: new Date().toISOString(),
        is_active: true,
      };
      return Promise.resolve(HashtagSchema.parse(newHashtag));
    });
    (mockAdapterInstance.removeHashtag as jest.Mock).mockImplementation((projectId, hashtag) => {
      return Promise.resolve();
    });

    // Настраиваем бота с мок-адаптером и конфигурацией
    setupInstagramScraperBot(bot, mockAdapterInstance, mockConfig);

    // Мокируем методы API Telegram
    mockSendMessage = jest.fn().mockResolvedValue({
      message_id: 100,
      from: mockBotInfo,
      chat: {
        id: mockChatId,
        type: 'private',
        first_name: 'Test',
        username: 'testuser'
      },
      date: Math.floor(Date.now() / 1000),
      text: 'Mocked response'
    });
    mockEditMessageText = jest.fn().mockResolvedValue({
      message_id: 100,
      from: mockBotInfo,
      chat: {
        id: mockChatId,
        type: 'private',
        first_name: 'Test',
        username: 'testuser'
      },
      date: Math.floor(Date.now() / 1000),
      text: 'Mocked edited message'
    });
    mockAnswerCbQuery = jest.fn().mockResolvedValue(true);

    bot.telegram.sendMessage = mockSendMessage;
    bot.telegram.editMessageText = mockEditMessageText;
    bot.telegram.answerCbQuery = mockAnswerCbQuery;
  });

  it("should enter hashtag scene when hashtag button is clicked", async () => {
    // TODO: Implement test for entering hashtag scene
    // This will involve:
    // 1. Setting up the scene session with a project ID
    // 2. Simulating a button click to enter the hashtag scene
    // 3. Verifying that scene.enter was called with the correct scene name
  });

  it("should show hashtag list when user has hashtags", async () => {
    // TODO: Implement test for showing hashtag list
    // This will involve:
    // 1. Setting up the scene session with a project ID
    // 2. Simulating entering the hashtag scene
    // 3. Verifying that getHashtagsByProjectId was called with the correct project ID
    // 4. Verifying that the hashtag list is shown
  });

  it("should allow adding a new hashtag", async () => {
    // TODO: Implement test for adding a new hashtag
    // This will involve:
    // 1. Simulating a button click to add a hashtag
    // 2. Simulating text input for the hashtag
    // 3. Verifying that addHashtag was called with correct parameters
    // 4. Verifying that the user is shown a success message
  });

  it("should allow removing a hashtag", async () => {
    // TODO: Implement test for removing a hashtag
    // This will involve:
    // 1. Simulating a button click to remove a hashtag
    // 2. Verifying that removeHashtag was called with correct parameters
    // 3. Verifying that the user is shown a success message
  });
});
