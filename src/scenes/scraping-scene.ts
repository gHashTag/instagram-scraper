import { Scenes, Markup } from "telegraf";
import type { ScraperBotContext } from "../types";
import { ScraperSceneStep } from "../types";
import { logger } from "../logger";
import MockScraperService from "../services/mock-scraper-service";
import { registerButtons } from "../utils/button-handler";

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
  console.log("[DEBUG] Обработчик кнопки 'Скрапить конкурентов' вызван");
  console.log("[DEBUG] match:", ctx.match);

  try {
    const projectId = parseInt((ctx.match as unknown as RegExpExecArray)[1], 10);
    console.log(`[DEBUG] Извлеченный projectId: ${projectId}`);

    if (isNaN(projectId)) {
      logger.warn("[ScrapingScene] Invalid project ID from action match");
      console.error(`[ERROR] Невалидный projectId: ${(ctx.match as unknown as RegExpExecArray)[1]}`);
      if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
      ctx.scene.reenter();
      return;
    }

    console.log(`[DEBUG] Установка projectId в сессии: ${projectId}`);
    ctx.scene.session.currentProjectId = projectId;
    ctx.scene.session.step = ScraperSceneStep.SCRAPING_COMPETITORS;

    try {
      await ctx.storage.initialize();

      // Получаем список конкурентов
      console.log(`[DEBUG] Получение списка конкурентов для проекта ${projectId}`);
      const competitors = await ctx.storage.getCompetitorAccounts(projectId, true);
      console.log(`[DEBUG] Получено конкурентов: ${competitors.length}`);

      if (competitors.length === 0) {
        console.log("[DEBUG] Конкуренты не найдены");
        await ctx.answerCbQuery("У вас нет добавленных конкурентов.");
        ctx.scene.reenter();
        return;
      }

      // Формируем сообщение со списком конкурентов
      let message = "👥 *Выберите конкурентов для скрапинга:*\n\n";

      // Создаем клавиатуру с кнопками для выбора конкурентов
      console.log("[DEBUG] Создание клавиатуры с кнопками для выбора конкурентов");
      const keyboard = competitors.map((competitor) => [
        Markup.button.callback(
          competitor.username,
          `scrape_competitor_${projectId}_${competitor.id}`
        )
      ]);

      keyboard.push([Markup.button.callback("🔄 Скрапить всех конкурентов", `scrape_all_competitors_${projectId}`)]);
      keyboard.push([Markup.button.callback("🔙 Назад", `back_to_scraping_menu`)]);

      console.log("[DEBUG] Отправка сообщения с клавиатурой");
      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(keyboard)
      });

      if (ctx.callbackQuery) {
        console.log("[DEBUG] Ответ на callback query");
        await ctx.answerCbQuery();
      }
    } catch (error) {
      logger.error("[ScrapingScene] Error in handleScrapeCompetitorsAction:", error);
      console.error("[ERROR] Ошибка при загрузке конкурентов:", error);
      await ctx.reply(
        "Произошла ошибка при загрузке конкурентов. Попробуйте еще раз."
      );
    } finally {
      console.log("[DEBUG] Закрытие соединения с БД");
      await ctx.storage.close();
    }
  } catch (error) {
    console.error("[ERROR] Критическая ошибка в обработчике кнопки 'Скрапить конкурентов':", error);
    try {
      await ctx.reply("Произошла критическая ошибка. Пожалуйста, попробуйте еще раз.");
      if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка").catch(() => {});
    } catch (e) {
      console.error("[ERROR] Не удалось отправить сообщение об ошибке:", e);
    }
  }
}

// Регистрация обработчиков действий в сцене скрапинга
console.log("[DEBUG] Регистрация обработчиков действий в сцене скрапинга");

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

// Обработчик для возврата в меню скрапинга
export async function handleBackToScrapingMenuAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ScrapingScene] handleBackToScrapingMenuAction triggered");
  console.log("[DEBUG] Обработчик кнопки 'Назад к меню скрапинга' вызван");

  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }

    console.log("[DEBUG] Возврат в меню скрапинга через reenter");
    ctx.scene.reenter();
    return;
  } catch (error) {
    console.error("[ERROR] Ошибка в обработчике кнопки 'Назад к меню скрапинга':", error);
    try {
      await ctx.reply("Произошла ошибка при возврате в меню скрапинга. Попробуйте еще раз.");
    } catch (e) {
      console.error("[ERROR] Не удалось отправить сообщение об ошибке:", e);
    }
  }
}

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

// Обработчик для скрапинга конкретного конкурента
export async function handleScrapeCompetitorAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ScrapingScene] handleScrapeCompetitorAction triggered");

  // Получаем projectId и competitorId из match
  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);
  const competitorId = parseInt(match[2], 10);

  if (isNaN(projectId) || isNaN(competitorId)) {
    logger.warn("[ScrapingScene] Invalid project ID or competitor ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта или конкурента.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.step = ScraperSceneStep.SCRAPING_PROGRESS;

  try {
    // Отправляем сообщение о начале скрапинга
    await ctx.answerCbQuery("Начинаем скрапинг...");

    const progressMessage = await ctx.reply("⏳ *Скрапинг Reels конкурента...*\n\nПожалуйста, подождите. Это может занять некоторое время.", {
      parse_mode: "Markdown"
    });

    // Инициализируем хранилище
    await ctx.storage.initialize();

    // Получаем информацию о конкуренте
    const competitors = await ctx.storage.getCompetitorAccounts(projectId);
    const competitor = competitors.find(c => c.id === competitorId);

    if (!competitor) {
      await ctx.reply("Конкурент не найден. Возможно, он был удален.");
      ctx.scene.reenter();
      return;
    }

    // Создаем экземпляр сервиса скрапинга
    const scraperService = new MockScraperService(ctx.storage);

    // Запускаем скрапинг
    const savedCount = await scraperService.scrapeCompetitorReels(projectId, competitorId, {
      maxReels: 10
    });

    // Обновляем сообщение о прогрессе
    await ctx.telegram.editMessageText(
      ctx.chat?.id,
      progressMessage.message_id,
      undefined,
      `✅ *Скрапинг завершен!*\n\nУспешно собрано и сохранено ${savedCount} Reels для конкурента *${competitor.username}*.\n\nВы можете просмотреть результаты в разделе "Просмотреть Reels".`,
      {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("👀 Просмотреть результаты", `show_reels_competitor_${projectId}_${competitorId}`)],
          [Markup.button.callback("🔙 Назад к списку конкурентов", `scrape_competitors_${projectId}`)],
          [Markup.button.callback("🔙 Назад к меню скрапинга", "back_to_scraping_menu")]
        ]).reply_markup
      }
    );

    ctx.scene.session.step = ScraperSceneStep.SCRAPING_RESULTS;
  } catch (error) {
    logger.error("[ScrapingScene] Error in handleScrapeCompetitorAction:", error);
    await ctx.reply(
      "❌ Произошла ошибка при скрапинге. Пожалуйста, попробуйте еще раз позже.",
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Назад к списку конкурентов", `scrape_competitors_${projectId}`)],
        [Markup.button.callback("🔙 Назад к меню скрапинга", "back_to_scraping_menu")]
      ])
    );
  } finally {
    await ctx.storage.close();
  }
}

// Обработчик для скрапинга конкретного хештега
export async function handleScrapeHashtagAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ScrapingScene] handleScrapeHashtagAction triggered");

  // Получаем projectId и hashtagId из match
  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);
  const hashtagId = parseInt(match[2], 10);

  if (isNaN(projectId) || isNaN(hashtagId)) {
    logger.warn("[ScrapingScene] Invalid project ID or hashtag ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта или хештега.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.step = ScraperSceneStep.SCRAPING_PROGRESS;

  try {
    // Отправляем сообщение о начале скрапинга
    await ctx.answerCbQuery("Начинаем скрапинг...");

    const progressMessage = await ctx.reply("⏳ *Скрапинг Reels по хештегу...*\n\nПожалуйста, подождите. Это может занять некоторое время.", {
      parse_mode: "Markdown"
    });

    // Инициализируем хранилище
    await ctx.storage.initialize();

    // Получаем информацию о хештеге
    const hashtags = await ctx.storage.getHashtagsByProjectId(projectId);
    const hashtag = hashtags?.find(h => h.id === hashtagId);

    if (!hashtag) {
      await ctx.reply("Хештег не найден. Возможно, он был удален.");
      ctx.scene.reenter();
      return;
    }

    // Создаем экземпляр сервиса скрапинга
    const scraperService = new MockScraperService(ctx.storage);

    // Запускаем скрапинг
    const savedCount = await scraperService.scrapeHashtagReels(projectId, hashtagId, {
      maxReels: 10
    });

    // Обновляем сообщение о прогрессе
    await ctx.telegram.editMessageText(
      ctx.chat?.id,
      progressMessage.message_id,
      undefined,
      `✅ *Скрапинг завершен!*\n\nУспешно собрано и сохранено ${savedCount} Reels для хештега *#${hashtag.hashtag}*.\n\nВы можете просмотреть результаты в разделе "Просмотреть Reels".`,
      {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("👀 Просмотреть результаты", `show_reels_hashtag_${projectId}_${hashtagId}`)],
          [Markup.button.callback("🔙 Назад к списку хештегов", `scrape_hashtags_${projectId}`)],
          [Markup.button.callback("🔙 Назад к меню скрапинга", "back_to_scraping_menu")]
        ]).reply_markup
      }
    );

    ctx.scene.session.step = ScraperSceneStep.SCRAPING_RESULTS;
  } catch (error) {
    logger.error("[ScrapingScene] Error in handleScrapeHashtagAction:", error);
    await ctx.reply(
      "❌ Произошла ошибка при скрапинге. Пожалуйста, попробуйте еще раз позже.",
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Назад к списку хештегов", `scrape_hashtags_${projectId}`)],
        [Markup.button.callback("🔙 Назад к меню скрапинга", "back_to_scraping_menu")]
      ])
    );
  } finally {
    await ctx.storage.close();
  }
}

// Обработчик для скрапинга всех конкурентов
export async function handleScrapeAllCompetitorsAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ScrapingScene] handleScrapeAllCompetitorsAction triggered");

  // Получаем projectId из match
  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[ScrapingScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.step = ScraperSceneStep.SCRAPING_PROGRESS;

  try {
    // Отправляем сообщение о начале скрапинга
    await ctx.answerCbQuery("Начинаем скрапинг всех конкурентов...");

    const progressMessage = await ctx.reply("⏳ *Скрапинг Reels всех конкурентов...*\n\nПожалуйста, подождите. Это может занять некоторое время.", {
      parse_mode: "Markdown"
    });

    // Инициализируем хранилище
    await ctx.storage.initialize();

    // Получаем список конкурентов
    const competitors = await ctx.storage.getCompetitorAccounts(projectId);

    if (competitors.length === 0) {
      await ctx.reply("У вас нет добавленных конкурентов.");
      ctx.scene.reenter();
      return;
    }

    // Создаем экземпляр сервиса скрапинга
    const scraperService = new MockScraperService(ctx.storage);

    // Запускаем скрапинг для каждого конкурента
    let totalSavedCount = 0;
    let processedCount = 0;

    for (const competitor of competitors) {
      // Обновляем сообщение о прогрессе
      await ctx.telegram.editMessageText(
        ctx.chat?.id,
        progressMessage.message_id,
        undefined,
        `⏳ *Скрапинг Reels конкурентов...*\n\nОбработано: ${processedCount}/${competitors.length}\nТекущий конкурент: ${competitor.username}`,
        {
          parse_mode: "Markdown"
        }
      );

      // Запускаем скрапинг для текущего конкурента
      const savedCount = await scraperService.scrapeCompetitorReels(projectId, competitor.id, {
        maxReels: 5 // Меньше Reels для каждого конкурента, чтобы не перегружать базу
      });

      totalSavedCount += savedCount;
      processedCount++;
    }

    // Обновляем сообщение о прогрессе
    await ctx.telegram.editMessageText(
      ctx.chat?.id,
      progressMessage.message_id,
      undefined,
      `✅ *Скрапинг завершен!*\n\nУспешно обработано ${competitors.length} конкурентов.\nСобрано и сохранено ${totalSavedCount} Reels.\n\nВы можете просмотреть результаты в разделе "Просмотреть Reels".`,
      {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("👀 Просмотреть результаты", `show_reels_project_${projectId}`)],
          [Markup.button.callback("🔙 Назад к меню скрапинга", "back_to_scraping_menu")]
        ]).reply_markup
      }
    );

    ctx.scene.session.step = ScraperSceneStep.SCRAPING_RESULTS;
  } catch (error) {
    logger.error("[ScrapingScene] Error in handleScrapeAllCompetitorsAction:", error);
    await ctx.reply(
      "❌ Произошла ошибка при скрапинге. Пожалуйста, попробуйте еще раз позже.",
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Назад к меню скрапинга", "back_to_scraping_menu")]
      ])
    );
  } finally {
    await ctx.storage.close();
  }
}

// Обработчик для скрапинга всех хештегов
export async function handleScrapeAllHashtagsAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ScrapingScene] handleScrapeAllHashtagsAction triggered");

  // Получаем projectId из match
  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[ScrapingScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.step = ScraperSceneStep.SCRAPING_PROGRESS;

  try {
    // Отправляем сообщение о начале скрапинга
    await ctx.answerCbQuery("Начинаем скрапинг всех хештегов...");

    const progressMessage = await ctx.reply("⏳ *Скрапинг Reels по всем хештегам...*\n\nПожалуйста, подождите. Это может занять некоторое время.", {
      parse_mode: "Markdown"
    });

    // Инициализируем хранилище
    await ctx.storage.initialize();

    // Получаем список хештегов
    const hashtags = await ctx.storage.getHashtagsByProjectId(projectId);

    if (!hashtags || hashtags.length === 0) {
      await ctx.reply("У вас нет добавленных хештегов.");
      ctx.scene.reenter();
      return;
    }

    // Создаем экземпляр сервиса скрапинга
    const scraperService = new MockScraperService(ctx.storage);

    // Запускаем скрапинг для каждого хештега
    let totalSavedCount = 0;
    let processedCount = 0;

    for (const hashtag of hashtags) {
      // Обновляем сообщение о прогрессе
      await ctx.telegram.editMessageText(
        ctx.chat?.id,
        progressMessage.message_id,
        undefined,
        `⏳ *Скрапинг Reels по хештегам...*\n\nОбработано: ${processedCount}/${hashtags.length}\nТекущий хештег: #${hashtag.hashtag}`,
        {
          parse_mode: "Markdown"
        }
      );

      // Запускаем скрапинг для текущего хештега
      const savedCount = await scraperService.scrapeHashtagReels(projectId, hashtag.id, {
        maxReels: 5 // Меньше Reels для каждого хештега, чтобы не перегружать базу
      });

      totalSavedCount += savedCount;
      processedCount++;
    }

    // Обновляем сообщение о прогрессе
    await ctx.telegram.editMessageText(
      ctx.chat?.id,
      progressMessage.message_id,
      undefined,
      `✅ *Скрапинг завершен!*\n\nУспешно обработано ${hashtags.length} хештегов.\nСобрано и сохранено ${totalSavedCount} Reels.\n\nВы можете просмотреть результаты в разделе "Просмотреть Reels".`,
      {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("👀 Просмотреть результаты", `show_reels_project_${projectId}`)],
          [Markup.button.callback("🔙 Назад к меню скрапинга", "back_to_scraping_menu")]
        ]).reply_markup
      }
    );

    ctx.scene.session.step = ScraperSceneStep.SCRAPING_RESULTS;
  } catch (error) {
    logger.error("[ScrapingScene] Error in handleScrapeAllHashtagsAction:", error);
    await ctx.reply(
      "❌ Произошла ошибка при скрапинге. Пожалуйста, попробуйте еще раз позже.",
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Назад к меню скрапинга", "back_to_scraping_menu")]
      ])
    );
  } finally {
    await ctx.storage.close();
  }
}

// Обработчик для скрапинга всего (конкуренты + хештеги)
export async function handleScrapeAllAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ScrapingScene] handleScrapeAllAction triggered");

  // Получаем projectId из match
  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[ScrapingScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.step = ScraperSceneStep.SCRAPING_PROGRESS;

  try {
    // Отправляем сообщение о начале скрапинга
    await ctx.answerCbQuery("Начинаем полный скрапинг...");

    const progressMessage = await ctx.reply("⏳ *Полный скрапинг Reels...*\n\nПожалуйста, подождите. Это может занять некоторое время.", {
      parse_mode: "Markdown"
    });

    // Инициализируем хранилище
    await ctx.storage.initialize();

    // Получаем список конкурентов и хештегов
    const competitors = await ctx.storage.getCompetitorAccounts(projectId);
    const hashtags = await ctx.storage.getHashtagsByProjectId(projectId);

    if ((competitors.length === 0) && (!hashtags || hashtags.length === 0)) {
      await ctx.reply("У вас нет добавленных конкурентов или хештегов.");
      ctx.scene.reenter();
      return;
    }

    // Создаем экземпляр сервиса скрапинга
    const scraperService = new MockScraperService(ctx.storage);

    // Запускаем скрапинг для каждого конкурента
    let totalSavedCount = 0;
    let totalProcessedCount = 0;
    const totalItems = competitors.length + (hashtags ? hashtags.length : 0);

    // Сначала обрабатываем конкурентов
    for (const competitor of competitors) {
      // Обновляем сообщение о прогрессе
      await ctx.telegram.editMessageText(
        ctx.chat?.id,
        progressMessage.message_id,
        undefined,
        `⏳ *Полный скрапинг Reels...*\n\nОбработано: ${totalProcessedCount}/${totalItems}\nТекущий источник: конкурент ${competitor.username}`,
        {
          parse_mode: "Markdown"
        }
      );

      // Запускаем скрапинг для текущего конкурента
      const savedCount = await scraperService.scrapeCompetitorReels(projectId, competitor.id, {
        maxReels: 3 // Меньше Reels для каждого источника, чтобы не перегружать базу
      });

      totalSavedCount += savedCount;
      totalProcessedCount++;
    }

    // Затем обрабатываем хештеги
    if (hashtags && hashtags.length > 0) {
      for (const hashtag of hashtags) {
        // Обновляем сообщение о прогрессе
        await ctx.telegram.editMessageText(
          ctx.chat?.id,
          progressMessage.message_id,
          undefined,
          `⏳ *Полный скрапинг Reels...*\n\nОбработано: ${totalProcessedCount}/${totalItems}\nТекущий источник: хештег #${hashtag.hashtag}`,
          {
            parse_mode: "Markdown"
          }
        );

        // Запускаем скрапинг для текущего хештега
        const savedCount = await scraperService.scrapeHashtagReels(projectId, hashtag.id, {
          maxReels: 3 // Меньше Reels для каждого источника, чтобы не перегружать базу
        });

        totalSavedCount += savedCount;
        totalProcessedCount++;
      }
    }

    // Обновляем сообщение о прогрессе
    await ctx.telegram.editMessageText(
      ctx.chat?.id,
      progressMessage.message_id,
      undefined,
      `✅ *Скрапинг завершен!*\n\nУспешно обработано ${totalItems} источников (${competitors.length} конкурентов и ${hashtags ? hashtags.length : 0} хештегов).\nСобрано и сохранено ${totalSavedCount} Reels.\n\nВы можете просмотреть результаты в разделе "Просмотреть Reels".`,
      {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("👀 Просмотреть результаты", `show_reels_project_${projectId}`)],
          [Markup.button.callback("🔙 Назад к меню скрапинга", "back_to_scraping_menu")]
        ]).reply_markup
      }
    );

    ctx.scene.session.step = ScraperSceneStep.SCRAPING_RESULTS;
  } catch (error) {
    logger.error("[ScrapingScene] Error in handleScrapeAllAction:", error);
    await ctx.reply(
      "❌ Произошла ошибка при скрапинге. Пожалуйста, попробуйте еще раз позже.",
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Назад к меню скрапинга", "back_to_scraping_menu")]
      ])
    );
  } finally {
    await ctx.storage.close();
  }
}

// Обработчик для просмотра результатов скрапинга
export async function handleShowReelsAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ScrapingScene] handleShowReelsAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);
  const sourceType = match[2] as "competitor" | "hashtag";
  const sourceId = match[3];

  if (isNaN(projectId)) {
    logger.warn("[ScrapingScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;

  if (sourceType && sourceId) {
    ctx.scene.session.currentSourceType = sourceType;
    ctx.scene.session.currentSourceId = sourceId;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }

  ctx.scene.enter("instagram_scraper_reels", {
    projectId,
    sourceType,
    sourceId
  });
}

// Регистрация обработчиков кнопок с использованием централизованного обработчика
registerButtons(scrapingScene, [
  {
    id: /scrape_competitors_(\d+)/,
    handler: handleScrapeCompetitorsAction,
    errorMessage: "Произошла ошибка при скрапинге конкурентов. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /scrape_hashtags_(\d+)/,
    handler: handleScrapeHashtagsAction,
    errorMessage: "Произошла ошибка при скрапинге хештегов. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: "back_to_scraping_menu",
    handler: handleBackToScrapingMenuAction,
    errorMessage: "Произошла ошибка при возврате в меню скрапинга. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /project_(\d+)/,
    handler: handleBackToProjectAction,
    errorMessage: "Произошла ошибка при возврате к проекту. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /scrape_competitor_(\d+)_(\d+)/,
    handler: handleScrapeCompetitorAction,
    errorMessage: "Произошла ошибка при скрапинге конкурента. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /scrape_hashtag_(\d+)_(\d+)/,
    handler: handleScrapeHashtagAction,
    errorMessage: "Произошла ошибка при скрапинге хештега. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /scrape_all_competitors_(\d+)/,
    handler: handleScrapeAllCompetitorsAction,
    errorMessage: "Произошла ошибка при скрапинге всех конкурентов. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /scrape_all_hashtags_(\d+)/,
    handler: handleScrapeAllHashtagsAction,
    errorMessage: "Произошла ошибка при скрапинге всех хештегов. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /scrape_all_(\d+)/,
    handler: handleScrapeAllAction,
    errorMessage: "Произошла ошибка при полном скрапинге. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /show_reels_(.+)_(.+)_(.+)/,
    handler: handleShowReelsAction,
    errorMessage: "Произошла ошибка при просмотре результатов. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /show_reels_project_(\d+)/,
    handler: handleShowReelsAction,
    errorMessage: "Произошла ошибка при просмотре результатов. Попробуйте еще раз.",
    verbose: true
  }
]);

// Экспортируем сцену
export default scrapingScene;
