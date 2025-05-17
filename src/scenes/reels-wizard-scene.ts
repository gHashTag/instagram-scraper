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

/**
 * Очищает состояние сессии перед выходом из сцены
 * @param ctx Контекст Telegraf
 * @param reason Причина очистки состояния (для логирования)
 */
function clearSessionState(ctx: ScraperBotContext, reason: string = "general"): void {
  if (ctx.scene.session) {
    logger.info(`[ReelsWizard] Clearing session state before leaving (reason: ${reason})`);
    ctx.scene.session.reelsFilter = undefined;
    ctx.scene.session.reelsPage = 1;
    ctx.scene.session.currentReelId = undefined;
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
    logger.info(`[ReelsWizard] Transitioning to ${targetScene} scene (reason: ${reason})`);
    await ctx.scene.enter(targetScene);
  } catch (error) {
    logger.error(`[ReelsWizard] Error entering ${targetScene} scene:`, error);
    await ctx.scene.leave();
  }
}

/**
 * Wizard-сцена для просмотра Reels
 */
export const reelsWizardScene = new Scenes.WizardScene<ScraperBotContext>(
  "reels_wizard",

  // Шаг 1: Отображение списка Reels
  async (ctx) => {
    logger.info(`[ReelsWizard] Шаг 1: Отображение списка Reels`);
    logger.debug(`[ReelsWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

    if (!ctx.from) {
      logger.error("[ReelsWizard] ctx.from is undefined");
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
      logger.error("[ReelsWizard] Project ID is undefined");
      await ctx.reply(
        "Не удалось определить проект. Пожалуйста, выберите проект из списка."
      );
      clearSessionState(ctx, "missing_project_id");
      await safeSceneTransition(ctx, "project_wizard", "missing_project_id");
      return;
    }

    // Получаем sourceType и sourceId из параметров или из сессии или из wizard.state
    const state = ctx.scene.state as { sourceType?: "competitor" | "hashtag"; sourceId?: string | number };
    let sourceType = state.sourceType || ctx.scene.session.currentSourceType;
    let sourceId = state.sourceId || ctx.scene.session.currentSourceId;

    if (!sourceType && ctx.wizard.state.sourceType) {
      sourceType = ctx.wizard.state.sourceType;
    }
    if (!sourceId && ctx.wizard.state.sourceId) {
      sourceId = ctx.wizard.state.sourceId;
    }

    // Сохраняем параметры в wizard.state и в сессии
    ctx.wizard.state.projectId = projectId;
    ctx.scene.session.currentProjectId = projectId;
    if (sourceType) {
      ctx.wizard.state.sourceType = sourceType;
      ctx.scene.session.currentSourceType = sourceType;
    }
    if (sourceId) {
      ctx.wizard.state.sourceId = sourceId;
      ctx.scene.session.currentSourceId = sourceId;
    }

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
        logger.error(`[ReelsWizard] Project with ID ${projectId} not found`);
        await ctx.reply(
          "Проект не найден. Возможно, он был удален."
        );
        clearSessionState(ctx, "project_not_found");
        await safeSceneTransition(ctx, "project_wizard", "project_not_found");
        return;
      }

      // Сохраняем имя проекта в wizard.state
      ctx.wizard.state.projectName = project.name;

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
            [Markup.button.callback("▶️ Запустить скрапинг", `scrape_project`)],
            [Markup.button.callback("🔙 Назад к проекту", `back_to_project`)]
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
      logger.error("[ReelsWizard] Error in step 1:", error);
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

  // Шаг 2: Отображение детальной информации о Reel
  async (ctx) => {
    logger.info(`[ReelsWizard] Шаг 2: Отображение детальной информации о Reel`);
    logger.debug(`[ReelsWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

    const { projectId, reelId } = ctx.wizard.state;

    if (!projectId || !reelId) {
      logger.error("[ReelsWizard] Project ID or Reel ID is undefined");
      await ctx.reply("Ошибка: не удалось определить проект или Reel. Начните сначала.");
      clearSessionState(ctx, "missing_ids_step_2");
      return ctx.wizard.selectStep(0);
    }

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
        logger.error(`[ReelsWizard] Reel with ID ${reelId} not found`);
        await ctx.reply("Reel не найден. Возможно, он был удален.");
        return ctx.wizard.selectStep(0);
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
            ctx.wizard.state.sourceType,
            ctx.wizard.state.sourceId
          )
        });
      } else {
        await ctx.reply(message, {
          parse_mode: "Markdown",
          ...createReelDetailsKeyboard(
            reel,
            projectId,
            ctx.wizard.state.sourceType,
            ctx.wizard.state.sourceId
          )
        });
      }
    } catch (error) {
      logger.error("[ReelsWizard] Error in step 2:", error);
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
reelsWizardScene.action("back_to_project", async (ctx) => {
  logger.info(`[ReelsWizard] Обработчик кнопки 'back_to_project' вызван`);
  await ctx.answerCbQuery();

  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "back_to_project_clicked");
  await safeSceneTransition(ctx, "project_wizard", "back_to_project_clicked");
});

reelsWizardScene.action("scrape_project", async (ctx) => {
  logger.info(`[ReelsWizard] Обработчик кнопки 'scrape_project' вызван`);
  await ctx.answerCbQuery();

  const projectId = ctx.wizard.state.projectId;

  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "scrape_project_clicked");
  ctx.scene.session.currentProjectId = projectId;
  await safeSceneTransition(ctx, "scraping_wizard", "scrape_project_clicked");
});

reelsWizardScene.action(/reel_details_(\d+)_(.+)/, async (ctx) => {
  logger.info(`[ReelsWizard] Обработчик кнопки 'reel_details' вызван`);
  await ctx.answerCbQuery();

  const projectId = parseInt(ctx.match[1], 10);
  const reelId = ctx.match[2];

  if (isNaN(projectId) || !reelId) {
    logger.warn("[ReelsWizard] Invalid project ID or reel ID from action match");
    await ctx.reply("Ошибка: неверные параметры.");
    return ctx.wizard.selectStep(0);
  }

  // Сохраняем параметры в wizard.state и в сессии
  ctx.wizard.state.projectId = projectId;
  ctx.wizard.state.reelId = reelId;
  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.currentReelId = reelId;
  ctx.scene.session.step = ScraperSceneStep.REEL_DETAILS;

  // Переходим к шагу отображения детальной информации о Reel
  return ctx.wizard.selectStep(1);
});

reelsWizardScene.action(/reels_page_(\d+)_(\d+)(?:_(.+)_(.+))?/, async (ctx) => {
  logger.info(`[ReelsWizard] Обработчик кнопки 'reels_page' вызван`);
  await ctx.answerCbQuery();

  const projectId = parseInt(ctx.match[1], 10);
  const page = parseInt(ctx.match[2], 10);
  const sourceType = ctx.match[3] as "competitor" | "hashtag" | undefined;
  const sourceId = ctx.match[4];

  if (isNaN(projectId) || isNaN(page)) {
    logger.warn("[ReelsWizard] Invalid project ID or page from action match");
    await ctx.reply("Ошибка: неверные параметры.");
    return ctx.wizard.selectStep(0);
  }

  // Сохраняем параметры в wizard.state и в сессии
  ctx.wizard.state.projectId = projectId;
  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.reelsPage = page;

  if (sourceType) {
    ctx.wizard.state.sourceType = sourceType;
    ctx.scene.session.currentSourceType = sourceType;
  }
  if (sourceId) {
    ctx.wizard.state.sourceId = sourceId;
    ctx.scene.session.currentSourceId = sourceId;
  }

  // Возвращаемся к шагу отображения списка Reels
  return ctx.wizard.selectStep(0);
});

reelsWizardScene.action(/reels_list_(\d+)(?:_(.+)_(.+))?/, async (ctx) => {
  logger.info(`[ReelsWizard] Обработчик кнопки 'reels_list' вызван`);
  await ctx.answerCbQuery();

  const projectId = parseInt(ctx.match[1], 10);
  const sourceType = ctx.match[2] as "competitor" | "hashtag" | undefined;
  const sourceId = ctx.match[3];

  if (isNaN(projectId)) {
    logger.warn("[ReelsWizard] Invalid project ID from action match");
    await ctx.reply("Ошибка: неверный ID проекта.");
    return ctx.wizard.selectStep(0);
  }

  // Сохраняем параметры в wizard.state и в сессии
  ctx.wizard.state.projectId = projectId;
  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.step = ScraperSceneStep.REELS_LIST;

  if (sourceType) {
    ctx.wizard.state.sourceType = sourceType;
    ctx.scene.session.currentSourceType = sourceType;
  }
  if (sourceId) {
    ctx.wizard.state.sourceId = sourceId;
    ctx.scene.session.currentSourceId = sourceId;
  }

  // Возвращаемся к шагу отображения списка Reels
  return ctx.wizard.selectStep(0);
});

// Обработчик для перехода к аналитике
reelsWizardScene.action(/analytics_enter_(\d+)/, async (ctx) => {
  logger.info(`[ReelsWizard] Обработчик кнопки 'analytics_enter' вызван`);
  await ctx.answerCbQuery();

  const projectId = parseInt(ctx.match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[ReelsWizard] Invalid project ID from action match");
    await ctx.reply("Ошибка: неверный ID проекта.");
    return ctx.wizard.selectStep(0);
  }

  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "analytics_enter_clicked");
  ctx.scene.session.currentProjectId = projectId;
  await safeSceneTransition(ctx, "analytics_wizard", "analytics_enter_clicked");
});

// Добавляем обработчик для команды /reels
export function setupReelsWizard(bot: any) {
  bot.command('reels', async (ctx: any) => {
    logger.info("[ReelsWizard] Command /reels triggered");
    await ctx.scene.enter('reels_wizard');
  });

  // Добавляем обработчик для кнопки "Просмотр Reels" в главном меню
  bot.hears('👀 Просмотр Reels', async (ctx: any) => {
    logger.info("[ReelsWizard] Button '👀 Просмотр Reels' clicked");
    await ctx.scene.enter('reels_wizard');
  });
}

export default reelsWizardScene;
