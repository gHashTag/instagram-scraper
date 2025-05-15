/**
 * SQLite Adapter для Instagram Scraper Bot
 *
 * Этот адаптер предоставляет интерфейс для работы с локальной SQLite базой данных
 * для автономной разработки и тестирования модуля Instagram Scraper Bot.
 */

import sqlite from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { StorageAdapter } from "../types";
import {
  User,
  Project,
  Competitor,
  Hashtag,
  ReelContent,
  ReelsFilter,
  ParsingRunLog
} from "../schemas";

// Настройки для адаптера SQLite
export interface SqliteAdapterConfig {
  dbPath?: string; // Путь к файлу SQLite базы данных
}

/**
 * Адаптер для работы с SQLite базой данных
 * Реализует интерфейс StorageAdapter
 */
export class SqliteAdapter implements StorageAdapter {
  private db: sqlite.Database | null = null;
  private dbPath: string;

  /**
   * Создает новый экземпляр адаптера SQLite
   * @param config Настройки адаптера
   */
  constructor(config: SqliteAdapterConfig = {}) {
    // Определение пути к базе данных
    if (config.dbPath) {
      this.dbPath = config.dbPath;
    } else {
      // Если путь не указан, используем путь по умолчанию
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      this.dbPath =
        process.env.SQLITE_DB_PATH ||
        path.resolve(__dirname, "../.dev/sqlite.db");
    }

    // Проверяем существование директории для базы данных
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  /**
   * Инициализация подключения к базе данных (ранее connect)
   */
  async initialize(): Promise<void> {
    if (!this.db) {
      try {
        // Создаем или открываем существующую SQLite базу данных
        this.db = sqlite(this.dbPath);

        // Включаем поддержку внешних ключей
        this.db.exec("PRAGMA foreign_keys = ON;");

        console.log(`SQLite адаптер подключен к базе данных: ${this.dbPath}`);
      } catch (error) {
        console.error("Ошибка при подключении к SQLite базе данных:", error);
        throw new Error(
          `Ошибка подключения к SQLite: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Закрытие подключения к базе данных (ранее disconnect)
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log("SQLite адаптер отключен от базы данных");
    }
  }

  /**
   * Проверяет подключение к базе данных и возвращает экземпляр базы данных
   * @returns Экземпляр базы данных SQLite
   */
  private ensureConnection(): sqlite.Database {
    if (!this.db) {
      // console.log("Creating new SQLite connection for ensureConnection");
      this.db = new sqlite(this.dbPath);
      this.db.exec("PRAGMA journal_mode = WAL;"); // Recommended for concurrent access
      this.db.exec("PRAGMA foreign_keys = ON;");
    }
    return this.db;
  }

  /**
   * Получение списка проектов пользователя
   * @param userId ID пользователя
   */
  async getProjectsByUserId(userId: number): Promise<Project[]> {
    const db = this.ensureConnection();

    try {
      const query = db.prepare(`
        SELECT * FROM Projects
        WHERE user_id = ? AND is_active = 1
        ORDER BY created_at DESC
      `);

      const projects = query.all(userId) as Project[];
      return projects;
    } catch (error) {
      console.error("Ошибка при получении проектов из SQLite:", error);
      throw new Error(
        `Ошибка при получении проектов: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Получение проекта по ID
   * @param projectId ID проекта
   */
  async getProjectById(projectId: number): Promise<Project | null> {
    const db = this.ensureConnection();

    try {
      const query = db.prepare(`
        SELECT * FROM Projects
        WHERE id = ?
      `);

      const project = query.get(projectId) as Project | null;
      return project;
    } catch (error) {
      console.error("Ошибка при получении проекта из SQLite:", error);
      throw new Error(
        `Ошибка при получении проекта: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Создание нового проекта
   * @param userId ID пользователя
   * @param name Название проекта
   */
  async createProject(userId: number, name: string): Promise<Project> {
    const db = this.ensureConnection();

    try {
      const query = db.prepare(`
        INSERT INTO Projects (user_id, name, description)
        VALUES (?, ?, ?)
      `);

      const result = query.run(userId, name, null);

      // Получаем созданный проект
      if (result.lastInsertRowid) {
        const projectId = Number(result.lastInsertRowid);
        const project = await this.getProjectById(projectId);

        if (project) {
          return project;
        }
      }

      throw new Error("Не удалось создать проект");
    } catch (error) {
      console.error("Ошибка при создании проекта в SQLite:", error);
      throw new Error(
        `Ошибка при создании проекта: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Получение списка конкурентов для проекта
   * @param projectId ID проекта
   * @param activeOnly Только активные (по умолчанию true)
   */
  async getCompetitorAccounts(
    projectId: number,
    activeOnly: boolean = true
  ): Promise<Competitor[]> {
    const db = this.ensureConnection();

    try {
      const queryStr = `
        SELECT * FROM Competitors
        WHERE project_id = ? ${activeOnly ? "AND is_active = 1" : ""}
        ORDER BY created_at DESC
      `;
      const query = db.prepare(queryStr);

      const competitors = query.all(projectId) as Competitor[];
      return competitors;
    } catch (error) {
      console.error("Ошибка при получении конкурентов из SQLite:", error);
      throw new Error(
        `Ошибка при получении конкурентов: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Добавление нового конкурента в проект
   * @param projectId ID проекта
   * @param username Имя пользователя (логин) конкурента в Instagram
   * @param instagramUrl URL профиля конкурента
   */
  async addCompetitorAccount(
    projectId: number,
    username: string,
    instagramUrl: string
  ): Promise<Competitor> {
    const db = this.ensureConnection();

    try {
      const query = db.prepare(`
        INSERT INTO Competitors (project_id, username, instagram_url)
        VALUES (?, ?, ?)
      `);

      const result = query.run(projectId, username, instagramUrl);

      // Получаем созданного конкурента
      if (result.lastInsertRowid) {
        const competitorId = Number(result.lastInsertRowid);
        const getCompetitor = db.prepare(`
          SELECT * FROM Competitors
          WHERE id = ?
        `);

        const competitor = getCompetitor.get(competitorId) as Competitor;

        if (competitor) {
          return competitor;
        }
      }

      throw new Error("Не удалось добавить конкурента");
    } catch (error) {
      console.error("Ошибка при добавлении конкурента в SQLite:", error);
      throw new Error(
        `Ошибка при добавлении конкурента: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Получение списка хэштегов для проекта
   * @param projectId ID проекта
   * @param activeOnly Только активные (по умолчанию true)
   */
  async getTrackingHashtags(
    projectId: number,
    activeOnly: boolean = true
  ): Promise<Hashtag[]> {
    const db = this.ensureConnection();

    try {
      const queryStr = `
        SELECT * FROM Hashtags
        WHERE project_id = ? ${activeOnly ? "AND is_active = 1" : ""}
        ORDER BY created_at DESC
      `;
      const query = db.prepare(queryStr);

      const hashtags = query.all(projectId) as Hashtag[];
      return hashtags;
    } catch (error) {
      console.error("Ошибка при получении хэштегов из SQLite:", error);
      throw new Error(
        `Ошибка при получении хэштегов: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Добавление нового хэштега в проект
   * @param projectId ID проекта
   * @param name Название хэштега (без символа #)
   */
  async addHashtag(projectId: number, name: string): Promise<Hashtag> {
    const db = this.ensureConnection();

    try {
      // Убираем символ # в начале, если он есть
      const cleanName = name.startsWith("#") ? name.substring(1) : name;

      const query = db.prepare(`
        INSERT INTO Hashtags (project_id, name)
        VALUES (?, ?)
      `);

      const result = query.run(projectId, cleanName);

      // Получаем созданный хэштег
      if (result.lastInsertRowid) {
        const hashtagId = Number(result.lastInsertRowid);
        const getHashtag = db.prepare(`
          SELECT * FROM Hashtags
          WHERE id = ?
        `);

        const hashtag = getHashtag.get(hashtagId) as Hashtag;

        if (hashtag) {
          return hashtag;
        }
      }

      throw new Error("Не удалось добавить хэштег");
    } catch (error) {
      console.error("Ошибка при добавлении хэштега в SQLite:", error);
      throw new Error(
        `Ошибка при добавлении хэштега: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Сохранение списка Reels в базу данных
   * @param reels Массив объектов с данными о Reel
   * @param projectId ID проекта
   * @param sourceType Тип источника ('competitor' или 'hashtag')
   * @param sourceId ID источника (ID конкурента или ID хэштега)
   * @returns Количество успешно сохраненных Reels
   */
  async saveReels(
    reels: Partial<ReelContent>[],
    projectId: number,
    sourceType: "competitor" | "hashtag",
    sourceId: string | number
  ): Promise<number> {
    const db = this.ensureConnection();
    let savedCount = 0;

    const insertStmt = db.prepare(`
      INSERT INTO ReelsContent (
        project_id, source_type, source_id, instagram_id, url, caption,
        author_username, author_id, views, likes, comments_count,
        duration, thumbnail_url, music_title, published_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (instagram_id) DO UPDATE SET
        views = excluded.views,
        likes = excluded.likes,
        comments_count = excluded.comments_count,
        fetched_at = CURRENT_TIMESTAMP
    `);

    // TODO: Использовать транзакцию для массовой вставки
    for (const reel of reels) {
      try {
        // Проверяем наличие обязательных полей
        if (!reel.instagram_id || !reel.url || !reel.published_at) {
          console.warn(
            "Skipping reel due to missing required fields (instagram_id, url, or published_at):",
            reel
          );
          continue;
        }

        const result = insertStmt.run(
          projectId,
          sourceType,
          String(sourceId),
          reel.instagram_id,
          reel.url,
          reel.caption || null,
          reel.author_username || null,
          reel.author_id || null,
          reel.views || 0,
          reel.likes || 0,
          reel.comments_count || 0,
          reel.duration || null,
          reel.thumbnail_url || null,
          reel.music_title || null,
          reel.published_at
        );
        if (result.changes > 0) {
          savedCount++;
        }
      } catch (error) {
        console.error("Ошибка при сохранении Reel в SQLite:", reel, error);
        // Не прерываем цикл, продолжаем сохранять остальные
      }
    }
    return savedCount;
  }

  /**
   * Получение списка Reels по фильтру
   * @param filter Параметры фильтрации
   */
  async getReels(filter: ReelsFilter = {}): Promise<ReelContent[]> {
    const db = this.ensureConnection();
    let query = "SELECT * FROM ReelsContent WHERE 1=1";
    const params: any[] = [];

    if (filter.projectId) {
      query += " AND project_id = ?";
      params.push(filter.projectId);
    }

    if (filter.sourceType) {
      query += " AND source_type = ?";
      params.push(filter.sourceType);
    }

    if (filter.sourceId) {
      query += " AND source_id = ?";
      params.push(String(filter.sourceId));
    }

    if (filter.minViews) {
      query += " AND views >= ?";
      params.push(filter.minViews);
    }

    if (filter.afterDate) {
      query += " AND published_at >= ?";
      params.push(filter.afterDate);
    }

    if (filter.beforeDate) {
      query += " AND published_at <= ?";
      params.push(filter.beforeDate);
    }

    if (typeof filter.is_processed === "boolean") {
      query += " AND is_processed = ?";
      params.push(filter.is_processed ? 1 : 0);
    }

    query += ` ORDER BY ${filter.orderBy || "published_at"} ${filter.orderDirection || "DESC"}`;

    if (filter.limit) {
      query += " LIMIT ?";
      params.push(filter.limit);

      if (filter.offset) {
        query += " OFFSET ?";
        params.push(filter.offset);
      }
    }

    const statement = db.prepare(query);
    const resultReels = statement.all(...params) as ReelContent[];

    return resultReels;
  }

  /**
   * Обновление статуса обработки Reel
   * @param reelId ID Reel
   * @param isProcessed Статус обработки
   * @param status Дополнительная информация о статусе
   * @param result Результат обработки
   */
  async updateReelProcessingStatus(
    reelId: number,
    isProcessed: boolean,
    status?: string,
    result?: string
  ): Promise<void> {
    const db = this.ensureConnection();

    try {
      const query = db.prepare(`
        UPDATE ReelsContent
        SET is_processed = ?,
            processing_status = ?,
            processing_result = ?
        WHERE id = ?
      `);

      query.run(isProcessed ? 1 : 0, status || null, result || null, reelId);
    } catch (error) {
      console.error(
        "Ошибка при обновлении статуса обработки Reel в SQLite:",
        error
      );
      throw new Error(
        `Ошибка при обновлении статуса обработки Reel: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Получение списка конкурентов для проекта
   * @param projectId ID проекта
   */
  async getCompetitorsByProjectId(projectId: number): Promise<Competitor[]> {
    return this.getCompetitorAccounts(projectId);
  }

  /**
   * Удаление конкурента
   * @param projectId ID проекта
   * @param username Имя пользователя конкурента
   */
  async deleteCompetitorAccount(projectId: number, username: string): Promise<boolean> {
    const db = this.ensureConnection();

    try {
      const query = db.prepare(`
        UPDATE Competitors
        SET is_active = 0
        WHERE username = ? AND project_id = ?
      `);

      const result = query.run(username, projectId);
      return result.changes > 0;
    } catch (error) {
      console.error("Ошибка при удалении конкурента из SQLite:", error);
      throw new Error(
        `Ошибка при удалении конкурента: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Получение списка хэштегов для проекта
   * @param projectId ID проекта
   */
  async getHashtagsByProjectId(projectId: number): Promise<Hashtag[]> {
    return this.getTrackingHashtags(projectId);
  }

  /**
   * Удаление хэштега
   * @param projectId ID проекта
   * @param hashtag Хэштег
   */
  async removeHashtag(projectId: number, hashtag: string): Promise<void> {
    const db = this.ensureConnection();

    try {
      const query = db.prepare(`
        UPDATE Hashtags
        SET is_active = 0
        WHERE project_id = ? AND name = ?
      `);

      query.run(projectId, hashtag);
    } catch (error) {
      console.error("Ошибка при удалении хэштега из SQLite:", error);
      throw new Error(
        `Ошибка при удалении хэштега: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Получение списка Reels по ID конкурента
   * @param competitorId ID конкурента
   * @param filter Параметры фильтрации
   */
  async getReelsByCompetitorId(competitorId: number, filter?: any): Promise<ReelContent[]> {
    const db = this.ensureConnection();

    try {
      let query = `
        SELECT * FROM ReelsContent
        WHERE source_type = 'competitor' AND source_id = ?
      `;

      const params: any[] = [String(competitorId)];

      // Применяем фильтры, если они есть
      if (filter) {
        if (filter.minViews) {
          query += " AND views >= ?";
          params.push(filter.minViews);
        }

        if (filter.afterDate) {
          query += " AND published_at >= ?";
          params.push(filter.afterDate);
        }

        if (filter.beforeDate) {
          query += " AND published_at <= ?";
          params.push(filter.beforeDate);
        }
      }

      query += " ORDER BY published_at DESC";

      const statement = db.prepare(query);
      return statement.all(...params) as ReelContent[];
    } catch (error) {
      console.error("Ошибка при получении Reels по ID конкурента из SQLite:", error);
      return [];
    }
  }

  /**
   * Получение списка Reels по ID проекта
   * @param projectId ID проекта
   * @param filter Параметры фильтрации
   */
  async getReelsByProjectId(projectId: number, filter?: any): Promise<ReelContent[]> {
    return this.getReels({ projectId, ...filter });
  }

  /**
   * Логирование запуска парсинга
   * @param log Данные лога
   */
  async logParsingRun(log: Partial<ParsingRunLog>): Promise<ParsingRunLog> {
    const db = this.ensureConnection();

    try {
      const query = db.prepare(`
        INSERT INTO ParsingRunLogs (
          run_id, project_id, source_type, source_id, status,
          error_message, started_at, ended_at, reels_found_count,
          reels_added_count, errors_count
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = query.run(
        log.run_id,
        log.project_id,
        log.source_type,
        String(log.source_id),
        log.status,
        log.error_message || null,
        log.started_at,
        log.ended_at || null,
        log.reels_found_count || 0,
        log.reels_added_count || 0,
        log.errors_count || 0
      );

      if (result.lastInsertRowid) {
        const logId = Number(result.lastInsertRowid);
        const getLog = db.prepare(`
          SELECT * FROM ParsingRunLogs
          WHERE id = ?
        `);

        const parsingLog = getLog.get(logId) as ParsingRunLog;

        if (parsingLog) {
          return parsingLog;
        }
      }

      throw new Error("Не удалось создать лог запуска парсинга");
    } catch (error) {
      console.error("Ошибка при создании лога запуска парсинга в SQLite:", error);
      throw new Error(
        `Ошибка при создании лога запуска парсинга: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Алиас для logParsingRun (используется в тестах)
   * @param log Данные лога
   */
  async createParsingLog(log: Partial<ParsingRunLog>): Promise<ParsingRunLog> {
    return this.logParsingRun(log);
  }

  /**
   * Обновление лога запуска парсинга (используется в тестах)
   * @param log Данные лога
   */
  async updateParsingLog(log: Partial<ParsingRunLog>): Promise<ParsingRunLog> {
    const db = this.ensureConnection();

    try {
      if (!log.id || !log.run_id) {
        throw new Error("ID и run_id обязательны для обновления лога парсинга");
      }

      const query = db.prepare(`
        UPDATE ParsingRunLogs
        SET status = ?,
            ended_at = ?,
            reels_found_count = ?,
            reels_added_count = ?,
            errors_count = ?,
            error_message = ?
        WHERE id = ?
      `);

      query.run(
        log.status || "completed",
        log.ended_at || new Date().toISOString(),
        log.reels_found_count || 0,
        log.reels_added_count || 0,
        log.errors_count || 0,
        log.error_message || null,
        log.id
      );

      const getLog = db.prepare(`
        SELECT * FROM ParsingRunLogs
        WHERE id = ?
      `);

      const updatedLog = getLog.get(log.id) as ParsingRunLog;

      if (updatedLog) {
        return updatedLog;
      }

      throw new Error("Не удалось обновить лог запуска парсинга");
    } catch (error) {
      console.error("Ошибка при обновлении лога запуска парсинга в SQLite:", error);
      throw new Error(
        `Ошибка при обновлении лога запуска парсинга: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Получение логов запуска парсинга
   * @param targetType Тип цели ('competitor' или 'hashtag')
   * @param targetId ID цели
   */
  async getParsingRunLogs(
    targetType: "competitor" | "hashtag",
    targetId: string
  ): Promise<ParsingRunLog[]> {
    const db = this.ensureConnection();

    try {
      const query = db.prepare(`
        SELECT * FROM ParsingRunLogs
        WHERE source_type = ? AND source_id = ?
        ORDER BY started_at DESC
      `);

      return query.all(targetType, targetId) as ParsingRunLog[];
    } catch (error) {
      console.error("Ошибка при получении логов запуска парсинга из SQLite:", error);
      return [];
    }
  }

  /**
   * Получение логов запуска парсинга по ID проекта
   * @param projectId ID проекта
   */
  async getParsingLogsByProjectId(projectId: number): Promise<ParsingRunLog[]> {
    const db = this.ensureConnection();

    try {
      const query = db.prepare(`
        SELECT * FROM ParsingRunLogs
        WHERE project_id = ?
        ORDER BY started_at DESC
      `);

      return query.all(projectId) as ParsingRunLog[];
    } catch (error) {
      console.error("Ошибка при получении логов запуска парсинга по ID проекта из SQLite:", error);
      return [];
    }
  }



  // МЕТОДЫ ИЗ ИНТЕРФЕЙСА STORAGEADAPTER

  async getUserByTelegramId(telegramId: number): Promise<User | null> {
    const db = this.ensureConnection();
    try {
      const query = db.prepare("SELECT * FROM Users WHERE telegram_id = ?");
      const user = query.get(telegramId) as User | null;
      return user;
    } catch (error) {
      console.error("Ошибка при получении пользователя из SQLite:", error);
      throw new Error(
        `Ошибка при получении пользователя: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async createUser(
    telegramId: number,
    username?: string,
    firstName?: string,
    lastName?: string
  ): Promise<User> {
    const db = this.ensureConnection();
    try {
      const query = db.prepare(
        "INSERT INTO Users (telegram_id, username, created_at, is_active, first_name, last_name)" +
          " VALUES (?, ?, datetime('now'), 1, ?, ?)"
      );
      const result = query.run(
        telegramId,
        username || null,
        firstName || null,
        lastName || null
      );

      if (result.lastInsertRowid) {
        const createdUser = await this.getUserByTelegramId(telegramId);
        if (createdUser) return createdUser;
      }
      throw new Error("Не удалось создать пользователя после вставки.");
    } catch (error) {
      console.error("Ошибка при создании пользователя в SQLite:", error);
      throw new Error(
        `Ошибка при создании пользователя: ${error instanceof Error ? error.message : String(error)}`
      );
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
      console.error("Ошибка в findUserByTelegramIdOrCreate в SQLite:", error);
      throw new Error(
        `Ошибка при поиске или создании пользователя: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

}
