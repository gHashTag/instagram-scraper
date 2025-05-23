# Тестирование Instagram Scraper Bot

## Структура тестов

Тесты в проекте разделены на несколько категорий:

1. **Тесты Telegram сцен** - тесты для сцен и компонентов Telegram бота
2. **Тесты базы данных** - тесты для адаптеров базы данных
3. **Тесты утилит** - тесты для утилитарных функций
4. **Интеграционные тесты** - тесты для проверки взаимодействия компонентов

## Запуск тестов

### Запуск всех тестов

```bash
bun run test
```

### Запуск тестов Telegram сцен

```bash
bun run test:telegram
```

### Запуск тестов базы данных

```bash
bun run test:database
```

### Запуск тестов утилит

```bash
bun run test:utils
```

### Запуск интеграционных тестов

```bash
bun run test:integration
```

### Запуск тестов для Neon адаптера

```bash
bun run test:neon
```

## Важные замечания

1. **Тесты для Neon адаптера** должны запускаться отдельно от других тестов, так как они используют моки, которые могут конфликтовать с другими тестами.

2. **Интеграционные тесты** требуют наличия тестовой базы данных, которая создается автоматически при запуске тестов.

3. **Все тесты должны проходить успешно при запуске отдельно**. Если тесты не проходят, необходимо исправить ошибки перед коммитом.

## Добавление новых тестов

При добавлении новых тестов следуйте следующим правилам:

1. Тесты для Telegram сцен должны быть добавлены в директорию `src/__tests__/unit/scenes`
2. Тесты для компонентов должны быть добавлены в директорию `src/__tests__/unit/components`
3. Тесты для утилит должны быть добавлены в директорию `src/__tests__/unit/utils`
4. Тесты для адаптеров базы данных должны быть добавлены в директорию `src/__tests__/unit/adapters`
5. Интеграционные тесты должны быть добавлены в директорию `src/__tests__/integration`

## Инструменты для тестирования

### Фреймворк для тестирования Telegram-сцен

В проекте реализован специальный фреймворк для тестирования Telegram-сцен, который упрощает создание и поддержку тестов. Фреймворк находится в директории `src/test-framework/telegram`.

#### Использование фреймворка

```typescript
import { SceneTester, generateEnterHandlerTests } from "../../../test-framework/telegram";
import { ProjectScene } from "../../../scenes/project-scene";

// Создаем тестер сцены
const sceneTester = new SceneTester({
  sceneName: "ProjectScene",
  sceneFilePath: "../../../scenes/project-scene",
  sceneConstructor: ProjectScene
});

// Генерируем тесты для обработчика входа в сцену
generateEnterHandlerTests(sceneTester);
```

### Генератор тестов для Telegram-сцен

Для упрощения создания тестов для Telegram-сцен в проекте есть специальный генератор тестов, который использует фреймворк для тестирования Telegram-сцен.

```bash
bun run generate:telegram-tests
```

Генератор проведет вас через интерактивный процесс создания тестов:
1. Запросит имя файла сцены (например, `project-scene`)
2. Предложит выбрать типы тестов для генерации
3. Запросит дополнительную информацию в зависимости от выбранных типов тестов
4. Сгенерирует файлы тестов, использующие фреймворк для тестирования Telegram-сцен

### Скрипт для TDD-цикла

Для упрощения процесса TDD (Test-Driven Development) в проекте есть специальный скрипт.

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

Подробнее о паттернах и инструментах для тестирования см. в файле [TESTING_PATTERNS.md](TESTING_PATTERNS.md).

## Проверка типов

Перед запуском тестов рекомендуется проверить типы TypeScript:

```bash
bun run typecheck
```
