import { Pool } from "pg";
/**
 * Адаптер для работы с базой данных Neon
 */
export class NeonStorageAdapter {
    /**
     * Создает новый адаптер для Neon DB
     * @param connectionString Строка подключения к базе данных Neon
     */
    constructor(connectionString) {
        this.client = null;
        this.pool = new Pool({
            connectionString,
            ssl: {
                rejectUnauthorized: false,
            },
        });
    }
    /**
     * Инициализирует подключение к базе данных
     */
    async initialize() {
        if (!this.client) {
            this.client = await this.pool.connect();
        }
    }
    /**
     * Закрывает подключение к базе данных
     */
    async close() {
        if (this.client) {
            this.client.release();
            this.client = null;
        }
    }
    /**
     * Получает пользователя по идентификатору Telegram
     * @param telegramId Идентификатор пользователя в Telegram
     */
    async getUserByTelegramId(telegramId) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        const result = await this.client.query('SELECT * FROM "Users" WHERE telegram_id = $1', [telegramId]);
        return result.rows[0] || null;
    }
    /**
     * Создает нового пользователя
     * @param telegramId Идентификатор пользователя в Telegram
     * @param username Имя пользователя (опционально)
     * @param firstName Имя (опционально)
     * @param lastName Фамилия (опционально)
     */
    async createUser(telegramId, username, firstName, lastName) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        const result = await this.client.query('INSERT INTO "Users" (telegram_id, username, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING *', [telegramId, username, firstName, lastName]);
        return result.rows[0];
    }
    /**
     * Получает проекты пользователя
     * @param userId Идентификатор пользователя
     */
    async getProjectsByUserId(userId) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        const result = await this.client.query('SELECT * FROM "Projects" WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return result.rows;
    }
    /**
     * Получает проект по идентификатору
     * @param projectId Идентификатор проекта
     */
    async getProjectById(projectId) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        const result = await this.client.query('SELECT * FROM "Projects" WHERE id = $1', [projectId]);
        return result.rows[0] || null;
    }
    /**
     * Создает новый проект
     * @param userId Идентификатор пользователя
     * @param name Название проекта
     */
    async createProject(userId, name) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        const result = await this.client.query('INSERT INTO "Projects" (user_id, name, is_active) VALUES ($1, $2, true) RETURNING *', [userId, name]);
        return result.rows[0];
    }
    /**
     * Обновляет проект
     * @param projectId Идентификатор проекта
     * @param updates Данные для обновления
     */
    async updateProject(projectId, updates) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        const updateFields = [];
        const values = [];
        let valueIndex = 1;
        if (updates.name !== undefined) {
            updateFields.push(`name = $${valueIndex}`);
            values.push(updates.name);
            valueIndex++;
        }
        if (updates.is_active !== undefined) {
            updateFields.push(`is_active = $${valueIndex}`);
            values.push(updates.is_active);
            valueIndex++;
        }
        // Добавляем updated_at
        updateFields.push(`updated_at = NOW()`);
        // Добавляем projectId в конец массива values
        values.push(projectId.toString());
        const result = await this.client.query(`UPDATE "Projects" SET ${updateFields.join(", ")} WHERE id = $${valueIndex} RETURNING *`, values);
        return result.rows[0];
    }
    /**
     * Получает конкурентов проекта
     * @param projectId Идентификатор проекта
     */
    async getCompetitorAccounts(projectId) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        const result = await this.client.query('SELECT * FROM "Competitors" WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
        return result.rows;
    }
    /**
     * Получает конкурента по идентификатору
     * @param competitorId Идентификатор конкурента
     */
    async getCompetitorById(competitorId) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        const result = await this.client.query('SELECT * FROM "Competitors" WHERE id = $1', [competitorId]);
        return result.rows[0] || null;
    }
    /**
     * Создает нового конкурента
     * @param projectId Идентификатор проекта
     * @param username Имя пользователя
     * @param instagramUrl URL аккаунта Instagram
     * @param notes Примечания (опционально)
     */
    async createCompetitor(projectId, username, instagramUrl, notes) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        const result = await this.client.query('INSERT INTO "Competitors" (project_id, username, instagram_url, notes) VALUES ($1, $2, $3, $4) RETURNING *', [projectId, username, instagramUrl, notes]);
        return result.rows[0];
    }
    /**
     * Обновляет конкурента
     * @param competitorId Идентификатор конкурента
     * @param updates Данные для обновления
     */
    async updateCompetitor(competitorId, updates) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        const updateFields = [];
        const values = [];
        let valueIndex = 1;
        if (updates.username !== undefined) {
            updateFields.push(`username = $${valueIndex}`);
            values.push(updates.username);
            valueIndex++;
        }
        if (updates.instagram_url !== undefined) {
            updateFields.push(`instagram_url = $${valueIndex}`);
            values.push(updates.instagram_url);
            valueIndex++;
        }
        if (updates.notes !== undefined) {
            updateFields.push(`notes = $${valueIndex}`);
            values.push(updates.notes);
            valueIndex++;
        }
        // Добавляем updated_at
        updateFields.push(`updated_at = NOW()`);
        // Добавляем competitorId в конец массива values
        values.push(competitorId.toString());
        const result = await this.client.query(`UPDATE "Competitors" SET ${updateFields.join(", ")} WHERE id = $${valueIndex} RETURNING *`, values);
        return result.rows[0];
    }
    /**
     * Удаляет конкурента
     * @param competitorId Идентификатор конкурента
     */
    async deleteCompetitor(competitorId) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        const result = await this.client.query('DELETE FROM "Competitors" WHERE id = $1 RETURNING id', [competitorId]);
        return (result.rowCount ?? 0) > 0;
    }
    /**
     * Получает хэштеги проекта
     * @param projectId Идентификатор проекта
     */
    async getTrackingHashtags(projectId) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        const result = await this.client.query('SELECT * FROM "Hashtags" WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
        return result.rows;
    }
    /**
     * Получает хэштег по идентификатору
     * @param hashtagId Идентификатор хэштега
     */
    async getHashtagById(hashtagId) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        const result = await this.client.query('SELECT * FROM "Hashtags" WHERE id = $1', [hashtagId]);
        return result.rows[0] || null;
    }
    /**
     * Создает новый хэштег
     * @param projectId Идентификатор проекта
     * @param name Название хэштега
     * @param notes Примечания (опционально)
     */
    async createHashtag(projectId, name, notes) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        // Удаляем символ # в начале, если он есть
        const cleanName = name.startsWith("#") ? name.substring(1) : name;
        const result = await this.client.query('INSERT INTO "Hashtags" (project_id, name, notes) VALUES ($1, $2, $3) RETURNING *', [projectId, cleanName, notes]);
        return result.rows[0];
    }
    /**
     * Обновляет хэштег
     * @param hashtagId Идентификатор хэштега
     * @param updates Данные для обновления
     */
    async updateHashtag(hashtagId, updates) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        const updateFields = [];
        const values = [];
        let valueIndex = 1;
        if (updates.name !== undefined) {
            // Удаляем символ # в начале, если он есть
            const cleanName = updates.name.startsWith("#")
                ? updates.name.substring(1)
                : updates.name;
            updateFields.push(`name = $${valueIndex}`);
            values.push(cleanName);
            valueIndex++;
        }
        if (updates.notes !== undefined) {
            updateFields.push(`notes = $${valueIndex}`);
            values.push(updates.notes);
            valueIndex++;
        }
        // Добавляем updated_at
        updateFields.push(`updated_at = NOW()`);
        // Добавляем hashtagId в конец массива values
        values.push(hashtagId.toString());
        const result = await this.client.query(`UPDATE "Hashtags" SET ${updateFields.join(", ")} WHERE id = $${valueIndex} RETURNING *`, values);
        return result.rows[0];
    }
    /**
     * Удаляет хэштег
     * @param hashtagId Идентификатор хэштега
     */
    async deleteHashtag(hashtagId) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        const result = await this.client.query('DELETE FROM "Hashtags" WHERE id = $1 RETURNING id', [hashtagId]);
        return (result.rowCount ?? 0) > 0;
    }
    /**
     * Получает Reels проекта
     * @param projectId Идентификатор проекта
     * @param options Параметры запроса
     */
    async getReels(projectId, options) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        const limit = options?.limit || 10;
        const offset = options?.offset || 0;
        // Получаем общее количество Reels
        const countResult = await this.client.query('SELECT COUNT(*) as total FROM "ReelsContent" WHERE project_id = $1', [projectId]);
        const total = parseInt(countResult.rows[0].total);
        // Получаем Reels с пагинацией
        const result = await this.client.query('SELECT * FROM "ReelsContent" WHERE project_id = $1 ORDER BY publication_date DESC LIMIT $2 OFFSET $3', [projectId, limit, offset]);
        return {
            reels: result.rows,
            total,
        };
    }
    /**
     * Сохраняет Reels в базу данных
     * @param reels Массив Reels для сохранения
     */
    async saveReels(reels) {
        if (!this.client)
            throw new Error("Соединение с базой данных не инициализировано");
        let savedCount = 0;
        // Используем транзакцию для пакетного сохранения
        try {
            await this.client.query("BEGIN");
            for (const reel of reels) {
                // Проверяем, существует ли уже такой Reel
                const existingResult = await this.client.query('SELECT id FROM "ReelsContent" WHERE reels_url = $1', [reel.reels_url]);
                if (existingResult.rows.length === 0) {
                    // Если нет, добавляем новый
                    await this.client.query(`INSERT INTO "ReelsContent" (
              project_id, source_type, source_id, reels_url, 
              publication_date, views_count, likes_count, comments_count,
              description, author_username, author_id, audio_title, audio_artist
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [
                        reel.project_id,
                        reel.source_type,
                        reel.source_id,
                        reel.reels_url,
                        reel.publication_date,
                        reel.views_count,
                        reel.likes_count,
                        reel.comments_count,
                        reel.description,
                        reel.author_username,
                        reel.author_id,
                        reel.audio_title,
                        reel.audio_artist,
                    ]);
                    savedCount++;
                }
            }
            await this.client.query("COMMIT");
        }
        catch (error) {
            await this.client.query("ROLLBACK");
            throw error;
        }
        return savedCount;
    }
}
/**
 * Фабричная функция для создания адаптера Neon
 * @param connectionString Строка подключения к базе данных Neon
 */
export function createNeonStorageAdapter(connectionString) {
    return new NeonStorageAdapter(connectionString);
}
