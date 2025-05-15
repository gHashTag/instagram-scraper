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
  Competitor,
  CompetitorSchema
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

const mockCompetitors: Competitor[] = [
  {
    id: 1,
    project_id: 1,
    username: "competitor1",
    instagram_url: "https://instagram.com/competitor1",
    created_at: new Date().toISOString(),
    is_active: true,
  },
  {
    id: 2,
    project_id: 1,
    username: "competitor2",
    instagram_url: "https://instagram.com/competitor2",
    created_at: new Date().toISOString(),
    is_active: true,
  },
];

// Валидируем mockCompetitors с помощью Zod
const validatedCompetitors = mockCompetitors.map(competitor => CompetitorSchema.parse(competitor));

describe.skip("E2E: Competitor Management", () => {
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
    (mockAdapterInstance.getCompetitorAccounts as jest.Mock).mockResolvedValue(validatedCompetitors);
    (mockAdapterInstance.addCompetitorAccount as jest.Mock).mockImplementation((projectId, username, instagramUrl) => {
      const newCompetitor: Competitor = {
        id: mockCompetitors.length + 1,
        project_id: projectId,
        username,
        instagram_url: instagramUrl,
        created_at: new Date().toISOString(),
        is_active: true,
      };
      return Promise.resolve(CompetitorSchema.parse(newCompetitor));
    });
    (mockAdapterInstance.deleteCompetitorAccount as jest.Mock).mockImplementation((projectId, username) => {
      return Promise.resolve(true);
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

  it("should enter competitor scene when /competitors command is sent", async () => {
    // Создаем объект Update для имитации команды /competitors
    const update: Update = {
      update_id: 123459,
      message: {
        message_id: 4,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: mockChatId,
          type: 'private',
          first_name: 'Test',
          username: 'testuser'
        },
        from: {
          id: mockUserIdFromUpdate,
          is_bot: false,
          first_name: 'Test',
          username: 'testuser'
        },
        text: '/competitors',
        entities: [
          {
            offset: 0,
            length: 12,
            type: 'bot_command'
          }
        ]
      }
    };

    // Вызываем обработчик команды /competitors
    await bot.handleUpdate(update);

    // Проверяем, что был вызван метод scene.enter с правильным именем сцены
    expect((bot.context as any).scene.enter).toHaveBeenCalledWith("instagram_scraper_competitors");
  });

  it("should show competitor list when user has competitors", async () => {
    // TODO: Implement test for showing competitor list
    // This will involve:
    // 1. Setting up the scene session with a project ID
    // 2. Simulating entering the competitor scene
    // 3. Verifying that getCompetitorAccounts was called with the correct project ID
    // 4. Verifying that the competitor list is shown
  });

  it("should allow adding a new competitor", async () => {
    // TODO: Implement test for adding a new competitor
    // This will involve:
    // 1. Simulating a button click to add a competitor
    // 2. Simulating text input for the competitor URL
    // 3. Verifying that addCompetitorAccount was called with correct parameters
    // 4. Verifying that the user is shown a success message
  });

  it("should allow deleting a competitor", async () => {
    // TODO: Implement test for deleting a competitor
    // This will involve:
    // 1. Simulating a button click to delete a competitor
    // 2. Verifying that deleteCompetitorAccount was called with correct parameters
    // 3. Verifying that the user is shown a success message
  });
});
