import { Scenes, Markup } from "telegraf";
import type { ScraperBotContext } from "../types";
import { ScraperSceneStep } from "../types";
import { logger } from "../logger";
import MockScraperService from "../services/mock-scraper-service";

/**
 * Очищает состояние сессии перед выходом из сцены
 * @param ctx Контекст Telegraf
 * @param reason Причина очистки состояния (для логирования)
 */
function clearSessionState(ctx: ScraperBotContext, reason: string = "general"): void {
  if (ctx.scene.session) {
    logger.info(`[ScrapingWizard] Clearing session state before leaving (reason: ${reason})`);
    // Очистка всех необходимых полей состояния
    ctx.scene.session.step = undefined;
    ctx.scene.session.currentProjectId = undefined;
    ctx.scene.session.currentSourceType = undefined;
    ctx.scene.session.currentSourceId = undefined;
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
    logger.info(`[ScrapingWizard] Transitioning to ${targetScene} scene (reason: ${reason})`);
    await ctx.scene.enter(targetScene);
  } catch (error) {
    logger.error(`[ScrapingWizard] Error entering ${targetScene} scene:`, error);
    await ctx.scene.leave();
  }
}

/**
 * Wizard-сцена для управления скрапингом данных из Instagram
 */
export const scrapingWizardScene = new Scenes.WizardScene<ScraperBotContext>(
  "scraping_wizard",

  // Шаг 1: Отображение меню скрапинга
  async (ctx) => {
    logger.info(`[ScrapingWizard] Шаг 1: Отображение меню скрапинга`);
    logger.debug(`[ScrapingWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

    if (!ctx.from) {
      logger.error("[ScrapingWizard] ctx.from is undefined");
      await ctx.reply(
        "Не удалось определить пользователя. Попробуйте перезапустить бота командой /start."
      );
      clearSessionState(ctx, "missing_user");
      return ctx.scene.leave();
    }

    // Получаем projectId из сессии или из wizard.state
    let projectId = ctx.scene.session.currentProjectId;
    if (!projectId && ctx.wizard.state.projectId) {
      projectId = ctx.wizard.state.projectId;
    }

    if (!projectId) {
      logger.error("[ScrapingWizard] Project ID is undefined");
      await ctx.reply(
        "Не удалось определить проект. Пожалуйста, выберите проект из списка."
      );
      clearSessionState(ctx, "missing_project_id");
      await safeSceneTransition(ctx, "project_wizard", "missing_project_id");
      return;
    }

    // Сохраняем projectId в wizard.state и в session
    ctx.wizard.state.projectId = projectId;
    ctx.scene.session.currentProjectId = projectId;
    ctx.scene.session.step = ScraperSceneStep.SCRAPING_MENU;

    try {
      await ctx.storage.initialize();

      // Получаем информацию о проекте
      const project = await ctx.storage.getProjectById(projectId);

      if (!project) {
        logger.error(`[ScrapingWizard] Project with ID ${projectId} not found`);
        await ctx.reply(
          "Проект не найден. Возможно, он был удален."
        );
        clearSessionState(ctx, "project_not_found");
        await safeSceneTransition(ctx, "project_wizard", "project_not_found");
        return;
      }

      // Сохраняем имя проекта в wizard.state
      ctx.wizard.state.projectName = project.name;

      // Получаем список конкурентов
      const competitors = await ctx.storage.getCompetitorAccounts(projectId, true);
      ctx.wizard.state.competitors = competitors;

      // Получаем список хештегов
      const hashtags = await ctx.storage.getHashtagsByProjectId(projectId);
      ctx.wizard.state.hashtags = hashtags;

      // Формируем сообщение
      let message = `🔍 *Скрапинг для проекта "${project.name}"*\n\n`;

      if (competitors.length === 0 && (!hashtags || hashtags.length === 0)) {
        message += "⚠️ У вас нет добавленных конкурентов или хештегов для скрапинга.\n";
        message += "Пожалуйста, добавьте конкурентов или хештеги перед запуском скрапинга.";

        await ctx.reply(message, {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("👥 Добавить конкурентов", `add_competitors`)],
            [Markup.button.callback("📊 Добавить хештеги", `add_hashtags`)],
            [Markup.button.callback("🔙 Назад к проекту", `back_to_project`)]
          ])
        });

        return;
      }

      message += "*Выберите источник для скрапинга:*\n\n";

      if (competitors.length > 0) {
        message += `👥 *Конкуренты (${competitors.length}):*\n`;
        competitors.slice(0, 5).forEach((competitor, index) => {
          message += `${index + 1}. ${competitor.username}\n`;
        });
        if (competitors.length > 5) {
          message += `...и еще ${competitors.length - 5}\n`;
        }
        message += "\n";
      }

      if (hashtags && hashtags.length > 0) {
        message += `📊 *Хештеги (${hashtags.length}):*\n`;
        hashtags.slice(0, 5).forEach((hashtag, index) => {
          message += `${index + 1}. #${hashtag.hashtag}\n`;
        });
        if (hashtags.length > 5) {
          message += `...и еще ${hashtags.length - 5}\n`;
        }
      }

      // Создаем клавиатуру с кнопками для выбора источника скрапинга
      const keyboard = [];

      if (competitors.length > 0) {
        keyboard.push([Markup.button.callback("👥 Скрапить конкурентов", `scrape_competitors`)]);
      }

      if (hashtags && hashtags.length > 0) {
        keyboard.push([Markup.button.callback("📊 Скрапить хештеги", `scrape_hashtags`)]);
      }

      keyboard.push([Markup.button.callback("🔄 Скрапить всё", `scrape_all`)]);
      keyboard.push([Markup.button.callback("🔙 Назад к проекту", `back_to_project`)]);

      await ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(keyboard)
      });
    } catch (error) {
      logger.error("[ScrapingWizard] Error in step 1:", error);
      await ctx.reply(
        "Произошла ошибка при загрузке данных. Попробуйте еще раз."
      );
      clearSessionState(ctx, "error_loading_data");
      return ctx.scene.leave();
    } finally {
      await ctx.storage.close();
    }

    // Остаемся на текущем шаге
    return;
  },

  // Шаг 2: Выбор конкурентов для скрапинга
  async (ctx) => {
    logger.info(`[ScrapingWizard] Шаг 2: Выбор конкурентов для скрапинга`);
    logger.debug(`[ScrapingWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

    const { projectId, competitors } = ctx.wizard.state;

    if (!projectId) {
      logger.error("[ScrapingWizard] Project ID is undefined in step 2");
      await ctx.reply("Ошибка: не удалось определить проект. Начните сначала.");
      clearSessionState(ctx, "missing_project_id_step_2");
      await safeSceneTransition(ctx, "project_wizard", "missing_project_id_step_2");
      return;
    }

    if (!competitors || competitors.length === 0) {
      logger.warn("[ScrapingWizard] No competitors found for project");
      await ctx.reply("У вас нет добавленных конкурентов.");
      return ctx.wizard.selectStep(0);
    }

    // Формируем сообщение со списком конкурентов
    let message = "👥 *Выберите конкурентов для скрапинга:*\n\n";

    // Создаем клавиатуру с кнопками для выбора конкурентов
    const keyboard = competitors.map((competitor) => [
      Markup.button.callback(
        competitor.username,
        `scrape_competitor_${competitor.id}`
      )
    ]);

    keyboard.push([Markup.button.callback("🔄 Скрапить всех конкурентов", `scrape_all_competitors`)]);
    keyboard.push([Markup.button.callback("🔙 Назад", `back_to_menu`)]);

    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(keyboard)
    });

    // Остаемся на текущем шаге
    return;
  },

  // Шаг 3: Выбор хештегов для скрапинга
  async (ctx) => {
    logger.info(`[ScrapingWizard] Шаг 3: Выбор хештегов для скрапинга`);
    logger.debug(`[ScrapingWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

    const { projectId, hashtags } = ctx.wizard.state;

    if (!projectId) {
      logger.error("[ScrapingWizard] Project ID is undefined in step 3");
      await ctx.reply("Ошибка: не удалось определить проект. Начните сначала.");
      clearSessionState(ctx, "missing_project_id_step_3");
      await safeSceneTransition(ctx, "project_wizard", "missing_project_id_step_3");
      return;
    }

    if (!hashtags || hashtags.length === 0) {
      logger.warn("[ScrapingWizard] No hashtags found for project");
      await ctx.reply("У вас нет добавленных хештегов.");
      return ctx.wizard.selectStep(0);
    }

    // Формируем сообщение со списком хештегов
    let message = "📊 *Выберите хештеги для скрапинга:*\n\n";

    // Создаем клавиатуру с кнопками для выбора хештегов
    const keyboard = hashtags.map((hashtag) => [
      Markup.button.callback(
        `#${hashtag.hashtag}`,
        `scrape_hashtag_${hashtag.id}`
      )
    ]);

    keyboard.push([Markup.button.callback("🔄 Скрапить все хештеги", `scrape_all_hashtags`)]);
    keyboard.push([Markup.button.callback("🔙 Назад", `back_to_menu`)]);

    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(keyboard)
    });

    // Остаемся на текущем шаге
    return;
  }
);

// Регистрируем обработчики кнопок на уровне сцены
scrapingWizardScene.action("back_to_project", async (ctx) => {
  logger.info(`[ScrapingWizard] Обработчик кнопки 'back_to_project' вызван`);
  await ctx.answerCbQuery();

  const projectId = ctx.wizard.state.projectId;

  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "back_to_project_clicked");
  await safeSceneTransition(ctx, "project_wizard", "back_to_project_clicked");
});

scrapingWizardScene.action("back_to_menu", async (ctx) => {
  logger.info(`[ScrapingWizard] Обработчик кнопки 'back_to_menu' вызван`);
  await ctx.answerCbQuery();

  // Возвращаемся к меню скрапинга (шаг 1)
  return ctx.wizard.selectStep(0);
});

scrapingWizardScene.action("add_competitors", async (ctx) => {
  logger.info(`[ScrapingWizard] Обработчик кнопки 'add_competitors' вызван`);
  await ctx.answerCbQuery();

  const projectId = ctx.wizard.state.projectId;

  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "add_competitors_clicked");
  ctx.scene.session.currentProjectId = projectId;
  await safeSceneTransition(ctx, "competitor_wizard", "add_competitors_clicked");
});

scrapingWizardScene.action("add_hashtags", async (ctx) => {
  logger.info(`[ScrapingWizard] Обработчик кнопки 'add_hashtags' вызван`);
  await ctx.answerCbQuery();

  const projectId = ctx.wizard.state.projectId;

  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "add_hashtags_clicked");
  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.projectId = projectId;
  await safeSceneTransition(ctx, "hashtag_wizard", "add_hashtags_clicked");
});

scrapingWizardScene.action("scrape_competitors", async (ctx) => {
  logger.info(`[ScrapingWizard] Обработчик кнопки 'scrape_competitors' вызван`);
  await ctx.answerCbQuery();

  // Переходим к шагу выбора конкурентов
  return ctx.wizard.next();
});

scrapingWizardScene.action("scrape_hashtags", async (ctx) => {
  logger.info(`[ScrapingWizard] Обработчик кнопки 'scrape_hashtags' вызван`);
  await ctx.answerCbQuery();

  // Переходим к шагу выбора хештегов (шаг 3)
  return ctx.wizard.selectStep(2);
});

// Добавляем обработчик для команды /scraping
export function setupScrapingWizard(bot: any) {
  bot.command('scraping', async (ctx: any) => {
    logger.info("[ScrapingWizard] Command /scraping triggered");
    await ctx.scene.enter('scraping_wizard');
  });

  // Добавляем обработчик для кнопки "Скрапинг" в главном меню
  bot.hears('🔍 Скрапинг', async (ctx: any) => {
    logger.info("[ScrapingWizard] Button '🔍 Скрапинг' clicked");
    await ctx.scene.enter('scraping_wizard');
  });
}

export default scrapingWizardScene;
