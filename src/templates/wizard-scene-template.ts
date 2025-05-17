import { Scenes, Markup } from "telegraf";
import type { ScraperBotContext } from "../types";
import { ScraperSceneStep } from "../types";
import { logger } from "../logger";
import { StorageAdapter } from "../types";

/**
 * Очищает состояние сессии перед выходом из сцены
 * @param ctx Контекст Telegraf
 * @param reason Причина очистки состояния (для логирования)
 */
function clearSessionState(ctx: ScraperBotContext, reason: string = "general"): void {
  if (ctx.scene.session) {
    logger.info(`[TemplateWizard] Clearing session state before leaving (reason: ${reason})`);
    // Очистка всех необходимых полей состояния
    ctx.scene.session.step = undefined;
    // Специфичные для сцены поля
    ctx.scene.session.specificField = undefined;
    // Для Wizard-сцен
    if (ctx.wizard && ctx.wizard.state) {
      ctx.wizard.state = {};
    }
  }
}

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
    logger.info(`[TemplateWizard] Transitioning to ${targetScene} scene (reason: ${reason})`);
    await ctx.scene.enter(targetScene);
  } catch (error) {
    logger.error(`[TemplateWizard] Error entering ${targetScene} scene:`, error);
    await ctx.scene.leave();
  }
}

/**
 * Wizard-сцена для [описание функциональности]
 */
export class TemplateWizardScene extends Scenes.WizardScene<ScraperBotContext> {
  /**
   * Конструктор сцены
   * @param storage Адаптер хранилища
   */
  constructor(storage: StorageAdapter) {
    super(
      "template_wizard", // ID сцены
      
      // Шаг 1: Начальный шаг
      async (ctx) => {
        logger.info(`[TemplateWizard] Шаг 1: Описание шага`);
        logger.debug(`[TemplateWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);
        
        // Проверка наличия пользователя
        if (!ctx.from) {
          logger.error("[TemplateWizard] ctx.from is undefined");
          await ctx.reply(
            "Не удалось определить пользователя. Попробуйте перезапустить бота командой /start."
          );
          clearSessionState(ctx, "missing_user");
          return ctx.scene.leave();
        }

        // Получение данных из состояния или параметров
        const itemId = ctx.wizard.state.itemId || ctx.scene.session.currentItemId;
        
        if (!itemId) {
          // Обработка отсутствия необходимых данных
          await ctx.reply(
            "Не удалось определить элемент. Пожалуйста, выберите из списка."
          );
          clearSessionState(ctx, "missing_item_id");
          await safeSceneTransition(ctx, "fallback_scene", "missing_item_id");
          return;
        }
        
        // Устанавливаем шаг сцены
        ctx.scene.session.step = ScraperSceneStep.TEMPLATE_STEP_1;
        
        try {
          await ctx.storage.initialize();
          
          // Бизнес-логика шага
          // ...
          
          // Отправка сообщения пользователю
          await ctx.reply("Сообщение для пользователя", {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [Markup.button.callback("Кнопка 1", "button_1")],
              [Markup.button.callback("Кнопка 2", "button_2")],
              [Markup.button.callback("Назад", "back_button")]
            ])
          });
        } catch (error) {
          // Обработка ошибок
          logger.error("[TemplateWizard] Error in step 1:", error);
          await ctx.reply("Произошла ошибка. Пожалуйста, попробуйте позже.");
          clearSessionState(ctx, "error_in_step_1");
          await safeSceneTransition(ctx, "fallback_scene", "error_in_step_1");
        } finally {
          await ctx.storage.close();
        }
        
        // Остаемся на текущем шаге или переходим к следующему
        return; // или return ctx.wizard.next();
      },
      
      // Шаг 2: Следующий шаг
      async (ctx) => {
        logger.info(`[TemplateWizard] Шаг 2: Описание шага`);
        logger.debug(`[TemplateWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);
        
        // Устанавливаем шаг сцены
        ctx.scene.session.step = ScraperSceneStep.TEMPLATE_STEP_2;
        
        try {
          await ctx.storage.initialize();
          
          // Логика шага 2
          // ...
          
          // Отправка сообщения пользователю
          await ctx.reply("Сообщение для шага 2", {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [Markup.button.callback("Назад к шагу 1", "back_to_step_1")],
              [Markup.button.callback("Завершить", "finish")]
            ])
          });
        } catch (error) {
          // Обработка ошибок
          logger.error("[TemplateWizard] Error in step 2:", error);
          await ctx.reply("Произошла ошибка. Пожалуйста, попробуйте позже.");
          clearSessionState(ctx, "error_in_step_2");
          await safeSceneTransition(ctx, "fallback_scene", "error_in_step_2");
        } finally {
          await ctx.storage.close();
        }
        
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
    // Обработчик для кнопки 1
    this.action("button_1", async (ctx) => {
      logger.info(`[TemplateWizard] Обработчик кнопки 'button_1' вызван`);
      await ctx.answerCbQuery();
      
      // Логика обработчика
      // ...
      
      // Переход к определенному шагу
      return ctx.wizard.selectStep(1);
    });
    
    // Обработчик для кнопки 2
    this.action("button_2", async (ctx) => {
      logger.info(`[TemplateWizard] Обработчик кнопки 'button_2' вызван`);
      await ctx.answerCbQuery();
      
      // Логика обработчика
      // ...
      
      // Переход к определенному шагу
      return ctx.wizard.selectStep(2);
    });
    
    // Обработчик для кнопки "Назад к шагу 1"
    this.action("back_to_step_1", async (ctx) => {
      logger.info(`[TemplateWizard] Обработчик кнопки 'back_to_step_1' вызван`);
      await ctx.answerCbQuery();
      
      // Переход к шагу 1
      return ctx.wizard.selectStep(0);
    });
    
    // Обработчик для кнопки "Завершить"
    this.action("finish", async (ctx) => {
      logger.info(`[TemplateWizard] Обработчик кнопки 'finish' вызван`);
      await ctx.answerCbQuery();
      
      // Отправляем сообщение о завершении
      await ctx.reply("Операция успешно завершена!");
      
      // Очистка состояния и безопасный переход в другую сцену
      clearSessionState(ctx, "finish_button_clicked");
      await safeSceneTransition(ctx, "project_wizard", "finish_button_clicked");
    });
    
    // Обработчик для кнопки "Назад"
    this.action("back_button", async (ctx) => {
      logger.info(`[TemplateWizard] Обработчик кнопки 'back_button' вызван`);
      await ctx.answerCbQuery();
      
      // Очистка состояния и безопасный переход в другую сцену
      clearSessionState(ctx, "back_button_clicked");
      await safeSceneTransition(ctx, "previous_scene", "back_button_clicked");
    });
  }
}

// Добавляем обработчик для команды
export function setupTemplateWizard(bot: any) {
  bot.command('template', async (ctx: any) => {
    logger.info("[TemplateWizard] Command /template triggered");
    await ctx.scene.enter('template_wizard');
  });
  
  bot.hears('Шаблон', async (ctx: any) => {
    logger.info("[TemplateWizard] Button 'Шаблон' clicked");
    await ctx.scene.enter('template_wizard');
  });
}

export default TemplateWizardScene;
