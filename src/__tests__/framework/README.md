# Фреймворк для тестирования Telegram-ботов

Этот фреймворк предоставляет набор инструментов для тестирования Telegram-ботов, созданных с использованием библиотеки Telegraf.

## Структура фреймворка

Фреймворк состоит из следующих компонентов:

- **Типы** (`types.ts`) - типы и интерфейсы для создания моков и тестирования Telegram-сцен
- **Моки** (`mocks.ts`) - функции для создания моков контекста и адаптера хранилища
- **Утверждения** (`assertions.ts`) - функции для проверки вызовов методов контекста
- **Тестеры** (`scene-tester.ts`, `sequence-tester.ts`) - классы для тестирования Telegram-сцен и последовательностей действий
- **Генераторы тестов** (`test-generators.ts`) - функции для генерации типовых тестов для Telegram-сцен

## Использование фреймворка

### Создание моков

```typescript
import { createMockContext, createMockAdapter } from "../framework/telegram";

// Создание мокированного контекста
const mockContext = createMockContext({
  userId: 123456789,
  username: "testuser",
  messageText: "Test message",
  callbackQueryData: "test_callback_data",
  sessionData: {
    currentProjectId: 1,
    currentReelId: "reel123",
  },
});

// Создание мокированного адаптера хранилища
const mockAdapter = createMockAdapter({
  getReelById: jest.fn().mockResolvedValue({
    id: 1,
    instagram_id: "reel123",
    url: "https://example.com",
    caption: "Test Reel",
    transcript: "This is a test transcript.",
    transcript_status: "completed",
  }),
});
```

### Тестирование сцены

```typescript
import { SceneTester } from "../framework/telegram";
import { ChatbotScene } from "../../scenes/chatbot-scene";

// Создание тестера для сцены
const sceneTester = new SceneTester({
  sceneName: "ChatbotScene",
  sceneFilePath: "../../scenes/chatbot-scene.ts",
  sceneConstructor: ChatbotScene,
  constructorArgs: ["test-api-key"],
});

// Создание тестового набора
sceneTester.createTestSuite([
  {
    name: "should handle enter correctly",
    setup: (tester) => {
      // Настройка контекста и адаптера
      const context = tester.getContext();
      context.scene.session.currentProjectId = 1;

      const adapter = tester.getAdapter();
      adapter.getReelById.mockResolvedValue({
        id: 1,
        instagram_id: "reel123",
        url: "https://example.com",
        caption: "Test Reel",
        transcript: "This is a test transcript.",
        transcript_status: "completed",
      });
    },
    test: async (scene, context, adapter) => {
      // Вызов метода enter
      await (scene as any).enter(context);

      // Проверка результатов
      expect(context.reply).toHaveBeenCalledWith(
        expect.stringContaining("Чат с видео"),
        expect.anything()
      );
    },
  },
]);
```

### Тестирование последовательности действий

```typescript
import { SequenceTester } from "../framework/telegram";
import { ChatbotScene } from "../../scenes/chatbot-scene";
import { expectReplyWithText, expectAnswerCbQuery } from "../framework/telegram";

// Создание тестера для последовательности действий
const sequenceTester = new SequenceTester({
  sceneName: "ChatbotScene",
  sceneFilePath: "../../scenes/chatbot-scene.ts",
  sceneConstructor: ChatbotScene,
  constructorArgs: ["test-api-key"],
});

// Тестирование последовательности действий
sequenceTester.testSequence("Chat with Reel", [
  // Шаг 1: Вход в сцену
  {
    name: "Enter scene",
    action: async (tester) => {
      const scene = tester.createScene() as any;
      const context = tester.getContext();

      // Настройка контекста и адаптера
      context.scene.session.currentProjectId = 1;
      context.scene.session.currentReelId = "reel123";

      const adapter = tester.getAdapter();
      adapter.getReelById.mockResolvedValue({
        id: 1,
        instagram_id: "reel123",
        url: "https://example.com",
        caption: "Test Reel",
        transcript: "This is a test transcript.",
        transcript_status: "completed",
      });

      // Вызов метода enter
      await scene.enter(context);
    },
    assertions: (tester) => {
      const context = tester.getContext();

      // Проверка результатов
      expectReplyWithText(context, "Чат с видео");
    },
  },

  // Шаг 2: Отправка текстового сообщения
  {
    name: "Send text message",
    action: async (tester) => {
      const scene = tester.createScene() as any;
      const context = tester.getContext();

      // Настройка контекста
      context.message = {
        ...context.message,
        text: "What is this video about?",
      };

      // Настройка сервиса чат-бота
      scene.chatbotService.generateResponse = jest.fn().mockResolvedValue(
        "This video is about Instagram Reels."
      );

      // Вызов обработчика текстовых сообщений
      await scene.onText(context);
    },
    assertions: (tester) => {
      const context = tester.getContext();
      const scene = tester.createScene() as any;

      // Проверка результатов
      expect(context.sendChatAction).toHaveBeenCalledWith("typing");
      expect(scene.chatbotService.generateResponse).toHaveBeenCalledWith(
        "123456789",
        "reel123",
        "What is this video about?"
      );
      expectReplyWithText(context, "This video is about Instagram Reels.");
    },
  },
]);
```

### Использование генераторов тестов

```typescript
import { generateTextHandlerTests, generateCallbackQueryHandlerTests } from "../framework/telegram";
import { ChatbotScene } from "../../scenes/chatbot-scene";

// Создание экземпляра сцены
const mockAdapter = createMockAdapter();
const chatbotScene = new ChatbotScene(mockAdapter, "test-api-key");

// Генерация тестов для обработчика текстовых сообщений
generateTextHandlerTests({
  name: "ChatbotScene",
  scene: chatbotScene,
  getHandler: (scene) => (scene as any).onText.bind(scene),
  cases: [
    {
      name: "should generate response for text message",
      text: "What is this video about?",
      setupContext: (ctx) => {
        ctx.scene.session.currentReelId = "reel123";
        (chatbotScene as any).chatbotService.generateResponse = jest.fn().mockResolvedValue(
          "This video is about Instagram Reels."
        );
      },
      assertions: (ctx) => {
        expect(ctx.sendChatAction).toHaveBeenCalledWith("typing");
        expect((chatbotScene as any).chatbotService.generateResponse).toHaveBeenCalledWith(
          "123456789",
          "reel123",
          "What is this video about?"
        );
        expect(ctx.reply).toHaveBeenCalledWith(
          "This video is about Instagram Reels.",
          expect.anything()
        );
      },
    },
  ],
});
```

## Расширение фреймворка

Фреймворк можно расширять, добавляя новые компоненты или улучшая существующие. Например, можно добавить поддержку для тестирования других типов обработчиков или создать новые генераторы тестов для специфических сценариев.

## Тестирование фреймворка

Тесты для фреймворка находятся в директории `src/__tests__/framework/tests/`. Они проверяют работу основных компонентов фреймворка:

- Создание моков контекста и адаптера
- Работу класса SceneTester
- Работу класса SequenceTester
- Работу генераторов тестов

Для запуска тестов фреймворка используйте команду:

```bash
bun test src/__tests__/framework/tests/
```
