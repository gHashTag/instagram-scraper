# Тестирование в Instagram Scraper Bot

Этот документ описывает подход к тестированию в проекте Instagram Scraper Bot, включая структуру тестов, используемые инструменты и паттерны тестирования.

## Структура тестов

Тесты в проекте организованы следующим образом:

```
src/__tests__/
├── framework/                # Фреймворк для тестирования
│   ├── telegram/             # Компоненты для тестирования Telegram-ботов
│   │   ├── assertions.ts     # Утилиты для проверки состояния сцены
│   │   ├── index.ts          # Экспорт всех компонентов фреймворка
│   │   ├── mocks.ts          # Функции для создания моков
│   │   ├── scene-tester.ts   # Класс для тестирования сцен
│   │   ├── sequence-tester.ts # Класс для тестирования последовательностей действий
│   │   ├── test-generators.ts # Генераторы тестов
│   │   └── types.ts          # Типы и интерфейсы
│   ├── README.md             # Документация по фреймворку
│   └── tests/                # Тесты для фреймворка
│       └── framework.test.ts # Тесты для компонентов фреймворка
├── examples/                 # Примеры использования фреймворка
│   ├── chatbot-scene-example.test.ts # Пример тестирования чат-бота
│   └── telegram-scene-test-example.test.ts # Пример тестирования Telegram-сцены
├── e2e/                     # End-to-end тесты
│   ├── project-scene.e2e.test.ts    # E2E тесты для сцены проектов
│   ├── competitor-scene.e2e.test.ts # E2E тесты для сцены конкурентов
│   └── hashtag-scene.e2e.test.ts    # E2E тесты для сцены хештегов
├── integration/              # Интеграционные тесты
├── setup.ts                  # Настройка окружения для тестов
└── unit/                     # Модульные тесты
    ├── adapters/             # Тесты для адаптеров хранилища
    ├── scenes/               # Тесты для Telegram-сцен
    └── utils/                # Тесты для утилит
```

## Инструменты тестирования

В проекте используются следующие инструменты для тестирования:

- **Bun Test** - встроенный в Bun фреймворк для тестирования, совместимый с Jest API
- **TypeScript** - для типизации тестов и проверки типов
- **Фреймворк для тестирования Telegram-ботов** (`src/__tests__/framework/telegram/`) - собственный фреймворк для упрощения тестирования Telegram-ботов

## Запуск тестов

Для запуска тестов используются следующие команды:

```bash
# Запуск всех тестов
bun test

# Запуск конкретного теста
bun test src/__tests__/unit/scenes/project-scene-enter.test.ts

# Запуск тестов с определенным паттерном
bun test --pattern "project-scene"

# Запуск тестов в watch-режиме
bun test --watch
```

## Фреймворк для тестирования Telegram-ботов

Для тестирования Telegram-ботов в проекте разработан специальный фреймворк, который упрощает создание и поддержку тестов. Фреймворк предоставляет инструменты для создания моков, тестирования обработчиков и проверки состояния сцены.

### Основные компоненты фреймворка

1. **SceneTester** - класс для тестирования Telegram-сцен
2. **SequenceTester** - класс для тестирования последовательностей действий
3. **Генераторы тестов** - функции для генерации типовых тестов
4. **Утилиты для проверки состояния** - функции для проверки состояния сцены и отправленных сообщений
5. **Моки** - функции для создания моков контекста и адаптера хранилища

### Преимущества фреймворка

- Чистая и модульная архитектура
- Строгая типизация
- Гибкие инструменты для создания моков
- Поддержка тестирования последовательностей действий
- Генераторы типовых тестов
- Подробная документация

Подробная документация по фреймворку доступна в файле [src/__tests__/framework/README.md](./framework/README.md).

### Примеры использования фреймворка

Примеры использования фреймворка доступны в директории `src/__tests__/examples/`.

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { SceneTester, expectReplyWithText } from "../../framework/telegram";
import { projectScene } from "../../../scenes/project-scene";

describe("ProjectScene - Enter Handler", () => {
  // Создаем тестер сцены
  const sceneTester = new SceneTester({
    sceneName: "ProjectScene",
    sceneFilePath: "../../../scenes/project-scene",
    sceneInstance: projectScene
  });

  // Создаем тестовый набор
  sceneTester.createTestSuite([
    {
      name: "should handle enter correctly",
      setup: (tester) => {
        // Настройка контекста и адаптера
        const context = tester.getContext();
        context.scene.session.currentProjectId = 1;

        const adapter = tester.getAdapter();
        adapter.getProjectById = jest.fn().mockResolvedValue({
          id: 1,
          name: "Test Project"
        });
      },
      test: async (scene, context, adapter) => {
        // Вызываем метод enter
        await (scene as any).enter(context);

        // Проверяем результаты
        expectReplyWithText(context, "Проект: Test Project");
      }
    }
  ]);
});
```

## Паттерны тестирования

### 1. Модульное тестирование

Модульные тесты проверяют отдельные компоненты системы в изоляции. В проекте используются следующие паттерны модульного тестирования:

#### 1.1. Тестирование адаптеров хранилища

Для тестирования адаптеров хранилища используется подход с мокированием внешних зависимостей (например, базы данных) и проверкой корректности вызовов методов.

```typescript
import { describe, it, expect, beforeEach, jest } from "bun:test";
import { PostgresAdapter } from "../../../adapters/postgres-adapter";

describe("PostgresAdapter", () => {
  let adapter: PostgresAdapter;
  let mockPool: any;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue({
        query: jest.fn(),
        release: jest.fn()
      })
    };
    adapter = new PostgresAdapter(mockPool);
  });

  it("should get user by telegram id", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1, telegram_id: 123456789 }] });

    const user = await adapter.getUserByTelegramId(123456789);

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT * FROM users"),
      [123456789]
    );
    expect(user).toEqual({ id: 1, telegram_id: 123456789 });
  });
});
```

#### 1.2. Тестирование утилит

Для тестирования утилит используется подход с проверкой корректности возвращаемых значений для различных входных данных.

```typescript
import { describe, it, expect } from "bun:test";
import { formatDate } from "../../../utils/date-utils";

describe("Date Utils", () => {
  it("should format date correctly", () => {
    const date = new Date("2023-01-01T12:00:00Z");

    const formattedDate = formatDate(date);

    expect(formattedDate).toBe("01.01.2023 12:00");
  });
});
```

### 2. Тестирование Telegram-сцен

Для тестирования Telegram-сцен используется специальный фреймворк, который упрощает создание и поддержку тестов. Основные паттерны тестирования Telegram-сцен:

#### 2.0. Прямое тестирование обработчиков сцен

Прямой подход к тестированию сцен заключается в вызове обработчиков с мокированным контекстом, что упрощает тестирование и делает тесты более понятными:

```typescript
import { describe, it, expect, beforeEach, jest } from "bun:test";
import { handleProjectEnter, handleCreateProjectAction } from "../../../scenes/project-scene";
import { ScraperSceneStep } from "../../../types";
import { createMockContext, createMockAdapter } from "../../framework/telegram";

describe("E2E: Project Scene", () => {
  it("should show empty projects list when entering scene", async () => {
    // Создаем мок для контекста и адаптера
    const mockContext = createMockContext();
    const mockAdapter = createMockAdapter({
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      getUserByTelegramId: jest.fn().mockResolvedValue({
        id: 1,
        telegram_id: 123456789,
      }),
      getProjectsByUserId: jest.fn().mockResolvedValue([])
    });

    // Добавляем адаптер в контекст
    mockContext.storage = mockAdapter;

    // Вызываем обработчик входа в сцену
    await handleProjectEnter(mockContext);

    // Проверяем, что были вызваны нужные методы
    expect(mockAdapter.initialize).toHaveBeenCalled();
    expect(mockAdapter.getUserByTelegramId).toHaveBeenCalledWith(123456789);
    expect(mockContext.reply).toHaveBeenCalled();
  });
});

#### 2.1. Тестирование с использованием SceneTester

```typescript
import { describe, it, expect } from "bun:test";
import { SceneTester, expectReplyWithText } from "../../framework/telegram";
import { projectScene } from "../../../scenes/project-scene";

describe("ProjectScene - Enter Handler", () => {
  const sceneTester = new SceneTester({
    sceneName: "ProjectScene",
    sceneFilePath: "../../../scenes/project-scene",
    sceneInstance: projectScene
  });

  sceneTester.createTestSuite([
    {
      name: "should handle enter correctly",
      setup: (tester) => {
        // Настройка контекста и адаптера
        const adapter = tester.getAdapter();
        adapter.getUserByTelegramId = jest.fn().mockResolvedValue({
          id: 1,
          telegram_id: 123456789
        });
        adapter.getProjectsByUserId = jest.fn().mockResolvedValue([
          { id: 1, name: "Test Project" }
        ]);
      },
      test: async (scene, context, adapter) => {
        // Вызываем метод enter
        await (scene as any).enter(context);

        // Проверяем результаты
        expectReplyWithText(context, "Ваши проекты");
      }
    }
  ]);
});
```

#### 2.2. Тестирование последовательностей действий

```typescript
import { describe } from "bun:test";
import { SequenceTester, expectReplyWithText } from "../../framework/telegram";
import { projectScene } from "../../../scenes/project-scene";
import { ScraperSceneStep } from "../../../types";

describe("ProjectScene - Full Scenario", () => {
  const sequenceTester = new SequenceTester({
    sceneName: "ProjectScene",
    sceneFilePath: "../../../scenes/project-scene",
    sceneInstance: projectScene
  });

  sequenceTester.testSequence("Project Creation", [
    {
      name: "Enter scene",
      action: async (tester) => {
        const scene = tester.createScene();
        const context = tester.getContext();
        const adapter = tester.getAdapter();

        // Настройка адаптера
        adapter.getUserByTelegramId = jest.fn().mockResolvedValue({
          id: 1,
          telegram_id: 123456789
        });
        adapter.getProjectsByUserId = jest.fn().mockResolvedValue([]);

        // Вызываем метод enter
        await (scene as any).enter(context);
      },
      assertions: (tester) => {
        const context = tester.getContext();
        expectReplyWithText(context, "У вас еще нет проектов");
      }
    },
    {
      name: "Click create project button",
      action: async (tester) => {
        const scene = tester.createScene();
        const context = tester.getContext();

        // Настройка контекста
        context.callbackQuery = {
          ...context.callbackQuery,
          data: "create_project"
        };

        // Вызываем обработчик
        await (scene as any).handleCreateProjectAction(context);
      },
      assertions: (tester) => {
        const context = tester.getContext();
        expect(context.scene.session.step).toBe(ScraperSceneStep.CREATE_PROJECT);
        expectReplyWithText(context, "Введите название");
      }
    }
  ]);
});

```

### 3. Интеграционное тестирование

Интеграционные тесты проверяют взаимодействие между компонентами системы. В проекте используются следующие паттерны интеграционного тестирования:

#### 3.1. Тестирование взаимодействия адаптера с базой данных

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { PostgresAdapter } from "../../../adapters/postgres-adapter";
import { Pool } from "pg";

describe("PostgresAdapter Integration", () => {
  let adapter: PostgresAdapter;
  let pool: Pool;

  beforeEach(async () => {
    // Создаем реальное подключение к тестовой базе данных
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL
    });

    adapter = new PostgresAdapter(pool);
    await adapter.initialize();

    // Очищаем таблицы перед каждым тестом
    await pool.query("TRUNCATE users, projects, competitors, hashtags CASCADE");
  });

  afterEach(async () => {
    await adapter.close();
  });

  it("should create and retrieve user", async () => {
    // Создаем пользователя
    const user = await adapter.findUserByTelegramIdOrCreate(123456789, "testuser");

    // Проверяем, что пользователь создан
    expect(user).toEqual(expect.objectContaining({
      telegram_id: 123456789,
      username: "testuser"
    }));

    // Получаем пользователя по telegram_id
    const retrievedUser = await adapter.getUserByTelegramId(123456789);

    // Проверяем, что получен тот же пользователь
    expect(retrievedUser).toEqual(expect.objectContaining({
      telegram_id: 123456789,
      username: "testuser"
    }));
  });
});
```

### 4. E2E тестирование

E2E (End-to-End) тесты проверяют работу системы от начала до конца, имитируя взаимодействие пользователя с ботом через Telegram API. В проекте используется подход к E2E тестированию, основанный на эмуляции обновлений от Telegram и мокировании API.

#### 4.1. Тестирование команд бота

```typescript
import { describe, it, expect, beforeEach, mock, jest } from "bun:test";
import { Telegraf } from "telegraf";
import { setupInstagramScraperBot } from "../../..";
import { Update } from "telegraf/types";
import { NeonAdapter } from "../../adapters/neon-adapter";

describe("E2E: Bot Commands", () => {
  let bot: Telegraf<any>;
  let mockAdapterInstance: any;
  let mockSendMessage: jest.Mock;

  beforeEach(async () => {
    // Настройка мокированного окружения
    // ...

    // Создаем объект Update для имитации команды /start
    const update: Update = {
      update_id: 123456,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: 12345,
          type: 'private',
          first_name: 'Test',
          username: 'testuser'
        },
        from: {
          id: 123456789,
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

    // Проверяем, что были вызваны нужные методы
    expect(mockAdapterInstance.initialize).toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining('Добро пожаловать'),
      expect.any(Object)
    );
  });
});
```

#### 4.2. Тестирование взаимодействия с инлайн-клавиатурой

```typescript
it("should handle project selection", async () => {
  // Создаем объект Update для имитации нажатия на кнопку
  const update: Update = {
    update_id: 123457,
    callback_query: {
      id: '123456',
      from: {
        id: 123456789,
        is_bot: false,
        first_name: 'Test',
        username: 'testuser'
      },
      message: {
        message_id: 2,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: 12345,
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

  // Проверяем, что были вызваны нужные методы
  expect(mockAdapterInstance.getProjectById).toHaveBeenCalledWith(1);
  expect(mockSendMessage).toHaveBeenCalledWith(
    12345,
    expect.stringContaining('Проект'),
    expect.any(Object)
  );
});
```

#### 4.3. Интеграция с фреймворком для тестирования Telegram-сцен

E2E тесты могут быть интегрированы с фреймворком для тестирования Telegram-сцен для упрощения тестирования сложных сценариев:

```typescript
import { SceneTester, SceneSequenceTester } from "../../helpers/telegram";

it("should test project creation sequence", async () => {
  // Создаем тестер сцены и последовательностей
  const sceneTester = new SceneTester({
    sceneName: "ProjectScene",
    sceneFilePath: "../../scenes/project-scene",
    sceneConstructor: ProjectScene
  });

  const sequenceTester = new SceneSequenceTester(sceneTester);

  // Добавляем шаги в последовательность
  sequenceTester
    .addSceneEnter(/* ... */)
    .addButtonClick(/* ... */)
    .addTextInput(/* ... */);

  // Запускаем последовательность
  await sequenceTester.run();
});
```

Подробная документация по E2E тестированию доступна в файле [E2E_TESTING.md](./E2E_TESTING.md).
```

## Лучшие практики тестирования

1. **Изолированные тесты** - каждый тест должен быть независимым от других тестов
2. **Чистое состояние** - перед каждым тестом необходимо очищать состояние (использовать `beforeEach` и `afterEach`)
3. **Понятные имена тестов** - имена тестов должны описывать, что тестируется и какой ожидается результат
4. **Минимальные моки** - мокировать только необходимые зависимости
5. **Проверка граничных случаев** - тестировать не только "счастливый путь", но и обработку ошибок и граничные случаи
6. **Один тест - одна проверка** - каждый тест должен проверять только одну функциональность
7. **Использование фреймворка** - для тестирования Telegram-сцен использовать специальный фреймворк

## Дополнительные ресурсы

- [Документация по Bun Test](https://bun.sh/docs/cli/test)
- [Документация по фреймворку для тестирования Telegram-ботов](./framework/README.md)
- [Примеры использования фреймворка](./examples/)
- [Примеры тестов в проекте](./unit/scenes/)
