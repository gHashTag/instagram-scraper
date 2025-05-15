# Фреймворк для тестирования Telegram-сцен

Этот фреймворк предоставляет инструменты для тестирования Telegram-сцен в проекте Instagram Scraper Bot.

## Основные компоненты

### 1. SceneTester

Класс для тестирования Telegram-сцен. Предоставляет методы для создания моков контекста и адаптера хранилища, а также для вызова методов сцены.

```typescript
import { SceneTester } from "../../../__tests__/helpers/telegram";
import { ProjectScene } from "../../../scenes/project-scene";

// Создаем тестер сцены
const sceneTester = new SceneTester({
  sceneName: "ProjectScene",
  sceneFilePath: "../../../scenes/project-scene",
  sceneConstructor: ProjectScene
});

// Получаем экземпляр сцены
const scene = sceneTester.getScene();

// Получаем мокированный контекст
const ctx = sceneTester.getContext();

// Получаем мокированный адаптер
const adapter = sceneTester.getAdapter();

// Обновляем контекст
sceneTester.updateContext({
  userId: 123456789,
  messageText: "Test message",
  sessionData: {
    step: ScraperSceneStep.PROJECT_LIST,
    projectId: 1
  }
});

// Обновляем адаптер
sceneTester.updateAdapter({
  getUserByTelegramId: jest.fn().mockResolvedValue({ id: 1, telegram_id: 123456789 }),
  getProjectsByUserId: jest.fn().mockResolvedValue([{ id: 1, name: "Test Project" }])
});

// Сбрасываем все моки
sceneTester.resetMocks();

// Вызываем метод сцены
await sceneTester.callSceneMethod("enterHandler", ctx);
```

### 2. SceneSequenceTester

Класс для тестирования последовательностей действий в сцене. Позволяет создавать сценарии тестирования, состоящие из нескольких шагов.

```typescript
import { SceneTester, SceneSequenceTester, expectSceneStep, expectMessageContaining } from "../../../__tests__/helpers/telegram";
import { ProjectScene } from "../../../scenes/project-scene";
import { ScraperSceneStep } from "../../../types";

// Создаем тестер сцены
const sceneTester = new SceneTester({
  sceneName: "ProjectScene",
  sceneFilePath: "../../../scenes/project-scene",
  sceneConstructor: ProjectScene
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
      expectMessageContaining(tester.getContext(), "Выберите проект");
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

// Или генерируем тест
sequenceTester.generateTest("should create a project successfully");
```

### 3. Генераторы тестов

Функции для генерации тестов для обработчиков входа, действий и текстовых сообщений.

```typescript
import { SceneTester, generateEnterHandlerTests, generateActionHandlerTests, generateTextHandlerTests } from "../../../__tests__/helpers/telegram";
import { ProjectScene } from "../../../scenes/project-scene";
import { ScraperSceneStep } from "../../../types";

describe("ProjectScene Tests", () => {
  // Создаем тестер сцены
  const sceneTester = new SceneTester({
    sceneName: "ProjectScene",
    sceneFilePath: "../../../scenes/project-scene",
    sceneConstructor: ProjectScene
  });

  // Генерируем тесты для обработчика входа в сцену
  generateEnterHandlerTests(sceneTester);

  // Генерируем тесты для обработчика действия
  generateActionHandlerTests(
    sceneTester,
    "handleSelectProjectAction" as keyof ProjectScene,
    "project"
  );

  // Генерируем тесты для обработчика текстовых сообщений
  generateTextHandlerTests(
    sceneTester,
    "handleProjectSceneText" as keyof ProjectScene,
    "CREATE_PROJECT",
    ScraperSceneStep.CREATE_PROJECT
  );
});
```

### 4. Шаблоны тестов

Функции для создания типичных сценариев тестирования.

```typescript
import { SceneTester, createProjectCreationTestTemplate, createCompetitorAdditionTestTemplate } from "../../../__tests__/helpers/telegram";
import { ProjectScene } from "../../../scenes/project-scene";

describe("ProjectScene Templates", () => {
  // Создаем тестер сцены
  const sceneTester = new SceneTester({
    sceneName: "ProjectScene",
    sceneFilePath: "../../../scenes/project-scene",
    sceneConstructor: ProjectScene
  });

  // Создаем шаблон для тестирования создания проекта
  createProjectCreationTestTemplate(
    sceneTester,
    "handleProjectSceneText" as keyof ProjectScene
  );

  // Создаем шаблон для тестирования добавления конкурента
  createCompetitorAdditionTestTemplate(
    sceneTester,
    "handleCompetitorSceneText" as keyof ProjectScene
  );
});
```

### 5. Утилиты для проверки состояния сцены

Функции для проверки состояния сцены и отправленных сообщений.

```typescript
import { SceneTester, expectSceneStep, expectMessageContaining, expectInlineKeyboardWithButtons, expectSceneTransition, expectSceneExit, expectAdapterMethodCalled, expectConnectionClosed } from "../../../__tests__/helpers/telegram";
import { ProjectScene } from "../../../scenes/project-scene";
import { ScraperSceneStep } from "../../../types";

it("should handle project selection", async () => {
  // Создаем тестер сцены
  const sceneTester = new SceneTester({
    sceneName: "ProjectScene",
    sceneFilePath: "../../../scenes/project-scene",
    sceneConstructor: ProjectScene
  });

  // Настраиваем моки
  sceneTester.updateAdapter({
    getUserByTelegramId: jest.fn().mockResolvedValue({ id: 1, telegram_id: 123456789 }),
    getProjectById: jest.fn().mockResolvedValue({ id: 1, name: "Test Project" })
  });

  // Обновляем контекст
  sceneTester.updateContext({
    callbackQueryData: "project_1",
    matchData: ["project_1", "1"]
  });

  // Вызываем метод сцены
  await sceneTester.callSceneMethod("handleSelectProjectAction", sceneTester.getContext());

  // Проверяем состояние сцены
  expectSceneStep(sceneTester.getContext(), ScraperSceneStep.PROJECT_MENU);
  expectMessageContaining(sceneTester.getContext(), "Test Project");
  expectInlineKeyboardWithButtons(sceneTester.getContext(), ["Конкуренты", "Хештеги", "Запустить парсинг"]);
  expectAdapterMethodCalled(sceneTester.getContext(), "getProjectById", 1);
  expectConnectionClosed(sceneTester.getContext());
});
```

### 6. Моки для UI-элементов

Функции для создания моков инлайн-клавиатур и других UI-элементов.

```typescript
import { createInlineKeyboardMock, createBackButtonMock, createProjectListKeyboardMock, createProjectMenuKeyboardMock, createCompetitorListKeyboardMock, createHashtagListKeyboardMock, createParsingResultsKeyboardMock } from "../../../__tests__/helpers/telegram";

// Создаем мок инлайн-клавиатуры
const keyboard = createInlineKeyboardMock([
  [{ text: "Button 1", callback_data: "button_1" }],
  [{ text: "Button 2", callback_data: "button_2" }]
]);

// Создаем мок кнопки "Назад"
const backButton = createBackButtonMock("back_to_menu");

// Создаем мок кнопок для списка проектов
const projectListKeyboard = createProjectListKeyboardMock([
  { id: 1, name: "Project 1" },
  { id: 2, name: "Project 2" }
]);

// Создаем мок кнопок для меню проекта
const projectMenuKeyboard = createProjectMenuKeyboardMock(1);

// Создаем мок кнопок для списка конкурентов
const competitorListKeyboard = createCompetitorListKeyboardMock(1, [
  { id: 1, username: "competitor1" },
  { id: 2, username: "competitor2" }
]);

// Создаем мок кнопок для списка хештегов
const hashtagListKeyboard = createHashtagListKeyboardMock(1, [
  { id: 1, name: "hashtag1" },
  { id: 2, name: "hashtag2" }
]);

// Создаем мок кнопок для результатов парсинга
const parsingResultsKeyboard = createParsingResultsKeyboardMock(1, [1, 2, 3]);
```

## Примеры использования

### Пример 1: Тестирование обработчика входа в сцену

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { SceneTester, generateEnterHandlerTests } from "../../../__tests__/helpers/telegram";
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

### Пример 2: Тестирование полного сценария создания проекта

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { SceneTester, SceneSequenceTester, expectSceneStep, expectMessageContaining } from "../../../__tests__/helpers/telegram";
import { ProjectScene } from "../../../scenes/project-scene";
import { ScraperSceneStep } from "../../../types";

describe("ProjectScene - Full Scenario", () => {
  it("should handle full project creation scenario", async () => {
    // Создаем тестер сцены
    const sceneTester = new SceneTester({
      sceneName: "ProjectScene",
      sceneFilePath: "../../../scenes/project-scene",
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
});
```
