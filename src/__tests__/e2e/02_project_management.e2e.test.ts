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
  ProjectSchema 
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

const mockProjects: Project[] = [
  {
    id: 1,
    user_id: 1,
    name: "Test Project 1",
    created_at: new Date().toISOString(),
    is_active: true,
  },
  {
    id: 2,
    user_id: 1,
    name: "Test Project 2",
    created_at: new Date().toISOString(),
    is_active: true,
  },
];

// Валидируем mockProjects с помощью Zod
const validatedProjects = mockProjects.map(project => ProjectSchema.parse(project));

describe.skip("E2E: Project Management", () => {
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
    (mockAdapterInstance.getProjectsByUserId as jest.Mock).mockResolvedValue(validatedProjects);
    (mockAdapterInstance.createProject as jest.Mock).mockImplementation((userId, name) => {
      const newProject: Project = {
        id: mockProjects.length + 1,
        user_id: userId,
        name,
        created_at: new Date().toISOString(),
        is_active: true,
      };
      return Promise.resolve(ProjectSchema.parse(newProject));
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

  it("should show project list when user has projects", async () => {
    // Создаем объект Update для имитации команды /projects
    const update: Update = {
      update_id: 123457,
      message: {
        message_id: 2,
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
        text: '/projects',
        entities: [
          {
            offset: 0,
            length: 9,
            type: 'bot_command'
          }
        ]
      }
    };

    // Вызываем обработчик команды /projects
    await bot.handleUpdate(update);

    // Проверяем, что был вызван метод scene.enter с правильным именем сцены
    expect((bot.context as any).scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");
    
    // Проверяем, что был вызван метод getProjectsByUserId
    expect(mockAdapterInstance.findUserByTelegramIdOrCreate).toHaveBeenCalledWith(mockUserIdFromUpdate, "testuser", "Test", undefined);
  });

  it("should allow creating a new project", async () => {
    // TODO: Implement test for creating a new project
    // This will involve:
    // 1. Simulating a button click to create a project
    // 2. Simulating text input for the project name
    // 3. Verifying that createProject was called with correct parameters
    // 4. Verifying that the user is shown a success message
  });

  it("should show project menu when selecting a project", async () => {
    // TODO: Implement test for selecting a project
    // This will involve:
    // 1. Simulating a button click to select a project
    // 2. Verifying that the project menu is shown
    // 3. Verifying that the session data is updated correctly
  });
});
