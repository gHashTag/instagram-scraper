import { Scenes, Markup } from "telegraf";
import type { ScraperBotContext } from "../types";
import { ScraperSceneStep } from "../types";
import { logger } from "../logger";
import { ReelsFilter } from "../schemas";
import { formatDate, formatViews } from "./components/reels-keyboard";

/**
 * Очищает состояние сессии перед выходом из сцены
 * @param ctx Контекст Telegraf
 * @param reason Причина очистки состояния (для логирования)
 */
function clearSessionState(ctx: ScraperBotContext, reason: string = "general"): void {
  if (ctx.scene.session) {
    logger.info(`[AnalyticsWizard] Clearing session state before leaving (reason: ${reason})`);
    // Очистка всех необходимых полей состояния
    ctx.scene.session.textReport = undefined;
    ctx.scene.session.csvReport = undefined;
    ctx.scene.session.currentProjectId = undefined;
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
  targetScene: string = "project_wizard",
  reason: string = "general"
): Promise<void> {
  try {
    logger.info(`[AnalyticsWizard] Transitioning to ${targetScene} scene (reason: ${reason})`);
    await ctx.scene.enter(targetScene);
  } catch (error) {
    logger.error(`[AnalyticsWizard] Error entering ${targetScene} scene:`, error);
    await ctx.scene.leave();
  }
}

/**
 * Wizard-сцена для аналитики Reels
 */
export const analyticsWizardScene = new Scenes.WizardScene<ScraperBotContext>(
  "analytics_wizard",

  // Шаг 1: Отображение меню аналитики
  async (ctx) => {
    logger.info(`[AnalyticsWizard] Шаг 1: Отображение меню аналитики`);
    logger.debug(`[AnalyticsWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

    if (!ctx.from) {
      logger.error("[AnalyticsWizard] ctx.from is undefined");
      await ctx.reply(
        "Не удалось определить пользователя. Попробуйте перезапустить бота командой /start."
      );
      clearSessionState(ctx, "missing_user");
      return ctx.scene.leave();
    }

    // Получаем projectId из параметров или из сессии или из wizard.state
    let projectId = ctx.scene.session.currentProjectId;
    if (!projectId && ctx.wizard.state.projectId) {
      projectId = ctx.wizard.state.projectId;
    }

    if (!projectId) {
      logger.error("[AnalyticsWizard] Project ID is undefined");
      await ctx.reply(
        "Не удалось определить проект. Пожалуйста, выберите проект из списка."
      );
      clearSessionState(ctx, "missing_project_id");
      await safeSceneTransition(ctx, "project_wizard", "missing_project_id");
      return;
    }

    // Сохраняем параметры в wizard.state и в сессии
    ctx.wizard.state.projectId = projectId;
    ctx.scene.session.currentProjectId = projectId;

    // Устанавливаем шаг сцены
    ctx.scene.session.step = ScraperSceneStep.REELS_ANALYTICS;

    try {
      await ctx.storage.initialize();

      // Получаем информацию о проекте
      const project = await ctx.storage.getProjectById(projectId);

      if (!project) {
        logger.error(`[AnalyticsWizard] Project with ID ${projectId} not found`);
        await ctx.reply(
          "Проект не найден. Возможно, он был удален."
        );
        clearSessionState(ctx, "project_not_found");
        await safeSceneTransition(ctx, "project_wizard", "project_not_found");
        return;
      }

      // Сохраняем имя проекта в wizard.state
      ctx.wizard.state.projectName = project.name;

      // Формируем сообщение с меню аналитики
      let message = `📊 *Аналитика для проекта "${project.name}"*\n\n`;
      message += "Выберите тип аналитики:";

      // Отправляем сообщение с клавиатурой
      await ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("📈 Популярность контента", `analytics_popularity`)],
          [Markup.button.callback("🔍 Эффективность хештегов", `analytics_hashtags`)],
          [Markup.button.callback("📊 Тренды", `analytics_trends`)],
          [Markup.button.callback("💡 Рекомендации", `analytics_recommendations`)],
          [Markup.button.callback("📄 Экспорт отчета", `analytics_export`)],
          [Markup.button.callback("🔙 К списку Reels", `back_to_reels`)],
          [Markup.button.callback("🔙 К проекту", `back_to_project`)]
        ])
      });
    } catch (error) {
      logger.error("[AnalyticsWizard] Error in step 1:", error);
      await ctx.reply(
        "Произошла ошибка при загрузке данных. Попробуйте еще раз."
      );
      clearSessionState(ctx, "data_loading_error");
      await safeSceneTransition(ctx, "project_wizard", "data_loading_error");
    } finally {
      await ctx.storage.close();
    }

    // Остаемся на текущем шаге
    return;
  },

  // Шаг 2: Отображение анализа популярности контента
  async (ctx) => {
    logger.info(`[AnalyticsWizard] Шаг 2: Отображение анализа популярности контента`);
    logger.debug(`[AnalyticsWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

    const { projectId, projectName } = ctx.wizard.state;

    if (!projectId || !projectName) {
      logger.error("[AnalyticsWizard] Project ID or Project Name is undefined");
      await ctx.reply("Ошибка: не удалось определить проект. Начните сначала.");
      clearSessionState(ctx, "missing_ids_step_2");
      return ctx.wizard.selectStep(0);
    }

    try {
      await ctx.storage.initialize();

      // Получаем все Reels проекта
      const reels = await ctx.storage.getReels({ projectId });

      if (reels.length === 0) {
        await ctx.reply(
          `📊 *Анализ популярности контента для проекта "${projectName}"*\n\n⚠️ Нет доступных Reels для анализа. Попробуйте запустить скрапинг.`,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [Markup.button.callback("▶️ Запустить скрапинг", `scrape_project`)],
              [Markup.button.callback("🔙 К меню аналитики", `back_to_menu`)],
              [Markup.button.callback("🔙 К проекту", `back_to_project`)]
            ])
          }
        );
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
      let message = `📊 *Анализ популярности контента для проекта "${projectName}"*\n\n`;

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
          [Markup.button.callback("🔙 К меню аналитики", `back_to_menu`)],
          [Markup.button.callback("🔙 К списку Reels", `back_to_reels`)],
          [Markup.button.callback("🔙 К проекту", `back_to_project`)]
        ])
      });
    } catch (error) {
      logger.error("[AnalyticsWizard] Error in step 2:", error);
      await ctx.reply(
        "Произошла ошибка при загрузке данных. Попробуйте еще раз."
      );
      return ctx.wizard.selectStep(0);
    } finally {
      await ctx.storage.close();
    }

    // Остаемся на текущем шаге
    return;
  }
);

// Регистрируем обработчики кнопок на уровне сцены
analyticsWizardScene.action("back_to_project", async (ctx) => {
  logger.info(`[AnalyticsWizard] Обработчик кнопки 'back_to_project' вызван`);
  await ctx.answerCbQuery();

  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "back_to_project_clicked");
  await safeSceneTransition(ctx, "project_wizard", "back_to_project_clicked");
});

analyticsWizardScene.action("back_to_reels", async (ctx) => {
  logger.info(`[AnalyticsWizard] Обработчик кнопки 'back_to_reels' вызван`);
  await ctx.answerCbQuery();

  const projectId = ctx.wizard.state.projectId;

  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "back_to_reels_clicked");
  ctx.scene.session.currentProjectId = projectId;
  await safeSceneTransition(ctx, "reels_wizard", "back_to_reels_clicked");
});

analyticsWizardScene.action("back_to_menu", async (ctx) => {
  logger.info(`[AnalyticsWizard] Обработчик кнопки 'back_to_menu' вызван`);
  await ctx.answerCbQuery();

  // Возвращаемся к меню аналитики (шаг 1)
  return ctx.wizard.selectStep(0);
});

analyticsWizardScene.action("analytics_popularity", async (ctx) => {
  logger.info(`[AnalyticsWizard] Обработчик кнопки 'analytics_popularity' вызван`);
  await ctx.answerCbQuery();

  // Переходим к шагу анализа популярности контента
  return ctx.wizard.selectStep(1);
});

analyticsWizardScene.action("scrape_project", async (ctx) => {
  logger.info(`[AnalyticsWizard] Обработчик кнопки 'scrape_project' вызван`);
  await ctx.answerCbQuery();

  const projectId = ctx.wizard.state.projectId;

  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "scrape_project_clicked");
  ctx.scene.session.currentProjectId = projectId;
  await safeSceneTransition(ctx, "scraping_wizard", "scrape_project_clicked");
});

// Добавляем обработчик для команды /analytics
export function setupAnalyticsWizard(bot: any) {
  bot.command('analytics', async (ctx: any) => {
    logger.info("[AnalyticsWizard] Command /analytics triggered");
    await ctx.scene.enter('analytics_wizard');
  });

  // Добавляем обработчик для кнопки "Аналитика" в главном меню
  bot.hears('📈 Аналитика', async (ctx: any) => {
    logger.info("[AnalyticsWizard] Button '📈 Аналитика' clicked");
    await ctx.scene.enter('analytics_wizard');
  });
}

export default analyticsWizardScene;
