# История успеха: Паттерны для Wizard-сцен

## Проблемы с Wizard-сценами

В процессе разработки Telegram бота мы столкнулись с несколькими проблемами при использовании Wizard-сцен:

1. **Дублирование обработчиков кнопок**: Регистрация обработчиков внутри шагов приводила к их дублированию и ошибкам.
2. **Отсутствие обновления данных**: При возврате к предыдущим шагам данные не обновлялись, так как они уже были загружены в состояние.
3. **Зависание при выходе из сцены**: При выходе из сцены бот зависал, так как не было явного указания, в какую сцену перейти.

## Решения и паттерны

### 1. Регистрация обработчиков кнопок на уровне сцены

**Проблема**: Регистрация обработчиков кнопок внутри шагов с помощью `ctx.wizard.action()` приводила к их дублированию при повторном входе в шаг.

**Решение**: Регистрация всех обработчиков на уровне сцены с помощью `scene.action()` или утилиты `registerButtons`.

**Пример**:
```typescript
// ❌ Неправильно: внутри шага
async (ctx) => {
  ctx.wizard.action("button_id", async (ctx) => {
    // Обработчик
  });
}

// ✅ Правильно: на уровне сцены
myWizardScene.action("button_id", async (ctx) => {
  // Обработчик
});

// ✅ Еще лучше: использование утилиты registerButtons
registerButtons(myWizardScene, [
  {
    id: "button_id",
    handler: async (ctx) => {
      // Обработчик с автоматической обработкой ошибок
    },
    errorMessage: "Произошла ошибка. Попробуйте еще раз.",
    verbose: true
  }
]);
```

### 2. Очистка состояния при переходах между шагами

**Проблема**: При возврате к предыдущим шагам данные не обновлялись, так как они уже были загружены в состояние.

**Решение**: Очистка соответствующих частей состояния перед переходом к шагу.

**Пример**:
```typescript
myWizardScene.action("back_to_list", async (ctx) => {
  await ctx.answerCbQuery();

  // Очищаем данные в состоянии
  if (ctx.wizard && ctx.wizard.state) {
    delete ctx.wizard.state.items;
  }

  // Возвращаемся к шагу со списком
  return ctx.wizard.selectStep(1);
});
```

### 3. Явное указание сцены при выходе

**Проблема**: При выходе из сцены с помощью `ctx.scene.leave()` бот зависал, так как не было явного указания, в какую сцену перейти.

**Решение**: Явное указание сцены для перехода после выхода из текущей сцены.

**Пример**:
```typescript
myWizardScene.action("exit_wizard", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("Вы вышли из мастера.");

  // Очистка состояния перед выходом
  ctx.wizard.state = {};

  // Явный переход в другую сцену
  try {
    await ctx.scene.enter("main_menu_scene");
  } catch (error) {
    console.error("[ERROR] Ошибка при переходе в главное меню:", error);
    return ctx.scene.leave();
  }
});
```

### 4. Подробное логирование для отладки

**Проблема**: Сложность отладки Wizard-сцен из-за неочевидных переходов и состояний.

**Решение**: Добавление подробного логирования на каждом шаге и в каждом обработчике.

**Пример**:
```typescript
async (ctx) => {
  console.log("[WIZARD] Шаг 2: Начало выполнения");
  console.log("[DEBUG] Содержимое ctx.wizard.state:", ctx.wizard.state);

  // Логика шага

  console.log("[DEBUG] Переход к следующему шагу");
  return ctx.wizard.next();
}
```

### 5. Стандартизация с помощью утилитных функций

**Проблема**: Код для очистки состояния и безопасного перехода между сценами дублировался в разных обработчиках, что затрудняло поддержку и увеличивало вероятность ошибок.

**Решение**: Создание утилитных функций для очистки состояния и безопасного перехода между сценами, которые можно использовать во всех обработчиках.

**Пример**:
```typescript
// Утилитные функции
function clearSessionState(ctx: ScraperBotContext, reason: string = "general"): void {
  if (ctx.scene.session) {
    logger.info(`[SceneName] Clearing session state before leaving (reason: ${reason})`);
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
    logger.info(`[SceneName] Transitioning to ${targetScene} scene (reason: ${reason})`);
    await ctx.scene.enter(targetScene);
  } catch (error) {
    logger.error(`[SceneName] Error entering ${targetScene} scene:`, error);
    await ctx.scene.leave();
  }
}

// Использование утилитных функций
myWizardScene.action("exit", async (ctx) => {
  logger.info(`[MyWizard] Обработчик кнопки 'exit' вызван`);
  await ctx.answerCbQuery();
  await ctx.reply("Вы вышли из мастера.");

  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "exit_button_clicked");
  await safeSceneTransition(ctx, "main_menu_scene", "exit_button_clicked");
});
```

### 6. Тестирование Wizard-сцен

**Проблема**: Отсутствие тестов для проверки корректности работы Wizard-сцен.

**Решение**: Создание модульных тестов для проверки обработчиков кнопок и переходов между шагами.

**Пример**:
```typescript
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
```

## Конкретные примеры исправлений

### Исправление проблемы с кнопкой "Вернуться к списку" в визард-сцене конкурентов

**Проблема**: При нажатии на кнопку "Вернуться к списку" список конкурентов не обновлялся.

**Решение**:
```typescript
competitorWizardScene.action("back_to_list", async (ctx: any) => {
  console.log(`[DEBUG] Обработчик кнопки 'back_to_list' вызван`);
  await ctx.answerCbQuery();

  // Очищаем список конкурентов в состоянии
  if (ctx.wizard && ctx.wizard.state) {
    delete ctx.wizard.state.competitors;
  }

  // Возвращаемся к списку конкурентов
  return ctx.wizard.selectStep(1);
});
```

### Исправление проблемы с кнопкой "Выйти" в визард-сцене конкурентов

**Проблема**: При нажатии на кнопку "Выйти" бот зависал.

**Решение**:
```typescript
competitorWizardScene.action("exit_wizard", async (ctx: any) => {
  console.log(`[DEBUG] Обработчик кнопки 'exit_wizard' вызван`);
  await ctx.answerCbQuery();
  await ctx.reply("Вы вышли из режима управления конкурентами.");

  // Очищаем состояние визарда перед выходом
  if (ctx.wizard && ctx.wizard.state) {
    ctx.wizard.state = {};
  }

  // Явно указываем, что нужно перейти в сцену проектов
  try {
    console.log(`[DEBUG] Переход в сцену проектов после выхода из режима управления конкурентами`);
    await ctx.scene.enter("instagram_scraper_projects");
  } catch (error) {
    console.error(`[ERROR] Ошибка при переходе в сцену проектов:`, error);
    return ctx.scene.leave();
  }
});
```

## Рекомендации для рефакторинга других сцен

1. **Проверьте регистрацию обработчиков кнопок**:
   - Переместите все обработчики `ctx.wizard.action()` на уровень сцены с помощью `scene.action()`
   - Используйте утилиту `registerButtons` для централизованной регистрации обработчиков
   - Удалите дублирующиеся обработчики

2. **Создайте утилитные функции**:
   - Создайте функцию `clearSessionState` для стандартизации очистки состояния
   - Создайте функцию `safeSceneTransition` для безопасного перехода между сценами
   - Используйте эти функции во всех обработчиках

3. **Добавьте очистку состояния**:
   - В обработчиках кнопок, которые возвращают к предыдущим шагам, используйте функцию `clearSessionState`
   - Особенно важно для кнопок "Вернуться", "Обновить список" и т.п.

4. **Исправьте выход из сцены**:
   - В обработчиках кнопок "Выйти" используйте функцию `safeSceneTransition`
   - Очищайте состояние перед выходом с помощью функции `clearSessionState`

5. **Добавьте логирование**:
   - В начале каждого шага логируйте его номер и содержимое состояния
   - В обработчиках кнопок логируйте их вызов и переходы
   - Используйте структурированное логирование с указанием имени сцены и причины действий

6. **Напишите тесты**:
   - Создайте модульные тесты для проверки обработчиков кнопок
   - Проверяйте корректность переходов между шагами
   - Проверяйте очистку состояния при переходах
   - Проверяйте функциональность утилитных функций

## Заключение

Применение этих паттернов позволило решить проблемы с Wizard-сценами в нашем Telegram боте. Теперь сцены работают стабильно, данные обновляются корректно, и бот не зависает при переходах между сценами.

Особенно эффективным оказалось использование утилитных функций `clearSessionState` и `safeSceneTransition`, которые стандартизировали очистку состояния и переходы между сценами, уменьшили дублирование кода и повысили надежность.

Для удобства использования этих паттернов в будущем мы создали следующую документацию:

- [WIZARD_SCENE_PATTERNS.md](./WIZARD_SCENE_PATTERNS.md) - подробное описание паттернов и примеры кода
- [WIZARD_SCENE_REFACTORING_CHECKLIST.md](./WIZARD_SCENE_REFACTORING_CHECKLIST.md) - чек-лист для рефакторинга существующих Wizard-сцен

Эти документы помогут разработчикам создавать надежные и поддерживаемые Wizard-сцены для Telegram бота, избегая распространенных проблем.
