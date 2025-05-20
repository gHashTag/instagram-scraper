# Чек-лист для рефакторинга Wizard-сцен

Этот чек-лист поможет вам провести рефакторинг существующих Wizard-сцен в соответствии с проверенными паттернами.

## 1. Анализ текущего состояния

- [ ] Просмотрите код сцены и найдите все вызовы `ctx.wizard.action()`
- [ ] Найдите все обработчики кнопок, которые возвращают к предыдущим шагам
- [ ] Найдите все обработчики кнопок, которые выходят из сцены
- [ ] Проверьте, обновляются ли данные при возврате к предыдущим шагам
- [ ] Проверьте, есть ли явное указание сцены при выходе

## 2. Перенос обработчиков кнопок на уровень сцены

- [ ] Для каждого вызова `ctx.wizard.action()` внутри шагов:
  - [ ] Создайте соответствующий обработчик на уровне сцены с помощью `scene.action()`
  - [ ] Скопируйте логику обработчика
  - [ ] Удалите вызов `ctx.wizard.action()` из шага
  - [ ] Добавьте логирование в новый обработчик

Пример:
```typescript
// До рефакторинга (внутри шага)
ctx.wizard.action("button_id", async (ctx) => {
  await ctx.answerCbQuery();
  // Логика обработчика
});

// После рефакторинга (на уровне сцены)
myWizardScene.action("button_id", async (ctx) => {
  console.log(`[DEBUG] Обработчик кнопки 'button_id' вызван`);
  await ctx.answerCbQuery();
  // Логика обработчика
});
```

## 3. Добавление очистки состояния при переходах

- [ ] Для каждого обработчика, который возвращает к предыдущему шагу:
  - [ ] Добавьте очистку соответствующих частей состояния перед переходом
  - [ ] Добавьте логирование очистки состояния

Пример:
```typescript
myWizardScene.action("back_to_list", async (ctx) => {
  console.log(`[DEBUG] Обработчик кнопки 'back_to_list' вызван`);
  await ctx.answerCbQuery();

  // Очищаем данные в состоянии
  if (ctx.wizard && ctx.wizard.state) {
    console.log(`[DEBUG] Очистка списка элементов в состоянии`);
    delete ctx.wizard.state.items;
  }

  // Возвращаемся к шагу со списком
  return ctx.wizard.selectStep(1);
});
```

## 4. Создание утилитных функций для очистки состояния и переходов

- [ ] Создайте функцию `clearSessionState` для стандартизации очистки состояния:

```typescript
/**
 * Очищает состояние сессии перед выходом из сцены
 * @param ctx Контекст Telegraf
 * @param reason Причина очистки состояния (для логирования)
 */
function clearSessionState(ctx: ScraperBotContext, reason: string = "general"): void {
  if (ctx.scene.session) {
    logger.info(`[SceneName] Clearing session state before leaving (reason: ${reason})`);
    // Очистка всех необходимых полей состояния
    ctx.scene.session.filter = undefined;
    ctx.scene.session.page = 1;
    ctx.scene.session.currentItemId = undefined;
    // Для Wizard-сцен
    if (ctx.wizard && ctx.wizard.state) {
      ctx.wizard.state = {};
    }
  }
}
```

- [ ] Создайте функцию `safeSceneTransition` для безопасного перехода между сценами:

```typescript
/**
 * Выполняет безопасный переход в другую сцену с обработкой ошибок
 * @param ctx Контекст Telegraf
 * @param targetScene Целевая сцена
 * @param reason Причина перехода (для логирования)
 */
async function safeSceneTransition(
  ctx: ScraperBotContext,
  targetScene: string = "instagram_scraper_projects",
  reason: string = "general"
): Promise<void> {
  try {
    logger.info(`[SceneName] Transitioning to ${targetScene} scene (reason: ${reason})`);
    await ctx.scene.enter(targetScene);
  } catch (error) {
    logger.error(`[SceneName] Error entering ${targetScene} scene:`, error);
    await ctx.scene.leave();
  }
}
```

## 5. Исправление выхода из сцены

- [ ] Для каждого обработчика, который выходит из сцены:
  - [ ] Используйте функцию `clearSessionState` для очистки состояния
  - [ ] Используйте функцию `safeSceneTransition` для перехода в другую сцену
  - [ ] Добавьте логирование выхода и перехода

Пример:
```typescript
myWizardScene.action("exit_wizard", async (ctx) => {
  console.log(`[DEBUG] Обработчик кнопки 'exit_wizard' вызван`);
  await ctx.answerCbQuery();
  await ctx.reply("Вы вышли из мастера.");

  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "exit_button_clicked");
  await safeSceneTransition(ctx, "main_menu_scene", "exit_button_clicked");
});
```

## 6. Добавление логирования

- [ ] В начале каждого шага добавьте логирование:
  - [ ] Номер шага и его назначение
  - [ ] Содержимое состояния
  - [ ] Входные данные (если есть)

Пример:
```typescript
async (ctx) => {
  console.log(`[WIZARD] Шаг 2: Отображение списка элементов`);
  console.log(`[DEBUG] Содержимое ctx.wizard.state:`, ctx.wizard.state);

  // Логика шага

  console.log(`[DEBUG] Шаг 2 завершен`);
  return;
}
```

## 7. Создание тестов

- [ ] Создайте модульные тесты для проверки:
  - [ ] Обработчиков кнопок
  - [ ] Переходов между шагами
  - [ ] Очистки состояния при переходах
  - [ ] Выхода из сцены

Пример:
```typescript
describe("myWizardScene", () => {
  it("should handle 'back_to_list' button click", async () => {
    // Создаем мок для контекста
    const mockCtx = {
      answerCbQuery: jest.fn().mockResolvedValue(undefined),
      wizard: {
        state: { items: [{ id: 1, name: "Item 1" }] },
        selectStep: jest.fn().mockResolvedValue(undefined)
      }
    };

    // Вызываем обработчик
    await backToListHandler(mockCtx);

    // Проверяем, что состояние очищено
    expect(mockCtx.wizard.state.items).toBeUndefined();

    // Проверяем, что был вызван переход к шагу 1
    expect(mockCtx.wizard.selectStep).toHaveBeenCalledWith(1);
  });
});
```

## 8. Проверка результатов

- [ ] Запустите бота и проверьте работу сцены:
  - [ ] Переходы между шагами
  - [ ] Обновление данных при возврате к предыдущим шагам
  - [ ] Выход из сцены и переход в другую сцену
  - [ ] Отсутствие ошибок в логах

## 9. Документирование изменений

- [ ] Добавьте комментарии к коду, объясняющие логику работы сцены
- [ ] Обновите документацию проекта
- [ ] Добавьте информацию о рефакторинге в историю успеха

## Пример рефакторинга

### До рефакторинга

```typescript
const myWizardScene = new Scenes.WizardScene(
  "my_wizard",
  // Шаг 1
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply("Шаг 1");
    return ctx.wizard.next();
  },
  // Шаг 2
  async (ctx) => {
    // Регистрация обработчиков внутри шага (проблема!)
    ctx.wizard.action("back", async (ctx) => {
      await ctx.answerCbQuery();
      return ctx.wizard.selectStep(0);
    });

    ctx.wizard.action("exit", async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply("Выход");
      return ctx.scene.leave(); // Нет явного указания сцены (проблема!)
    });

    await ctx.reply("Шаг 2", Markup.inlineKeyboard([
      Markup.button.callback("Назад", "back"),
      Markup.button.callback("Выход", "exit")
    ]));

    return;
  }
);
```

### После рефакторинга

```typescript
// Утилитные функции для очистки состояния и переходов
function clearSessionState(ctx: ScraperBotContext, reason: string = "general"): void {
  if (ctx.scene.session) {
    logger.info(`[MyWizard] Clearing session state before leaving (reason: ${reason})`);
    // Очистка всех необходимых полей состояния
    ctx.scene.session.filter = undefined;
    ctx.scene.session.page = 1;
    // Для Wizard-сцен
    if (ctx.wizard && ctx.wizard.state) {
      ctx.wizard.state = {};
    }
  }
}

async function safeSceneTransition(
  ctx: ScraperBotContext,
  targetScene: string = "main_menu_scene",
  reason: string = "general"
): Promise<void> {
  try {
    logger.info(`[MyWizard] Transitioning to ${targetScene} scene (reason: ${reason})`);
    await ctx.scene.enter(targetScene);
  } catch (error) {
    logger.error(`[MyWizard] Error entering ${targetScene} scene:`, error);
    await ctx.scene.leave();
  }
}

const myWizardScene = new Scenes.WizardScene(
  "my_wizard",
  // Шаг 1
  async (ctx) => {
    logger.info(`[MyWizard] Шаг 1: Начало`);
    ctx.wizard.state.data = {};
    await ctx.reply("Шаг 1");
    logger.info(`[MyWizard] Переход к шагу 2`);
    return ctx.wizard.next();
  },
  // Шаг 2
  async (ctx) => {
    logger.info(`[MyWizard] Шаг 2: Отображение опций`);
    logger.debug(`[MyWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

    await ctx.reply("Шаг 2", Markup.inlineKeyboard([
      Markup.button.callback("Назад", "back"),
      Markup.button.callback("Выход", "exit")
    ]));

    logger.info(`[MyWizard] Шаг 2 завершен`);
    return;
  }
);

// Регистрация обработчиков на уровне сцены с использованием registerButtons
registerButtons(myWizardScene, [
  {
    id: "back",
    handler: async (ctx) => {
      logger.info(`[MyWizard] Обработчик кнопки 'back' вызван`);
      await ctx.answerCbQuery();

      // Очистка состояния при необходимости
      if (ctx.wizard && ctx.wizard.state && ctx.wizard.state.someData) {
        logger.info(`[MyWizard] Очистка данных в состоянии`);
        delete ctx.wizard.state.someData;
      }

      logger.info(`[MyWizard] Возврат к шагу 1`);
      return ctx.wizard.selectStep(0);
    },
    errorMessage: "Произошла ошибка при возврате назад. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: "exit",
    handler: async (ctx) => {
      logger.info(`[MyWizard] Обработчик кнопки 'exit' вызван`);
      await ctx.answerCbQuery();
      await ctx.reply("Выход");

      // Очистка состояния и безопасный переход в другую сцену
      clearSessionState(ctx, "exit_button_clicked");
      await safeSceneTransition(ctx, "main_menu_scene", "exit_button_clicked");
    },
    errorMessage: "Произошла ошибка при выходе. Попробуйте еще раз.",
    verbose: true
  }
]);
```

## Заключение

Следуя этому чек-листу, вы сможете провести рефакторинг существующих Wizard-сцен и сделать их более надежными и поддерживаемыми. Помните, что основная цель рефакторинга — устранить проблемы с дублированием обработчиков, обновлением данных и выходом из сцены.
