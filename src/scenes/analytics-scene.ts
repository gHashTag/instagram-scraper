import { Scenes, Markup } from "telegraf";
import type { ScraperBotContext } from "../types";
import { ScraperSceneStep } from "../types";
import { logger } from "../logger";
import { ReelsFilter, ReelContent } from "../schemas";
import { formatDate, formatViews } from "./components/reels-keyboard";
import { registerButtons } from "../utils/button-handler";

/**
 * Очищает состояние сессии перед выходом из сцены
 * @param ctx Контекст Telegraf
 * @param reason Причина очистки состояния (для логирования)
 */
function clearSessionState(ctx: ScraperBotContext, reason: string = "general"): void {
  if (ctx.scene.session) {
    logger.info(`[AnalyticsScene] Clearing session state before leaving (reason: ${reason})`);
    // Очистка всех необходимых полей состояния
    ctx.scene.session.textReport = undefined;
    ctx.scene.session.csvReport = undefined;
    ctx.scene.session.currentProjectId = undefined;
    ctx.scene.session.step = undefined;
  }
}

/**
 * Выполняет безопасный переход в другую сцену с обработкой ошибок
 * @param ctx Контекст Telegraf
 * @param targetScene Целевая сцена
 * @param reason Причина перехода (для логирования)
 * @param state Дополнительные параметры для передачи в целевую сцену
 */
async function safeSceneTransition(
  ctx: ScraperBotContext,
  targetScene: string = "instagram_scraper_projects",
  reason: string = "general",
  state: Record<string, any> = {}
): Promise<void> {
  try {
    logger.info(`[AnalyticsScene] Transitioning to ${targetScene} scene (reason: ${reason})`);
    await ctx.scene.enter(targetScene, state);
  } catch (error) {
    logger.error(`[AnalyticsScene] Error entering ${targetScene} scene:`, error);
    await ctx.scene.leave();
  }
}

/**
 * Сцена для аналитики Reels
 */
export const analyticsScene = new Scenes.BaseScene<ScraperBotContext>(
  "instagram_scraper_analytics"
);

// --- Enter Scene Handler ---
export async function handleAnalyticsEnter(ctx: ScraperBotContext): Promise<void> {
  logger.info("[AnalyticsScene] Enter handler triggered");

  if (!ctx.from) {
    logger.error("[AnalyticsScene] ctx.from is undefined");
    await ctx.reply(
      "Не удалось определить пользователя. Попробуйте перезапустить бота командой /start."
    );

    // Очистка состояния и безопасный переход в другую сцену
    clearSessionState(ctx, "missing_user");
    await safeSceneTransition(ctx, "instagram_scraper_projects", "missing_user");
    return;
  }

  // Получаем projectId из параметров или из сессии
  const state = ctx.scene.state as { projectId?: number };
  const projectId = state.projectId || ctx.scene.session.currentProjectId;

  if (!projectId) {
    logger.error("[AnalyticsScene] Project ID is undefined");
    await ctx.reply(
      "Не удалось определить проект. Пожалуйста, выберите проект из списка."
    );
    ctx.scene.enter("instagram_scraper_projects");
    return;
  }

  // Сохраняем параметры в сессии
  ctx.scene.session.currentProjectId = projectId;

  // Устанавливаем шаг сцены
  ctx.scene.session.step = ScraperSceneStep.REELS_ANALYTICS;

  try {
    await ctx.storage.initialize();

    // Получаем информацию о проекте
    const project = await ctx.storage.getProjectById(projectId);

    if (!project) {
      logger.error(`[AnalyticsScene] Project with ID ${projectId} not found`);
      await ctx.reply(
        "Проект не найден. Возможно, он был удален."
      );
      ctx.scene.enter("instagram_scraper_projects");
      return;
    }

    // Формируем сообщение с меню аналитики
    let message = `📊 *Аналитика для проекта "${project.name}"*\n\n`;
    message += "Выберите тип аналитики:";

    // Отправляем сообщение с клавиатурой
    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("📈 Популярность контента", `analytics_popularity_${projectId}`)],
        [Markup.button.callback("🔍 Эффективность хештегов", `analytics_hashtags_${projectId}`)],
        [Markup.button.callback("📊 Тренды", `analytics_trends_${projectId}`)],
        [Markup.button.callback("💡 Рекомендации", `analytics_recommendations_${projectId}`)],
        [Markup.button.callback("📄 Экспорт отчета", `analytics_export_${projectId}`)],
        [Markup.button.callback("🔙 К списку Reels", `reels_list_${projectId}`)],
        [Markup.button.callback("🔙 К проекту", `project_${projectId}`)],
      ])
    });
  } catch (error) {
    logger.error("[AnalyticsScene] Error in enter handler:", error);
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

analyticsScene.enter(handleAnalyticsEnter);

// --- Action Handlers ---

// Обработчик для анализа популярности контента
export async function handlePopularityAnalyticsAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[AnalyticsScene] handlePopularityAnalyticsAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[AnalyticsScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;

  try {
    await ctx.storage.initialize();

    // Получаем информацию о проекте
    const project = await ctx.storage.getProjectById(projectId);

    if (!project) {
      logger.error(`[AnalyticsScene] Project with ID ${projectId} not found`);
      await ctx.reply(
        "Проект не найден. Возможно, он был удален."
      );
      ctx.scene.enter("instagram_scraper_projects");
      return;
    }

    // Получаем все Reels проекта
    const reels = await ctx.storage.getReels({ projectId });

    if (reels.length === 0) {
      await ctx.reply(
        `📊 *Анализ популярности контента для проекта "${project.name}"*\n\n⚠️ Нет доступных Reels для анализа. Попробуйте запустить скрапинг.`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("▶️ Запустить скрапинг", `scrape_project_${projectId}`)],
            [Markup.button.callback("🔙 К меню аналитики", `analytics_menu_${projectId}`)],
            [Markup.button.callback("🔙 К проекту", `project_${projectId}`)]
          ])
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

    // Анализируем по времени суток
    const reelsByHour: { [key: number]: number } = {};
    reels.forEach(reel => {
      const hour = new Date(reel.published_at).getHours();
      reelsByHour[hour] = (reelsByHour[hour] || 0) + 1;
    });

    // Находим час с максимальным количеством публикаций
    let maxHour = 0;
    let maxHourCount = 0;
    for (const [hour, count] of Object.entries(reelsByHour)) {
      if (count > maxHourCount) {
        maxHour = parseInt(hour);
        maxHourCount = count;
      }
    }

    // Анализируем по длительности
    const reelsWithDuration = reels.filter(reel => reel.duration !== null && reel.duration !== undefined);
    const avgDuration = reelsWithDuration.length > 0
      ? reelsWithDuration.reduce((sum, reel) => sum + (reel.duration || 0), 0) / reelsWithDuration.length
      : 0;

    // Формируем сообщение с аналитикой
    let message = `📊 *Анализ популярности контента для проекта "${project.name}"*\n\n`;

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

    message += `🕒 *Статистика по времени публикации:*\n`;
    message += `- Самое популярное время публикации: *${maxHour}:00* (${maxHourCount} Reels)\n\n`;

    if (avgDuration > 0) {
      message += `⏱️ *Статистика по длительности:*\n`;
      message += `- Средняя длительность Reels: *${Math.round(avgDuration)} сек.*\n\n`;
    }

    message += `Для просмотра детальной информации о конкретном Reel вернитесь к списку Reels.`;

    // Отправляем сообщение с клавиатурой
    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔙 К меню аналитики", `analytics_menu_${projectId}`)],
        [Markup.button.callback("🔙 К списку Reels", `reels_list_${projectId}`)],
        [Markup.button.callback("🔙 К проекту", `project_${projectId}`)]
      ])
    });

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }
  } catch (error) {
    logger.error("[AnalyticsScene] Error in handlePopularityAnalyticsAction:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке данных. Попробуйте еще раз."
    );
  } finally {
    await ctx.storage.close();
  }
}

// Обработчик для возврата к меню аналитики
export async function handleAnalyticsMenuAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[AnalyticsScene] handleAnalyticsMenuAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[AnalyticsScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }

  ctx.scene.reenter();
}

// Обработчик для анализа эффективности хештегов
export async function handleHashtagsAnalyticsAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[AnalyticsScene] handleHashtagsAnalyticsAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[AnalyticsScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;

  try {
    await ctx.storage.initialize();

    // Получаем информацию о проекте
    const project = await ctx.storage.getProjectById(projectId);

    if (!project) {
      logger.error(`[AnalyticsScene] Project with ID ${projectId} not found`);
      await ctx.reply(
        "Проект не найден. Возможно, он был удален."
      );
      ctx.scene.enter("instagram_scraper_projects");
      return;
    }

    // Получаем хештеги проекта
    const hashtags = await ctx.storage.getHashtagsByProjectId(projectId);

    if (hashtags.length === 0) {
      await ctx.reply(
        `📊 *Анализ эффективности хештегов для проекта "${project.name}"*\n\n⚠️ Нет доступных хештегов для анализа. Добавьте хештеги в проект.`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("➕ Добавить хештеги", `hashtags_${projectId}`)],
            [Markup.button.callback("🔙 К меню аналитики", `analytics_menu_${projectId}`)],
            [Markup.button.callback("🔙 К проекту", `project_${projectId}`)]
          ])
        }
      );

      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
      }

      return;
    }

    // Получаем все Reels проекта
    const reels = await ctx.storage.getReels({ projectId });

    if (reels.length === 0) {
      await ctx.reply(
        `📊 *Анализ эффективности хештегов для проекта "${project.name}"*\n\n⚠️ Нет доступных Reels для анализа. Попробуйте запустить скрапинг.`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("▶️ Запустить скрапинг", `scrape_project_${projectId}`)],
            [Markup.button.callback("🔙 К меню аналитики", `analytics_menu_${projectId}`)],
            [Markup.button.callback("🔙 К проекту", `project_${projectId}`)]
          ])
        }
      );

      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
      }

      return;
    }

    // Анализируем данные по хештегам
    const hashtagStats: { [key: string]: { count: number; totalViews: number; avgViews: number } } = {};

    // Группируем Reels по хештегам
    for (const hashtag of hashtags) {
      const hashtagReels = reels.filter(reel =>
        reel.source_type === "hashtag" && reel.source_id === hashtag.id.toString()
      );

      if (hashtagReels.length > 0) {
        const totalViews = hashtagReels.reduce((sum, reel) => sum + (reel.views || 0), 0);
        const avgViews = totalViews / hashtagReels.length;

        hashtagStats[hashtag.tag_name] = {
          count: hashtagReels.length,
          totalViews,
          avgViews
        };
      }
    }

    // Сортируем хештеги по среднему количеству просмотров
    const sortedHashtags = Object.entries(hashtagStats)
      .sort((a, b) => b[1].avgViews - a[1].avgViews);

    // Формируем сообщение с аналитикой
    let message = `📊 *Анализ эффективности хештегов для проекта "${project.name}"*\n\n`;

    if (sortedHashtags.length === 0) {
      message += "⚠️ Нет данных для анализа эффективности хештегов. Убедитесь, что вы запустили скрапинг по хештегам.";
    } else {
      message += `📈 *Эффективность хештегов (по среднему количеству просмотров):*\n\n`;

      sortedHashtags.forEach(([tagName, stats], index) => {
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
        message += `${medal} #${tagName}\n`;
        message += `   - Количество Reels: *${stats.count}*\n`;
        message += `   - Среднее количество просмотров: *${formatViews(Math.round(stats.avgViews))}*\n`;
        message += `   - Общее количество просмотров: *${formatViews(stats.totalViews)}*\n\n`;
      });

      // Добавляем рекомендации
      message += `💡 *Рекомендации:*\n`;
      if (sortedHashtags.length > 0) {
        message += `- Наиболее эффективный хештег: *#${sortedHashtags[0][0]}*\n`;
        message += `- Рекомендуется использовать этот хештег для увеличения охвата.\n\n`;
      }
    }

    // Отправляем сообщение с клавиатурой
    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔙 К меню аналитики", `analytics_menu_${projectId}`)],
        [Markup.button.callback("🔙 К списку Reels", `reels_list_${projectId}`)],
        [Markup.button.callback("🔙 К проекту", `project_${projectId}`)]
      ])
    });

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }
  } catch (error) {
    logger.error("[AnalyticsScene] Error in handleHashtagsAnalyticsAction:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке данных. Попробуйте еще раз."
    );
  } finally {
    await ctx.storage.close();
  }
}

// Обработчик для анализа трендов
export async function handleTrendsAnalyticsAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[AnalyticsScene] handleTrendsAnalyticsAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[AnalyticsScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;

  try {
    await ctx.storage.initialize();

    // Получаем информацию о проекте
    const project = await ctx.storage.getProjectById(projectId);

    if (!project) {
      logger.error(`[AnalyticsScene] Project with ID ${projectId} not found`);
      await ctx.reply(
        "Проект не найден. Возможно, он был удален."
      );
      ctx.scene.enter("instagram_scraper_projects");
      return;
    }

    // Получаем все Reels проекта
    const reels = await ctx.storage.getReels({ projectId });

    if (reels.length === 0) {
      await ctx.reply(
        `📊 *Анализ трендов для проекта "${project.name}"*\n\n⚠️ Нет доступных Reels для анализа. Попробуйте запустить скрапинг.`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("▶️ Запустить скрапинг", `scrape_project_${projectId}`)],
            [Markup.button.callback("🔙 К меню аналитики", `analytics_menu_${projectId}`)],
            [Markup.button.callback("🔙 К проекту", `project_${projectId}`)]
          ])
        }
      );

      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
      }

      return;
    }

    // Сортируем Reels по дате публикации
    const sortedReels = [...reels].sort((a, b) =>
      new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
    );

    // Группируем Reels по неделям
    const weeklyStats: { [key: string]: { count: number; totalViews: number; avgViews: number } } = {};

    sortedReels.forEach(reel => {
      const date = new Date(reel.published_at);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toLocaleDateString("ru-RU");

      if (!weeklyStats[weekKey]) {
        weeklyStats[weekKey] = { count: 0, totalViews: 0, avgViews: 0 };
      }

      weeklyStats[weekKey].count += 1;
      weeklyStats[weekKey].totalViews += (reel.views || 0);
    });

    // Вычисляем средние просмотры для каждой недели
    Object.keys(weeklyStats).forEach(week => {
      weeklyStats[week].avgViews = weeklyStats[week].totalViews / weeklyStats[week].count;
    });

    // Анализируем тренды по музыке
    const musicStats: { [key: string]: number } = {};
    reels.forEach(reel => {
      if (reel.music_title) {
        musicStats[reel.music_title] = (musicStats[reel.music_title] || 0) + 1;
      }
    });

    // Сортируем музыку по популярности
    const sortedMusic = Object.entries(musicStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Формируем сообщение с аналитикой
    let message = `📊 *Анализ трендов для проекта "${project.name}"*\n\n`;

    // Добавляем тренды по неделям
    message += `📈 *Тренды по неделям:*\n\n`;

    const weeks = Object.keys(weeklyStats).sort((a, b) => {
      const dateA = new Date(a.split('.').reverse().join('-'));
      const dateB = new Date(b.split('.').reverse().join('-'));
      return dateA.getTime() - dateB.getTime();
    });

    if (weeks.length > 0) {
      weeks.forEach(week => {
        const stats = weeklyStats[week];
        message += `📅 Неделя с ${week}:\n`;
        message += `   - Количество Reels: *${stats.count}*\n`;
        message += `   - Среднее количество просмотров: *${formatViews(Math.round(stats.avgViews))}*\n\n`;
      });

      // Определяем тренд
      const firstWeekAvg = weeklyStats[weeks[0]].avgViews;
      const lastWeekAvg = weeklyStats[weeks[weeks.length - 1]].avgViews;
      const trend = lastWeekAvg > firstWeekAvg ? "📈 Растущий" : lastWeekAvg < firstWeekAvg ? "📉 Падающий" : "➡️ Стабильный";

      message += `*Общий тренд просмотров: ${trend}*\n\n`;
    } else {
      message += "Недостаточно данных для анализа трендов по неделям.\n\n";
    }

    // Добавляем тренды по музыке
    if (sortedMusic.length > 0) {
      message += `🎵 *Популярная музыка:*\n\n`;
      sortedMusic.forEach(([title, count], index) => {
        message += `${index + 1}. "${title}" - использована в *${count}* Reels\n`;
      });
      message += "\n";
    }

    // Отправляем сообщение с клавиатурой
    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔙 К меню аналитики", `analytics_menu_${projectId}`)],
        [Markup.button.callback("🔙 К списку Reels", `reels_list_${projectId}`)],
        [Markup.button.callback("🔙 К проекту", `project_${projectId}`)]
      ])
    });

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }
  } catch (error) {
    logger.error("[AnalyticsScene] Error in handleTrendsAnalyticsAction:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке данных. Попробуйте еще раз."
    );
  } finally {
    await ctx.storage.close();
  }
}

analyticsScene.action(/analytics_trends_(\d+)/, handleTrendsAnalyticsAction);

// Обработчик для генерации рекомендаций
export async function handleRecommendationsAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[AnalyticsScene] handleRecommendationsAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[AnalyticsScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;

  try {
    await ctx.storage.initialize();

    // Получаем информацию о проекте
    const project = await ctx.storage.getProjectById(projectId);

    if (!project) {
      logger.error(`[AnalyticsScene] Project with ID ${projectId} not found`);
      await ctx.reply(
        "Проект не найден. Возможно, он был удален."
      );
      ctx.scene.enter("instagram_scraper_projects");
      return;
    }

    // Получаем все Reels проекта
    const reels = await ctx.storage.getReels({ projectId });

    if (reels.length === 0) {
      await ctx.reply(
        `💡 *Рекомендации для проекта "${project.name}"*\n\n⚠️ Нет доступных Reels для анализа. Попробуйте запустить скрапинг.`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("▶️ Запустить скрапинг", `scrape_project_${projectId}`)],
            [Markup.button.callback("🔙 К меню аналитики", `analytics_menu_${projectId}`)],
            [Markup.button.callback("🔙 К проекту", `project_${projectId}`)]
          ])
        }
      );

      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
      }

      return;
    }

    // Анализируем данные для генерации рекомендаций

    // 1. Анализ оптимального времени публикации
    const reelsByHour: { [key: number]: { count: number; totalViews: number; avgViews: number } } = {};
    reels.forEach(reel => {
      const hour = new Date(reel.published_at).getHours();
      if (!reelsByHour[hour]) {
        reelsByHour[hour] = { count: 0, totalViews: 0, avgViews: 0 };
      }
      reelsByHour[hour].count += 1;
      reelsByHour[hour].totalViews += (reel.views || 0);
    });

    // Вычисляем средние просмотры для каждого часа
    Object.keys(reelsByHour).forEach(hour => {
      const hourNum = parseInt(hour);
      reelsByHour[hourNum].avgViews = reelsByHour[hourNum].totalViews / reelsByHour[hourNum].count;
    });

    // Сортируем часы по среднему количеству просмотров
    const sortedHours = Object.entries(reelsByHour)
      .sort((a, b) => b[1].avgViews - a[1].avgViews)
      .slice(0, 3);

    // 2. Анализ оптимальной длительности
    const reelsWithDuration = reels.filter(reel => reel.duration !== null && reel.duration !== undefined);

    // Группируем Reels по диапазонам длительности
    const durationRanges: { [key: string]: { count: number; totalViews: number; avgViews: number } } = {
      "0-15": { count: 0, totalViews: 0, avgViews: 0 },
      "16-30": { count: 0, totalViews: 0, avgViews: 0 },
      "31-60": { count: 0, totalViews: 0, avgViews: 0 },
      "60+": { count: 0, totalViews: 0, avgViews: 0 }
    };

    reelsWithDuration.forEach(reel => {
      const duration = reel.duration || 0;
      let range = "60+";

      if (duration <= 15) range = "0-15";
      else if (duration <= 30) range = "16-30";
      else if (duration <= 60) range = "31-60";

      durationRanges[range].count += 1;
      durationRanges[range].totalViews += (reel.views || 0);
    });

    // Вычисляем средние просмотры для каждого диапазона
    Object.keys(durationRanges).forEach(range => {
      if (durationRanges[range].count > 0) {
        durationRanges[range].avgViews = durationRanges[range].totalViews / durationRanges[range].count;
      }
    });

    // Сортируем диапазоны по среднему количеству просмотров
    const sortedDurations = Object.entries(durationRanges)
      .filter(([_, stats]) => stats.count > 0)
      .sort((a, b) => b[1].avgViews - a[1].avgViews);

    // 3. Анализ популярной музыки
    const musicStats: { [key: string]: { count: number; totalViews: number; avgViews: number } } = {};
    reels.forEach(reel => {
      if (reel.music_title) {
        if (!musicStats[reel.music_title]) {
          musicStats[reel.music_title] = { count: 0, totalViews: 0, avgViews: 0 };
        }
        musicStats[reel.music_title].count += 1;
        musicStats[reel.music_title].totalViews += (reel.views || 0);
      }
    });

    // Вычисляем средние просмотры для каждой музыки
    Object.keys(musicStats).forEach(music => {
      musicStats[music].avgViews = musicStats[music].totalViews / musicStats[music].count;
    });

    // Сортируем музыку по среднему количеству просмотров
    const sortedMusic = Object.entries(musicStats)
      .filter(([_, stats]) => stats.count > 1) // Только музыка, использованная более одного раза
      .sort((a, b) => b[1].avgViews - a[1].avgViews)
      .slice(0, 3);

    // Формируем сообщение с рекомендациями
    let message = `💡 *Рекомендации для проекта "${project.name}"*\n\n`;

    // Рекомендации по времени публикации
    message += `⏰ *Оптимальное время публикации:*\n\n`;

    if (sortedHours.length > 0) {
      sortedHours.forEach(([hour, stats], index) => {
        message += `${index + 1}. *${hour}:00 - ${parseInt(hour) + 1}:00*\n`;
        message += `   - Среднее количество просмотров: *${formatViews(Math.round(stats.avgViews))}*\n`;
        message += `   - Количество Reels: *${stats.count}*\n\n`;
      });

      message += `👉 Рекомендуется публиковать Reels в период *${sortedHours[0][0]}:00 - ${parseInt(sortedHours[0][0]) + 1}:00*\n\n`;
    } else {
      message += "Недостаточно данных для анализа оптимального времени публикации.\n\n";
    }

    // Рекомендации по длительности
    message += `⏱️ *Оптимальная длительность Reels:*\n\n`;

    if (sortedDurations.length > 0) {
      sortedDurations.forEach(([range, stats], index) => {
        message += `${index + 1}. *${range} секунд*\n`;
        message += `   - Среднее количество просмотров: *${formatViews(Math.round(stats.avgViews))}*\n`;
        message += `   - Количество Reels: *${stats.count}*\n\n`;
      });

      message += `👉 Рекомендуется создавать Reels длительностью *${sortedDurations[0][0]} секунд*\n\n`;
    } else {
      message += "Недостаточно данных для анализа оптимальной длительности.\n\n";
    }

    // Рекомендации по музыке
    message += `🎵 *Рекомендуемая музыка:*\n\n`;

    if (sortedMusic.length > 0) {
      sortedMusic.forEach(([title, stats], index) => {
        message += `${index + 1}. "${title}"\n`;
        message += `   - Среднее количество просмотров: *${formatViews(Math.round(stats.avgViews))}*\n`;
        message += `   - Использована в *${stats.count}* Reels\n\n`;
      });

      message += `👉 Рекомендуется использовать музыку "${sortedMusic[0][0]}"\n\n`;
    } else {
      message += "Недостаточно данных для анализа популярной музыки.\n\n";
    }

    // Общие рекомендации
    message += `📝 *Общие рекомендации:*\n\n`;
    message += `1. Регулярно публикуйте новый контент\n`;
    message += `2. Используйте популярные хештеги по вашей тематике\n`;
    message += `3. Взаимодействуйте с аудиторией через комментарии\n`;
    message += `4. Следите за трендами и адаптируйте контент\n`;
    message += `5. Экспериментируйте с разными форматами и темами\n\n`;

    message += `Для более детального анализа используйте другие разделы аналитики.`;

    // Отправляем сообщение с клавиатурой
    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔙 К меню аналитики", `analytics_menu_${projectId}`)],
        [Markup.button.callback("🔙 К списку Reels", `reels_list_${projectId}`)],
        [Markup.button.callback("🔙 К проекту", `project_${projectId}`)]
      ])
    });

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }
  } catch (error) {
    logger.error("[AnalyticsScene] Error in handleRecommendationsAction:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке данных. Попробуйте еще раз."
    );
  } finally {
    await ctx.storage.close();
  }
}

// Обработчик для экспорта отчета
export async function handleExportAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[AnalyticsScene] handleExportAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[AnalyticsScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  ctx.scene.session.currentProjectId = projectId;

  try {
    await ctx.storage.initialize();

    // Получаем информацию о проекте
    const project = await ctx.storage.getProjectById(projectId);

    if (!project) {
      logger.error(`[AnalyticsScene] Project with ID ${projectId} not found`);
      await ctx.reply(
        "Проект не найден. Возможно, он был удален."
      );
      ctx.scene.enter("instagram_scraper_projects");
      return;
    }

    // Получаем все Reels проекта
    const reels = await ctx.storage.getReels({ projectId });

    if (reels.length === 0) {
      await ctx.reply(
        `📄 *Экспорт отчета для проекта "${project.name}"*\n\n⚠️ Нет доступных Reels для экспорта. Попробуйте запустить скрапинг.`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("▶️ Запустить скрапинг", `scrape_project_${projectId}`)],
            [Markup.button.callback("🔙 К меню аналитики", `analytics_menu_${projectId}`)],
            [Markup.button.callback("🔙 К проекту", `project_${projectId}`)]
          ])
        }
      );

      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
      }

      return;
    }

    // Формируем CSV-отчет
    let csvContent = "ID,URL,Автор,Дата публикации,Просмотры,Лайки,Комментарии,Длительность,Музыка\n";

    reels.forEach(reel => {
      const row = [
        reel.instagram_id,
        reel.url,
        reel.author_username || "",
        new Date(reel.published_at).toLocaleDateString("ru-RU"),
        reel.views || 0,
        reel.likes || 0,
        reel.comments_count || 0,
        reel.duration || "",
        reel.music_title || ""
      ];

      // Экранируем запятые и кавычки
      const escapedRow = row.map(cell => {
        const cellStr = String(cell);
        return cellStr.includes(",") || cellStr.includes('"')
          ? `"${cellStr.replace(/"/g, '""')}"`
          : cellStr;
      });

      csvContent += escapedRow.join(",") + "\n";
    });

    // Формируем текстовый отчет
    let textReport = `📊 АНАЛИТИЧЕСКИЙ ОТЧЕТ ПО ПРОЕКТУ "${project.name.toUpperCase()}"\n`;
    textReport += `Дата формирования: ${new Date().toLocaleDateString("ru-RU")}\n\n`;

    // Общая статистика
    const totalReels = reels.length;
    const totalViews = reels.reduce((sum, reel) => sum + (reel.views || 0), 0);
    const avgViews = totalViews / totalReels;

    textReport += `ОБЩАЯ СТАТИСТИКА:\n`;
    textReport += `- Всего Reels: ${totalReels}\n`;
    textReport += `- Общее количество просмотров: ${formatViews(totalViews)}\n`;
    textReport += `- Среднее количество просмотров: ${formatViews(Math.round(avgViews))}\n\n`;

    // Топ-5 Reels по просмотрам
    const topReels = [...reels]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5);

    textReport += `ТОП-5 REELS ПО ПРОСМОТРАМ:\n`;
    topReels.forEach((reel, index) => {
      textReport += `${index + 1}. ID: ${reel.instagram_id}\n`;
      textReport += `   Автор: ${reel.author_username || "Неизвестно"}\n`;
      textReport += `   Просмотры: ${formatViews(reel.views || 0)}\n`;
      textReport += `   Дата: ${new Date(reel.published_at).toLocaleDateString("ru-RU")}\n`;
      textReport += `   URL: ${reel.url}\n\n`;
    });

    // Отправляем текстовый отчет
    await ctx.reply(
      `📄 *Экспорт отчета для проекта "${project.name}"*\n\nВыберите формат экспорта:`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("📝 Текстовый отчет", `export_text_${projectId}`)],
          [Markup.button.callback("📊 CSV-отчет", `export_csv_${projectId}`)],
          [Markup.button.callback("🔙 К меню аналитики", `analytics_menu_${projectId}`)],
          [Markup.button.callback("🔙 К проекту", `project_${projectId}`)]
        ])
      }
    );

    // Сохраняем отчеты в сессии для последующего использования
    ctx.scene.session.textReport = textReport;
    ctx.scene.session.csvReport = csvContent;

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }
  } catch (error) {
    logger.error("[AnalyticsScene] Error in handleExportAction:", error);
    await ctx.reply(
      "Произошла ошибка при формировании отчета. Попробуйте еще раз."
    );
  } finally {
    await ctx.storage.close();
  }
}

// Обработчик для экспорта текстового отчета
export async function handleExportTextAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[AnalyticsScene] handleExportTextAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[AnalyticsScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  // Получаем текстовый отчет из сессии
  const textReport = ctx.scene.session.textReport;

  if (!textReport) {
    logger.warn("[AnalyticsScene] Text report not found in session");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: отчет не найден. Попробуйте сформировать отчет заново.");
    ctx.scene.reenter();
    return;
  }

  // Отправляем текстовый отчет
  await ctx.reply(textReport);

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery("Текстовый отчет сформирован");
  }
}

// Обработчик для экспорта CSV-отчета
export async function handleExportCsvAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[AnalyticsScene] handleExportCsvAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[AnalyticsScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  // Получаем CSV-отчет из сессии
  const csvReport = ctx.scene.session.csvReport;

  if (!csvReport) {
    logger.warn("[AnalyticsScene] CSV report not found in session");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: отчет не найден. Попробуйте сформировать отчет заново.");
    ctx.scene.reenter();
    return;
  }

  try {
    // Получаем информацию о проекте
    await ctx.storage.initialize();
    const project = await ctx.storage.getProjectById(projectId);
    await ctx.storage.close();

    const projectName = project ? project.name : `project_${projectId}`;
    const fileName = `reels_report_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

    // Отправляем CSV-файл
    // Преобразуем строку CSV в буфер
    const buffer = Buffer.from(csvReport, 'utf-8');

    await ctx.replyWithDocument({
      source: buffer,
      filename: fileName
    });

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery("CSV-отчет сформирован");
    }
  } catch (error) {
    logger.error("[AnalyticsScene] Error in handleExportCsvAction:", error);
    await ctx.reply(
      "Произошла ошибка при формировании CSV-отчета. Попробуйте еще раз."
    );
  }
}

// Обработчик для возврата к проекту
export async function handleBackToProjectAction(ctx: ScraperBotContext): Promise<void> {
  logger.info("[AnalyticsScene] handleBackToProjectAction triggered");

  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[AnalyticsScene] Invalid project ID from action match");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    ctx.scene.reenter();
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }

  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "back_to_project_clicked");
  await safeSceneTransition(ctx, "instagram_scraper_projects", "back_to_project_clicked", { projectId });
}

// Регистрация обработчиков кнопок с использованием централизованного обработчика
registerButtons(analyticsScene, [
  {
    id: /analytics_popularity_(\d+)/,
    handler: handlePopularityAnalyticsAction,
    errorMessage: "Произошла ошибка при анализе популярности контента. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /analytics_menu_(\d+)/,
    handler: handleAnalyticsMenuAction,
    errorMessage: "Произошла ошибка при возврате к меню аналитики. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /analytics_hashtags_(\d+)/,
    handler: handleHashtagsAnalyticsAction,
    errorMessage: "Произошла ошибка при анализе эффективности хештегов. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /analytics_trends_(\d+)/,
    handler: handleTrendsAnalyticsAction,
    errorMessage: "Произошла ошибка при анализе трендов. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /analytics_recommendations_(\d+)/,
    handler: handleRecommendationsAction,
    errorMessage: "Произошла ошибка при генерации рекомендаций. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /analytics_export_(\d+)/,
    handler: handleExportAction,
    errorMessage: "Произошла ошибка при экспорте отчета. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /export_text_(\d+)/,
    handler: handleExportTextAction,
    errorMessage: "Произошла ошибка при экспорте текстового отчета. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /export_csv_(\d+)/,
    handler: handleExportCsvAction,
    errorMessage: "Произошла ошибка при экспорте CSV-отчета. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /project_(\d+)/,
    handler: handleBackToProjectAction,
    errorMessage: "Произошла ошибка при возврате к проекту. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /reels_list_(\d+)/,
    handler: async (ctx) => {
      const match = ctx.match as unknown as RegExpExecArray;
      const projectId = parseInt(match[1], 10);
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery().catch(() => {});
      }

      // Очистка состояния и безопасный переход в другую сцену
      clearSessionState(ctx, "back_to_reels_list_clicked");
      await safeSceneTransition(ctx, "instagram_scraper_reels", "back_to_reels_list_clicked", { projectId });
    },
    errorMessage: "Произошла ошибка при возврате к списку Reels. Попробуйте еще раз.",
    verbose: true
  }
]);

// Экспортируем сцену
export default analyticsScene;
