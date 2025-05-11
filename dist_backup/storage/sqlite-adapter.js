/**
 * SQLite адаптер хранилища для локальной разработки
 *
 * Адаптер использует локальную SQLite базу данных вместо Neon
 * для автономной разработки без внешних зависимостей.
 */
import { Database } from "bun:sqlite";
import path from "path";
import { fileURLToPath } from "url";
// Для ES модулей получаем dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Создает SQLite адаптер для локальной разработки
 */
export function createSQLiteStorageAdapter(dbPath) {
    // Если путь не указан, используем путь по умолчанию
    const fullDbPath = dbPath || path.resolve(__dirname, "../.dev/sqlite.db");
    // Подключение к базе данных
    const db = new Database(fullDbPath);
    // Включаем поддержку внешних ключей
    db.exec("PRAGMA foreign_keys = ON;");
    // Реализация StorageAdapter
    return {
        // ПОЛЬЗОВАТЕЛИ
        // Получение пользователя по Telegram ID
        async getUserByTelegramId(telegramId) {
            try {
                const row = db
                    .prepare(`
          SELECT id, telegram_id, username, first_name, last_name
          FROM Users
          WHERE telegram_id = ?
        `)
                    .get(telegramId);
                if (!row)
                    return null;
                return {
                    id: row.id.toString(),
                    telegramId,
                    username: row.username || "",
                    firstName: row.first_name || "",
                    lastName: row.last_name || "",
                };
            }
            catch (error) {
                console.error("Ошибка при получении пользователя:", error);
                return null;
            }
        },
        // Создание нового пользователя
        async createUser(userData) {
            try {
                const result = db
                    .prepare(`
          INSERT INTO Users (
            telegram_id, username, first_name, last_name
          ) VALUES (?, ?, ?, ?)
          ON CONFLICT(telegram_id) DO UPDATE SET
            username = excluded.username,
            first_name = excluded.first_name,
            last_name = excluded.last_name,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, telegram_id, username, first_name, last_name
        `)
                    .get(userData.telegramId, userData.username || null, userData.firstName || null, userData.lastName || null);
                if (!result) {
                    // Если RETURNING не поддерживается, получаем пользователя отдельно
                    const user = db
                        .prepare(`
            SELECT id, telegram_id, username, first_name, last_name
            FROM Users
            WHERE telegram_id = ?
          `)
                        .get(userData.telegramId);
                    return {
                        id: user.id.toString(),
                        telegramId: user.telegram_id,
                        username: user.username || "",
                        firstName: user.first_name || "",
                        lastName: user.last_name || "",
                    };
                }
                return {
                    id: result.id.toString(),
                    telegramId: result.telegram_id,
                    username: result.username || "",
                    firstName: result.first_name || "",
                    lastName: result.last_name || "",
                };
            }
            catch (error) {
                console.error("Ошибка при создании пользователя:", error);
                return null;
            }
        },
        // ПРОЕКТЫ
        // Получение проектов пользователя
        async getProjectsByUserId(userId) {
            try {
                const rows = db
                    .prepare(`
          SELECT id, name, description, industry, is_active
          FROM Projects
          WHERE user_id = ?
          ORDER BY created_at DESC
        `)
                    .all(userId);
                return rows.map(row => ({
                    id: row.id.toString(),
                    name: row.name,
                    description: row.description || "",
                    industry: row.industry || "",
                    isActive: row.is_active === 1,
                }));
            }
            catch (error) {
                console.error("Ошибка при получении проектов:", error);
                return [];
            }
        },
        // Создание нового проекта
        async createProject(userId, projectData) {
            try {
                const result = db
                    .prepare(`
          INSERT INTO Projects (
            user_id, name, description, industry
          ) VALUES (?, ?, ?, ?)
          RETURNING id, name, description, industry, is_active
        `)
                    .get(userId, projectData.name, projectData.description || null, projectData.industry || null);
                if (!result) {
                    // Для версий SQLite без поддержки RETURNING
                    const stmt = db.prepare(`
            INSERT INTO Projects (
              user_id, name, description, industry
            ) VALUES (?, ?, ?, ?)
          `);
                    const info = stmt.run(userId, projectData.name, projectData.description || null, projectData.industry || null);
                    if (!info.lastInsertRowid) {
                        throw new Error("Не удалось создать проект");
                    }
                    const project = db
                        .prepare(`
            SELECT id, name, description, industry, is_active
            FROM Projects
            WHERE id = ?
          `)
                        .get(info.lastInsertRowid);
                    return {
                        id: project.id.toString(),
                        name: project.name,
                        description: project.description || "",
                        industry: project.industry || "",
                        isActive: project.is_active === 1,
                    };
                }
                return {
                    id: result.id.toString(),
                    name: result.name,
                    description: result.description || "",
                    industry: result.industry || "",
                    isActive: result.is_active === 1,
                };
            }
            catch (error) {
                console.error("Ошибка при создании проекта:", error);
                return null;
            }
        },
        // КОНКУРЕНТЫ
        // Добавление аккаунта конкурента
        async addCompetitorAccount(projectId, competitorData) {
            try {
                const result = db
                    .prepare(`
          INSERT INTO Competitors (
            project_id, username, instagram_url, notes
          ) VALUES (?, ?, ?, ?)
          RETURNING id, username, instagram_url, notes
        `)
                    .get(projectId, competitorData.username, competitorData.instagramUrl, competitorData.notes || null);
                if (!result) {
                    // Для версий SQLite без поддержки RETURNING
                    const stmt = db.prepare(`
            INSERT INTO Competitors (
              project_id, username, instagram_url, notes
            ) VALUES (?, ?, ?, ?)
          `);
                    const info = stmt.run(projectId, competitorData.username, competitorData.instagramUrl, competitorData.notes || null);
                    if (!info.lastInsertRowid) {
                        throw new Error("Не удалось добавить конкурента");
                    }
                    const competitor = db
                        .prepare(`
            SELECT id, username, instagram_url, notes
            FROM Competitors
            WHERE id = ?
          `)
                        .get(info.lastInsertRowid);
                    return {
                        id: competitor.id.toString(),
                        username: competitor.username,
                        instagramUrl: competitor.instagram_url,
                        notes: competitor.notes || "",
                    };
                }
                return {
                    id: result.id.toString(),
                    username: result.username,
                    instagramUrl: result.instagram_url,
                    notes: result.notes || "",
                };
            }
            catch (error) {
                console.error("Ошибка при добавлении конкурента:", error);
                return null;
            }
        },
        // Получение аккаунтов конкурентов
        async getCompetitorAccounts(projectId) {
            try {
                const rows = db
                    .prepare(`
          SELECT id, username, instagram_url, notes
          FROM Competitors
          WHERE project_id = ?
          ORDER BY created_at DESC
        `)
                    .all(projectId);
                return rows.map(row => ({
                    id: row.id.toString(),
                    username: row.username,
                    instagramUrl: row.instagram_url,
                    notes: row.notes || "",
                }));
            }
            catch (error) {
                console.error("Ошибка при получении конкурентов:", error);
                return [];
            }
        },
        // ХЭШТЕГИ
        // Добавление хэштега для отслеживания
        async addTrackingHashtag(projectId, hashtagData) {
            try {
                const cleanName = hashtagData.name.replace(/^#/, "");
                const result = db
                    .prepare(`
          INSERT INTO Hashtags (
            project_id, name, notes
          ) VALUES (?, ?, ?)
          RETURNING id, name, notes
        `)
                    .get(projectId, cleanName, hashtagData.notes || null);
                if (!result) {
                    // Для версий SQLite без поддержки RETURNING
                    const stmt = db.prepare(`
            INSERT INTO Hashtags (
              project_id, name, notes
            ) VALUES (?, ?, ?)
          `);
                    const info = stmt.run(projectId, cleanName, hashtagData.notes || null);
                    if (!info.lastInsertRowid) {
                        throw new Error("Не удалось добавить хэштег");
                    }
                    const hashtag = db
                        .prepare(`
            SELECT id, name, notes
            FROM Hashtags
            WHERE id = ?
          `)
                        .get(info.lastInsertRowid);
                    return {
                        id: hashtag.id.toString(),
                        name: hashtag.name,
                        notes: hashtag.notes || "",
                    };
                }
                return {
                    id: result.id.toString(),
                    name: result.name,
                    notes: result.notes || "",
                };
            }
            catch (error) {
                console.error("Ошибка при добавлении хэштега:", error);
                return null;
            }
        },
        // Получение отслеживаемых хэштегов
        async getTrackingHashtags(projectId) {
            try {
                const rows = db
                    .prepare(`
          SELECT id, name, notes
          FROM Hashtags
          WHERE project_id = ?
          ORDER BY created_at DESC
        `)
                    .all(projectId);
                return rows.map(row => ({
                    id: row.id.toString(),
                    name: row.name,
                    notes: row.notes || "",
                }));
            }
            catch (error) {
                console.error("Ошибка при получении хэштегов:", error);
                return [];
            }
        },
        // REELS
        // Сохранение Reels
        async saveReels(projectId, sourceType, sourceId, reels) {
            try {
                let insertedCount = 0;
                const insertStmt = db.prepare(`
          INSERT INTO ReelsContent (
            project_id, source_type, source_id, reels_url,
            publication_date, views_count, likes_count, comments_count,
            description, author_username, author_id, audio_title, audio_artist
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(reels_url) DO UPDATE SET
            views_count = excluded.views_count,
            likes_count = excluded.likes_count,
            comments_count = excluded.comments_count,
            updated_at = CURRENT_TIMESTAMP
        `);
                db.transaction(() => {
                    for (const reel of reels) {
                        const info = insertStmt.run(projectId, sourceType, sourceId, reel.url, reel.publishedAt
                            ? new Date(reel.publishedAt).toISOString()
                            : null, reel.views || null, reel.likes || null, reel.comments || null, reel.description || null, reel.authorUsername || null, reel.authorId || null, reel.audioTitle || null, reel.audioArtist || null);
                        if (info.changes > 0) {
                            insertedCount++;
                        }
                    }
                })();
                return insertedCount;
            }
            catch (error) {
                console.error("Ошибка при сохранении Reels:", error);
                return 0;
            }
        },
        // Получение Reels
        async getReels(projectId, options = {}) {
            try {
                const { limit = 10, offset = 0, sort = "views_desc", sourceType, sourceId, } = options;
                let query = `
          SELECT
            id, reels_url, publication_date, views_count, likes_count,
            comments_count, description, author_username, author_id,
            audio_title, audio_artist, source_type, source_id
          FROM ReelsContent
          WHERE project_id = ?
        `;
                const params = [projectId];
                if (sourceType) {
                    query += " AND source_type = ?";
                    params.push(sourceType);
                    if (sourceId) {
                        query += " AND source_id = ?";
                        params.push(sourceId);
                    }
                }
                // Сортировка
                if (sort === "views_desc") {
                    query += " ORDER BY views_count DESC, publication_date DESC";
                }
                else if (sort === "date_desc") {
                    query += " ORDER BY publication_date DESC, views_count DESC";
                }
                else if (sort === "likes_desc") {
                    query += " ORDER BY likes_count DESC, views_count DESC";
                }
                query += " LIMIT ? OFFSET ?";
                params.push(limit, offset);
                const rows = db.prepare(query).all(...params);
                return rows.map(row => ({
                    id: row.id.toString(),
                    url: row.reels_url,
                    publishedAt: row.publication_date
                        ? new Date(row.publication_date)
                        : undefined,
                    views: row.views_count,
                    likes: row.likes_count,
                    comments: row.comments_count,
                    description: row.description || "",
                    authorUsername: row.author_username || "",
                    authorId: row.author_id || "",
                    audioTitle: row.audio_title || "",
                    audioArtist: row.audio_artist || "",
                    sourceType: row.source_type,
                    sourceId: row.source_id.toString(),
                }));
            }
            catch (error) {
                console.error("Ошибка при получении Reels:", error);
                return [];
            }
        },
        // Закрытие соединения
        async close() {
            try {
                db.close();
                return true;
            }
            catch (error) {
                console.error("Ошибка при закрытии соединения:", error);
                return false;
            }
        },
    };
}
