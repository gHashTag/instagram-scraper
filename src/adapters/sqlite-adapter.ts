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
import {
  StorageAdapter,
  User,
  Project,
  Competitor,
  Hashtag,
  ReelContent,
  ReelsFilter,
  ParsingRunLog,
} from "@/types";

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
    const db = this.ensureConnection();
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

  async logParsingRun(log: Partial<ParsingRunLog>): Promise<ParsingRunLog> {
    const db = this.ensureConnection();
    const {
      run_id = `run_${Date.now()}`,
      project_id,
      source_type,
      source_id,
      status,
      started_at = new Date().toISOString(), // Убедимся, что есть значение по умолчанию
      ended_at,
      reels_found_count = 0,
      reels_added_count = 0,
      errors_count = 0,
      error_message,
    } = log;

    if (
      project_id === undefined ||
      source_type === undefined ||
      source_id === undefined ||
      status === undefined
    ) {
      // TODO: более строгая валидация или возвращение ошибки
      console.error(
        "logParsingRun: Missing required fields (project_id, source_type, source_id, status)",
        log
      );
      // @ts-expect-error - returning partial log as error indicator
      return { ...log, id: "ERROR_MISSING_FIELDS" };
    }

    try {
      const query = db.prepare(`
        INSERT INTO ParsingRunLogs (
          run_id, project_id, source_type, source_id, status, started_at,
          ended_at, reels_found_count, reels_added_count, errors_count, error_message
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(run_id, project_id, source_type, source_id) DO UPDATE SET
          status = excluded.status,
          ended_at = excluded.ended_at,
          reels_found_count = excluded.reels_found_count,
          reels_added_count = excluded.reels_added_count,
          errors_count = excluded.errors_count,
          error_message = excluded.error_message
      `);

      const result = query.run(
        run_id,
        project_id,
        source_type,
        String(source_id), // Для SQLite source_id должен быть строкой, если это username
        status,
        started_at,
        ended_at || null,
        reels_found_count,
        reels_added_count,
        errors_count,
        error_message || null
      );

      // Попытаемся вернуть полную запись лога, если это новая запись
      // Для существующей (ON CONFLICT) это будет сложнее без SELECT, но для простоты вернем входные данные + id
      let loggedRun: ParsingRunLog;
      if (result.lastInsertRowid) {
        // Это была новая запись, но lastInsertRowid не является run_id
        // Мы могли бы сделать SELECT, но пока вернем дополненный log
        loggedRun = {
          ...log,
          id: String(result.lastInsertRowid), // это ID строки, а не run_id
          run_id,
          project_id,
          source_type,
          source_id: String(source_id),
          status,
          started_at,
          // reels_found_count, reels_added_count, errors_count уже есть в log
        } as ParsingRunLog; // Приведение типа, так как мы дополнили все поля
      } else {
        // Это было обновление, вернем входные данные, т.к. run_id уже есть
        loggedRun = {
          ...log,
          run_id, // Убедимся, что run_id есть
          project_id,
          source_type,
          source_id: String(source_id),
          status,
          started_at,
        } as ParsingRunLog;
      }
      return loggedRun;
    } catch (error) {
      console.error("Ошибка при логировании запуска парсинга в SQLite:", error);
      throw new Error(
        `Ошибка при логировании запуска парсинга: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
