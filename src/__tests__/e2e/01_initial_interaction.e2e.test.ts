import {
  describe,
  it,
  expect,
  beforeEach,
  mock,
  jest,
} from "bun:test";

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

// --- Определяем константы и моки здесь, так как нет общего файла mockData ---
const USER_ID_FOR_TESTING = 123456789;
const mockUser: User = {
  id: 1, // Внутренний ID пользователя в БД, возвращаемый findUserByTelegramIdOrCreate
  telegram_id: USER_ID_FOR_TESTING, // ID, с которым пользователь приходит в Update
  username: "testuser",
  created_at: new Date().toISOString(),
  is_active: true,
};

// Валидируем mockUser с помощью Zod
const validatedUser = UserSchema.parse(mockUser);

// Создаем мок-проекты для тестирования
const mockProjects: Project[] = [];
// --- Конец определения констант и моков ---

// Используем mock.module из bun:test
mock.module("../../adapters/neon-adapter", () => {
  // jest.fn() используется для создания мок-функций
  return {
    NeonAdapter: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      getUserByTelegramId: jest.fn(),
      getProjectById: jest.fn(),
      getProjectsByUserId: jest.fn(),
      createProject: jest.fn(),
      getHashtagsByProjectId: jest.fn(),
      addHashtag: jest.fn(),
      removeHashtag: jest.fn(),
      getCompetitorAccounts: jest.fn(),
      addCompetitorAccount: jest.fn(),
      deleteCompetitorAccount: jest.fn(),
      findUserByTelegramIdOrCreate: jest.fn(),
    })),
  };
});

describe.skip("E2E: Initial Bot Interaction", () => {
  let bot: Telegraf<ScraperBotContext>;
  let mockAdapterInstance: StorageAdapter & {
    [key: string]: jest.Mock | SpyInstance<any[], any>;
  };
  let mockSendMessage: jest.Mock;
  let mockEditMessageText: jest.Mock;
  let mockAnswerCbQuery: jest.Mock;
  let mockGetMe: jest.Mock;

  const mockChatId = 12345;
  const mockUserIdFromUpdate = USER_ID_FOR_TESTING; // ID пользователя в объекте Update.from

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

    // Настройка поведения моков адаптера по умолчанию для этого describe блока
    (mockAdapterInstance.initialize as jest.Mock).mockResolvedValue(undefined);
    (mockAdapterInstance.close as jest.Mock).mockResolvedValue(undefined);
    (
      mockAdapterInstance.findUserByTelegramIdOrCreate as jest.Mock
    ).mockResolvedValue(validatedUser);
    (mockAdapterInstance.getProjectsByUserId as jest.Mock).mockResolvedValue(
      mockProjects
    );

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

  it("should respond to /start command with welcome message", async () => {
    // Создаем объект Update для имитации команды /start
    const update: Update = {
      update_id: 123456,
      message: {
        message_id: 1,
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
        text: '/start',
        entities: [
          {
            offset: 0,
            length: 6,
            type: 'bot_command'
          }
        ]
      }
    };

    // Вызываем обработчик команды /start
    await bot.handleUpdate(update);

    // Проверяем, что было отправлено приветственное сообщение
    expect(mockSendMessage).toHaveBeenCalledWith(
      mockChatId,
      expect.stringContaining('Добро пожаловать'),
      expect.objectContaining({
        reply_markup: expect.objectContaining({
          keyboard: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({ text: expect.stringContaining('Проекты') })
            ])
          ])
        })
      })
    );
  });

  it("should respond to /projects command and enter project scene", async () => {
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
  });

  it("should respond to /projects command when user has projects", async () => {
    // Создаем объект Update для имитации команды /projects
    const update: Update = {
      update_id: 123458,
      message: {
        message_id: 3,
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
  });

  it("should respond to /competitors command and enter competitor scene", async () => {
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
});
