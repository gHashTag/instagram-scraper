import { Pool, QueryResult } from "pg";
import { StorageAdapter } from "../types";
import {
  User,
  Project,
  Competitor,
  Hashtag,
  ReelContent,
  ReelsFilter,
  ParsingRunLog,
  NotificationSettings
} from "../schemas";
import {
  validateUser,
  validateProject,
  validateCompetitors,
} from "../utils/validation-zod";

/**
 * Адаптер для работы с базой данных Neon (PostgreSQL)
 * Реализует интерфейс StorageAdapter
 */
export class NeonAdapter implements StorageAdapter {
  private pool?: Pool;

  constructor() {
    // Инициализация пула подключений к Neon
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || "",
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
    });
    console.log("Neon адаптер инициализирован");
  }

  async initialize(): Promise<void> {
    if (!this.pool) {
      throw new Error("Пул подключений к Neon не инициализирован");
    }

    // Сбрасываем флаги при инициализации
    NeonAdapter.isClosing = false;
    NeonAdapter.isPoolClosed = false;

    try {
      await this.pool.connect();
      console.log("Подключение к Neon успешно");
    } catch (error) {
      console.error("Ошибка при подключении к Neon:", error);
      throw error;
    }
  }

  // Статический флаг для отслеживания состояния соединения
  private static isClosing: boolean = false;
  private static isPoolClosed: boolean = false;

  async close(): Promise<void> {
    // Если пул уже закрыт или закрывается, просто выходим
    if (!this.pool || NeonAdapter.isPoolClosed || NeonAdapter.isClosing) {
      return;
    }

    try {
      NeonAdapter.isClosing = true;
      await this.pool.end();
      NeonAdapter.isPoolClosed = true;
      console.log("Neon адаптер закрыт");
    } catch (error) {
      if (error instanceof Error && error.message.includes('Called end on pool more than once')) {
        console.log("Соединение с Neon уже закрыто");
        NeonAdapter.isPoolClosed = true;
      } else {
        console.error("Ошибка при закрытии соединения с Neon:", error);
      }
    } finally {
      this.pool = undefined; // Сбрасываем пул после закрытия
      NeonAdapter.isClosing = false;
    }
  }

  private ensureConnection(): Pool {
    if (!this.pool) {
      throw new Error(
        "Нет подключения к Neon базе данных. Вызовите initialize() перед использованием адаптера."
      );
    }
    return this.pool;
  }

  /**
   * Безопасно выполняет SQL-запрос, проверяя наличие соединения
   * @param query SQL-запрос
   * @param params Параметры запроса
   * @returns Результат запроса
   */
  private async safeQuery(query: string, params?: any[]): Promise<QueryResult> {
    const pool = this.ensureConnection();
    return pool.query(query, params);
  }

  /**
   * Выполняет произвольный SQL-запрос
   * @param query SQL-запрос
   * @param params Параметры запроса
   * @returns Результат запроса
   */
  async executeQuery(query: string, params?: any[]): Promise<any> {
    const pool = this.ensureConnection();
    try {
      const result = await pool.query(query, params);
      return result;
    } catch (error) {
      console.error("Ошибка при выполнении SQL-запроса:", error);
      return null;
    }
  }

  async getProjectsByUserId(userId: number): Promise<Project[]> {
    try {
      // Получаем проекты пользователя по telegram_id
      // Используем CAST для преобразования типов
      const pool = this.ensureConnection();
      const res = await pool.query(
        `SELECT p.* FROM projects p
         JOIN users u ON p.user_id::text = u.id::text
         WHERE u.telegram_id = $1::integer`,
        [userId]
      );

      // Преобразуем данные вручную, без использования Zod
      const projects: Project[] = [];

      for (const row of res.rows) {
        try {
          const project: Project = {
            id: typeof row.id === 'string' ? parseInt(row.id, 10) : Number(row.id),
            user_id: Number(row.user_id), // Преобразуем user_id в число
            name: String(row.name),
            description: row.description || null,
            created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
            is_active: row.is_active === undefined ? true : Boolean(row.is_active)
          };
          projects.push(project);
        } catch (err) {
          console.error(`Ошибка при обработке проекта: ${err}`);
          // Пропускаем проблемный проект
        }
      }

      return projects;
    } catch (error) {
      console.error("Ошибка при получении проектов из Neon:", error);
      return [];
    }
  }

  async getProjectById(projectId: number): Promise<Project | null> {
    const pool = this.ensureConnection();
    try {
      const res = await pool.query("SELECT * FROM Projects WHERE id = $1", [
        projectId,
      ]);

      if (!res.rows[0]) {
        return null;
      }

      // Валидируем данные с помощью Zod
      return validateProject(res.rows[0]);
    } catch (error) {
      console.error("Ошибка при получении проекта из Neon:", error);
      return null;
    }
  }

  async createProject(userId: number, name: string): Promise<Project> {
    try {
      const res = await this.safeQuery(
        "INSERT INTO projects (user_id, name) VALUES ($1, $2) RETURNING *",
        [userId, name]
      );

      // Валидируем данные с помощью Zod
      const validatedProject = validateProject(res.rows[0]);
      if (!validatedProject) {
        throw new Error("Не удалось валидировать созданный проект");
      }

      return validatedProject;
    } catch (error) {
      console.error("Ошибка при создании проекта в Neon:", error);
      throw new Error(
        `Ошибка при создании проекта: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getCompetitorAccounts(
    projectId: number,
    activeOnly: boolean = true
  ): Promise<Competitor[]> {
    const pool = this.ensureConnection();
    try {
      const query = activeOnly
        ? "SELECT * FROM Competitors WHERE project_id = $1 AND is_active = true"
        : "SELECT * FROM Competitors WHERE project_id = $1";
      const res = await pool.query(query, [projectId]);

      // Валидируем данные с помощью Zod
      return validateCompetitors(res.rows);
    } catch (error) {
      console.error("Ошибка при получении конкурентов из Neon:", error);
      return [];
    }
  }

  async getCompetitorsByProjectId(projectId: number): Promise<Competitor[]> {
    try {
      const pool = this.ensureConnection();
      const res = await pool.query(
        "SELECT * FROM competitors WHERE project_id = $1",
        [projectId]
      );

      // Валидируем данные с помощью Zod
      return validateCompetitors(res.rows);
    } catch (error) {
      console.error("Ошибка при получении конкурентов из Neon:", error);
      return [];
    }
  }

  // Метод перенесен в конец файла

  async getUserByTelegramId(telegramId: number): Promise<User | null> {
    try {
      const res = await this.safeQuery(
        "SELECT * FROM users WHERE telegram_id = $1",
        [telegramId]
      );

      if (!res.rows[0]) {
        return null;
      }

      // Добавляем is_active, если его нет
      if (res.rows[0].is_active === undefined) {
        res.rows[0].is_active = true;
      }

      // Проверяем и исправляем id, если он не является числом
      if (res.rows[0].id === null || isNaN(Number(res.rows[0].id))) {
        console.warn(`ID пользователя ${telegramId} равен ${res.rows[0].id}, исправляем на 1`);
        res.rows[0].id = 1; // Устанавливаем значение по умолчанию
      }

      // Валидируем данные с помощью Zod
      const validatedUser = validateUser(res.rows[0]);
      if (!validatedUser) {
        console.error("Не удалось валидировать пользователя:", res.rows[0]);
        // Возвращаем данные пользователя без валидации в крайнем случае
        return {
          id: typeof res.rows[0].id === 'string' ? parseInt(res.rows[0].id, 10) : (isNaN(Number(res.rows[0].id)) ? 1 : res.rows[0].id),
          telegram_id: res.rows[0].telegram_id,
          username: res.rows[0].username || null,
          first_name: res.rows[0].first_name || null,
          last_name: res.rows[0].last_name || null,
          created_at: res.rows[0].created_at instanceof Date ? res.rows[0].created_at.toISOString() : res.rows[0].created_at,
          is_active: res.rows[0].is_active === undefined ? true : res.rows[0].is_active
        };
      }
      return validatedUser;
    } catch (error) {
      console.error("Ошибка при получении пользователя из Neon:", error);
      return null;
    }
  }

  async createUser(
    telegramId: number,
    username?: string,
    firstName?: string,
    lastName?: string
  ): Promise<User> {
    try {
      const res = await this.safeQuery(
        "INSERT INTO users (telegram_id, username, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING *",
        [telegramId, username || null, firstName || null, lastName || null]
      );

      // Валидируем данные с помощью Zod
      const validatedUser = validateUser(res.rows[0]);
      if (!validatedUser) {
        throw new Error("Не удалось валидировать созданного пользователя");
      }

      return validatedUser;
    } catch (error) {
      console.error("Ошибка при создании пользователя в Neon:", error);
      throw new Error(
        `Ошибка при создании пользователя: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getTrackingHashtags(
    projectId: number,
    activeOnly?: boolean
  ): Promise<Hashtag[]> {
    let query = "SELECT * FROM hashtags WHERE project_id = $1";
    const params: any[] = [projectId];
    if (activeOnly) {
      query += " AND is_active = true";
    }
    const res = await this.safeQuery(query, params);
    return res.rows;
  }

  // Метод перенесен в конец файла

  async saveReelsContent(content: any): Promise<void> {
    await this.safeQuery(
      "INSERT INTO reels_content (competitor_id, reel_id, content_url, description, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING",
      [
        content.competitorId,
        content.reelId,
        content.contentUrl,
        content.description || null,
        content.createdAt,
      ]
    );
  }

  // Устаревший метод, оставлен для обратной совместимости
  // Используйте новую версию метода с поддержкой ReelsFilter
  async getReelsByCompetitorId_deprecated(
    competitorId: number,
    filter: any
  ): Promise<any[]> {
    let query = "SELECT * FROM reels_content WHERE competitor_id = $1";
    const params: any[] = [competitorId];
    if (filter.from) {
      query += " AND created_at >= $2";
      params.push(filter.from);
    }
    if (filter.to) {
      query += " AND created_at <= $3";
      params.push(filter.to);
    }
    const res = await this.safeQuery(query, params);
    return res.rows;
  }

  async saveReels(
    reels: Partial<ReelContent>[],
    projectId: number,
    sourceType: string,
    sourceId: string | number
  ): Promise<number> {
    // Подавляем ошибку TS6133 для неиспользуемых параметров
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    projectId;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sourceType;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sourceId;
    let savedCount = 0;
    for (const reel of reels) {
      await this.saveReelsContent(reel);
      savedCount++;
    }
    return savedCount;
  }

  async getReels(filter?: ReelsFilter): Promise<ReelContent[]> {
    const pool = this.ensureConnection();
    let query = "SELECT * FROM reels_content";
    const params: any[] = [];
    let whereAdded = false;

    if (filter) {
      // Фильтр по ID проекта
      if (filter.projectId) {
        query += " WHERE project_id = $" + (params.length + 1);
        params.push(filter.projectId);
        whereAdded = true;
      }

      // Фильтр по типу источника
      if (filter.sourceType) {
        query += whereAdded ? " AND" : " WHERE";
        query += " source_type = $" + (params.length + 1);
        params.push(filter.sourceType);
        whereAdded = true;
      }

      // Фильтр по ID источника
      if (filter.sourceId) {
        query += whereAdded ? " AND" : " WHERE";
        query += " source_id = $" + (params.length + 1);
        params.push(filter.sourceId);
        whereAdded = true;
      }

      // Фильтр по минимальному количеству просмотров
      if (filter.minViews) {
        query += whereAdded ? " AND" : " WHERE";
        query += " views >= $" + (params.length + 1);
        params.push(filter.minViews);
        whereAdded = true;
      }

      // Фильтр по дате публикации (после)
      if (filter.afterDate) {
        query += whereAdded ? " AND" : " WHERE";
        query += " published_at >= $" + (params.length + 1);
        params.push(filter.afterDate);
        whereAdded = true;
      }

      // Фильтр по дате публикации (до)
      if (filter.beforeDate) {
        query += whereAdded ? " AND" : " WHERE";
        query += " published_at <= $" + (params.length + 1);
        params.push(filter.beforeDate);
        whereAdded = true;
      }

      // Фильтр по статусу обработки
      if (filter.is_processed !== undefined) {
        query += whereAdded ? " AND" : " WHERE";
        query += " is_processed = $" + (params.length + 1);
        params.push(filter.is_processed);
        whereAdded = true;
      }

      // Сортировка
      if (filter.orderBy) {
        query += " ORDER BY " + filter.orderBy;
        if (filter.orderDirection) {
          query += " " + filter.orderDirection;
        } else {
          query += " DESC"; // По умолчанию сортируем по убыванию
        }
      } else {
        query += " ORDER BY published_at DESC"; // По умолчанию сортируем по дате публикации
      }

      // Пагинация
      if (filter.limit) {
        query += " LIMIT $" + (params.length + 1);
        params.push(filter.limit);

        if (filter.offset) {
          query += " OFFSET $" + (params.length + 1);
          params.push(filter.offset);
        }
      }
    } else {
      // Если фильтр не указан, сортируем по дате публикации и ограничиваем 20 записями
      query += " ORDER BY published_at DESC LIMIT 20";
    }

    try {
      const res = await pool.query(query, params);
      return res.rows;
    } catch (error) {
      console.error("Ошибка при получении Reels из Neon:", error);
      return [];
    }
  }

  /**
   * Получает Reels по ID проекта
   * @param projectId ID проекта
   * @param filter Фильтр для Reels
   * @returns Массив Reels
   */
  async getReelsByProjectId(projectId: number, filter?: ReelsFilter): Promise<ReelContent[]> {
    const combinedFilter: ReelsFilter = {
      ...filter,
      projectId
    };
    return this.getReels(combinedFilter);
  }

  /**
   * Получает Reels конкретного конкурента
   * @param projectId ID проекта
   * @param competitorId ID конкурента
   * @param filter Фильтр для Reels
   * @returns Массив Reels
   */
  async getReelsByCompetitorId(competitorId: number, filter?: ReelsFilter): Promise<ReelContent[]> {
    const pool = this.ensureConnection();
    try {
      // Сначала получаем информацию о конкуренте, чтобы узнать ID проекта
      const competitorResult = await pool.query("SELECT project_id FROM competitors WHERE id = $1", [competitorId]);

      if (competitorResult.rows.length === 0) {
        throw new Error(`Конкурент с ID ${competitorId} не найден`);
      }

      const projectId = competitorResult.rows[0].project_id;

      // Затем получаем Reels с фильтрацией по проекту, типу источника и ID источника
      const combinedFilter: ReelsFilter = {
        ...filter,
        projectId,
        sourceType: "competitor",
        sourceId: competitorId.toString()
      };

      return this.getReels(combinedFilter);
    } catch (error) {
      console.error("Ошибка при получении Reels конкурента из Neon:", error);
      return [];
    }
  }

  /**
   * Получает Reels по хештегу
   * @param projectId ID проекта
   * @param hashtagId ID хештега
   * @param filter Фильтр для Reels
   * @returns Массив Reels
   */
  async getReelsByHashtagId(hashtagId: number, filter?: ReelsFilter): Promise<ReelContent[]> {
    const pool = this.ensureConnection();
    try {
      // Сначала получаем информацию о хештеге, чтобы узнать ID проекта
      const hashtagResult = await pool.query("SELECT project_id FROM hashtags WHERE id = $1", [hashtagId]);

      if (hashtagResult.rows.length === 0) {
        throw new Error(`Хештег с ID ${hashtagId} не найден`);
      }

      const projectId = hashtagResult.rows[0].project_id;

      // Затем получаем Reels с фильтрацией по проекту, типу источника и ID источника
      const combinedFilter: ReelsFilter = {
        ...filter,
        projectId,
        sourceType: "hashtag",
        sourceId: hashtagId.toString()
      };

      return this.getReels(combinedFilter);
    } catch (error) {
      console.error("Ошибка при получении Reels хештега из Neon:", error);
      return [];
    }
  }

  /**
   * Получает детальную информацию о Reel по ID
   * @param reelId ID Reel
   * @returns Детальная информация о Reel или null, если Reel не найден
   */
  async getReelById(reelId: string): Promise<ReelContent | null> {
    const pool = this.ensureConnection();
    try {
      const result = await pool.query("SELECT * FROM reels_content WHERE instagram_id = $1", [reelId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error("Ошибка при получении Reel из Neon:", error);
      return null;
    }
  }

  /**
   * Получает количество Reels по фильтру
   * @param filter Фильтр для Reels
   * @returns Количество Reels
   */
  async getReelsCount(filter?: ReelsFilter): Promise<number> {
    const pool = this.ensureConnection();
    let query = "SELECT COUNT(*) FROM reels_content";
    const params: any[] = [];
    let whereAdded = false;

    if (filter) {
      // Фильтр по ID проекта
      if (filter.projectId) {
        query += " WHERE project_id = $" + (params.length + 1);
        params.push(filter.projectId);
        whereAdded = true;
      }

      // Фильтр по типу источника
      if (filter.sourceType) {
        query += whereAdded ? " AND" : " WHERE";
        query += " source_type = $" + (params.length + 1);
        params.push(filter.sourceType);
        whereAdded = true;
      }

      // Фильтр по ID источника
      if (filter.sourceId) {
        query += whereAdded ? " AND" : " WHERE";
        query += " source_type = $" + (params.length + 1);
        params.push(filter.sourceId);
        whereAdded = true;
      }

      // Фильтр по минимальному количеству просмотров
      if (filter.minViews) {
        query += whereAdded ? " AND" : " WHERE";
        query += " views >= $" + (params.length + 1);
        params.push(filter.minViews);
        whereAdded = true;
      }

      // Фильтр по дате публикации (после)
      if (filter.afterDate) {
        query += whereAdded ? " AND" : " WHERE";
        query += " published_at >= $" + (params.length + 1);
        params.push(filter.afterDate);
        whereAdded = true;
      }

      // Фильтр по дате публикации (до)
      if (filter.beforeDate) {
        query += whereAdded ? " AND" : " WHERE";
        query += " published_at <= $" + (params.length + 1);
        params.push(filter.beforeDate);
        whereAdded = true;
      }

      // Фильтр по статусу обработки
      if (filter.is_processed !== undefined) {
        query += whereAdded ? " AND" : " WHERE";
        query += " is_processed = $" + (params.length + 1);
        params.push(filter.is_processed);
      }
    }

    try {
      const result = await pool.query(query, params);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error("Ошибка при получении количества Reels из Neon:", error);
      return 0;
    }
  }

  async logParsingRun(log: Partial<ParsingRunLog>): Promise<ParsingRunLog> {
    const res = await this.safeQuery(
      "INSERT INTO parsing_run_logs (run_id, target_type, target_id, status, message, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [
        log.run_id || this.generateUUID(),
        log.source_type || "unknown",
        log.source_id || "unknown",
        log.status || "unknown",
        log.error_message || null,
        log.started_at || new Date().toISOString(),
      ]
    );
    return res.rows[0];
  }

  /**
   * Получает настройки уведомлений пользователя
   * @param userId ID пользователя
   * @returns Настройки уведомлений или null, если не найдены
   */
  async getNotificationSettings(userId: number): Promise<NotificationSettings | null> {
    try {
      const res = await this.safeQuery(
        "SELECT * FROM notification_settings WHERE user_id = $1",
        [userId]
      );

      if (!res.rows[0]) {
        return null;
      }

      return res.rows[0] as NotificationSettings;
    } catch (error) {
      console.error("Ошибка при получении настроек уведомлений из Neon:", error);
      return null;
    }
  }

  /**
   * Сохраняет настройки уведомлений пользователя
   * @param settings Настройки уведомлений
   * @returns Сохраненные настройки уведомлений
   */
  async saveNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    try {
      const res = await this.safeQuery(
        "INSERT INTO notification_settings (user_id, new_reels_enabled, trends_enabled, weekly_report_enabled, min_views_threshold, notification_time, notification_days) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        [
          settings.user_id,
          settings.new_reels_enabled !== undefined ? settings.new_reels_enabled : true,
          settings.trends_enabled !== undefined ? settings.trends_enabled : true,
          settings.weekly_report_enabled !== undefined ? settings.weekly_report_enabled : true,
          settings.min_views_threshold || 1000,
          settings.notification_time || "09:00",
          settings.notification_days || [1, 2, 3, 4, 5, 6, 7],
        ]
      );

      return res.rows[0] as NotificationSettings;
    } catch (error) {
      console.error("Ошибка при сохранении настроек уведомлений в Neon:", error);
      throw new Error(
        `Ошибка при сохранении настроек уведомлений: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Обновляет настройки уведомлений пользователя
   * @param userId ID пользователя
   * @param settings Настройки уведомлений для обновления
   * @returns Обновленные настройки уведомлений
   */
  async updateNotificationSettings(userId: number, settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    try {
      // Формируем части запроса для обновления
      const updateParts = [];
      const params: any[] = [userId];
      let paramIndex = 2;

      if (settings.new_reels_enabled !== undefined) {
        updateParts.push(`new_reels_enabled = $${paramIndex++}`);
        params.push(settings.new_reels_enabled);
      }

      if (settings.trends_enabled !== undefined) {
        updateParts.push(`trends_enabled = $${paramIndex++}`);
        params.push(settings.trends_enabled);
      }

      if (settings.weekly_report_enabled !== undefined) {
        updateParts.push(`weekly_report_enabled = $${paramIndex++}`);
        params.push(settings.weekly_report_enabled);
      }

      if (settings.min_views_threshold !== undefined) {
        updateParts.push(`min_views_threshold = $${paramIndex++}`);
        params.push(settings.min_views_threshold);
      }

      if (settings.notification_time) {
        updateParts.push(`notification_time = $${paramIndex++}`);
        params.push(settings.notification_time);
      }

      if (settings.notification_days) {
        updateParts.push(`notification_days = $${paramIndex++}`);
        params.push(settings.notification_days);
      }

      if (settings.updated_at) {
        updateParts.push(`updated_at = $${paramIndex++}`);
        params.push(settings.updated_at);
      }

      // Если нет полей для обновления, возвращаем текущие настройки
      if (updateParts.length === 0) {
        const currentSettings = await this.getNotificationSettings(userId);
        if (!currentSettings) {
          return await this.saveNotificationSettings({ user_id: userId });
        }
        return currentSettings;
      }

      const updateQuery = `UPDATE notification_settings SET ${updateParts.join(', ')} WHERE user_id = $1 RETURNING *`;
      const res = await this.safeQuery(updateQuery, params);

      // Если настройки не найдены, создаем новые
      if (res.rows.length === 0) {
        return await this.saveNotificationSettings({ user_id: userId, ...settings });
      }

      return res.rows[0] as NotificationSettings;
    } catch (error) {
      console.error("Ошибка при обновлении настроек уведомлений в Neon:", error);
      throw new Error(
        `Ошибка при обновлении настроек уведомлений: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Получает пользователя по ID
   * @param userId ID пользователя
   * @returns Пользователь или null, если не найден
   */
  async getUserById(userId: number): Promise<User | null> {
    try {
      const res = await this.safeQuery(
        "SELECT * FROM users WHERE id = $1",
        [userId]
      );

      if (!res.rows[0]) {
        return null;
      }

      // Добавляем is_active, если его нет
      if (res.rows[0].is_active === undefined) {
        res.rows[0].is_active = true;
      }

      // Валидируем данные с помощью Zod
      return validateUser(res.rows[0]);
    } catch (error) {
      console.error("Ошибка при получении пользователя из Neon:", error);
      return null;
    }
  }

  /**
   * Получает новые Reels после указанной даты
   * @param projectId ID проекта
   * @param afterDate Дата, после которой искать Reels
   * @returns Массив новых Reels
   */
  async getNewReels(projectId: number, afterDate: string): Promise<ReelContent[]> {
    try {
      const filter: ReelsFilter = {
        projectId,
        afterDate
      };
      return await this.getReels(filter);
    } catch (error) {
      console.error("Ошибка при получении новых Reels из Neon:", error);
      return [];
    }
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  async getParsingRunLogs(
    targetType: "competitor" | "hashtag",
    targetId: string
  ): Promise<ParsingRunLog[]> {
    const res = await this.safeQuery(
      "SELECT * FROM parsing_run_logs WHERE target_type = $1 AND target_id = $2 ORDER BY created_at DESC",
      [targetType, targetId]
    );
    return res.rows;
  }

  // Получение хештегов по ID проекта
  async getHashtagsByProjectId(projectId: number): Promise<Hashtag[] | null> {
    const query =
      "SELECT id, project_id, hashtag, created_at FROM hashtags WHERE project_id = $1 ORDER BY created_at DESC";
    try {
      const result = await this.safeQuery(query, [
        projectId,
      ]);
      return result.rows;
    } catch (error) {
      console.error("Error fetching hashtags:", error);
      return null;
    }
  }

  // Добавление хештега к проекту
  async addHashtag(
    projectId: number,
    hashtag: string
  ): Promise<Hashtag | null> {
    const query =
      "INSERT INTO hashtags (project_id, hashtag) VALUES ($1, $2) RETURNING id, project_id, hashtag, created_at";
    try {
      const result = await this.safeQuery(query, [
        projectId,
        hashtag,
      ]);
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error adding hashtag:", error);
      return null;
    }
  }

  // Удаление хештега
  async removeHashtag(projectId: number, hashtag: string): Promise<void> {
    await this.safeQuery(
      "DELETE FROM hashtags WHERE project_id = $1 AND hashtag = $2",
      [projectId, hashtag]
    );
  }

  // Добавление аккаунта конкурента
  async addCompetitorAccount(
    projectId: number,
    username: string,
    instagramUrl: string
  ): Promise<Competitor | null> {
    const query =
      "INSERT INTO competitors (project_id, username, instagram_url) VALUES ($1, $2, $3) RETURNING *";
    try {
      const result = await this.safeQuery(query, [
        projectId,
        username,
        instagramUrl,
      ]);
      return result.rows[0] || null;
    } catch (error) {
      console.error("Error adding competitor account:", error);
      return null;
    }
  }

  // Удаление аккаунта конкурента
  async deleteCompetitorAccount(
    projectId: number,
    username: string
  ): Promise<boolean> {
    const pool = this.ensureConnection();
    try {
      const res = await pool.query(
        "DELETE FROM Competitors WHERE project_id = $1 AND username = $2 RETURNING id",
        [projectId, username]
      );
      return res.rowCount !== null && res.rowCount > 0;
    } catch (error) {
      console.error("Ошибка при удалении конкурента из Neon:", error);
      return false;
    }
  }

  async findUserByTelegramIdOrCreate(
    telegramId: number,
    username?: string,
    firstName?: string,
    lastName?: string
  ): Promise<User> {
    try {
      let user = await this.getUserByTelegramId(telegramId);
      if (user) {
        // TODO: Опционально обновить username, firstName, lastName, если они изменились
        return user;
      }
      // Если пользователь не найден, создаем нового
      user = await this.createUser(telegramId, username, firstName, lastName);
      return user;
    } catch (error) {
      console.error(
        "Ошибка в findUserByTelegramIdOrCreate в NeonAdapter:",
        error
      );
      throw new Error(
        `Ошибка при поиске или создании пользователя в Neon: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
