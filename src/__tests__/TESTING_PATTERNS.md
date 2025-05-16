# Паттерны тестирования Telegram-сцен

Этот документ описывает паттерны тестирования Telegram-сцен в проекте Instagram Scraper Bot. Паттерны основаны на опыте разработки и тестирования сцен и представляют собой проверенные подходы к тестированию различных аспектов работы сцен.

## 1. Паттерн "Проверка входа в сцену"

Этот паттерн используется для тестирования обработчика входа в сцену. Он проверяет, что при входе в сцену происходят правильные действия: получение пользователя, получение данных, отправка сообщений и т.д.

### Шаги паттерна:

1. Создание мока адаптера с нужными методами
2. Создание мока контекста
3. Вызов обработчика входа в сцену
4. Проверка, что были вызваны нужные методы адаптера
5. Проверка, что были отправлены нужные сообщения
6. Проверка, что соединение с адаптером было закрыто

### Пример реализации:

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { SceneTester } from "../../helpers/telegram";
import { ProjectScene } from "../../../scenes/project-scene";

describe("ProjectScene - Enter Handler", () => {
  let sceneTester: SceneTester<ProjectScene>;

  beforeEach(() => {
    sceneTester = new SceneTester({
      sceneName: "ProjectScene",
      sceneFilePath: "../../../scenes/project-scene",
      sceneConstructor: ProjectScene
    });
    
    sceneTester.resetMocks();
  });

  it("should handle successful scene entry", async () => {
    // Настраиваем моки для успешного сценария
    const mockUser = { id: 1, telegram_id: 123456789, username: "testuser", created_at: new Date().toISOString(), is_active: true };
    const mockProjects = [{ id: 1, user_id: 1, name: "Test Project", created_at: new Date().toISOString(), is_active: true }];

    sceneTester.updateAdapter({
      getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
      getProjectsByUserId: jest.fn().mockResolvedValue(mockProjects),
    });

    // Вызываем обработчик входа в сцену
    await sceneTester.callSceneMethod("enterHandler", sceneTester.getContext());

    // Проверяем, что были вызваны нужные методы
    expect(sceneTester.getAdapter().getUserByTelegramId).toHaveBeenCalledWith(123456789);
    expect(sceneTester.getAdapter().getProjectsByUserId).toHaveBeenCalledWith(1);
    expect(sceneTester.getContext().reply).toHaveBeenCalled();
    expect(sceneTester.getAdapter().close).toHaveBeenCalled();
  });

  it("should handle error when user is not found", async () => {
    // Настраиваем моки для сценария с ошибкой
    sceneTester.updateAdapter({
      getUserByTelegramId: jest.fn().mockResolvedValue(null),
    });

    // Вызываем обработчик входа в сцену
    await sceneTester.callSceneMethod("enterHandler", sceneTester.getContext());

    // Проверяем, что были вызваны нужные методы
    expect(sceneTester.getAdapter().getUserByTelegramId).toHaveBeenCalledWith(123456789);
    expect(sceneTester.getContext().reply).toHaveBeenCalledWith(expect.stringContaining("ошибка"));
    expect(sceneTester.getContext().scene.leave).toHaveBeenCalled();
    expect(sceneTester.getAdapter().close).toHaveBeenCalled();
  });
});
```

## 2. Паттерн "Проверка обработчика действия"

Этот паттерн используется для тестирования обработчиков действий (callback query). Он проверяет, что при получении callback query происходят правильные действия: получение данных, обработка действия, отправка сообщений и т.д.

### Шаги паттерна:

1. Создание мока адаптера с нужными методами
2. Создание мока контекста с данными callback query
3. Вызов обработчика действия
4. Проверка, что были вызваны нужные методы адаптера
5. Проверка, что были отправлены нужные сообщения
6. Проверка, что был вызван метод answerCbQuery
7. Проверка, что соединение с адаптером было закрыто

### Пример реализации:

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { SceneTester } from "../../helpers/telegram";
import { ProjectScene } from "../../../scenes/project-scene";

describe("ProjectScene - Action Handlers", () => {
  let sceneTester: SceneTester<ProjectScene>;

  beforeEach(() => {
    sceneTester = new SceneTester({
      sceneName: "ProjectScene",
      sceneFilePath: "../../../scenes/project-scene",
      sceneConstructor: ProjectScene
    });
    
    sceneTester.resetMocks();
  });

  it("should handle project selection", async () => {
    // Настраиваем моки для успешного сценария
    const mockUser = { id: 1, telegram_id: 123456789, username: "testuser", created_at: new Date().toISOString(), is_active: true };
    const mockProject = { id: 1, user_id: 1, name: "Test Project", created_at: new Date().toISOString(), is_active: true };

    sceneTester.updateAdapter({
      getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
      getProjectById: jest.fn().mockResolvedValue(mockProject),
    });

    // Обновляем контекст с данными для callback query
    sceneTester.updateContext({
      callbackQueryData: "project_1",
      matchData: ["project_1", "1"],
    });

    // Вызываем обработчик действия
    await sceneTester.callSceneMethod("handleSelectProjectAction", sceneTester.getContext());

    // Проверяем, что были вызваны нужные методы
    expect(sceneTester.getAdapter().getUserByTelegramId).toHaveBeenCalledWith(123456789);
    expect(sceneTester.getAdapter().getProjectById).toHaveBeenCalledWith(1);
    expect(sceneTester.getContext().reply).toHaveBeenCalled();
    expect(sceneTester.getContext().answerCbQuery).toHaveBeenCalled();
    expect(sceneTester.getAdapter().close).toHaveBeenCalled();
  });

  it("should handle error when project is not found", async () => {
    // Настраиваем моки для сценария с ошибкой
    const mockUser = { id: 1, telegram_id: 123456789, username: "testuser", created_at: new Date().toISOString(), is_active: true };

    sceneTester.updateAdapter({
      getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
      getProjectById: jest.fn().mockResolvedValue(null),
    });

    // Обновляем контекст с данными для callback query
    sceneTester.updateContext({
      callbackQueryData: "project_1",
      matchData: ["project_1", "1"],
    });

    // Вызываем обработчик действия
    await sceneTester.callSceneMethod("handleSelectProjectAction", sceneTester.getContext());

    // Проверяем, что были вызваны нужные методы
    expect(sceneTester.getAdapter().getUserByTelegramId).toHaveBeenCalledWith(123456789);
    expect(sceneTester.getAdapter().getProjectById).toHaveBeenCalledWith(1);
    expect(sceneTester.getContext().reply).toHaveBeenCalledWith(expect.stringContaining("ошибка"));
    expect(sceneTester.getContext().answerCbQuery).toHaveBeenCalled();
    expect(sceneTester.getAdapter().close).toHaveBeenCalled();
  });
});
```

## 3. Паттерн "Проверка обработчика текстовых сообщений"

Этот паттерн используется для тестирования обработчиков текстовых сообщений. Он проверяет, что при получении текстового сообщения происходят правильные действия в зависимости от текущего шага сцены.

### Шаги паттерна:

1. Создание мока адаптера с нужными методами
2. Создание мока контекста с текстовым сообщением и нужным шагом в сессии
3. Вызов обработчика текстовых сообщений
4. Проверка, что были вызваны нужные методы адаптера
5. Проверка, что были отправлены нужные сообщения
6. Проверка, что соединение с адаптером было закрыто

### Пример реализации:

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { SceneTester } from "../../helpers/telegram";
import { ProjectScene } from "../../../scenes/project-scene";
import { ScraperSceneStep } from "../../../types";

describe("ProjectScene - Text Input Handler", () => {
  let sceneTester: SceneTester<ProjectScene>;

  beforeEach(() => {
    sceneTester = new SceneTester({
      sceneName: "ProjectScene",
      sceneFilePath: "../../../scenes/project-scene",
      sceneConstructor: ProjectScene
    });
    
    sceneTester.resetMocks();
  });

  it("should handle project creation", async () => {
    // Настраиваем моки для успешного сценария
    const mockUser = { id: 1, telegram_id: 123456789, username: "testuser", created_at: new Date().toISOString(), is_active: true };
    const mockProject = { id: 1, user_id: 1, name: "New Project", created_at: new Date().toISOString(), is_active: true };

    sceneTester.updateAdapter({
      getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
      createProject: jest.fn().mockResolvedValue(mockProject),
    });

    // Обновляем контекст с нужным шагом
    sceneTester.updateContext({
      messageText: "New Project",
      sessionData: {
        step: ScraperSceneStep.CREATE_PROJECT,
        userId: 1,
      },
    });

    // Вызываем обработчик текстового сообщения
    await sceneTester.callSceneMethod("handleProjectSceneText", sceneTester.getContext());

    // Проверяем, что были вызваны нужные методы
    expect(sceneTester.getAdapter().getUserByTelegramId).toHaveBeenCalledWith(123456789);
    expect(sceneTester.getAdapter().createProject).toHaveBeenCalledWith(1, "New Project");
    expect(sceneTester.getContext().reply).toHaveBeenCalledWith(expect.stringContaining("успешно создан"));
    expect(sceneTester.getAdapter().close).toHaveBeenCalled();
  });

  it("should do nothing if step is not CREATE_PROJECT", async () => {
    // Обновляем контекст с другим шагом
    sceneTester.updateContext({
      messageText: "New Project",
      sessionData: {
        step: ScraperSceneStep.PROJECT_LIST,
        userId: 1,
      },
    });

    // Вызываем обработчик текстового сообщения
    await sceneTester.callSceneMethod("handleProjectSceneText", sceneTester.getContext());

    // Проверяем, что не были вызваны методы адаптера
    expect(sceneTester.getAdapter().getUserByTelegramId).not.toHaveBeenCalled();
    expect(sceneTester.getAdapter().createProject).not.toHaveBeenCalled();
    expect(sceneTester.getContext().reply).not.toHaveBeenCalled();
    expect(sceneTester.getAdapter().close).not.toHaveBeenCalled();
  });
});
```

## 4. Паттерн "Проверка последовательности действий"

Этот паттерн используется для тестирования последовательности действий в сцене. Он проверяет, что при выполнении последовательности действий происходят правильные переходы между шагами и правильная обработка данных.

### Шаги паттерна:

1. Создание мока адаптера с нужными методами
2. Создание последовательности действий с помощью SceneSequenceTester
3. Запуск последовательности
4. Проверка, что после каждого шага происходят нужные действия

### Пример реализации:

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { SceneTester, SceneSequenceTester, expectSceneStep, expectMessageContaining } from "../../helpers/telegram";
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
    const mockUser = { id: 1, telegram_id: 123456789, username: "testuser", created_at: new Date().toISOString(), is_active: true };
    const mockProject = { id: 1, user_id: 1, name: "New Project", created_at: new Date().toISOString(), is_active: true };

    sceneTester.updateAdapter({
      getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
      getProjectsByUserId: jest.fn().mockResolvedValue([]),
      createProject: jest.fn().mockResolvedValue(mockProject),
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

## 5. Паттерн "Проверка обработки ошибок"

Этот паттерн используется для тестирования обработки ошибок в сцене. Он проверяет, что при возникновении ошибок происходит правильная обработка и отправка сообщений об ошибках.

### Шаги паттерна:

1. Создание мока адаптера с методами, которые возвращают ошибки
2. Создание мока контекста
3. Вызов метода сцены
4. Проверка, что были отправлены сообщения об ошибках
5. Проверка, что соединение с адаптером было закрыто

### Пример реализации:

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { SceneTester } from "../../helpers/telegram";
import { ProjectScene } from "../../../scenes/project-scene";

describe("ProjectScene - Error Handling", () => {
  let sceneTester: SceneTester<ProjectScene>;

  beforeEach(() => {
    sceneTester = new SceneTester({
      sceneName: "ProjectScene",
      sceneFilePath: "../../../scenes/project-scene",
      sceneConstructor: ProjectScene
    });
    
    sceneTester.resetMocks();
  });

  it("should handle database error during project creation", async () => {
    // Настраиваем моки для сценария с ошибкой
    const mockUser = { id: 1, telegram_id: 123456789, username: "testuser", created_at: new Date().toISOString(), is_active: true };

    sceneTester.updateAdapter({
      getUserByTelegramId: jest.fn().mockResolvedValue(mockUser),
      createProject: jest.fn().mockRejectedValue(new Error("Database error")),
    });

    // Обновляем контекст с нужным шагом
    sceneTester.updateContext({
      messageText: "New Project",
      sessionData: {
        step: ScraperSceneStep.CREATE_PROJECT,
        userId: 1,
      },
    });

    // Вызываем обработчик текстового сообщения
    await sceneTester.callSceneMethod("handleProjectSceneText", sceneTester.getContext());

    // Проверяем, что были вызваны нужные методы
    expect(sceneTester.getAdapter().getUserByTelegramId).toHaveBeenCalledWith(123456789);
    expect(sceneTester.getAdapter().createProject).toHaveBeenCalledWith(1, "New Project");
    expect(sceneTester.getContext().reply).toHaveBeenCalledWith(expect.stringContaining("ошибка"));
    expect(sceneTester.getAdapter().close).toHaveBeenCalled();
  });

  it("should handle error when user is not found", async () => {
    // Настраиваем моки для сценария с ошибкой
    sceneTester.updateAdapter({
      getUserByTelegramId: jest.fn().mockResolvedValue(null),
    });

    // Обновляем контекст с нужным шагом
    sceneTester.updateContext({
      messageText: "New Project",
      sessionData: {
        step: ScraperSceneStep.CREATE_PROJECT,
        userId: 1,
      },
    });

    // Вызываем обработчик текстового сообщения
    await sceneTester.callSceneMethod("handleProjectSceneText", sceneTester.getContext());

    // Проверяем, что были вызваны нужные методы
    expect(sceneTester.getAdapter().getUserByTelegramId).toHaveBeenCalledWith(123456789);
    expect(sceneTester.getContext().reply).toHaveBeenCalledWith(expect.stringContaining("ошибка"));
    expect(sceneTester.getAdapter().close).toHaveBeenCalled();
  });
});
```

## Заключение

Эти паттерны тестирования Telegram-сцен помогают создавать надежные и поддерживаемые тесты для сцен в проекте Instagram Scraper Bot. Они охватывают различные аспекты работы сцен и позволяют проверить корректность обработки различных ситуаций.

Использование фреймворка для тестирования Telegram-сцен значительно упрощает создание и поддержку тестов, делая их более понятными и единообразными.
