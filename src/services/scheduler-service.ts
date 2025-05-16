import { logger } from "../logger";
import { StorageAdapter } from "../types";
import { NotificationService } from "./notification-service";

/**
 * Сервис для планирования задач
 */
export class SchedulerService {
  private storage: StorageAdapter;
  private notificationService: NotificationService;
  private scheduledTasks: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Создает экземпляр сервиса планировщика задач
   * @param storage Адаптер хранилища данных
   * @param notificationService Сервис уведомлений
   */
  constructor(storage: StorageAdapter, notificationService: NotificationService) {
    this.storage = storage;
    this.notificationService = notificationService;
  }

  /**
   * Запускает планировщик задач
   */
  async start(): Promise<void> {
    logger.info("[SchedulerService] Запуск планировщика задач");
    
    // Планируем ежедневную проверку новых Reels
    this.scheduleNewReelsCheck();
    
    // Планируем еженедельные отчеты
    this.scheduleWeeklyReports();
    
    // Планируем анализ трендов
    this.scheduleTrendsAnalysis();
    
    logger.info("[SchedulerService] Планировщик задач запущен");
  }

  /**
   * Останавливает планировщик задач
   */
  stop(): void {
    logger.info("[SchedulerService] Остановка планировщика задач");
    
    // Очищаем все запланированные задачи
    for (const [taskId, timeout] of this.scheduledTasks.entries()) {
      clearTimeout(timeout);
      logger.info(`[SchedulerService] Задача ${taskId} остановлена`);
    }
    
    this.scheduledTasks.clear();
    
    logger.info("[SchedulerService] Планировщик задач остановлен");
  }

  /**
   * Планирует проверку новых Reels
   */
  private scheduleNewReelsCheck(): void {
    const taskId = "new-reels-check";
    
    // Функция для выполнения проверки новых Reels
    const checkNewReels = async () => {
      logger.info("[SchedulerService] Запуск проверки новых Reels");
      
      try {
        await this.storage.initialize();
        
        // Получаем всех активных пользователей
        const users = await this.getAllActiveUsers();
        
        for (const user of users) {
          // Получаем настройки уведомлений пользователя
          const settings = await this.storage.getNotificationSettings(user.id);
          
          // Если уведомления о новых Reels отключены, пропускаем пользователя
          if (!settings || !settings.new_reels_enabled) {
            continue;
          }
          
          // Получаем проекты пользователя
          const projects = await this.storage.getProjectsByUserId(user.id);
          
          for (const project of projects) {
            // Получаем дату последней проверки
            const lastCheckDate = new Date();
            lastCheckDate.setDate(lastCheckDate.getDate() - 1); // Проверяем Reels за последние 24 часа
            
            // Получаем новые Reels
            const newReels = await this.storage.getNewReels(project.id, lastCheckDate.toISOString());
            
            // Если есть новые Reels, отправляем уведомление
            if (newReels.length > 0) {
              await this.notificationService.sendNewReelsNotification(user.id, project.id, newReels);
            }
          }
        }
      } catch (error) {
        logger.error("[SchedulerService] Ошибка при проверке новых Reels:", error);
      } finally {
        await this.storage.close();
        
        // Планируем следующую проверку через 24 часа
        const nextCheck = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
        const timeout = setTimeout(checkNewReels, nextCheck);
        this.scheduledTasks.set(taskId, timeout);
        
        logger.info(`[SchedulerService] Следующая проверка новых Reels запланирована через 24 часа`);
      }
    };
    
    // Запускаем первую проверку через 1 минуту после запуска
    const timeout = setTimeout(checkNewReels, 60 * 1000);
    this.scheduledTasks.set(taskId, timeout);
    
    logger.info(`[SchedulerService] Первая проверка новых Reels запланирована через 1 минуту`);
  }

  /**
   * Планирует отправку еженедельных отчетов
   */
  private scheduleWeeklyReports(): void {
    const taskId = "weekly-reports";
    
    // Функция для отправки еженедельных отчетов
    const sendWeeklyReports = async () => {
      logger.info("[SchedulerService] Запуск отправки еженедельных отчетов");
      
      try {
        await this.storage.initialize();
        
        // Получаем всех активных пользователей
        const users = await this.getAllActiveUsers();
        
        for (const user of users) {
          // Получаем настройки уведомлений пользователя
          const settings = await this.storage.getNotificationSettings(user.id);
          
          // Если еженедельные отчеты отключены, пропускаем пользователя
          if (!settings || !settings.weekly_report_enabled) {
            continue;
          }
          
          // Получаем проекты пользователя
          const projects = await this.storage.getProjectsByUserId(user.id);
          
          for (const project of projects) {
            // Отправляем еженедельный отчет
            await this.notificationService.sendWeeklyReport(user.id, project.id);
          }
        }
      } catch (error) {
        logger.error("[SchedulerService] Ошибка при отправке еженедельных отчетов:", error);
      } finally {
        await this.storage.close();
        
        // Планируем следующую отправку через 7 дней
        const nextSend = 7 * 24 * 60 * 60 * 1000; // 7 дней в миллисекундах
        const timeout = setTimeout(sendWeeklyReports, nextSend);
        this.scheduledTasks.set(taskId, timeout);
        
        logger.info(`[SchedulerService] Следующая отправка еженедельных отчетов запланирована через 7 дней`);
      }
    };
    
    // Запускаем первую отправку через 2 минуты после запуска
    const timeout = setTimeout(sendWeeklyReports, 2 * 60 * 1000);
    this.scheduledTasks.set(taskId, timeout);
    
    logger.info(`[SchedulerService] Первая отправка еженедельных отчетов запланирована через 2 минуты`);
  }

  /**
   * Планирует анализ трендов
   */
  private scheduleTrendsAnalysis(): void {
    const taskId = "trends-analysis";
    
    // Функция для анализа трендов
    const analyzeTrends = async () => {
      logger.info("[SchedulerService] Запуск анализа трендов");
      
      try {
        await this.storage.initialize();
        
        // Получаем всех активных пользователей
        const users = await this.getAllActiveUsers();
        
        for (const user of users) {
          // Получаем настройки уведомлений пользователя
          const settings = await this.storage.getNotificationSettings(user.id);
          
          // Если уведомления о трендах отключены, пропускаем пользователя
          if (!settings || !settings.trends_enabled) {
            continue;
          }
          
          // Получаем проекты пользователя
          const projects = await this.storage.getProjectsByUserId(user.id);
          
          for (const project of projects) {
            // Анализируем тренды
            const trends = await this.analyzeTrendsForProject(project.id);
            
            // Если есть тренды, отправляем уведомление
            for (const trend of trends) {
              await this.notificationService.sendTrendNotification(user.id, project.id, trend);
            }
          }
        }
      } catch (error) {
        logger.error("[SchedulerService] Ошибка при анализе трендов:", error);
      } finally {
        await this.storage.close();
        
        // Планируем следующий анализ через 3 дня
        const nextAnalysis = 3 * 24 * 60 * 60 * 1000; // 3 дня в миллисекундах
        const timeout = setTimeout(analyzeTrends, nextAnalysis);
        this.scheduledTasks.set(taskId, timeout);
        
        logger.info(`[SchedulerService] Следующий анализ трендов запланирован через 3 дня`);
      }
    };
    
    // Запускаем первый анализ через 3 минуты после запуска
    const timeout = setTimeout(analyzeTrends, 3 * 60 * 1000);
    this.scheduledTasks.set(taskId, timeout);
    
    logger.info(`[SchedulerService] Первый анализ трендов запланирован через 3 минуты`);
  }

  /**
   * Получает всех активных пользователей
   * @returns Массив активных пользователей
   */
  private async getAllActiveUsers() {
    // Заглушка для получения всех активных пользователей
    // В реальном приложении здесь будет запрос к базе данных
    return [{ id: 1, telegram_id: 123456789, username: "testuser" }];
  }

  /**
   * Анализирует тренды для проекта
   * @param projectId ID проекта
   * @returns Массив трендов
   */
  private async analyzeTrendsForProject(projectId: number) {
    // Заглушка для анализа трендов
    // В реальном приложении здесь будет сложная логика анализа трендов
    return [
      {
        trendType: "views",
        description: "Рост просмотров Reels",
        value: 5000,
        changePercent: 15,
      },
    ];
  }
}
