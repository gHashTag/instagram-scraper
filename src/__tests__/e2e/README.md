# E2E тесты для Instagram Scraper Bot

Этот документ описывает подход к E2E тестированию Telegram бота для скрапинга Instagram.

## Структура тестов

E2E тесты расположены в директории `src/__tests__/e2e/` и разделены на несколько файлов по функциональности:

1. `01_initial_interaction.e2e.test.ts` - тесты для начального взаимодействия с ботом (команды /start, /projects, /competitors)
2. `02_project_management.e2e.test.ts` - тесты для управления проектами (создание, выбор проекта)
3. `03_competitor_management.e2e.test.ts` - тесты для управления конкурентами (добавление, удаление)
4. `04_hashtag_management.e2e.test.ts` - тесты для управления хештегами (добавление, удаление)

## Хелпер `setupE2ETestEnvironment`

Для упрощения настройки тестового окружения используется хелпер `setupE2ETestEnvironment` из файла `src/__tests__/helpers/e2e-setup.ts`. Этот хелпер:

1. Создает экземпляр бота Telegraf с мокированными методами API
2. Настраивает обработчики команд и callback-запросов для тестирования
3. Создает моки для хранилища данных (NeonAdapter)
4. Возвращает объект с настроенным ботом и моками для использования в тестах

### Использование хелпера

```typescript
import { setupE2ETestEnvironment } from "../helpers/e2e-setup";

describe("E2E: Test Suite", () => {
  let testEnv: ReturnType<typeof setupE2ETestEnvironment>;

  beforeEach(() => {
    // Настраиваем тестовое окружение
    testEnv = setupE2ETestEnvironment();
  });

  it("should do something", async () => {
    // Создаем объект Update для имитации команды или callback-запроса
    const update: Update = {
      // ...
    };

    // Вызываем обработчик
    await testEnv.bot.handleUpdate(update);

    // Проверяем, что были вызваны нужные методы
    expect(testEnv.mockSendMessage).toHaveBeenCalledWith(
      // ...
    );
  });
});
```

## Подход к мокированию Telegram API

Вместо реальных вызовов API Telegram, мы используем моки для всех методов API:

1. `mockSendMessage` - мок для метода `telegram.sendMessage`
2. `mockEditMessageText` - мок для метода `telegram.editMessageText`
3. `mockAnswerCbQuery` - мок для метода `telegram.answerCbQuery`
4. `mockSceneEnter` - мок для метода `scene.enter`

Для обработки команд и callback-запросов мы создаем специальные обработчики в хелпере `setupE2ETestEnvironment`:

```typescript
// Создаем тестовый обработчик для команды /start
bot.command('start', async () => {
  // Вызываем напрямую mockSendMessage вместо ctx.reply
  await mockSendMessage(
    CHAT_ID_FOR_TESTING,
    'Добро пожаловать в Instagram Scraper Bot!',
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
```

## Примеры тестов

### Тест для команды /start

```typescript
it("should respond to /start command with welcome message", async () => {
  // Создаем объект Update для имитации команды /start
  const update: Update = {
    update_id: 123456,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: {
        id: CHAT_ID_FOR_TESTING,
        type: 'private',
        first_name: 'Test',
        username: 'testuser'
      },
      from: {
        id: USER_ID_FOR_TESTING,
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
  await testEnv.bot.handleUpdate(update);

  // Проверяем, что было отправлено приветственное сообщение
  expect(testEnv.mockSendMessage).toHaveBeenCalledWith(
    CHAT_ID_FOR_TESTING,
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

### Тест для callback-запроса

```typescript
it("should allow adding a new competitor", async () => {
  // Создаем объект Update для имитации нажатия на кнопку добавления конкурента
  const callbackUpdate: Update = {
    update_id: 123461,
    callback_query: {
      id: "123458",
      from: {
        id: USER_ID_FOR_TESTING,
        is_bot: false,
        first_name: "Test",
        username: "testuser",
      },
      message: {
        message_id: 6,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: CHAT_ID_FOR_TESTING,
          type: "private",
          first_name: "Test",
          username: "testuser",
        },
        text: "Список конкурентов",
        entities: [],
      },
      chat_instance: "123456",
      data: "add_competitor_1",
    },
  };

  // Вызываем обработчик callback-запроса
  await testEnv.bot.handleUpdate(callbackUpdate);

  // Проверяем, что был вызван метод answerCbQuery
  expect(testEnv.mockAnswerCbQuery).toHaveBeenCalledWith("123458");

  // Проверяем, что было отправлено сообщение с запросом имени конкурента
  expect(testEnv.mockSendMessage).toHaveBeenCalledWith(
    CHAT_ID_FOR_TESTING,
    expect.stringContaining("Введите имя аккаунта конкурента"),
    expect.any(Object)
  );
});
```

## Запуск тестов

Для запуска всех E2E тестов используйте команду:

```bash
bun test src/__tests__/e2e/
```

Для запуска конкретного файла с тестами:

```bash
bun test src/__tests__/e2e/01_initial_interaction.e2e.test.ts
```
