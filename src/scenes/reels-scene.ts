import { Scenes, Markup } from "telegraf";
import type { ScraperBotContext } from "../types";
import { ScraperSceneStep } from "../types";
import { logger } from "../logger";
import { ReelsFilter } from "../schemas";
import {
  createReelsListKeyboard,
  createReelDetailsKeyboard,
  createReelsFilterKeyboard,
  formatDate,
  formatViews,
} from "./components/reels-keyboard";
import { registerButtons } from "../utils/button-handler";

/**
 * Очищает состояние сессии перед выходом из сцены
 * @param ctx Контекст Telegraf
 * @param reason Причина очистки состояния (для логирования)
 */
function clearSessionState(ctx: ScraperBotContext, reason: string = "general"): void {
  if (ctx.scene.session) {
    logger.info(`[ReelsScene] Clearing session state before leaving (reason: ${reason})`);
    ctx.scene.session.reelsFilter = undefined;
    ctx.scene.session.reelsPage = 1;
    ctx.scene.session.currentReelId = undefined;
    ctx.scene.session.currentSourceType = undefined;
    ctx.scene.session.currentSourceId = undefined;
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
    logger.info(`[ReelsScene] Transitioning to ${targetScene} scene (reason: ${reason})`);
    await ctx.scene.enter(targetScene);
  } catch (error) {
    logger.error(`[ReelsScene] Error entering ${targetScene} scene:`, error);
    await ctx.scene.leave();
  }
}

/**
 * Сцена для просмотра Reels
 */
export const reelsScene = new Scenes.BaseScene<ScraperBotContext>(
  "instagram_scraper_reels"
);

// --- Enter Scene Handler ---
export async function handleReelsEnter(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] Enter handler triggered");

  if (!ctx.from) {
    logger.error("[ReelsScene] ctx.from is undefined");
    await ctx.reply(
      "Не удалось определить пользователя. Попробуйте перезапустить бота командой /start."
    );

    // Очистка состояния и безопасный переход в другую сцену
    clearSessionState(ctx, "missing_user");
    await safeSceneTransition(ctx, "instagram_scraper_projects", "missing_user");
    return;
  }

  // Получаем projectId из параметров или из сессии
  const projectId = ctx.scene.session.currentProjectId;

  if (!projectId) {
    logger.error("[ReelsScene] Project ID is undefined");
    await ctx.reply(
      "Не удалось определить проект. Пожалуйста, выберите проект из списка."
    );
    ctx.scene.enter("instagram_scraper_projects");
    return;
  }

  // Получаем sourceType и sourceId из параметров или из сессии
  const state = ctx.scene.state as { sourceType?: "competitor" | "hashtag"; sourceId?: string | number };
  const sourceType = state.sourceType || ctx.scene.session.currentSourceType;
  const sourceId = state.sourceId || ctx.scene.session.currentSourceId;

  // Сохраняем параметры в сессии
  ctx.scene.session.currentProjectId = projectId;
  if (sourceType) ctx.scene.session.currentSourceType = sourceType;
  if (sourceId) ctx.scene.session.currentSourceId = sourceId;

  // Устанавливаем шаг сцены
  ctx.scene.session.step = ScraperSceneStep.REELS_LIST;

  // Устанавливаем параметры пагинации
  ctx.scene.session.reelsPage = ctx.scene.session.reelsPage || 1;
  ctx.scene.session.reelsPerPage = ctx.scene.session.reelsPerPage || 5;

  try {
    await ctx.storage.initialize();

    // Получаем информацию о проекте
    const project = await ctx.storage.getProjectById(projectId);

    if (!project) {
      logger.error(`[ReelsScene] Project with ID ${projectId} not found`);
      await ctx.reply(
        "Проект не найден. Возможно, он был удален."
      );
      ctx.scene.enter("instagram_scraper_projects");
      return;
    }

    // Формируем фильтр для получения Reels
    const filter: ReelsFilter = ctx.scene.session.reelsFilter || {
      projectId,
      limit: ctx.scene.session.reelsPerPage,
      offset: (ctx.scene.session.reelsPage - 1) * ctx.scene.session.reelsPerPage,
      orderBy: "published_at",
      orderDirection: "DESC",
    };

    // Если указан тип и ID источника, добавляем их в фильтр
    if (sourceType && sourceId) {
      filter.sourceType = sourceType;
      filter.sourceId = sourceId;
    }

    // Получаем Reels с учетом фильтра
    const reels = await ctx.storage.getReels(filter);

    // Получаем общее количество Reels для пагинации
    let totalReels = 0;
    if (ctx.storage.getReelsCount) {
      totalReels = await ctx.storage.getReelsCount({
        projectId,
        sourceType,
        sourceId,
      });
    } else {
      // Если метод не реализован, используем длину массива Reels
      totalReels = reels.length;
    }

    // Вычисляем общее количество страниц
    const totalPages = Math.ceil(totalReels / ctx.scene.session.reelsPerPage);

    // Формируем заголовок сообщения
    let title = `🎬 *Reels для проекта "${project.name}"*`;

    if (sourceType && sourceId) {
      if (sourceType === "competitor") {
        // Получаем информацию о конкуренте
        const competitors = await ctx.storage.getCompetitorAccounts(projectId);
        const competitor = competitors.find(c => c.id === Number(sourceId));

        if (competitor) {
          title += `\n👤 Конкурент: *${competitor.username}*`;
        }
      } else if (sourceType === "hashtag") {
        // Получаем информацию о хештеге
        const hashtags = await ctx.storage.getHashtagsByProjectId(projectId);
        const hashtag = hashtags?.find(h => h.id === Number(sourceId));

        if (hashtag) {
          title += `\n#️⃣ Хештег: *#${hashtag.hashtag}*`;
        }
      }
    }

    // Формируем сообщение
    let message = `${title}\n\n`;

    if (reels.length === 0) {
      message += "⚠️ Нет доступных Reels. Попробуйте запустить скрапинг или изменить фильтры.";

      await ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("▶️ Запустить скрапинг", `scrape_project_${projectId}`)],
          [Markup.button.callback("🔙 Назад к проекту", `project_${projectId}`)]
        ])
      });

      return;
    }

    message += `Найдено Reels: *${totalReels}*\n`;
    message += `Страница *${ctx.scene.session.reelsPage}* из *${totalPages}*\n\n`;
    message += "Выберите Reel для просмотра подробной информации:";

    // Отправляем сообщение с клавиатурой
    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...createReelsListKeyboard(
        reels,
        projectId,
        ctx.scene.session.reelsPage,
        totalPages,
        sourceType as "competitor" | "hashtag" | undefined,
        sourceId
      )
    });
  } catch (error) {
    logger.error("[ReelsScene] Error in enter handler:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке данных. Попробуйте еще раз."
    );

    // Очистка состояния и безопасный переход в другую сцену
    clearSessionState(ctx, "data_loading_error");
    await safeSceneTransition(ctx, "instagram_scraper_projects", "data_loading_error");
  } finally {
    await ctx.storage.close();
  }
}

reelsScene.enter(handleReelsEnter);

// --- Action Handlers ---

// Обработчик для просмотра детальной информации о Reel
export async function handleReelDetailsAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] handleReelDetailsAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);
  const reelId = match[2];

  if (isNaN(projectId) || !reelId) {
    logger.warn("[ReelsScene] Invalid project ID or reel ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверные параметры.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.currentReelId = reelId;
  ctx.scene.session.step = ScraperSceneStep.REEL_DETAILS;

  try {
    await ctx.storage.initialize();

    // Получаем информацию о Reel
    let reel = null;
    if (ctx.storage.getReelById) {
      reel = await ctx.storage.getReelById(reelId);
    } else {
      // Если метод не реализован, получаем Reel из общего списка
      const reels = await ctx.storage.getReels({ projectId });
      reel = reels.find(r => r.instagram_id === reelId) || null;
    }

    if (!reel) {
      logger.error(`[ReelsScene] Reel with ID ${reelId} not found`);
      await ctx.answerCbQuery("Reel не найден. Возможно, он был удален.");
      ctx.scene.reenter();
      return;
    }

    // Получаем информацию об источнике
    let sourceInfo = "";
    if (reel.source_type === "competitor") {
      sourceInfo = `👤 Конкурент: *${reel.author_username || "Неизвестно"}*`;
    } else if (reel.source_type === "hashtag") {
      // Получаем информацию о хештеге
      const hashtags = await ctx.storage.getHashtagsByProjectId(projectId);
      const hashtag = hashtags?.find(h => h.id === Number(reel.source_id));

      if (hashtag) {
        sourceInfo = `#️⃣ Хештег: *#${hashtag.hashtag}*`;
      } else {
        sourceInfo = `#️⃣ Хештег: *ID ${reel.source_id}*`;
      }
    }

    // Формируем сообщение с детальной информацией о Reel
    let message = `🎬 *Детальная информация о Reel*\n\n`;
    message += sourceInfo ? `${sourceInfo}\n` : "";
    message += `👤 Автор: *${reel.author_username || "Неизвестно"}*\n`;
    message += `📅 Дата публикации: *${formatDate(reel.published_at)}*\n`;
    message += `👁️ Просмотры: *${formatViews(reel.views)}*\n`;
    message += `❤️ Лайки: *${reel.likes || "Нет данных"}*\n`;
    message += `💬 Комментарии: *${reel.comments_count || "Нет данных"}*\n`;

    if (reel.duration) {
      message += `⏱️ Длительность: *${reel.duration} сек.*\n`;
    }

    if (reel.music_title) {
      message += `🎵 Музыка: *${reel.music_title}*\n`;
    }

    message += `\n📝 Описание:\n${reel.caption || "Без описания"}`;

    // Добавляем информацию о расшифровке
    if (reel.transcript_status) {
      message += "\n\n🎙️ *Расшифровка:* ";

      switch (reel.transcript_status) {
        case "pending":
          message += "В очереди на обработку";
          break;
        case "processing":
          message += "В процессе";
          break;
        case "completed":
          message += "Завершена";
          if (reel.transcript) {
            message += "\n\n*Фрагмент расшифровки:*\n";
            // Показываем только первые 100 символов расшифровки
            const previewText = reel.transcript.length > 100
              ? reel.transcript.substring(0, 100) + "..."
              : reel.transcript;
            message += previewText;
          }
          break;
        case "failed":
          message += "Ошибка при обработке";
          break;
        default:
          message += "Статус неизвестен";
      }
    }

    // Отправляем сообщение с клавиатурой
    if (reel.thumbnail_url) {
      await ctx.replyWithPhoto(reel.thumbnail_url, {
        caption: message,
        parse_mode: "Markdown",
        ...createReelDetailsKeyboard(
          reel,
          projectId,
          ctx.scene.session.currentSourceType,
          ctx.scene.session.currentSourceId
        )
      });
    } else {
      await ctx.reply(message, {
        parse_mode: "Markdown",
        ...createReelDetailsKeyboard(
          reel,
          projectId,
          ctx.scene.session.currentSourceType,
          ctx.scene.session.currentSourceId
        )
      });
    }

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }
  } catch (error) {
    logger.error("[ReelsScene] Error in handleReelDetailsAction:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке данных. Попробуйте еще раз."
    );
  } finally {
    await ctx.storage.close();
  }
}

// Обработчик для пагинации списка Reels
export async function handleReelsPageAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] handleReelsPageAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);
  const page = parseInt(match[2], 10);
  const sourceType = match[3] as "competitor" | "hashtag" | undefined;
  const sourceId = match[4];

  if (isNaN(projectId) || isNaN(page)) {
    logger.warn("[ReelsScene] Invalid project ID or page from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверные параметры.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.reelsPage = page;
  if (sourceType) ctx.scene.session.currentSourceType = sourceType;
  if (sourceId) ctx.scene.session.currentSourceId = sourceId;

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }

  ctx.scene.reenter();
}

// Обработчик для возврата к списку Reels
export async function handleReelsListAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] handleReelsListAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);
  const sourceType = match[2] as "competitor" | "hashtag" | undefined;
  const sourceId = match[3];

  if (isNaN(projectId)) {
    logger.warn("[ReelsScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.step = ScraperSceneStep.REELS_LIST;
  if (sourceType) ctx.scene.session.currentSourceType = sourceType;
  if (sourceId) ctx.scene.session.currentSourceId = sourceId;

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }

  ctx.scene.reenter();
}

// Обработчик для фильтрации Reels
export async function handleReelsFilterAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] handleReelsFilterAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[ReelsScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.step = ScraperSceneStep.REELS_FILTER;

  try {
    await ctx.storage.initialize();

    // Получаем информацию о проекте
    const project = await ctx.storage.getProjectById(projectId);

    if (!project) {
      logger.error(`[ReelsScene] Project with ID ${projectId} not found`);
      await ctx.reply(
        "Проект не найден. Возможно, он был удален."
      );
      ctx.scene.enter("instagram_scraper_projects");
      return;
    }

    // Формируем сообщение
    let message = `🔍 *Фильтрация Reels для проекта "${project.name}"*\n\n`;
    message += "Выберите параметры фильтрации:";

    // Отправляем сообщение с клавиатурой
    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      ...createReelsFilterKeyboard(
        projectId,
        ctx.scene.session.currentSourceType,
        ctx.scene.session.currentSourceId
      )
    });

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }
  } catch (error) {
    logger.error("[ReelsScene] Error in handleReelsFilterAction:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке данных. Попробуйте еще раз."
    );
  } finally {
    await ctx.storage.close();
  }
}

// Обработчик для фильтрации Reels по просмотрам
export async function handleReelsFilterViewsAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] handleReelsFilterViewsAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);
  const minViews = parseInt(match[2], 10);
  const sourceType = match[3] as "competitor" | "hashtag" | undefined;
  const sourceId = match[4];

  if (isNaN(projectId) || isNaN(minViews)) {
    logger.warn("[ReelsScene] Invalid project ID or minViews from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверные параметры.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  if (sourceType) ctx.scene.session.currentSourceType = sourceType;
  if (sourceId) ctx.scene.session.currentSourceId = sourceId;

  // Обновляем фильтр
  ctx.scene.session.reelsFilter = {
    ...ctx.scene.session.reelsFilter,
    projectId,
    minViews,
    limit: ctx.scene.session.reelsPerPage,
    offset: 0, // Сбрасываем пагинацию
  };

  // Сбрасываем страницу
  ctx.scene.session.reelsPage = 1;

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery(`Фильтр применен: просмотры > ${minViews}`);
  }

  // Возвращаемся к списку Reels
  ctx.scene.session.step = ScraperSceneStep.REELS_LIST;
  ctx.scene.reenter();
}

// Обработчик для фильтрации Reels по дате
export async function handleReelsFilterDateAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] handleReelsFilterDateAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);
  const period = match[2]; // "week" или "month"
  const sourceType = match[3] as "competitor" | "hashtag" | undefined;
  const sourceId = match[4];

  if (isNaN(projectId) || !period) {
    logger.warn("[ReelsScene] Invalid project ID or period from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверные параметры.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  if (sourceType) ctx.scene.session.currentSourceType = sourceType;
  if (sourceId) ctx.scene.session.currentSourceId = sourceId;

  // Вычисляем дату начала периода
  const now = new Date();
  let afterDate: string;

  if (period === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    afterDate = weekAgo.toISOString();
  } else if (period === "month") {
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    afterDate = monthAgo.toISOString();
  } else {
    // Если период неизвестен, используем неделю
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    afterDate = weekAgo.toISOString();
  }

  // Обновляем фильтр
  ctx.scene.session.reelsFilter = {
    ...ctx.scene.session.reelsFilter,
    projectId,
    afterDate,
    limit: ctx.scene.session.reelsPerPage,
    offset: 0, // Сбрасываем пагинацию
  };

  // Сбрасываем страницу
  ctx.scene.session.reelsPage = 1;

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery(`Фильтр применен: за ${period === "week" ? "неделю" : "месяц"}`);
  }

  // Возвращаемся к списку Reels
  ctx.scene.session.step = ScraperSceneStep.REELS_LIST;
  ctx.scene.reenter();
}

// Обработчик для сортировки Reels
export async function handleReelsSortAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] handleReelsSortAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);
  const sortField = match[2]; // "views" или "date"
  const sourceType = match[3] as "competitor" | "hashtag" | undefined;
  const sourceId = match[4];

  if (isNaN(projectId) || !sortField) {
    logger.warn("[ReelsScene] Invalid project ID or sort field from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверные параметры.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  if (sourceType) ctx.scene.session.currentSourceType = sourceType;
  if (sourceId) ctx.scene.session.currentSourceId = sourceId;

  // Определяем поле для сортировки
  let orderBy: string;
  if (sortField === "views") {
    orderBy = "views";
  } else if (sortField === "date") {
    orderBy = "published_at";
  } else {
    // Если поле неизвестно, используем дату публикации
    orderBy = "published_at";
  }

  // Обновляем фильтр
  ctx.scene.session.reelsFilter = {
    ...ctx.scene.session.reelsFilter,
    projectId,
    orderBy,
    orderDirection: "DESC",
    limit: ctx.scene.session.reelsPerPage,
    offset: 0, // Сбрасываем пагинацию
  };

  // Сбрасываем страницу
  ctx.scene.session.reelsPage = 1;

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery(`Сортировка применена: по ${sortField === "views" ? "просмотрам" : "дате"}`);
  }

  // Возвращаемся к списку Reels
  ctx.scene.session.step = ScraperSceneStep.REELS_LIST;
  ctx.scene.reenter();
}

reelsScene.action(/reels_sort_(\d+)_(.+)(?:_(.+)_(.+))?/, handleReelsSortAction);

// Обработчик для сброса фильтров
export async function handleReelsFilterResetAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] handleReelsFilterResetAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);
  const sourceType = match[2] as "competitor" | "hashtag" | undefined;
  const sourceId = match[3];

  if (isNaN(projectId)) {
    logger.warn("[ReelsScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  if (sourceType) ctx.scene.session.currentSourceType = sourceType;
  if (sourceId) ctx.scene.session.currentSourceId = sourceId;

  // Сбрасываем фильтр
  ctx.scene.session.reelsFilter = {
    projectId,
    limit: ctx.scene.session.reelsPerPage,
    offset: 0,
    orderBy: "published_at",
    orderDirection: "DESC",
  };

  // Если указан тип и ID источника, добавляем их в фильтр
  if (sourceType && sourceId) {
    ctx.scene.session.reelsFilter.sourceType = sourceType;
    ctx.scene.session.reelsFilter.sourceId = sourceId;
  }

  // Сбрасываем страницу
  ctx.scene.session.reelsPage = 1;

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery("Фильтры сброшены");
  }

  // Возвращаемся к списку Reels
  ctx.scene.session.step = ScraperSceneStep.REELS_LIST;
  ctx.scene.reenter();
}

// Обработчик для аналитики Reels
export async function handleReelsAnalyticsAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] handleReelsAnalyticsAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[ReelsScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.step = ScraperSceneStep.REELS_ANALYTICS;

  try {
    await ctx.storage.initialize();

    // Получаем информацию о проекте
    const project = await ctx.storage.getProjectById(projectId);

    if (!project) {
      logger.error(`[ReelsScene] Project with ID ${projectId} not found`);
      await ctx.reply(
        "Проект не найден. Возможно, он был удален."
      );
      ctx.scene.enter("instagram_scraper_projects");
      return;
    }

    // Формируем фильтр для получения всех Reels проекта
    const filter: ReelsFilter = {
      projectId,
    };

    // Если указан тип и ID источника, добавляем их в фильтр
    if (ctx.scene.session.currentSourceType && ctx.scene.session.currentSourceId) {
      filter.sourceType = ctx.scene.session.currentSourceType;
      filter.sourceId = ctx.scene.session.currentSourceId;
    }

    // Получаем все Reels проекта
    const reels = await ctx.storage.getReels(filter);

    if (reels.length === 0) {
      await ctx.editMessageText(
        `📊 *Аналитика Reels для проекта "${project.name}"*\n\n⚠️ Нет доступных Reels для анализа. Попробуйте запустить скрапинг.`,
        {
          parse_mode: "Markdown",
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback("▶️ Запустить скрапинг", `scrape_project_${projectId}`)],
            [Markup.button.callback("🔙 К списку Reels", `reels_list_${projectId}`)],
            [Markup.button.callback("🔙 К проекту", `project_${projectId}`)]
          ]).reply_markup
        }
      );

      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
      }

      return;
    }

    // Анализируем данные
    const totalReels = reels.length;
    const totalViews = reels.reduce((sum, reel) => sum + (reel.views || 0), 0);
    const avgViews = totalViews / totalReels;
    const maxViews = Math.max(...reels.map(reel => reel.views || 0));
    const minViews = Math.min(...reels.filter(reel => reel.views !== undefined).map(reel => reel.views || 0));

    // Находим Reel с максимальным количеством просмотров
    const mostViewedReel = reels.find(reel => reel.views === maxViews);

    // Анализируем по дате публикации
    const reelsByDate: { [key: string]: number } = {};
    reels.forEach(reel => {
      const date = new Date(reel.published_at).toLocaleDateString("ru-RU");
      reelsByDate[date] = (reelsByDate[date] || 0) + 1;
    });

    // Находим дату с максимальным количеством публикаций
    let maxDate = "";
    let maxCount = 0;
    for (const [date, count] of Object.entries(reelsByDate)) {
      if (count > maxCount) {
        maxDate = date;
        maxCount = count;
      }
    }

    // Формируем сообщение с аналитикой
    let message = `📊 *Аналитика Reels для проекта "${project.name}"*\n\n`;

    if (ctx.scene.session.currentSourceType && ctx.scene.session.currentSourceId) {
      if (ctx.scene.session.currentSourceType === "competitor") {
        // Получаем информацию о конкуренте
        const competitors = await ctx.storage.getCompetitorAccounts(projectId);
        const competitor = competitors.find(c => c.id === Number(ctx.scene.session.currentSourceId));

        if (competitor) {
          message += `👤 Конкурент: *${competitor.username}*\n\n`;
        }
      } else if (ctx.scene.session.currentSourceType === "hashtag") {
        // Получаем информацию о хештеге
        const hashtags = await ctx.storage.getHashtagsByProjectId(projectId);
        const hashtag = hashtags?.find(h => h.id === Number(ctx.scene.session.currentSourceId));

        if (hashtag) {
          message += `#️⃣ Хештег: *#${hashtag.hashtag}*\n\n`;
        }
      }
    }

    message += `📈 *Общая статистика:*\n`;
    message += `- Всего Reels: *${totalReels}*\n`;
    message += `- Общее количество просмотров: *${formatViews(totalViews)}*\n`;
    message += `- Среднее количество просмотров: *${formatViews(Math.round(avgViews))}*\n`;
    message += `- Максимальное количество просмотров: *${formatViews(maxViews)}*\n`;
    message += `- Минимальное количество просмотров: *${formatViews(minViews)}*\n\n`;

    if (mostViewedReel) {
      message += `🔝 *Самый популярный Reel:*\n`;
      message += `- Просмотры: *${formatViews(mostViewedReel.views)}*\n`;
      message += `- Дата публикации: *${formatDate(mostViewedReel.published_at)}*\n`;
      message += `- Автор: *${mostViewedReel.author_username || "Неизвестно"}*\n`;
      message += `- Описание: ${mostViewedReel.caption ? (mostViewedReel.caption.length > 50 ? mostViewedReel.caption.substring(0, 47) + "..." : mostViewedReel.caption) : "Без описания"}\n\n`;
    }

    message += `📅 *Статистика по датам:*\n`;
    message += `- Дата с наибольшим количеством публикаций: *${maxDate}* (${maxCount} Reels)\n\n`;

    message += `Для просмотра детальной информации о конкретном Reel вернитесь к списку Reels.`;

    // Отправляем сообщение с клавиатурой
    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("📈 Расширенная аналитика", `analytics_enter_${projectId}`)],
        [Markup.button.callback("🔙 К списку Reels", `reels_list_${projectId}`)],
        [Markup.button.callback("🔙 К проекту", `project_${projectId}`)]
      ]).reply_markup
    });

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }
  } catch (error) {
    logger.error("[ReelsScene] Error in handleReelsAnalyticsAction:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке данных. Попробуйте еще раз."
    );
  } finally {
    await ctx.storage.close();
  }
}

// Обработчик для перехода к расширенной аналитике
export async function handleEnterAnalyticsAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] handleEnterAnalyticsAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[ReelsScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }

  ctx.scene.enter("instagram_scraper_analytics", { projectId });
}

// Обработчик для запуска расшифровки Reel
export async function handleTranscribeReelAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] handleTranscribeReelAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);
  const reelId = match[2];

  if (isNaN(projectId) || !reelId) {
    logger.warn("[ReelsScene] Invalid project ID or reel ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверные параметры.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.currentReelId = reelId;
  ctx.scene.session.step = ScraperSceneStep.TRANSCRIBE_REEL;

  try {
    await ctx.storage.initialize();

    // Получаем информацию о Reel
    let reel = null;
    if (ctx.storage.getReelById) {
      reel = await ctx.storage.getReelById(reelId);
    } else {
      // Если метод не реализован, получаем Reel из общего списка
      const reels = await ctx.storage.getReels({ projectId });
      reel = reels.find(r => r.instagram_id === reelId) || null;
    }

    if (!reel) {
      logger.error(`[ReelsScene] Reel with ID ${reelId} not found`);
      await ctx.answerCbQuery("Reel не найден. Возможно, он был удален.");
      ctx.scene.reenter();
      return;
    }

    // Отправляем сообщение о начале расшифровки
    await ctx.reply(
      "🎙️ *Запуск расшифровки видео*\n\nРасшифровка видео может занять некоторое время. Вы получите уведомление, когда процесс будет завершен.",
      { parse_mode: "Markdown" }
    );

    // Обновляем статус расшифровки
    if (ctx.storage.updateReel) {
      await ctx.storage.updateReel(reelId, {
        transcript_status: "pending",
        transcript_updated_at: new Date().toISOString(),
      });
    }

    // Запускаем расшифровку в фоновом режиме
    // Здесь должен быть вызов сервиса расшифровки
    // Например: transcriptService.transcribeReel(reelId);

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery("Расшифровка запущена");
    }

    // Возвращаемся к деталям Reel
    ctx.scene.session.step = ScraperSceneStep.REEL_DETAILS;
    ctx.scene.reenter();
  } catch (error) {
    logger.error("[ReelsScene] Error in handleTranscribeReelAction:", error);
    await ctx.reply(
      "Произошла ошибка при запуске расшифровки. Попробуйте еще раз."
    );
  } finally {
    await ctx.storage.close();
  }
}

// Обработчик для проверки статуса расшифровки
export async function handleCheckTranscriptAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] handleCheckTranscriptAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);
  const reelId = match[2];

  if (isNaN(projectId) || !reelId) {
    logger.warn("[ReelsScene] Invalid project ID or reel ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверные параметры.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.currentReelId = reelId;

  try {
    await ctx.storage.initialize();

    // Получаем информацию о Reel
    let reel = null;
    if (ctx.storage.getReelById) {
      reel = await ctx.storage.getReelById(reelId);
    } else {
      // Если метод не реализован, получаем Reel из общего списка
      const reels = await ctx.storage.getReels({ projectId });
      reel = reels.find(r => r.instagram_id === reelId) || null;
    }

    if (!reel) {
      logger.error(`[ReelsScene] Reel with ID ${reelId} not found`);
      await ctx.answerCbQuery("Reel не найден. Возможно, он был удален.");
      ctx.scene.reenter();
      return;
    }

    // Проверяем статус расшифровки
    const status = reel.transcript_status || "pending";
    let statusMessage = "";

    switch (status) {
      case "pending":
        statusMessage = "Расшифровка в очереди на обработку";
        break;
      case "processing":
        statusMessage = "Расшифровка в процессе";
        break;
      case "completed":
        statusMessage = "Расшифровка завершена";
        break;
      case "failed":
        statusMessage = "Ошибка при расшифровке";
        break;
      default:
        statusMessage = "Статус расшифровки неизвестен";
    }

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(statusMessage);
    }

    // Возвращаемся к деталям Reel
    ctx.scene.reenter();
  } catch (error) {
    logger.error("[ReelsScene] Error in handleCheckTranscriptAction:", error);
    await ctx.reply(
      "Произошла ошибка при проверке статуса расшифровки. Попробуйте еще раз."
    );
  } finally {
    await ctx.storage.close();
  }
}

// Обработчик для просмотра расшифровки
export async function handleViewTranscriptAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] handleViewTranscriptAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);
  const reelId = match[2];

  if (isNaN(projectId) || !reelId) {
    logger.warn("[ReelsScene] Invalid project ID or reel ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверные параметры.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.currentReelId = reelId;
  ctx.scene.session.step = ScraperSceneStep.EDIT_TRANSCRIPT;

  try {
    await ctx.storage.initialize();

    // Получаем информацию о Reel
    let reel = null;
    if (ctx.storage.getReelById) {
      reel = await ctx.storage.getReelById(reelId);
    } else {
      // Если метод не реализован, получаем Reel из общего списка
      const reels = await ctx.storage.getReels({ projectId });
      reel = reels.find(r => r.instagram_id === reelId) || null;
    }

    if (!reel) {
      logger.error(`[ReelsScene] Reel with ID ${reelId} not found`);
      await ctx.answerCbQuery("Reel не найден. Возможно, он был удален.");
      ctx.scene.reenter();
      return;
    }

    // Проверяем наличие расшифровки
    if (!reel.transcript) {
      await ctx.reply(
        "Расшифровка для этого Reel отсутствует. Запустите расшифровку, чтобы получить текст."
      );
      ctx.scene.session.step = ScraperSceneStep.REEL_DETAILS;
      ctx.scene.reenter();
      return;
    }

    // Формируем сообщение с расшифровкой
    let message = `📝 *Расшифровка видео*\n\n`;
    message += reel.transcript;

    // Отправляем сообщение с клавиатурой
    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Назад к Reel", `reel_details_${projectId}_${reelId}`)],
      ])
    });

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }
  } catch (error) {
    logger.error("[ReelsScene] Error in handleViewTranscriptAction:", error);
    await ctx.reply(
      "Произошла ошибка при получении расшифровки. Попробуйте еще раз."
    );
  } finally {
    await ctx.storage.close();
  }
}

// Обработчик для возврата к проекту
export async function handleBackToProjectAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] handleBackToProjectAction triggered");
  console.log("[DEBUG] Обработчик кнопки 'Назад к проекту' вызван");
  console.log("[DEBUG] match:", ctx.match);

  try {
    const match = ctx.match as unknown as RegExpExecArray;
    const projectId = parseInt(match[1], 10);
    console.log(`[DEBUG] Извлеченный projectId: ${projectId}`);

    if (isNaN(projectId)) {
      logger.warn("[ReelsScene] Invalid project ID from action match");
      console.error(`[ERROR] Невалидный projectId: ${match[1]}`);
      if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
      ctx.scene.reenter();
      return;
    }

    if (ctx.callbackQuery) {
      console.log("[DEBUG] Ответ на callback query");
      await ctx.answerCbQuery();
    }

    console.log(`[DEBUG] Переход в сцену проектов с projectId: ${projectId}`);
    ctx.scene.enter("instagram_scraper_projects", { projectId });
  } catch (error) {
    console.error("[ERROR] Критическая ошибка в обработчике кнопки 'Назад к проекту':", error);
    try {
      await ctx.reply("Произошла критическая ошибка. Пожалуйста, попробуйте еще раз.");
      if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка").catch(() => {});
      ctx.scene.reenter();
    } catch (e) {
      console.error("[ERROR] Не удалось отправить сообщение об ошибке:", e);
    }
  }
}

// Регистрация обработчика для возврата к проекту
reelsScene.action(/project_(\d+)/, handleBackToProjectAction);
console.log("[DEBUG] Зарегистрирован обработчик для project_(\\d+)");

// Обработчик для перехода к коллекциям Reels
export async function handleCollectionsAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] handleCollectionsAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[ReelsScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  // Сохраняем ID проекта в сессии
  ctx.scene.session.currentProjectId = projectId;

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }

  // Переходим к сцене коллекций Reels
  ctx.scene.enter("reels_collection_scene");
}

reelsScene.action(/collections_project_(\d+)/, handleCollectionsAction);

// Обработчик для перехода к чат-боту
export async function handleChatWithReelAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[ReelsScene] handleChatWithReelAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);
  const reelId = match[2];

  if (isNaN(projectId) || !reelId) {
    logger.warn("[ReelsScene] Invalid project ID or reel ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверные параметры.");
    ctx.scene.reenter();
    return;
  }

  // Сохраняем ID проекта и Reel в сессии
  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.currentReelId = reelId;

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }

  // Переходим к сцене чат-бота
  ctx.scene.enter("chatbot_scene");
}

// Регистрация обработчиков кнопок с использованием централизованного обработчика
registerButtons(reelsScene, [
  {
    id: /reel_details_(\d+)_(.+)/,
    handler: handleReelDetailsAction,
    errorMessage: "Произошла ошибка при просмотре деталей Reel. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /reels_page_(\d+)_(\d+)(?:_(.+)_(.+))?/,
    handler: handleReelsPageAction,
    errorMessage: "Произошла ошибка при переходе на другую страницу. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /reels_list_(\d+)(?:_(.+)_(.+))?/,
    handler: handleReelsListAction,
    errorMessage: "Произошла ошибка при возврате к списку Reels. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /reels_filter_(\d+)/,
    handler: handleReelsFilterAction,
    errorMessage: "Произошла ошибка при фильтрации Reels. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /reels_filter_views_(\d+)_(\d+)(?:_(.+)_(.+))?/,
    handler: handleReelsFilterViewsAction,
    errorMessage: "Произошла ошибка при фильтрации по просмотрам. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /reels_filter_date_(\d+)_(.+)(?:_(.+)_(.+))?/,
    handler: handleReelsFilterDateAction,
    errorMessage: "Произошла ошибка при фильтрации по дате. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /reels_sort_(\d+)_(.+)_(.+)(?:_(.+)_(.+))?/,
    handler: handleReelsSortAction,
    errorMessage: "Произошла ошибка при сортировке Reels. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /reels_filter_reset_(\d+)(?:_(.+)_(.+))?/,
    handler: handleReelsFilterResetAction,
    errorMessage: "Произошла ошибка при сбросе фильтров. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /reels_analytics_(\d+)/,
    handler: handleReelsAnalyticsAction,
    errorMessage: "Произошла ошибка при просмотре аналитики. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /analytics_enter_(\d+)/,
    handler: handleEnterAnalyticsAction,
    errorMessage: "Произошла ошибка при переходе к расширенной аналитике. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /transcribe_reel_(\d+)_(.+)/,
    handler: handleTranscribeReelAction,
    errorMessage: "Произошла ошибка при запуске расшифровки. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /check_transcript_(\d+)_(.+)/,
    handler: handleCheckTranscriptAction,
    errorMessage: "Произошла ошибка при проверке статуса расшифровки. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /view_transcript_(\d+)_(.+)/,
    handler: handleViewTranscriptAction,
    errorMessage: "Произошла ошибка при просмотре расшифровки. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /project_(\d+)/,
    handler: handleBackToProjectAction,
    errorMessage: "Произошла ошибка при возврате к проекту. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /chat_with_reel_(\d+)_(.+)/,
    handler: handleChatWithReelAction,
    errorMessage: "Произошла ошибка при переходе к чат-боту. Попробуйте еще раз.",
    verbose: true
  }
]);

// Экспортируем сцену
export default reelsScene;
