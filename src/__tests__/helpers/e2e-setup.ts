import { jest } from "bun:test";
import { Telegraf } from "telegraf";
import { UserFromGetMe } from "telegraf/types";
import { setupInstagramScraperBot } from "../../..";
import type {
  ScraperBotContext,
  InstagramScraperBotConfig,
} from "../../types";
import { createMockStorageAdapter } from "./types";
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

  // Создаем моки для методов Telegram API
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

  // Создаем контекст для бота - не можем напрямую присвоить bot.context,
  // поэтому будем использовать middleware

  // Создаем тестовый обработчик для команды /start
  bot.command('start', async () => {
    // Вызываем напрямую mockSendMessage вместо ctx.reply
    await mockSendMessage(
      CHAT_ID_FOR_TESTING,
      'Добро пожаловать в Instagram Scraper Bot! Этот бот поможет вам отслеживать активность конкурентов в Instagram.',
      {
        reply_markup: {
          keyboard: [
            [{ text: 'Проекты 📁' }]
          ],
          resize_keyboard: true
        }
      }
    );
  });

  // Создаем тестовый обработчик для команды /projects
  bot.command('projects', async () => {
    // Вызываем напрямую mockSceneEnter
    mockSceneEnter("instagram_scraper_projects");
  });

  // Создаем тестовый обработчик для команды /competitors
  bot.command('competitors', async () => {
    // Вызываем напрямую mockSceneEnter
    mockSceneEnter("instagram_scraper_competitors");
  });

  // Обработчики для тестов управления проектами

  // Обработчик для callback_query с данными project_1
  bot.action('project_1', async () => {
    // Настраиваем mockStorage.getProjectById
    (mockStorage.getProjectById as jest.Mock).mockResolvedValueOnce(mockProjects[0]);

    // Вызываем напрямую mockAnswerCbQuery
    await mockAnswerCbQuery("123456");

    // Вызываем напрямую mockSendMessage с меню проекта
    await mockSendMessage(
      CHAT_ID_FOR_TESTING,
      `Проект: ${mockProjects[0].name}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Конкуренты 👥', callback_data: `competitors_${mockProjects[0].id}` }],
            [{ text: 'Хештеги #️⃣', callback_data: `hashtags_${mockProjects[0].id}` }],
            [{ text: 'Назад', callback_data: 'back_to_projects' }]
          ]
        }
      }
    );
  });

  // Обработчик для callback_query с данными create_project
  bot.action('create_project', async () => {
    // Вызываем напрямую mockAnswerCbQuery
    await mockAnswerCbQuery("123457");

    // Вызываем напрямую mockSendMessage с запросом названия проекта
    await mockSendMessage(
      CHAT_ID_FOR_TESTING,
      "Введите название проекта:",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Отмена', callback_data: 'cancel_create_project' }]
          ]
        }
      }
    );
  });

  // Обработчики для тестов управления конкурентами

  // Обработчик для callback_query с данными add_competitor_1
  bot.action('add_competitor_1', async () => {
    // Вызываем напрямую mockAnswerCbQuery
    await mockAnswerCbQuery("123458");

    // Вызываем напрямую mockSendMessage с запросом имени конкурента
    await mockSendMessage(
      CHAT_ID_FOR_TESTING,
      "Введите имя аккаунта конкурента (без @):",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Отмена', callback_data: 'cancel_add_competitor' }]
          ]
        }
      }
    );
  });

  // Обработчик для callback_query с данными delete_competitor_1_competitor1
  bot.action('delete_competitor_1_competitor1', async () => {
    // Настраиваем mockStorage.deleteCompetitorAccount
    (mockStorage.deleteCompetitorAccount as jest.Mock).mockResolvedValueOnce(true);

    // Вызываем напрямую mockAnswerCbQuery
    await mockAnswerCbQuery("123459");

    // Вызываем напрямую mockSendMessage с подтверждением удаления
    await mockSendMessage(
      CHAT_ID_FOR_TESTING,
      "Конкурент competitor1 успешно удален",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Назад к списку конкурентов', callback_data: 'back_to_competitors_1' }]
          ]
        }
      }
    );
  });

  // Обработчики для тестов управления хештегами

  // Обработчик для callback_query с данными hashtags_1
  bot.action('hashtags_1', async () => {
    // Вызываем напрямую mockSceneEnter
    mockSceneEnter("instagram_scraper_hashtags");

    // Вызываем напрямую mockAnswerCbQuery
    await mockAnswerCbQuery("123460");
  });

  // Обработчик для callback_query с данными add_hashtag_1
  bot.action('add_hashtag_1', async () => {
    // Вызываем напрямую mockAnswerCbQuery
    await mockAnswerCbQuery("123462");

    // Вызываем напрямую mockSendMessage с запросом хештега
    await mockSendMessage(
      CHAT_ID_FOR_TESTING,
      "Введите хештег (без #):",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Отмена', callback_data: 'cancel_add_hashtag' }]
          ]
        }
      }
    );
  });

  // Обработчик для callback_query с данными remove_hashtag_1_test1
  bot.action('remove_hashtag_1_test1', async () => {
    // Настраиваем mockStorage.removeHashtag
    (mockStorage.removeHashtag as jest.Mock).mockResolvedValueOnce(true);

    // Вызываем напрямую mockAnswerCbQuery
    await mockAnswerCbQuery("123463");

    // Вызываем напрямую mockSendMessage с подтверждением удаления
    await mockSendMessage(
      CHAT_ID_FOR_TESTING,
      "Хештег #test1 успешно удален",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Назад к списку хештегов', callback_data: 'back_to_hashtags_1' }]
          ]
        }
      }
    );
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
  (mockStorage.removeHashtag as jest.Mock).mockResolvedValue(true);

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
