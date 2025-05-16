# E2E тестирование Telegram-бота

Этот документ описывает подход к E2E (End-to-End) тестированию Telegram-бота в проекте Instagram Scraper Bot. E2E тесты проверяют работу бота от начала до конца, имитируя взаимодействие пользователя с ботом через Telegram API.

## Подход к E2E тестированию

В проекте используется подход к E2E тестированию, основанный на эмуляции обновлений от Telegram и мокировании API. Этот подход позволяет тестировать бота без реального взаимодействия с Telegram API, что делает тесты более стабильными и независимыми от внешних сервисов.

### Ключевые компоненты подхода:

1. **Мокирование Telegram API**:
   - Мокирование методов Telegram API, таких как `sendMessage`, `editMessageText` и `answerCbQuery`
   - Перехват вызовов этих методов для проверки параметров

2. **Эмуляция обновлений от Telegram**:
   - Создание объектов `Update`, которые имитируют сообщения и команды от пользователя
   - Эти объекты содержат всю необходимую информацию, которую Telegram отправляет боту

3. **Обработка обновлений**:
   - Использование `bot.handleUpdate(update)` для обработки эмулированных обновлений
   - Это позволяет тестировать логику бота без реального взаимодействия с Telegram API

4. **Проверка результатов**:
   - Проверка вызовов методов адаптера хранилища
   - Проверка отправленных сообщений и клавиатур
   - Проверка состояния сцены и сессии

## Структура E2E тестов

E2E тесты в проекте организованы следующим образом:

```
src/__tests__/e2e/
├── 01_initial_interaction.e2e.test.ts  # Тесты для начального взаимодействия с ботом
├── 02_project_management.e2e.test.ts   # Тесты для управления проектами
├── 03_competitor_management.e2e.test.ts # Тесты для управления конкурентами
├── 04_hashtag_management.e2e.test.ts   # Тесты для управления хештегами
└── 05_parsing_management.e2e.test.ts   # Тесты для управления парсингом
```

## Создание E2E тестов

### 1. Настройка окружения для тестов

Перед созданием E2E тестов необходимо настроить окружение. Это включает в себя мокирование Telegram API и адаптера хранилища:

```typescript
import { describe, it, expect, beforeEach, mock, jest, SpyInstance } from "bun:test";
import { Telegraf } from "telegraf";
import { setupInstagramScraperBot } from "../../..";
import { Update, UserFromGetMe } from "telegraf/types";
import type { ScraperBotContext, InstagramScraperBotConfig, StorageAdapter, User } from "../../types";
import { NeonAdapter } from "../../adapters/neon-adapter";

// Мокируем адаптер хранилища
mock.module("../../adapters/neon-adapter", () => {
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

describe("E2E: Bot Interaction", () => {
  let bot: Telegraf<ScraperBotContext>;
  let mockAdapterInstance: StorageAdapter & {
    [key: string]: jest.Mock | SpyInstance<any[], any>;
  };
  let mockSendMessage: jest.Mock;
  let mockEditMessageText: jest.Mock;
  let mockAnswerCbQuery: jest.Mock;

  const mockChatId = 12345;
  const mockUserIdFromUpdate = 123456789;

  beforeEach(async () => {
    // Создаем экземпляр бота
    bot = new Telegraf<ScraperBotContext>("test-bot-token");
    bot.telegram.getMe = jest.fn().mockResolvedValue({
      id: 987654321,
      is_bot: true,
      first_name: "TestBot",
      username: "TestBot_username",
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
    });

    // Создаем мокированный адаптер хранилища
    mockAdapterInstance = new (NeonAdapter as any)() as StorageAdapter & {
      [key: string]: jest.Mock | SpyInstance<any[], any>;
    };

    // Настраиваем поведение моков адаптера
    (mockAdapterInstance.initialize as jest.Mock).mockResolvedValue(undefined);
    (mockAdapterInstance.close as jest.Mock).mockResolvedValue(undefined);
    (mockAdapterInstance.findUserByTelegramIdOrCreate as jest.Mock).mockResolvedValue({
      id: 1,
      telegram_id: mockUserIdFromUpdate,
      username: "testuser",
      created_at: new Date().toISOString(),
      is_active: true
    });
    (mockAdapterInstance.getProjectsByUserId as jest.Mock).mockResolvedValue([]);

    // Настраиваем бота с мок-адаптером
    setupInstagramScraperBot(bot, mockAdapterInstance, {
      telegramBotToken: "test-e2e-bot-token",
      apifyClientToken: "test-token",
    });

    // Мокируем методы API Telegram
    mockSendMessage = jest.fn();
    mockEditMessageText = jest.fn();
    mockAnswerCbQuery = jest.fn();

    bot.telegram.sendMessage = mockSendMessage;
    bot.telegram.editMessageText = mockEditMessageText;
    bot.telegram.answerCbQuery = mockAnswerCbQuery;
  });

  // Здесь будут тесты
});
```

### 2. Создание теста для команды

Пример теста для команды `/start`:

```typescript
it("should respond to /start command", async () => {
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

  // Проверяем, что были вызваны нужные методы адаптера
  expect(mockAdapterInstance.initialize).toHaveBeenCalled();
  expect(mockAdapterInstance.findUserByTelegramIdOrCreate).toHaveBeenCalledWith(
    mockUserIdFromUpdate,
    'testuser'
  );
  
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
```

### 3. Создание теста для нажатия на инлайн-кнопку

Пример теста для нажатия на кнопку в меню проектов:

```typescript
it("should handle project selection", async () => {
  // Настраиваем мок для getProjectById
  const mockProject = {
    id: 1,
    user_id: 1,
    name: 'Test Project',
    created_at: new Date().toISOString(),
    is_active: true
  };
  (mockAdapterInstance.getProjectById as jest.Mock).mockResolvedValue(mockProject);

  // Создаем объект Update для имитации нажатия на кнопку
  const update: Update = {
    update_id: 123457,
    callback_query: {
      id: '123456',
      from: {
        id: mockUserIdFromUpdate,
        is_bot: false,
        first_name: 'Test',
        username: 'testuser'
      },
      message: {
        message_id: 2,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: mockChatId,
          type: 'private',
          first_name: 'Test',
          username: 'testuser'
        },
        text: 'Ваши проекты:',
        entities: []
      },
      chat_instance: '123456',
      data: 'project_1'
    }
  };

  // Вызываем обработчик нажатия на кнопку
  await bot.handleUpdate(update);

  // Проверяем, что были вызваны нужные методы адаптера
  expect(mockAdapterInstance.initialize).toHaveBeenCalled();
  expect(mockAdapterInstance.findUserByTelegramIdOrCreate).toHaveBeenCalledWith(
    mockUserIdFromUpdate,
    'testuser'
  );
  expect(mockAdapterInstance.getProjectById).toHaveBeenCalledWith(1);
  
  // Проверяем, что было отправлено сообщение с меню проекта
  expect(mockSendMessage).toHaveBeenCalledWith(
    mockChatId,
    expect.stringContaining('Test Project'),
    expect.objectContaining({
      reply_markup: expect.objectContaining({
        inline_keyboard: expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({ text: expect.stringContaining('Конкуренты') })
          ]),
          expect.arrayContaining([
            expect.objectContaining({ text: expect.stringContaining('Хештеги') })
          ])
        ])
      })
    })
  );
  
  // Проверяем, что был вызван метод answerCbQuery
  expect(mockAnswerCbQuery).toHaveBeenCalledWith('123456');
});
```

### 4. Создание теста для ввода текста

Пример теста для ввода названия проекта:

```typescript
it("should handle project creation", async () => {
  // Настраиваем мок для createProject
  const mockProject = {
    id: 1,
    user_id: 1,
    name: 'New Project',
    created_at: new Date().toISOString(),
    is_active: true
  };
  (mockAdapterInstance.createProject as jest.Mock).mockResolvedValue(mockProject);

  // Создаем объект Update для имитации ввода текста
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
      text: 'New Project'
    }
  };

  // Устанавливаем состояние сессии
  bot.context.session = {
    step: 'CREATE_PROJECT',
    userId: 1
  };

  // Вызываем обработчик ввода текста
  await bot.handleUpdate(update);

  // Проверяем, что были вызваны нужные методы адаптера
  expect(mockAdapterInstance.initialize).toHaveBeenCalled();
  expect(mockAdapterInstance.findUserByTelegramIdOrCreate).toHaveBeenCalledWith(
    mockUserIdFromUpdate,
    'testuser'
  );
  expect(mockAdapterInstance.createProject).toHaveBeenCalledWith(1, 'New Project');
  
  // Проверяем, что было отправлено сообщение об успешном создании проекта
  expect(mockSendMessage).toHaveBeenCalledWith(
    mockChatId,
    expect.stringContaining('Проект успешно создан'),
    expect.any(Object)
  );
});
```

## Интеграция с фреймворком для тестирования Telegram-сцен

Фреймворк для тестирования Telegram-сцен может быть интегрирован с E2E тестами для упрощения тестирования сцен и последовательностей действий.

### Использование SceneTester в E2E тестах

```typescript
import { SceneTester } from "../helpers/telegram";
import { ProjectScene } from "../../scenes/project-scene";

it("should test project scene in E2E context", async () => {
  // Создаем тестер сцены
  const sceneTester = new SceneTester({
    sceneName: "ProjectScene",
    sceneFilePath: "../../scenes/project-scene",
    sceneConstructor: ProjectScene
  });

  // Настраиваем моки
  sceneTester.updateAdapter({
    getUserByTelegramId: jest.fn().mockResolvedValue({ id: 1, telegram_id: 123456789 }),
    getProjectsByUserId: jest.fn().mockResolvedValue([{ id: 1, name: "Test Project" }])
  });

  // Вызываем метод сцены
  await sceneTester.callSceneMethod("enterHandler", sceneTester.getContext());

  // Проверяем результаты
  expect(sceneTester.getAdapter().getUserByTelegramId).toHaveBeenCalledWith(123456789);
  expect(sceneTester.getAdapter().getProjectsByUserId).toHaveBeenCalledWith(1);
  expect(sceneTester.getContext().reply).toHaveBeenCalled();
});
```

### Использование SceneSequenceTester в E2E тестах

```typescript
import { SceneTester, SceneSequenceTester, expectSceneStep, expectMessageContaining } from "../helpers/telegram";
import { ProjectScene } from "../../scenes/project-scene";
import { ScraperSceneStep } from "../../types";

it("should test project creation sequence in E2E context", async () => {
  // Создаем тестер сцены
  const sceneTester = new SceneTester({
    sceneName: "ProjectScene",
    sceneFilePath: "../../scenes/project-scene",
    sceneConstructor: ProjectScene
  });

  // Настраиваем моки
  sceneTester.updateAdapter({
    getUserByTelegramId: jest.fn().mockResolvedValue({ id: 1, telegram_id: 123456789 }),
    getProjectsByUserId: jest.fn().mockResolvedValue([]),
    createProject: jest.fn().mockResolvedValue({ id: 1, name: "New Project" })
  });

  // Создаем тестер последовательностей
  const sequenceTester = new SceneSequenceTester(sceneTester);

  // Добавляем шаги в последовательность
  sequenceTester
    .addSceneEnter(
      "Enter scene",
      "enterHandler",
      {},
      (tester) => {
        expectMessageContaining(tester.getContext(), "У вас нет проектов");
      }
    )
    .addButtonClick(
      "Click create project button",
      "create_project",
      "handleCreateProjectAction" as keyof ProjectScene,
      {},
      (tester) => {
        expectSceneStep(tester.getContext(), ScraperSceneStep.CREATE_PROJECT);
        expectMessageContaining(tester.getContext(), "Введите название проекта");
      }
    )
    .addTextInput(
      "Enter project name",
      "New Project",
      "handleProjectSceneText" as keyof ProjectScene,
      {
        sessionData: {
          step: ScraperSceneStep.CREATE_PROJECT
        }
      },
      (tester) => {
        expectMessageContaining(tester.getContext(), "Проект успешно создан");
      }
    );

  // Запускаем последовательность
  await sequenceTester.run();
});
```

## Запуск E2E тестов

Для запуска E2E тестов используется команда:

```bash
bun test src/__tests__/e2e
```

Для запуска конкретного E2E теста:

```bash
bun test src/__tests__/e2e/01_initial_interaction.e2e.test.ts
```

## Лучшие практики E2E тестирования

1. **Изолированные тесты**: Каждый тест должен быть независимым от других тестов.
2. **Чистое состояние**: Перед каждым тестом необходимо очищать состояние (использовать `beforeEach`).
3. **Понятные имена тестов**: Имена тестов должны описывать, что тестируется и какой ожидается результат.
4. **Проверка граничных случаев**: Тестировать не только "счастливый путь", но и обработку ошибок.
5. **Использование фреймворка**: Для тестирования Telegram-сцен использовать специальный фреймворк.
6. **Документирование тестов**: Добавлять комментарии к тестам для объяснения сложных моментов.
7. **Регулярный запуск тестов**: Запускать E2E тесты при каждом коммите для раннего обнаружения проблем.
