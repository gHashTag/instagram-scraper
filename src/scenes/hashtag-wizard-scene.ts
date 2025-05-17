import { Scenes, Markup } from "telegraf";
import type { ScraperBotContext } from "@/types";
import { NeonAdapter } from "../adapters/neon-adapter";
import { ScraperSceneStep, ScraperSceneSessionData } from "@/types";
import { logger } from "../logger";

/**
 * Очищает состояние сессии перед выходом из сцены
 * @param ctx Контекст Telegraf
 * @param reason Причина очистки состояния (для логирования)
 */
function clearSessionState(ctx: ScraperBotContext, reason: string = "general"): void {
  if (ctx.scene.session) {
    logger.info(`[HashtagWizard] Clearing session state before leaving (reason: ${reason})`);
    // Очистка всех необходимых полей состояния
    ctx.scene.session.step = undefined;
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
  targetScene: string = "instagram_scraper_projects",
  reason: string = "general"
): Promise<void> {
  try {
    logger.info(`[HashtagWizard] Transitioning to ${targetScene} scene (reason: ${reason})`);
    await ctx.scene.enter(targetScene);
  } catch (error) {
    logger.error(`[HashtagWizard] Error entering ${targetScene} scene:`, error);
    await ctx.scene.leave();
  }
}

/**
 * Wizard-сцена для управления хештегами проекта
 */
export const hashtagWizardScene = new Scenes.WizardScene<ScraperBotContext>(
  "hashtag_wizard",
  
  // Шаг 1: Выбор проекта или отображение хештегов выбранного проекта
  async (ctx) => {
    logger.info(`[HashtagWizard] Шаг 1: Инициализация сцены хештегов`);
    logger.debug(`[HashtagWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);
    
    const adapter = ctx.storage as NeonAdapter;
    
    // Проверяем, есть ли projectId в состоянии wizard или в параметрах
    let projectId = ctx.wizard.state.projectId;
    if (!projectId && ctx.scene.session && ctx.scene.session.projectId) {
      projectId = ctx.scene.session.projectId;
      ctx.wizard.state.projectId = projectId;
    }
    
    if (!projectId) {
      await ctx.reply(
        "Ошибка: проект не определен. Пожалуйста, вернитесь и выберите проект."
      );
      clearSessionState(ctx, "missing_project_id");
      return ctx.scene.leave();
    }
    
    try {
      await adapter.initialize();
      const hashtags = await adapter.getHashtagsByProjectId(projectId);
      const projectName =
        (await adapter.getProjectById(projectId))?.name ||
        `Проект ID ${projectId}`;
      
      ctx.wizard.state.projectName = projectName;
      
      if (!hashtags || hashtags.length === 0) {
        await ctx.reply(
          `В проекте "${projectName}" нет отслеживаемых хештегов. Хотите добавить первый?`,
          {
            reply_markup: Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "Добавить хештег",
                  `add_hashtag`
                ),
              ],
              [Markup.button.callback("Назад к проекту", `back_to_project`)],
            ]).reply_markup,
          }
        );
      } else {
        const hashtagList = hashtags
          .map((h, i) => `${i + 1}. #${h.hashtag}`)
          .join("\n");
        const hashtagButtons = hashtags.map((h) => [
          Markup.button.callback(
            `#${h.hashtag}`,
            `hashtag_${h.id}`
          ),
          Markup.button.callback(
            `👀`,
            `view_reels_${h.id}`
          ),
          Markup.button.callback(
            `🗑️`,
            `delete_hashtag_${h.hashtag}`
          ),
        ]);
        
        await ctx.reply(
          `Хештеги в проекте "${projectName}":\n\n${hashtagList}\n\nЧто вы хотите сделать дальше?`,
          {
            reply_markup: Markup.inlineKeyboard([
              ...hashtagButtons,
              [
                Markup.button.callback(
                  "Добавить хештег",
                  `add_hashtag`
                ),
              ],
              [Markup.button.callback("Назад к проекту", `back_to_project`)],
            ]).reply_markup,
          }
        );
      }
    } catch (error) {
      logger.error(
        `[HashtagWizard] Ошибка при получении хештегов для проекта ${projectId}:`,
        error
      );
      await ctx.reply("Не удалось загрузить список хештегов. Попробуйте позже.");
      clearSessionState(ctx, "error_loading_hashtags");
      return ctx.scene.leave();
    } finally {
      if (adapter) {
        await adapter.close();
      }
    }
    
    // Остаемся на текущем шаге
    return;
  },
  
  // Шаг 2: Ввод нового хештега
  async (ctx) => {
    logger.info(`[HashtagWizard] Шаг 2: Ввод нового хештега`);
    logger.debug(`[HashtagWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);
    
    // Проверяем, есть ли текст сообщения
    if (ctx.message && 'text' in ctx.message) {
      const adapter = ctx.storage as NeonAdapter;
      const projectId = ctx.wizard.state.projectId;
      let hashtagInput = ctx.message.text.trim();
      
      if (!projectId) {
        await ctx.reply("Ошибка: проект не определен. Начните сначала.");
        clearSessionState(ctx, "missing_project_id_on_input");
        return ctx.scene.leave();
      }
      
      if (hashtagInput.startsWith("#")) {
        hashtagInput = hashtagInput.substring(1);
      }
      
      if (!hashtagInput || hashtagInput.includes(" ") || hashtagInput.length < 2) {
        await ctx.reply(
          "Некорректный хештег. Введите одно слово без пробелов (минимум 2 символа), # ставить не нужно."
        );
        return;
      }
      
      try {
        await adapter.initialize();
        const addedHashtag = await adapter.addHashtag(projectId, hashtagInput);
        if (addedHashtag) {
          await ctx.reply(`Хештег #${hashtagInput} успешно добавлен.`);
        } else {
          await ctx.reply(
            `Не удалось добавить хештег #${hashtagInput}. Возможно, он уже существует или произошла ошибка.`
          );
        }
      } catch (error) {
        logger.error(
          `[HashtagWizard] Ошибка при добавлении хештега ${hashtagInput} в проект ${projectId}:`,
          error
        );
        await ctx.reply("Произошла техническая ошибка при добавлении хештега.");
      } finally {
        if (adapter) {
          await adapter.close();
        }
        // Возвращаемся к списку хештегов (шаг 1)
        return ctx.wizard.selectStep(0);
      }
    } else {
      await ctx.reply("Пожалуйста, введите хештег для добавления (без #):");
    }
    
    // Остаемся на текущем шаге
    return;
  }
);

// Регистрируем обработчики кнопок на уровне сцены
hashtagWizardScene.action("add_hashtag", async (ctx) => {
  logger.info(`[HashtagWizard] Обработчик кнопки 'add_hashtag' вызван`);
  await ctx.answerCbQuery();
  
  await ctx.reply("Введите хештег для добавления (без #):", {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback("Отмена", "cancel_hashtag_input")],
    ]).reply_markup,
  });
  
  // Переходим к шагу ввода хештега
  return ctx.wizard.next();
});

hashtagWizardScene.action("cancel_hashtag_input", async (ctx) => {
  logger.info(`[HashtagWizard] Обработчик кнопки 'cancel_hashtag_input' вызван`);
  await ctx.answerCbQuery("Ввод отменен.");
  
  // Возвращаемся к списку хештегов (шаг 1)
  return ctx.wizard.selectStep(0);
});

hashtagWizardScene.action("back_to_project", async (ctx) => {
  logger.info(`[HashtagWizard] Обработчик кнопки 'back_to_project' вызван`);
  await ctx.answerCbQuery();
  await ctx.reply("Возврат к управлению проектом...");
  
  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "back_to_project_clicked");
  await safeSceneTransition(ctx, "instagram_scraper_projects", "back_to_project_clicked");
});

// Обработчик для удаления хештега
hashtagWizardScene.action(/delete_hashtag_(.+)/, async (ctx) => {
  logger.info(`[HashtagWizard] Обработчик кнопки 'delete_hashtag' вызван`);
  const adapter = ctx.storage as NeonAdapter;
  const hashtag = ctx.match[1];
  const projectId = ctx.wizard.state.projectId;
  
  if (!projectId || !hashtag) {
    logger.warn(`[HashtagWizard] Invalid data for delete hashtag: projectId=${projectId}, hashtag=${hashtag}`);
    await ctx.answerCbQuery("Ошибка: недостаточно данных");
    return;
  }
  
  try {
    await adapter.initialize();
    await adapter.removeHashtag(projectId, hashtag);
    await ctx.reply(`Хештег #${hashtag} удален.`);
    await ctx.answerCbQuery("Удалено");
  } catch (error) {
    logger.error(
      `[HashtagWizard] Ошибка при удалении хештега ${hashtag} из проекта ${projectId}:`,
      error
    );
    await ctx.reply("Произошла ошибка при удалении хештега.");
    await ctx.answerCbQuery("Ошибка");
  } finally {
    if (adapter) {
      await adapter.close();
    }
    // Возвращаемся к списку хештегов (шаг 1)
    return ctx.wizard.selectStep(0);
  }
});

// Обработчик для просмотра Reels хештега
hashtagWizardScene.action(/view_reels_(\d+)/, async (ctx) => {
  logger.info(`[HashtagWizard] Обработчик кнопки 'view_reels' вызван`);
  const hashtagId = parseInt(ctx.match[1], 10);
  const projectId = ctx.wizard.state.projectId;
  
  if (isNaN(hashtagId) || !projectId) {
    logger.warn(`[HashtagWizard] Invalid data for view reels: projectId=${projectId}, hashtagId=${hashtagId}`);
    await ctx.answerCbQuery("Ошибка: недостаточно данных");
    return;
  }
  
  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.currentSourceType = "hashtag";
  ctx.scene.session.currentSourceId = hashtagId;
  
  await ctx.answerCbQuery();
  
  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "view_reels_clicked");
  await safeSceneTransition(ctx, "instagram_scraper_reels", "view_reels_clicked");
});

// Добавляем обработчик для команды /hashtags
export function setupHashtagWizard(bot: any) {
  bot.command('hashtags', async (ctx: any) => {
    await ctx.scene.enter('hashtag_wizard');
  });

  // Добавляем обработчик для кнопки "Хэштеги" в главном меню
  bot.hears('#️⃣ Хэштеги', async (ctx: any) => {
    logger.info("[HashtagWizard] Обработчик кнопки '#️⃣ Хэштеги' вызван");
    await ctx.scene.enter('hashtag_wizard');
  });
}

export default hashtagWizardScene;
