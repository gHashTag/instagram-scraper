import { Scenes, Markup } from "telegraf";
import type { ScraperBotContext } from "../types";
import { ScraperSceneStep } from "../types";
import { logger } from "../logger";

/**
 * Сцена для управления скрапингом данных из Instagram
 */
export const scrapingScene = new Scenes.BaseScene<ScraperBotContext>(
  "instagram_scraper_scraping"
);

// --- Enter Scene Handler ---
export async function handleScrapingEnter(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ScrapingScene] Enter handler triggered");

  if (!ctx.from) {
    logger.error("[ScrapingScene] ctx.from is undefined");
    await ctx.reply(
      "Не удалось определить пользователя. Попробуйте перезапустить бота командой /start."
    );
    return ctx.scene.leave();
  }

  // Получаем projectId из сессии
  const projectId = ctx.scene.session.currentProjectId;

  if (!projectId) {
    logger.error("[ScrapingScene] Project ID is undefined");
    await ctx.reply(
      "Не удалось определить проект. Пожалуйста, выберите проект из списка."
    );
    ctx.scene.enter("instagram_scraper_projects");
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.step = ScraperSceneStep.SCRAPING_MENU;

  try {
    await ctx.storage.initialize();

    // Получаем информацию о проекте
    const project = await ctx.storage.getProjectById(projectId);

    if (!project) {
      logger.error(`[ScrapingScene] Project with ID ${projectId} not found`);
      await ctx.reply(
        "Проект не найден. Возможно, он был удален."
      );
      ctx.scene.enter("instagram_scraper_projects");
      return;
    }

    // Получаем список конкурентов
    const competitors = await ctx.storage.getCompetitorAccounts(projectId, true);

    // Получаем список хештегов
    const hashtags = await ctx.storage.getHashtagsByProjectId(projectId);

    // Формируем сообщение
    let message = `🔍 *Скрапинг для проекта "${project.name}"*\n\n`;

    if (competitors.length === 0 && (!hashtags || hashtags.length === 0)) {
      message += "⚠️ У вас нет добавленных конкурентов или хештегов для скрапинга.\n";
      message += "Пожалуйста, добавьте конкурентов или хештеги перед запуском скрапинга.";

      await ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("👥 Добавить конкурентов", `competitors_project_${projectId}`)],
          [Markup.button.callback("📊 Добавить хештеги", `manage_hashtags_${projectId}`)],
          [Markup.button.callback("🔙 Назад к проекту", `project_${projectId}`)]
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
      keyboard.push([Markup.button.callback("👥 Скрапить конкурентов", `scrape_competitors_${projectId}`)]);
    }

    if (hashtags && hashtags.length > 0) {
      keyboard.push([Markup.button.callback("📊 Скрапить хештеги", `scrape_hashtags_${projectId}`)]);
    }

    keyboard.push([Markup.button.callback("🔄 Скрапить всё", `scrape_all_${projectId}`)]);
    keyboard.push([Markup.button.callback("🔙 Назад к проекту", `project_${projectId}`)]);

    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(keyboard)
    });
  } catch (error) {
    logger.error("[ScrapingScene] Error in enter handler:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке данных. Попробуйте еще раз."
    );
    await ctx.scene.leave();
  } finally {
    await ctx.storage.close();
  }
}

scrapingScene.enter(handleScrapingEnter);

// --- Action Handlers ---

// Обработчик для скрапинга конкурентов
export async function handleScrapeCompetitorsAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ScrapingScene] handleScrapeCompetitorsAction triggered");

  const projectId = parseInt((ctx.match as unknown as RegExpExecArray)[1], 10);
  if (isNaN(projectId)) {
    logger.warn("[ScrapingScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.step = ScraperSceneStep.SCRAPING_COMPETITORS;

  try {
    await ctx.storage.initialize();

    // Получаем список конкурентов
    const competitors = await ctx.storage.getCompetitorAccounts(projectId, true);

    if (competitors.length === 0) {
      await ctx.answerCbQuery("У вас нет добавленных конкурентов.");
      ctx.scene.reenter();
      return;
    }

    // Формируем сообщение со списком конкурентов
    let message = "👥 *Выберите конкурентов для скрапинга:*\n\n";

    // Создаем клавиатуру с кнопками для выбора конкурентов
    const keyboard = competitors.map((competitor) => [
      Markup.button.callback(
        competitor.username,
        `scrape_competitor_${projectId}_${competitor.id}`
      )
    ]);

    keyboard.push([Markup.button.callback("🔄 Скрапить всех конкурентов", `scrape_all_competitors_${projectId}`)]);
    keyboard.push([Markup.button.callback("🔙 Назад", `back_to_scraping_menu`)]);

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(keyboard)
    });

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }
  } catch (error) {
    logger.error("[ScrapingScene] Error in handleScrapeCompetitorsAction:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке конкурентов. Попробуйте еще раз."
    );
  } finally {
    await ctx.storage.close();
  }
}

scrapingScene.action(/scrape_competitors_(\d+)/, handleScrapeCompetitorsAction);

// Обработчик для скрапинга хештегов
export async function handleScrapeHashtagsAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ScrapingScene] handleScrapeHashtagsAction triggered");

  const projectId = parseInt((ctx.match as unknown as RegExpExecArray)[1], 10);
  if (isNaN(projectId)) {
    logger.warn("[ScrapingScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.step = ScraperSceneStep.SCRAPING_HASHTAGS;

  try {
    await ctx.storage.initialize();

    // Получаем список хештегов
    const hashtags = await ctx.storage.getHashtagsByProjectId(projectId);

    if (!hashtags || hashtags.length === 0) {
      await ctx.answerCbQuery("У вас нет добавленных хештегов.");
      ctx.scene.reenter();
      return;
    }

    // Формируем сообщение со списком хештегов
    let message = "📊 *Выберите хештеги для скрапинга:*\n\n";

    // Создаем клавиатуру с кнопками для выбора хештегов
    const keyboard = hashtags.map((hashtag) => [
      Markup.button.callback(
        `#${hashtag.hashtag}`,
        `scrape_hashtag_${projectId}_${hashtag.id}`
      )
    ]);

    keyboard.push([Markup.button.callback("🔄 Скрапить все хештеги", `scrape_all_hashtags_${projectId}`)]);
    keyboard.push([Markup.button.callback("🔙 Назад", `back_to_scraping_menu`)]);

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(keyboard)
    });

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }
  } catch (error) {
    logger.error("[ScrapingScene] Error in handleScrapeHashtagsAction:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке хештегов. Попробуйте еще раз."
    );
  } finally {
    await ctx.storage.close();
  }
}

scrapingScene.action(/scrape_hashtags_(\d+)/, handleScrapeHashtagsAction);

// Обработчик для возврата в меню скрапинга
export async function handleBackToScrapingMenuAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ScrapingScene] handleBackToScrapingMenuAction triggered");

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }

  ctx.scene.reenter();
  return;
}

scrapingScene.action("back_to_scraping_menu", handleBackToScrapingMenuAction);

// Обработчик для возврата к проекту
export async function handleBackToProjectAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ScrapingScene] handleBackToProjectAction triggered");

  const projectId = ctx.scene.session.currentProjectId;

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }

  if (!projectId) {
    ctx.scene.enter("instagram_scraper_projects");
    return;
  }

  ctx.scene.enter("instagram_scraper_projects", { projectId });
  return;
}

scrapingScene.action(/project_(\d+)/, handleBackToProjectAction);

// Экспортируем сцену
export default scrapingScene;
