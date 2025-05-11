/**
 * SQLite Adapter для Instagram Scraper Bot
 *
 * Этот адаптер предоставляет интерфейс для работы с локальной SQLite базой данных
 * для автономной разработки и тестирования модуля Instagram Scraper Bot.
 */
import { Database } from "bun:sqlite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
/**
 * Адаптер для работы с SQLite базой данных
 * Реализует интерфейс StorageAdapter
 */
export class SqliteAdapter {
    /**
     * Создает новый экземпляр адаптера SQLite
     * @param config Настройки адаптера
     */
    constructor(config = {}) {
        this.db = null;
        // Определение пути к базе данных
        if (config.dbPath) {
            this.dbPath = config.dbPath;
        }
        else {
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
     * Подключение к базе данных
     */
    async connect() {
        if (!this.db) {
            try {
                // Создаем или открываем существующую SQLite базу данных
                this.db = new Database(this.dbPath);
                // Включаем поддержку внешних ключей
                this.db.exec("PRAGMA foreign_keys = ON;");
                console.log(`SQLite адаптер подключен к базе данных: ${this.dbPath}`);
            }
            catch (error) {
                console.error("Ошибка при подключении к SQLite базе данных:", error);
                throw new Error(`Ошибка подключения к SQLite: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    /**
     * Отключение от базы данных
     */
    async disconnect() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log("SQLite адаптер отключен от базы данных");
        }
    }
    /**
     * Проверяет подключение к базе данных и выдает ошибку, если нет подключения
     */
    ensureConnection() {
        if (!this.db) {
            throw new Error("Нет подключения к SQLite базе данных. Вызовите connect() перед использованием адаптера.");
        }
        return this.db;
    }
    /**
     * Получение списка проектов пользователя
     * @param userId ID пользователя
     */
    async getProjects(userId) {
        const db = this.ensureConnection();
        try {
            const query = db.prepare(`
        SELECT * FROM Projects
        WHERE user_id = ? AND is_active = 1
        ORDER BY created_at DESC
      `);
            const projects = query.all(userId);
            return projects;
        }
        catch (error) {
            console.error("Ошибка при получении проектов из SQLite:", error);
            throw new Error(`Ошибка при получении проектов: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Получение проекта по ID
     * @param projectId ID проекта
     */
    async getProject(projectId) {
        const db = this.ensureConnection();
        try {
            const query = db.prepare(`
        SELECT * FROM Projects
        WHERE id = ?
      `);
            const project = query.get(projectId);
            return project;
        }
        catch (error) {
            console.error("Ошибка при получении проекта из SQLite:", error);
            throw new Error(`Ошибка при получении проекта: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Создание нового проекта
     * @param userId ID пользователя
     * @param name Название проекта
     * @param description Описание проекта
     */
    async createProject(userId, name, description) {
        const db = this.ensureConnection();
        try {
            const query = db.prepare(`
        INSERT INTO Projects (user_id, name, description)
        VALUES (?, ?, ?)
      `);
            const result = query.run(userId, name, description || null);
            // Получаем созданный проект
            if (result.lastInsertRowid) {
                const projectId = Number(result.lastInsertRowid);
                const project = await this.getProject(projectId);
                if (project) {
                    return project;
                }
            }
            throw new Error("Не удалось создать проект");
        }
        catch (error) {
            console.error("Ошибка при создании проекта в SQLite:", error);
            throw new Error(`Ошибка при создании проекта: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Получение списка конкурентов для проекта
     * @param projectId ID проекта
     */
    async getCompetitors(projectId) {
        const db = this.ensureConnection();
        try {
            const query = db.prepare(`
        SELECT * FROM Competitors
        WHERE project_id = ? AND is_active = 1
        ORDER BY created_at DESC
      `);
            const competitors = query.all(projectId);
            return competitors;
        }
        catch (error) {
            console.error("Ошибка при получении конкурентов из SQLite:", error);
            throw new Error(`Ошибка при получении конкурентов: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Добавление нового конкурента в проект
     * @param projectId ID проекта
     * @param username Имя пользователя (логин) конкурента в Instagram
     * @param fullName Полное имя конкурента
     * @param profileUrl URL профиля конкурента
     */
    async addCompetitor(projectId, username, fullName, profileUrl) {
        const db = this.ensureConnection();
        try {
            const query = db.prepare(`
        INSERT INTO Competitors (project_id, username, full_name, profile_url)
        VALUES (?, ?, ?, ?)
      `);
            const result = query.run(projectId, username, fullName || null, profileUrl || `https://instagram.com/${username}`);
            // Получаем созданного конкурента
            if (result.lastInsertRowid) {
                const competitorId = Number(result.lastInsertRowid);
                const getCompetitor = db.prepare(`
          SELECT * FROM Competitors
          WHERE id = ?
        `);
                const competitor = getCompetitor.get(competitorId);
                if (competitor) {
                    return competitor;
                }
            }
            throw new Error("Не удалось добавить конкурента");
        }
        catch (error) {
            console.error("Ошибка при добавлении конкурента в SQLite:", error);
            throw new Error(`Ошибка при добавлении конкурента: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Получение списка хэштегов для проекта
     * @param projectId ID проекта
     */
    async getHashtags(projectId) {
        const db = this.ensureConnection();
        try {
            const query = db.prepare(`
        SELECT * FROM Hashtags
        WHERE project_id = ? AND is_active = 1
        ORDER BY created_at DESC
      `);
            const hashtags = query.all(projectId);
            return hashtags;
        }
        catch (error) {
            console.error("Ошибка при получении хэштегов из SQLite:", error);
            throw new Error(`Ошибка при получении хэштегов: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Добавление нового хэштега в проект
     * @param projectId ID проекта
     * @param name Название хэштега (без символа #)
     */
    async addHashtag(projectId, name) {
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
                const hashtag = getHashtag.get(hashtagId);
                if (hashtag) {
                    return hashtag;
                }
            }
            throw new Error("Не удалось добавить хэштег");
        }
        catch (error) {
            console.error("Ошибка при добавлении хэштега в SQLite:", error);
            throw new Error(`Ошибка при добавлении хэштега: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Сохранение нового Reel в базу данных
     * @param reel Объект с данными о Reel
     */
    async saveReel(reel) {
        const db = this.ensureConnection();
        try {
            const query = db.prepare(`
        INSERT INTO ReelsContent (
          project_id, source_type, source_id, instagram_id, url, caption,
          owner_username, owner_id, view_count, like_count, comment_count,
          duration, thumbnail_url, audio_title, published_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (instagram_id) DO UPDATE SET
          view_count = excluded.view_count,
          like_count = excluded.like_count,
          comment_count = excluded.comment_count,
          fetched_at = CURRENT_TIMESTAMP
      `);
            const result = query.run(reel.project_id, reel.source_type, reel.source_id, reel.instagram_id, reel.url, reel.caption || null, reel.owner_username || null, reel.owner_id || null, reel.view_count || 0, reel.like_count || 0, reel.comment_count || 0, reel.duration || null, reel.thumbnail_url || null, reel.audio_title || null, reel.published_at || new Date().toISOString());
            // Получаем сохраненный Reel
            if (result.lastInsertRowid) {
                const reelId = Number(result.lastInsertRowid);
                const getReel = db.prepare(`
          SELECT * FROM ReelsContent
          WHERE id = ?
        `);
                const savedReel = getReel.get(reelId);
                if (savedReel) {
                    return savedReel;
                }
            }
            // Если был конфликт (ON CONFLICT UPDATE), получаем обновленную запись по instagram_id
            if (reel.instagram_id) {
                const getReel = db.prepare(`
          SELECT * FROM ReelsContent
          WHERE instagram_id = ?
        `);
                const updatedReel = getReel.get(reel.instagram_id);
                if (updatedReel) {
                    return updatedReel;
                }
            }
            throw new Error("Не удалось сохранить Reel");
        }
        catch (error) {
            console.error("Ошибка при сохранении Reel в SQLite:", error);
            throw new Error(`Ошибка при сохранении Reel: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Получение списка Reels для проекта с возможностью фильтрации
     * @param projectId ID проекта
     * @param filter Объект с параметрами фильтрации
     */
    async getReels(projectId, filter = {}) {
        const db = this.ensureConnection();
        try {
            // Базовый запрос
            let query = `
        SELECT * FROM ReelsContent
        WHERE project_id = ?
      `;
            const params = [projectId];
            // Применяем фильтры
            if (filter.sourceType) {
                query += ` AND source_type = ?`;
                params.push(filter.sourceType);
            }
            if (filter.sourceId) {
                query += ` AND source_id = ?`;
                params.push(filter.sourceId);
            }
            if (filter.minViews) {
                query += ` AND view_count >= ?`;
                params.push(filter.minViews);
            }
            if (filter.afterDate) {
                query += ` AND published_at >= ?`;
                params.push(filter.afterDate);
            }
            if (filter.beforeDate) {
                query += ` AND published_at <= ?`;
                params.push(filter.beforeDate);
            }
            // Сортировка
            query += ` ORDER BY ${filter.orderBy || "published_at"} ${filter.orderDirection || "DESC"}`;
            // Лимит и смещение
            if (filter.limit) {
                query += ` LIMIT ?`;
                params.push(filter.limit);
                if (filter.offset) {
                    query += ` OFFSET ?`;
                    params.push(filter.offset);
                }
            }
            const statement = db.prepare(query);
            const reels = statement.all(...params);
            return reels;
        }
        catch (error) {
            console.error("Ошибка при получении Reels из SQLite:", error);
            throw new Error(`Ошибка при получении Reels: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Обновление статуса обработки Reel
     * @param reelId ID Reel
     * @param isProcessed Статус обработки
     * @param status Дополнительная информация о статусе
     * @param result Результат обработки
     */
    async updateReelProcessingStatus(reelId, isProcessed, status, result) {
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
        }
        catch (error) {
            console.error("Ошибка при обновлении статуса обработки Reel в SQLite:", error);
            throw new Error(`Ошибка при обновлении статуса обработки Reel: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
