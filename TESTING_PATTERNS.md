# Паттерны и инструменты для тестирования Telegram-сцен

В этом документе описаны паттерны и инструменты для тестирования Telegram-сцен в проекте Instagram Scraper Bot.

## Содержание

1. [Паттерны тестирования](#паттерны-тестирования)
2. [Фреймворк для тестирования Telegram-сцен](#фреймворк-для-тестирования-telegram-сцен)
3. [Инструменты для тестирования](#инструменты-для-тестирования)
4. [Процесс TDD](#процесс-tdd)
5. [Примеры тестов](#примеры-тестов)

## Паттерны тестирования

### Структура тестов для Telegram-сцен

Для каждой Telegram-сцены рекомендуется создавать три типа тестов:

1. **Тесты для обработчика входа в сцену** (`*-enter.test.ts`)
   - Тестируют логику, выполняемую при входе в сцену
   - Проверяют различные сценарии входа (успешный вход, ошибки и т.д.)

2. **Тесты для обработчиков действий** (`*-actions.test.ts`)
   - Тестируют обработчики действий, вызываемые при нажатии на кнопки
   - Проверяют различные сценарии действий (успешное выполнение, ошибки и т.д.)

3. **Тесты для обработчиков текстовых сообщений** (`*-ontext.test.ts`)
   - Тестируют обработчики текстовых сообщений
   - Проверяют различные сценарии ввода текста (валидный ввод, невалидный ввод, ошибки и т.д.)

### Общие паттерны для всех типов тестов

1. **Мокирование адаптера хранилища**
   ```typescript
   const mockAdapter: jest.Mocked<StorageAdapter> = {
     findUserByTelegramIdOrCreate: jest.fn(),
     getProjectsByUserId: jest.fn(),
     // ... другие методы
   };
   ```

2. **Мокирование контекста Telegraf**
   ```typescript
   const ctx = {
     scene: {
       enter: jest.fn(),
       reenter: jest.fn(),
       leave: jest.fn(),
       state: {},
     } as unknown as Scenes.SceneContext,
     reply: jest.fn().mockResolvedValue({} as Message.TextMessage),
     from: { id: 123456789 },
     // ... другие свойства
   };
   ```

3. **Сброс моков перед и после каждого теста**
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks();
   });

   afterEach(() => {
     jest.clearAllMocks();
   });
   ```

4. **Проверка вызова методов адаптера и контекста**
   ```typescript
   expect(mockAdapter.findUserByTelegramIdOrCreate).toHaveBeenCalledWith(123456789);
   expect(ctx.reply).toHaveBeenCalled();
   expect(mockAdapter.close).toHaveBeenCalled();
   ```

## Фреймворк для тестирования Telegram-сцен

В проекте реализован специальный фреймворк для тестирования Telegram-сцен, который упрощает создание и поддержку тестов.

### Структура фреймворка

Фреймворк находится в директории `src/test-framework/telegram` и состоит из следующих компонентов:

1. **types.ts** - типы для фреймворка
2. **mocks.ts** - утилиты для создания моков
3. **scene-tester.ts** - класс для тестирования сцен
4. **test-generators.ts** - генераторы тестов
5. **index.ts** - экспорт всех компонентов фреймворка

### Использование фреймворка

#### Создание тестера сцены

```typescript
import { SceneTester } from "../../../test-framework/telegram";
import { ProjectScene } from "../../../scenes/project-scene";

// Создаем тестер сцены
const sceneTester = new SceneTester({
  sceneName: "ProjectScene",
  sceneFilePath: "../../../scenes/project-scene",
  sceneConstructor: ProjectScene
});
```

#### Генерация тестов для обработчика входа в сцену

```typescript
import { generateEnterHandlerTests } from "../../../test-framework/telegram";

// Генерируем тесты для обработчика входа в сцену
generateEnterHandlerTests(sceneTester);
```

#### Генерация тестов для обработчика действия

```typescript
import { generateActionHandlerTests } from "../../../test-framework/telegram";

// Генерируем тесты для обработчика действия
generateActionHandlerTests(
  sceneTester,
  "handleCreateProjectAction" as keyof ProjectScene,
  "createProject"
);
```

#### Генерация тестов для обработчика текстовых сообщений

```typescript
import { generateTextHandlerTests } from "../../../test-framework/telegram";
import { SceneStep } from "../../../types";

// Генерируем тесты для обработчика текстовых сообщений
generateTextHandlerTests(
  sceneTester,
  "handleProjectText" as keyof ProjectScene,
  "CREATE_PROJECT",
  SceneStep.CREATE_PROJECT
);
```

#### Ручное создание тестов с использованием тестера сцены

```typescript
import { SceneTester } from "../../../test-framework/telegram";
import { ProjectScene } from "../../../scenes/project-scene";

describe("ProjectScene - Custom Tests", () => {
  // Создаем тестер сцены
  const sceneTester = new SceneTester({
    sceneName: "ProjectScene",
    sceneFilePath: "../../../scenes/project-scene",
    sceneConstructor: ProjectScene
  });

  beforeEach(() => {
    sceneTester.resetMocks();
  });

  it("should handle custom scenario", async () => {
    // Настраиваем моки
    sceneTester.updateAdapter({
      findUserByTelegramIdOrCreate: jest.fn().mockResolvedValue({ id: 1, telegram_id: 123456789 }),
    });

    // Обновляем контекст
    sceneTester.updateContext({
      messageText: "Custom message",
    });

    // Вызываем метод сцены
    await sceneTester.callSceneMethod("customMethod", sceneTester.getContext());

    // Проверяем результаты
    expect(sceneTester.getAdapter().findUserByTelegramIdOrCreate).toHaveBeenCalled();
    expect(sceneTester.getContext().reply).toHaveBeenCalled();
  });
});
```

## Инструменты для тестирования

### Генератор тестов для Telegram-сцен

Для упрощения создания тестов для Telegram-сцен в проекте есть специальный генератор тестов, который использует фреймворк для тестирования Telegram-сцен.

#### Использование генератора тестов

```bash
bun run generate:telegram-tests
```

Генератор проведет вас через интерактивный процесс создания тестов:
1. Запросит имя файла сцены (например, `project-scene`)
2. Предложит выбрать типы тестов для генерации
3. Запросит дополнительную информацию в зависимости от выбранных типов тестов
4. Сгенерирует файлы тестов, использующие фреймворк для тестирования Telegram-сцен

#### Преимущества использования фреймворка и генератора

1. **Типизация** - все компоненты фреймворка типизированы с помощью TypeScript
2. **Переиспользование кода** - фреймворк содержит общие компоненты для тестирования сцен
3. **Единообразие** - все тесты создаются по единому шаблону
4. **Простота поддержки** - изменения в фреймворке автоматически применяются ко всем тестам
5. **Расширяемость** - фреймворк можно расширять новыми компонентами и генераторами

### Скрипт для TDD-цикла

Для упрощения процесса TDD (Test-Driven Development) в проекте есть специальный скрипт.

#### Использование скрипта для TDD-цикла

```bash
bun run tdd <путь_к_тестовому_файлу>
```

Например:
```bash
bun run tdd src/__tests__/unit/scenes/project-scene-enter.test.ts
```

Скрипт проведет вас через все этапы TDD-цикла:
1. **Красный (Red)** - убедится, что тест падает
2. **Зеленый (Green)** - поможет реализовать минимальную функциональность для прохождения теста
3. **Рефакторинг (Refactor)** - поможет улучшить код без изменения функциональности

## Процесс TDD

### Шаг 1: Красный (Red)

1. Напишите тест для новой функциональности
2. Запустите тест и убедитесь, что он падает
3. Если тест проходит, возможно, вы уже реализовали функциональность или тест неправильно написан

### Шаг 2: Зеленый (Green)

1. Напишите минимальный код, чтобы тест прошел
2. Запустите тест и убедитесь, что он проходит
3. Если тест все еще падает, исправьте код и повторите

### Шаг 3: Рефакторинг (Refactor)

1. Улучшите код без изменения функциональности
2. Запустите тест и убедитесь, что он все еще проходит
3. Если тест падает, исправьте код и повторите

## Примеры тестов

### Пример теста для обработчика входа в сцену

```typescript
it("should handle successful scene entry", async () => {
  // Настраиваем моки для успешного сценария
  mockAdapter.findUserByTelegramIdOrCreate.mockResolvedValue({ id: 1, telegram_id: 123456789 });
  mockAdapter.getProjectsByUserId.mockResolvedValue([
    { id: 1, name: "Test Project", user_id: 1 },
  ]);

  // Вызываем обработчик входа в сцену
  await scene.enterHandler(ctx);

  // Проверяем, что были вызваны нужные методы
  expect(mockAdapter.findUserByTelegramIdOrCreate).toHaveBeenCalledWith(123456789);
  expect(mockAdapter.getProjectsByUserId).toHaveBeenCalledWith(1);
  expect(ctx.reply).toHaveBeenCalled();
  expect(mockAdapter.close).toHaveBeenCalled();
});
```

### Пример теста для обработчика действия

```typescript
it("should handle successful action", async () => {
  // Настраиваем моки для успешного сценария
  mockAdapter.findUserByTelegramIdOrCreate.mockResolvedValue({ id: 1, telegram_id: 123456789 });

  // Вызываем обработчик действия
  await scene.handleCreateProjectAction(ctx);

  // Проверяем, что были вызваны нужные методы
  expect(ctx.answerCbQuery).toHaveBeenCalled();
  expect(ctx.reply).toHaveBeenCalled();
  expect(mockAdapter.close).toHaveBeenCalled();
});
```

### Пример теста для обработчика текстового сообщения

```typescript
it("should handle successful text input", async () => {
  // Настраиваем моки для успешного сценария
  mockAdapter.findUserByTelegramIdOrCreate.mockResolvedValue({ id: 1, telegram_id: 123456789 });

  // Вызываем обработчик текстового сообщения
  await scene.handleProjectText(ctx);

  // Проверяем, что были вызваны нужные методы
  expect(mockAdapter.findUserByTelegramIdOrCreate).toHaveBeenCalledWith(123456789);
  expect(ctx.reply).toHaveBeenCalled();
  expect(ctx.scene.reenter).toHaveBeenCalled();
  expect(mockAdapter.close).toHaveBeenCalled();
});
```
