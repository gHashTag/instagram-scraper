import { Telegraf } from "telegraf";
import { logger } from "../logger";
import { StorageAdapter } from "../types";
import { ReelContent, NotificationSettings } from "../schemas";

/**
 * Сервис для отправки уведомлений пользователям
 */
export class NotificationService {
  private bot: Telegraf;
  private storage: StorageAdapter;

  /**
   * Создает экземпляр сервиса уведомлений
   * @param bot Экземпляр Telegraf бота
   * @param storage Адаптер хранилища данных
   */
  constructor(bot: Telegraf, storage: StorageAdapter) {
    this.bot = bot;
    this.storage = storage;
  }

  /**
   * Отправляет уведомление о новых Reels
   * @param userId ID пользователя
   * @param projectId ID проекта
   * @param newReels Массив новых Reels
   */
  async sendNewReelsNotification(
    userId: number,
    projectId: number,
    newReels: ReelContent[]
  ): Promise<void> {
    try {
      // Получаем настройки уведомлений пользователя
      await this.storage.initialize();
      const settings = await this.storage.getNotificationSettings(userId);
      
      // Проверяем, включены ли уведомления о новых Reels
      if (!settings || !settings.new_reels_enabled) {
        logger.info(`[NotificationService] Уведомления о новых Reels отключены для пользователя ${userId}`);
        await this.storage.close();
        return;
      }

      // Получаем информацию о проекте
      const project = await this.storage.getProjectById(projectId);
      if (!project) {
        logger.error(`[NotificationService] Проект с ID ${projectId} не найден`);
        await this.storage.close();
        return;
      }

      // Получаем информацию о пользователе
      const user = await this.storage.getUserById(userId);
      if (!user) {
        logger.error(`[NotificationService] Пользователь с ID ${userId} не найден`);
        await this.storage.close();
        return;
      }

      // Формируем сообщение
      let message = `🔔 *Новые Reels для проекта "${project.name}"*\n\n`;
      message += `Найдено ${newReels.length} новых Reels:\n\n`;

      // Добавляем информацию о первых 5 Reels
      const reelsToShow = newReels.slice(0, 5);
      reelsToShow.forEach((reel, index) => {
        message += `${index + 1}. *${reel.author_username || "Неизвестный автор"}*\n`;
        message += `   👁️ Просмотры: ${reel.views || "Н/Д"}\n`;
        message += `   📅 Дата: ${new Date(reel.published_at).toLocaleDateString("ru-RU")}\n`;
        if (reel.caption) {
          const shortCaption = reel.caption.length > 50 
            ? reel.caption.substring(0, 47) + "..." 
            : reel.caption;
          message += `   📝 Описание: ${shortCaption}\n`;
        }
        message += `   🔗 [Ссылка](${reel.url})\n\n`;
      });

      // Если Reels больше 5, добавляем сообщение о том, что есть еще
      if (newReels.length > 5) {
        message += `... и еще ${newReels.length - 5} Reels. Просмотрите их в разделе "Просмотр Reels".\n\n`;
      }

      // Добавляем кнопку для перехода к просмотру Reels
      message += `Для просмотра всех Reels перейдите в раздел "Просмотр Reels" или используйте команду /reels.`;

      // Отправляем сообщение пользователю
      await this.bot.telegram.sendMessage(user.telegram_id, message, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });

      logger.info(`[NotificationService] Отправлено уведомление о ${newReels.length} новых Reels пользователю ${userId}`);
    } catch (error) {
      logger.error(`[NotificationService] Ошибка при отправке уведомления о новых Reels:`, error);
    } finally {
      await this.storage.close();
    }
  }

  /**
   * Отправляет уведомление о новых трендах
   * @param userId ID пользователя
   * @param projectId ID проекта
   * @param trendData Данные о трендах
   */
  async sendTrendNotification(
    userId: number,
    projectId: number,
    trendData: {
      trendType: string;
      description: string;
      value: string | number;
      changePercent: number;
    }
  ): Promise<void> {
    try {
      // Получаем настройки уведомлений пользователя
      await this.storage.initialize();
      const settings = await this.storage.getNotificationSettings(userId);
      
      // Проверяем, включены ли уведомления о трендах
      if (!settings || !settings.trends_enabled) {
        logger.info(`[NotificationService] Уведомления о трендах отключены для пользователя ${userId}`);
        await this.storage.close();
        return;
      }

      // Получаем информацию о проекте
      const project = await this.storage.getProjectById(projectId);
      if (!project) {
        logger.error(`[NotificationService] Проект с ID ${projectId} не найден`);
        await this.storage.close();
        return;
      }

      // Получаем информацию о пользователе
      const user = await this.storage.getUserById(userId);
      if (!user) {
        logger.error(`[NotificationService] Пользователь с ID ${userId} не найден`);
        await this.storage.close();
        return;
      }

      // Определяем эмодзи для тренда
      let trendEmoji = "📊";
      if (trendData.changePercent > 0) {
        trendEmoji = "📈";
      } else if (trendData.changePercent < 0) {
        trendEmoji = "📉";
      }

      // Формируем сообщение
      let message = `${trendEmoji} *Обнаружен новый тренд для проекта "${project.name}"*\n\n`;
      message += `*Тип тренда:* ${trendData.trendType}\n`;
      message += `*Описание:* ${trendData.description}\n`;
      message += `*Значение:* ${trendData.value}\n`;
      message += `*Изменение:* ${trendData.changePercent > 0 ? "+" : ""}${trendData.changePercent.toFixed(2)}%\n\n`;
      message += `Для просмотра подробной аналитики перейдите в раздел "Аналитика" или используйте команду /analytics.`;

      // Отправляем сообщение пользователю
      await this.bot.telegram.sendMessage(user.telegram_id, message, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });

      logger.info(`[NotificationService] Отправлено уведомление о тренде пользователю ${userId}`);
    } catch (error) {
      logger.error(`[NotificationService] Ошибка при отправке уведомления о тренде:`, error);
    } finally {
      await this.storage.close();
    }
  }

  /**
   * Отправляет еженедельный отчет
   * @param userId ID пользователя
   * @param projectId ID проекта
   */
  async sendWeeklyReport(userId: number, projectId: number): Promise<void> {
    try {
      // Получаем настройки уведомлений пользователя
      await this.storage.initialize();
      const settings = await this.storage.getNotificationSettings(userId);
      
      // Проверяем, включены ли еженедельные отчеты
      if (!settings || !settings.weekly_report_enabled) {
        logger.info(`[NotificationService] Еженедельные отчеты отключены для пользователя ${userId}`);
        await this.storage.close();
        return;
      }

      // Получаем информацию о проекте
      const project = await this.storage.getProjectById(projectId);
      if (!project) {
        logger.error(`[NotificationService] Проект с ID ${projectId} не найден`);
        await this.storage.close();
        return;
      }

      // Получаем информацию о пользователе
      const user = await this.storage.getUserById(userId);
      if (!user) {
        logger.error(`[NotificationService] Пользователь с ID ${userId} не найден`);
        await this.storage.close();
        return;
      }

      // Получаем данные за последнюю неделю
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const reels = await this.storage.getReels({
        projectId,
        afterDate: oneWeekAgo.toISOString(),
      });

      // Формируем сообщение
      let message = `📊 *Еженедельный отчет для проекта "${project.name}"*\n\n`;
      
      if (reels.length === 0) {
        message += "За последнюю неделю не было добавлено новых Reels.\n\n";
      } else {
        // Статистика по новым Reels
        message += `*Новые Reels:* ${reels.length}\n\n`;
        
        // Статистика по просмотрам
        const totalViews = reels.reduce((sum, reel) => sum + (reel.views || 0), 0);
        const avgViews = totalViews / reels.length;
        message += `*Общее количество просмотров:* ${totalViews}\n`;
        message += `*Среднее количество просмотров:* ${Math.round(avgViews)}\n\n`;
        
        // Топ-3 Reels по просмотрам
        const topReels = [...reels].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 3);
        message += `*Топ-3 Reels по просмотрам:*\n`;
        topReels.forEach((reel, index) => {
          message += `${index + 1}. *${reel.author_username || "Неизвестный автор"}*\n`;
          message += `   👁️ Просмотры: ${reel.views || "Н/Д"}\n`;
          message += `   📅 Дата: ${new Date(reel.published_at).toLocaleDateString("ru-RU")}\n`;
          message += `   🔗 [Ссылка](${reel.url})\n\n`;
        });
      }
      
      message += `Для просмотра подробной аналитики перейдите в раздел "Аналитика" или используйте команду /analytics.`;

      // Отправляем сообщение пользователю
      await this.bot.telegram.sendMessage(user.telegram_id, message, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });

      logger.info(`[NotificationService] Отправлен еженедельный отчет пользователю ${userId}`);
    } catch (error) {
      logger.error(`[NotificationService] Ошибка при отправке еженедельного отчета:`, error);
    } finally {
      await this.storage.close();
    }
  }
}
