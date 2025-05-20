# Архитектура Wizard-сцен в Instagram Scraper Bot

## Введение

Этот документ описывает архитектуру Wizard-сцен в Instagram Scraper Bot после полного рефакторинга всех сцен с использованием `WizardScene` вместо `BaseScene`. Рефакторинг был проведен с целью стандартизации подхода к разработке сцен, улучшения управления состоянием и повышения надежности бота.

## Общая архитектура

Все сцены в боте теперь используют единый подход на основе `WizardScene` из библиотеки Telegraf. Каждая сцена состоит из следующих компонентов:

1. **Шаги (Steps)** - функции, которые выполняются последовательно при переходе между шагами сцены.
2. **Обработчики кнопок (Button Handlers)** - функции, которые обрабатывают нажатия на кнопки в интерфейсе бота.
3. **Утилитные функции** - стандартизированные функции для очистки состояния и безопасного перехода между сценами.
4. **Логирование** - подробное логирование для отслеживания состояния и переходов.

## Список Wizard-сцен

В боте реализованы следующие Wizard-сцены:

1. `projectWizardScene` - управление проектами
2. `competitorWizardScene` - управление конкурентами
3. `hashtagWizardScene` - управление хештегами
4. `scrapingWizardScene` - запуск скрапинга
5. `reelsWizardScene` - просмотр Reels
6. `analyticsWizardScene` - аналитика Reels
7. `notificationWizardScene` - управление уведомлениями
8. `reelsCollectionWizardScene` - управление коллекциями Reels
9. `chatbotWizardScene` - чат-бот для работы с расшифровками видео

## Стандартные утилитные функции

Во всех Wizard-сценах используются следующие стандартные утилитные функции:

### 1. `clearSessionState`

Функция для очистки состояния сессии перед выходом из сцены или переходом к другому шагу.

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
    ctx.scene.session.step = undefined;
    ctx.scene.session.currentItemId = undefined;
    // Для Wizard-сцен
    if (ctx.wizard && ctx.wizard.state) {
      ctx.wizard.state = {};
    }
  }
}
```

### 2. `safeSceneTransition`

Функция для безопасного перехода между сценами с обработкой ошибок.

```typescript
/**
 * Выполняет безопасный переход в другую сцену с обработкой ошибок
 * @param ctx Контекст Telegraf
 * @param targetScene Целевая сцена
 * @param reason Причина перехода (для логирования)
 */
async function safeSceneTransition(
  ctx: ScraperBotContext,
  targetScene: string = "project_wizard",
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

## Структура Wizard-сцены

Каждая Wizard-сцена имеет следующую структуру:

```typescript
import { Scenes, Markup } from "telegraf";
import type { ScraperBotContext } from "../types";
import { logger } from "../logger";

// Утилитные функции
function clearSessionState(ctx: ScraperBotContext, reason: string = "general"): void {
  // Реализация
}

async function safeSceneTransition(
  ctx: ScraperBotContext,
  targetScene: string = "project_wizard",
  reason: string = "general"
): Promise<void> {
  // Реализация
}

// Wizard-сцена
export class MyWizardScene extends Scenes.WizardScene<ScraperBotContext> {
  constructor(storage: StorageAdapter) {
    super(
      "my_wizard_scene_id",
      
      // Шаг 1
      async (ctx) => {
        logger.info(`[MyWizard] Шаг 1: Описание шага`);
        logger.debug(`[MyWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);
        
        // Логика шага
        
        return; // Остаемся на текущем шаге или ctx.wizard.next() для перехода к следующему
      },
      
      // Шаг 2
      async (ctx) => {
        logger.info(`[MyWizard] Шаг 2: Описание шага`);
        logger.debug(`[MyWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);
        
        // Логика шага
        
        return;
      }
    );
    
    // Регистрируем обработчики кнопок
    this.registerButtonHandlers();
  }

  /**
   * Регистрирует обработчики кнопок
   */
  private registerButtonHandlers(): void {
    // Обработчик для кнопки
    this.action("button_id", async (ctx) => {
      logger.info(`[MyWizard] Обработчик кнопки 'button_id' вызван`);
      await ctx.answerCbQuery();
      
      // Логика обработчика
      
      return ctx.wizard.selectStep(0); // Переход к определенному шагу
    });
    
    // Обработчик для выхода из сцены
    this.action("exit", async (ctx) => {
      logger.info(`[MyWizard] Обработчик кнопки 'exit' вызван`);
      await ctx.answerCbQuery();
      
      // Очистка состояния и безопасный переход в другую сцену
      clearSessionState(ctx, "exit_button_clicked");
      await safeSceneTransition(ctx, "project_wizard", "exit_button_clicked");
    });
  }
}

// Добавляем обработчик для команды
export function setupMyWizard(bot: any) {
  bot.command('my_command', async (ctx: any) => {
    logger.info("[MyWizard] Command /my_command triggered");
    await ctx.scene.enter('my_wizard_scene_id');
  });
}

export default MyWizardScene;
```

## Регистрация сцен в боте

Все Wizard-сцены регистрируются в файле `index.ts` следующим образом:

```typescript
// Импорт сцен
import { MyWizardScene, setupMyWizard } from "./src/scenes/my-wizard-scene";

// Инициализация бота
function initBot(
  bot: Telegraf<ScraperBotContext>,
  storageAdapter: StorageAdapter,
  config: InstagramScraperBotConfig
) {
  // Инициализируем сцены
  const stage = new Scenes.Stage<ScraperBotContext>([
    new MyWizardScene(storageAdapter),
    // Другие сцены
  ]);

  // Подключаем Stage middleware
  bot.use(stage.middleware() as Middleware<ScraperBotContext>);

  // Настраиваем обработчики для wizard-сцен
  setupMyWizard(bot);
  // Другие обработчики

  // Регистрируем обработчики команд
  bot.command("my_command", (ctx) =>
    ctx.scene.enter("my_wizard_scene_id")
  );
}
```

## Преимущества новой архитектуры

Новая архитектура Wizard-сцен имеет следующие преимущества:

1. **Стандартизация** - все сцены используют единый подход, что упрощает разработку и поддержку.
2. **Улучшенное управление состоянием** - использование `clearSessionState` и `safeSceneTransition` обеспечивает корректную очистку состояния и безопасные переходы между сценами.
3. **Подробное логирование** - каждый шаг и обработчик имеет подробное логирование, что упрощает отладку.
4. **Надежность** - обработка ошибок и безопасные переходы повышают надежность бота.
5. **Поддерживаемость** - стандартизированная структура упрощает поддержку и расширение функциональности.

## Примеры использования

### Пример 1: Создание нового шага

```typescript
// Шаг для отображения списка элементов
async (ctx) => {
  logger.info(`[MyWizard] Шаг: Отображение списка элементов`);
  logger.debug(`[MyWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);
  
  // Получаем данные из состояния
  const { projectId } = ctx.wizard.state;
  
  if (!projectId) {
    logger.error("[MyWizard] Project ID is undefined");
    await ctx.reply(
      "Не удалось определить проект. Пожалуйста, выберите проект из списка."
    );
    clearSessionState(ctx, "missing_project_id");
    await safeSceneTransition(ctx, "project_wizard", "missing_project_id");
    return;
  }
  
  try {
    // Загружаем данные
    const items = await ctx.storage.getItemsByProjectId(projectId);
    
    // Формируем сообщение
    let message = "📋 *Список элементов*\n\n";
    
    if (items.length === 0) {
      message += "Список пуст.";
    } else {
      items.forEach((item, index) => {
        message += `${index + 1}. ${item.name}\n`;
      });
    }
    
    // Формируем клавиатуру
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("➕ Добавить", "add_item")],
      [Markup.button.callback("⬅️ Назад", "back_to_menu")]
    ]);
    
    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...keyboard
    });
  } catch (error) {
    logger.error("[MyWizard] Error loading items:", error);
    await ctx.reply("Произошла ошибка при загрузке данных. Пожалуйста, попробуйте позже.");
    clearSessionState(ctx, "error_loading_items");
    await safeSceneTransition(ctx, "project_wizard", "error_loading_items");
  }
  
  // Остаемся на текущем шаге
  return;
}
```

### Пример 2: Создание обработчика кнопки

```typescript
// Обработчик для кнопки "Добавить"
this.action("add_item", async (ctx) => {
  logger.info(`[MyWizard] Обработчик кнопки 'add_item' вызван`);
  await ctx.answerCbQuery();
  
  // Переходим к шагу добавления элемента
  return ctx.wizard.selectStep(2);
});

// Обработчик для кнопки "Назад"
this.action("back_to_menu", async (ctx) => {
  logger.info(`[MyWizard] Обработчик кнопки 'back_to_menu' вызван`);
  await ctx.answerCbQuery();
  
  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "back_to_menu_clicked");
  await safeSceneTransition(ctx, "project_wizard", "back_to_menu_clicked");
});
```

## Заключение

Новая архитектура Wizard-сцен в Instagram Scraper Bot обеспечивает стандартизированный подход к разработке сцен, улучшенное управление состоянием и повышенную надежность бота. Следуя этой архитектуре, разработчики могут создавать новые сцены, которые будут соответствовать общему стилю и стандартам проекта.

Для получения дополнительной информации о паттернах и рефакторинге Wizard-сцен см. следующие документы:

- [WIZARD_SCENE_PATTERNS.md](./WIZARD_SCENE_PATTERNS.md) - подробное описание паттернов и примеры кода
- [WIZARD_SCENE_REFACTORING_CHECKLIST.md](./WIZARD_SCENE_REFACTORING_CHECKLIST.md) - чек-лист для рефакторинга существующих Wizard-сцен
- [SUCCESS_HISTORY_WIZARD_SCENES.md](./SUCCESS_HISTORY_WIZARD_SCENES.md) - история успеха и примеры исправлений
