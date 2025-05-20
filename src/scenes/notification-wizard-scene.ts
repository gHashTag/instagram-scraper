import { Scenes, Markup } from "telegraf";
import type { ScraperBotContext } from "../types";
import { ScraperSceneStep } from "../types";
import { logger } from "../logger";
import { NotificationSettings } from "../schemas";

/**
 * Очищает состояние сессии перед выходом из сцены
 * @param ctx Контекст Telegraf
 * @param reason Причина очистки состояния (для логирования)
 */
function clearSessionState(ctx: ScraperBotContext, reason: string = "general"): void {
  if (ctx.scene.session) {
    logger.info(`[NotificationWizard] Clearing session state before leaving (reason: ${reason})`);
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
  targetScene: string = "project_wizard",
  reason: string = "general"
): Promise<void> {
  try {
    logger.info(`[NotificationWizard] Transitioning to ${targetScene} scene (reason: ${reason})`);
    await ctx.scene.enter(targetScene);
  } catch (error) {
    logger.error(`[NotificationWizard] Error entering ${targetScene} scene:`, error);
    await ctx.scene.leave();
  }
}

/**
 * Форматирует дни недели для отображения
 * @param days Массив дней недели (1-7, где 1 - понедельник)
 * @returns Отформатированная строка с днями недели
 */
function formatDays(days: number[]): string {
  const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  if (days.length === 7) {
    return "Ежедневно";
  }

  if (days.length === 5 && days.includes(1) && days.includes(2) && days.includes(3) && days.includes(4) && days.includes(5)) {
    return "По будням";
  }

  if (days.length === 2 && days.includes(6) && days.includes(7)) {
    return "По выходным";
  }

  return days.map(day => dayNames[day - 1]).join(", ");
}

/**
 * Wizard-сцена для управления уведомлениями
 */
export const notificationWizardScene = new Scenes.WizardScene<ScraperBotContext>(
  "notification_wizard",

  // Шаг 1: Отображение настроек уведомлений
  async (ctx) => {
    logger.info(`[NotificationWizard] Шаг 1: Отображение настроек уведомлений`);
    logger.debug(`[NotificationWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

    if (!ctx.from) {
      logger.error("[NotificationWizard] ctx.from is undefined");
      await ctx.reply(
        "Не удалось определить пользователя. Попробуйте перезапустить бота командой /start."
      );
      clearSessionState(ctx, "missing_user");
      return ctx.scene.leave();
    }

    try {
      await ctx.storage.initialize();

      // Получаем пользователя
      const user = await ctx.storage.getUserByTelegramId(ctx.from.id);

      if (!user) {
        logger.error(`[NotificationWizard] User not found for telegram_id: ${ctx.from.id}`);
        await ctx.reply(
          "Вы не зарегистрированы. Пожалуйста, используйте /start для начала работы."
        );
        clearSessionState(ctx, "user_not_found");
        return ctx.scene.leave();
      }

      // Получаем настройки уведомлений пользователя
      let settings = await ctx.storage.getNotificationSettings(user.id);

      // Если настройки не найдены, создаем настройки по умолчанию
      if (!settings) {
        logger.info(`[NotificationWizard] Creating default notification settings for user ${user.id}`);
        settings = await ctx.storage.saveNotificationSettings({
          user_id: user.id,
          new_reels_enabled: true,
          trends_enabled: true,
          weekly_report_enabled: true,
          min_views_threshold: 1000,
          notification_time: "09:00",
          notification_days: [1, 2, 3, 4, 5, 6, 7],
        });
      }

      // Сохраняем настройки в wizard.state
      ctx.wizard.state.settings = settings;
      ctx.wizard.state.userId = user.id;

      // Устанавливаем шаг сцены
      ctx.scene.session.step = ScraperSceneStep.NOTIFICATION_SETTINGS;

      // Формируем сообщение с текущими настройками
      let message = `📢 *Настройки уведомлений*\n\n`;
      message += `🎬 Уведомления о новых Reels: ${settings.new_reels_enabled ? "✅ Включены" : "❌ Отключены"}\n`;
      message += `📈 Уведомления о трендах: ${settings.trends_enabled ? "✅ Включены" : "❌ Отключены"}\n`;
      message += `📊 Еженедельные отчеты: ${settings.weekly_report_enabled ? "✅ Включены" : "❌ Отключены"}\n\n`;
      message += `👁️ Минимальное количество просмотров для уведомлений: ${settings.min_views_threshold}\n`;
      message += `⏰ Время отправки уведомлений: ${settings.notification_time}\n`;
      message += `📅 Дни отправки уведомлений: ${formatDays(settings.notification_days)}\n\n`;
      message += `Выберите настройку, которую хотите изменить:`;

      // Создаем клавиатуру для управления настройками
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            `${settings.new_reels_enabled ? "🔕 Отключить" : "🔔 Включить"} уведомления о новых Reels`,
            `toggle_new_reels_${settings.new_reels_enabled ? "off" : "on"}`
          ),
        ],
        [
          Markup.button.callback(
            `${settings.trends_enabled ? "🔕 Отключить" : "🔔 Включить"} уведомления о трендах`,
            `toggle_trends_${settings.trends_enabled ? "off" : "on"}`
          ),
        ],
        [
          Markup.button.callback(
            `${settings.weekly_report_enabled ? "🔕 Отключить" : "🔔 Включить"} еженедельные отчеты`,
            `toggle_weekly_report_${settings.weekly_report_enabled ? "off" : "on"}`
          ),
        ],
        [
          Markup.button.callback(
            "👁️ Изменить порог просмотров",
            "change_views_threshold"
          ),
        ],
        [
          Markup.button.callback(
            "⏰ Изменить время уведомлений",
            "change_notification_time"
          ),
        ],
        [
          Markup.button.callback(
            "📅 Изменить дни уведомлений",
            "change_notification_days"
          ),
        ],
        [Markup.button.callback("🔙 Назад", "back_to_menu")],
      ]);

      // Отправляем сообщение с клавиатурой
      await ctx.reply(message, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      logger.error("[NotificationWizard] Error in step 1:", error);
      await ctx.reply(
        "Произошла ошибка при загрузке настроек уведомлений. Попробуйте еще раз."
      );
      clearSessionState(ctx, "error_loading_settings");
      return ctx.scene.leave();
    } finally {
      await ctx.storage.close();
    }

    // Остаемся на текущем шаге
    return;
  },

  // Шаг 2: Изменение порога просмотров
  async (ctx) => {
    logger.info(`[NotificationWizard] Шаг 2: Изменение порога просмотров`);
    logger.debug(`[NotificationWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

    // Проверяем, есть ли текст сообщения
    if (ctx.message && 'text' in ctx.message) {
      const threshold = parseInt(ctx.message.text.trim(), 10);

      if (isNaN(threshold) || threshold < 0) {
        await ctx.reply(
          "Пожалуйста, введите корректное число (положительное целое число):"
        );
        return;
      }

      const userId = ctx.wizard.state.userId;

      if (!userId) {
        logger.error("[NotificationWizard] User ID is undefined in step 2");
        await ctx.reply("Ошибка: не удалось определить пользователя. Начните сначала.");
        clearSessionState(ctx, "missing_user_id_step_2");
        return ctx.wizard.selectStep(0);
      }

      try {
        await ctx.storage.initialize();

        // Обновляем настройки
        await ctx.storage.updateNotificationSettings(userId, {
          min_views_threshold: threshold,
        });

        await ctx.reply(`Порог просмотров успешно изменен на ${threshold}.`);

        // Возвращаемся к шагу отображения настроек
        return ctx.wizard.selectStep(0);
      } catch (error) {
        logger.error("[NotificationWizard] Error updating views threshold:", error);
        await ctx.reply(
          "Произошла ошибка при обновлении порога просмотров. Попробуйте еще раз."
        );
        return ctx.wizard.selectStep(0);
      } finally {
        await ctx.storage.close();
      }
    } else {
      await ctx.reply(
        "Введите минимальное количество просмотров для уведомлений (например, 1000):"
      );
    }

    // Остаемся на текущем шаге
    return;
  },

  // Шаг 3: Изменение времени уведомлений
  async (ctx) => {
    logger.info(`[NotificationWizard] Шаг 3: Изменение времени уведомлений`);
    logger.debug(`[NotificationWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

    // Проверяем, есть ли текст сообщения
    if (ctx.message && 'text' in ctx.message) {
      const timePattern = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
      const time = ctx.message.text.trim();

      if (!timePattern.test(time)) {
        await ctx.reply(
          "Пожалуйста, введите корректное время в формате ЧЧ:ММ (например, 09:00):"
        );
        return;
      }

      const userId = ctx.wizard.state.userId;

      if (!userId) {
        logger.error("[NotificationWizard] User ID is undefined in step 3");
        await ctx.reply("Ошибка: не удалось определить пользователя. Начните сначала.");
        clearSessionState(ctx, "missing_user_id_step_3");
        return ctx.wizard.selectStep(0);
      }

      try {
        await ctx.storage.initialize();

        // Обновляем настройки
        await ctx.storage.updateNotificationSettings(userId, {
          notification_time: time,
        });

        await ctx.reply(`Время отправки уведомлений успешно изменено на ${time}.`);

        // Возвращаемся к шагу отображения настроек
        return ctx.wizard.selectStep(0);
      } catch (error) {
        logger.error("[NotificationWizard] Error updating notification time:", error);
        await ctx.reply(
          "Произошла ошибка при обновлении времени уведомлений. Попробуйте еще раз."
        );
        return ctx.wizard.selectStep(0);
      } finally {
        await ctx.storage.close();
      }
    } else {
      await ctx.reply(
        "Введите время отправки уведомлений в формате ЧЧ:ММ (например, 09:00):"
      );
    }

    // Остаемся на текущем шаге
    return;
  }
);

// Регистрируем обработчики кнопок на уровне сцены
notificationWizardScene.action("back_to_menu", async (ctx) => {
  logger.info(`[NotificationWizard] Обработчик кнопки 'back_to_menu' вызван`);
  await ctx.answerCbQuery();

  // Очистка состояния и выход из сцены
  clearSessionState(ctx, "back_to_menu_clicked");
  await ctx.scene.leave();

  // Отправляем сообщение с главным меню
  await ctx.reply(
    "Вы вернулись в главное меню. Выберите действие:",
    {
      reply_markup: {
        keyboard: [
          ["📊 Проекты", "🔍 Конкуренты"],
          ["#️⃣ Хэштеги", "🎬 Запустить скрапинг"],
          ["👀 Просмотр Reels", "📈 Аналитика"],
          ["🔔 Уведомления", "ℹ️ Помощь"],
        ],
        resize_keyboard: true,
      },
    }
  );
});

// Обработчик для включения/отключения уведомлений о новых Reels
notificationWizardScene.action(/toggle_new_reels_(on|off)/, async (ctx) => {
  logger.info(`[NotificationWizard] Обработчик кнопки 'toggle_new_reels' вызван`);
  await ctx.answerCbQuery();

  const match = ctx.match as RegExpExecArray;
  const action = match[1]; // "on" или "off"
  const userId = ctx.wizard.state.userId;

  if (!userId) {
    logger.error("[NotificationWizard] User ID is undefined in toggle_new_reels handler");
    await ctx.reply("Ошибка: не удалось определить пользователя. Начните сначала.");
    return ctx.wizard.selectStep(0);
  }

  try {
    await ctx.storage.initialize();

    // Обновляем настройки
    await ctx.storage.updateNotificationSettings(userId, {
      new_reels_enabled: action === "on",
    });

    // Отвечаем на callback query
    await ctx.answerCbQuery(
      `Уведомления о новых Reels ${action === "on" ? "включены" : "отключены"}`
    );

    // Возвращаемся к шагу отображения настроек
    return ctx.wizard.selectStep(0);
  } catch (error) {
    logger.error("[NotificationWizard] Error in toggle_new_reels handler:", error);
    await ctx.reply(
      "Произошла ошибка при обновлении настроек уведомлений. Попробуйте еще раз."
    );
    return ctx.wizard.selectStep(0);
  } finally {
    await ctx.storage.close();
  }
});

// Обработчик для включения/отключения уведомлений о трендах
notificationWizardScene.action(/toggle_trends_(on|off)/, async (ctx) => {
  logger.info(`[NotificationWizard] Обработчик кнопки 'toggle_trends' вызван`);
  await ctx.answerCbQuery();

  const match = ctx.match as RegExpExecArray;
  const action = match[1]; // "on" или "off"
  const userId = ctx.wizard.state.userId;

  if (!userId) {
    logger.error("[NotificationWizard] User ID is undefined in toggle_trends handler");
    await ctx.reply("Ошибка: не удалось определить пользователя. Начните сначала.");
    return ctx.wizard.selectStep(0);
  }

  try {
    await ctx.storage.initialize();

    // Обновляем настройки
    await ctx.storage.updateNotificationSettings(userId, {
      trends_enabled: action === "on",
    });

    // Отвечаем на callback query
    await ctx.answerCbQuery(
      `Уведомления о трендах ${action === "on" ? "включены" : "отключены"}`
    );

    // Возвращаемся к шагу отображения настроек
    return ctx.wizard.selectStep(0);
  } catch (error) {
    logger.error("[NotificationWizard] Error in toggle_trends handler:", error);
    await ctx.reply(
      "Произошла ошибка при обновлении настроек уведомлений. Попробуйте еще раз."
    );
    return ctx.wizard.selectStep(0);
  } finally {
    await ctx.storage.close();
  }
});

// Обработчик для включения/отключения еженедельных отчетов
notificationWizardScene.action(/toggle_weekly_report_(on|off)/, async (ctx) => {
  logger.info(`[NotificationWizard] Обработчик кнопки 'toggle_weekly_report' вызван`);
  await ctx.answerCbQuery();

  const match = ctx.match as RegExpExecArray;
  const action = match[1]; // "on" или "off"
  const userId = ctx.wizard.state.userId;

  if (!userId) {
    logger.error("[NotificationWizard] User ID is undefined in toggle_weekly_report handler");
    await ctx.reply("Ошибка: не удалось определить пользователя. Начните сначала.");
    return ctx.wizard.selectStep(0);
  }

  try {
    await ctx.storage.initialize();

    // Обновляем настройки
    await ctx.storage.updateNotificationSettings(userId, {
      weekly_report_enabled: action === "on",
    });

    // Отвечаем на callback query
    await ctx.answerCbQuery(
      `Еженедельные отчеты ${action === "on" ? "включены" : "отключены"}`
    );

    // Возвращаемся к шагу отображения настроек
    return ctx.wizard.selectStep(0);
  } catch (error) {
    logger.error("[NotificationWizard] Error in toggle_weekly_report handler:", error);
    await ctx.reply(
      "Произошла ошибка при обновлении настроек уведомлений. Попробуйте еще раз."
    );
    return ctx.wizard.selectStep(0);
  } finally {
    await ctx.storage.close();
  }
});

// Обработчик для изменения порога просмотров
notificationWizardScene.action("change_views_threshold", async (ctx) => {
  logger.info(`[NotificationWizard] Обработчик кнопки 'change_views_threshold' вызван`);
  await ctx.answerCbQuery();

  // Переходим к шагу изменения порога просмотров
  return ctx.wizard.selectStep(1);
});

// Обработчик для изменения времени уведомлений
notificationWizardScene.action("change_notification_time", async (ctx) => {
  logger.info(`[NotificationWizard] Обработчик кнопки 'change_notification_time' вызван`);
  await ctx.answerCbQuery();

  // Переходим к шагу изменения времени уведомлений
  return ctx.wizard.selectStep(2);
});

// Добавляем обработчик для команды /notifications
export function setupNotificationWizard(bot: any) {
  bot.command('notifications', async (ctx: any) => {
    logger.info("[NotificationWizard] Command /notifications triggered");
    await ctx.scene.enter('notification_wizard');
  });

  // Добавляем обработчик для кнопки "Уведомления" в главном меню
  bot.hears('🔔 Уведомления', async (ctx: any) => {
    logger.info("[NotificationWizard] Button '🔔 Уведомления' clicked");
    await ctx.scene.enter('notification_wizard');
  });
}

export default notificationWizardScene;
