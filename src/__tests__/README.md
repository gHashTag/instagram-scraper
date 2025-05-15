# Тестирование в Instagram Scraper Bot

Этот документ описывает подход к тестированию в проекте Instagram Scraper Bot, включая структуру тестов, используемые инструменты и паттерны тестирования.

## Структура тестов

Тесты в проекте организованы следующим образом:

```
src/__tests__/
├── helpers/                  # Вспомогательные инструменты для тестирования
│   └── telegram/             # Фреймворк для тестирования Telegram-сцен
│       ├── assertions.ts     # Утилиты для проверки состояния сцены
│       ├── index.ts          # Экспорт всех компонентов фреймворка
│       ├── mocks.ts          # Функции для создания моков
│       ├── README.md         # Документация по фреймворку
│       ├── scene-tester.ts   # Класс для тестирования сцен
│       ├── sequence-tester.ts # Класс для тестирования последовательностей действий
│       ├── test-generators.ts # Генераторы тестов
│       ├── test-templates.ts # Шаблоны для типичных сценариев тестирования
│       ├── types.ts          # Типы и интерфейсы
│       └── ui-mocks.ts       # Моки для UI-элементов
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
- **Фреймворк для тестирования Telegram-сцен** - собственный фреймворк для упрощения тестирования Telegram-сцен

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

## Фреймворк для тестирования Telegram-сцен

Для тестирования Telegram-сцен в проекте разработан специальный фреймворк, который упрощает создание и поддержку тестов. Фреймворк предоставляет инструменты для создания моков, тестирования обработчиков и проверки состояния сцены.

### Основные компоненты фреймворка

1. **SceneTester** - класс для тестирования Telegram-сцен
2. **SceneSequenceTester** - класс для тестирования последовательностей действий
3. **Генераторы тестов** - функции для генерации тестов для обработчиков
4. **Утилиты для проверки состояния** - функции для проверки состояния сцены и отправленных сообщений
5. **Моки для UI-элементов** - функции для создания моков инлайн-клавиатур и других UI-элементов
6. **Шаблоны для типичных сценариев** - функции для создания типичных сценариев тестирования

Подробная документация по фреймворку доступна в файле [src/__tests__/helpers/telegram/README.md](./helpers/telegram/README.md).

### Пример использования фреймворка

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { SceneTester, generateEnterHandlerTests } from "../../helpers/telegram";
import { ProjectScene } from "../../../scenes/project-scene";

describe("ProjectScene - Enter Handler", () => {
  // Создаем тестер сцены
  const sceneTester = new SceneTester({
    sceneName: "ProjectScene",
    sceneFilePath: "../../../scenes/project-scene",
    sceneConstructor: ProjectScene
  });

  // Генерируем тесты для обработчика входа в сцену
  generateEnterHandlerTests(sceneTester);
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

Новый подход к тестированию сцен заключается в прямом вызове обработчиков с мокированным контекстом, что упрощает тестирование и делает тесты более понятными:

```typescript
import { describe, it, expect, beforeEach, jest } from "bun:test";
import { handleProjectEnter, handleCreateProjectAction } from "../../../scenes/project-scene";
import { ScraperSceneStep } from "../../../types";

describe("E2E: Project Scene", () => {
  let mockContext: any;
  let mockStorage: any;

  beforeEach(() => {
    // Создаем мок для хранилища
    mockStorage = {
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      getUserByTelegramId: jest.fn().mockResolvedValue({
        id: 1,
        telegram_id: 123456789,
      }),
      // Другие методы...
    };

    // Создаем мок для контекста
    mockContext = {
      from: { id: 123456789, username: "testuser" },
      scene: { session: {}, enter: jest.fn(), leave: jest.fn() },
      reply: jest.fn().mockResolvedValue({}),
      // Другие методы...
      storage: mockStorage,
    };
  });

  it("should show empty projects list when entering scene", async () => {
    // Вызываем обработчик входа в сцену
    await handleProjectEnter(mockContext);

    // Проверяем, что были вызваны нужные методы
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.getUserByTelegramId).toHaveBeenCalledWith(123456789);
    // Другие проверки...
  });
});

#### 2.1. Тестирование обработчика входа в сцену

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { SceneTester, generateEnterHandlerTests } from "../../helpers/telegram";
import { ProjectScene } from "../../../scenes/project-scene";

describe("ProjectScene - Enter Handler", () => {
  const sceneTester = new SceneTester({
    sceneName: "ProjectScene",
    sceneFilePath: "../../../scenes/project-scene",
    sceneConstructor: ProjectScene
  });

  generateEnterHandlerTests(sceneTester);
});
```

#### 2.2. Тестирование обработчиков действий

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { SceneTester, generateActionHandlerTests } from "../../helpers/telegram";
import { ProjectScene } from "../../../scenes/project-scene";

describe("ProjectScene - Action Handlers", () => {
  const sceneTester = new SceneTester({
    sceneName: "ProjectScene",
    sceneFilePath: "../../../scenes/project-scene",
    sceneConstructor: ProjectScene
  });

  generateActionHandlerTests(
    sceneTester,
    "handleSelectProjectAction" as keyof ProjectScene,
    "project"
  );
});
```

#### 2.3. Тестирование обработчиков текстовых сообщений

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { SceneTester, generateTextHandlerTests } from "../../helpers/telegram";
import { ProjectScene } from "../../../scenes/project-scene";
import { ScraperSceneStep } from "../../../types";

describe("ProjectScene - Text Input Handler", () => {
  const sceneTester = new SceneTester({
    sceneName: "ProjectScene",
    sceneFilePath: "../../../scenes/project-scene",
    sceneConstructor: ProjectScene
  });

  generateTextHandlerTests(
    sceneTester,
    "handleProjectSceneText" as keyof ProjectScene,
    "CREATE_PROJECT",
    ScraperSceneStep.CREATE_PROJECT
  );
});
```

#### 2.4. Тестирование последовательностей действий

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { SceneTester, SceneSequenceTester, expectSceneStep, expectMessageContaining } from "../../helpers/telegram";
import { ProjectScene } from "../../../scenes/project-scene";
import { ScraperSceneStep } from "../../../types";

describe("ProjectScene - Full Scenario", () => {
  it("should handle full project creation scenario", async () => {
    const sceneTester = new SceneTester({
      sceneName: "ProjectScene",
      sceneFilePath: "../../../scenes/project-scene",
      sceneConstructor: ProjectScene
    });

    sceneTester.updateAdapter({
      getUserByTelegramId: jest.fn().mockResolvedValue({ id: 1, telegram_id: 123456789 }),
      getProjectsByUserId: jest.fn().mockResolvedValue([]),
      createProject: jest.fn().mockResolvedValue({ id: 1, name: "New Project" })
    });

    const sequenceTester = new SceneSequenceTester(sceneTester);

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

    await sequenceTester.run();
  });
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
- [Документация по фреймворку для тестирования Telegram-сцен](./helpers/telegram/README.md)
- [Примеры тестов в проекте](./unit/scenes/)
