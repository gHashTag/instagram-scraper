import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
// Получаем dirname для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Загружаем переменные окружения
dotenv.config({ path: path.join(__dirname, "../.env") });
// Состояние подключения к базе данных
let sql = null;
let initialized = false;
/**
 * Инициализирует подключение к Neon
 */
export async function initializeNeonStorage() {
    try {
        if (!process.env.NEON_DATABASE_URL) {
            throw new Error("Не задана переменная окружения NEON_DATABASE_URL");
        }
        if (!initialized) {
            sql = neon(process.env.NEON_DATABASE_URL);
            initialized = true;
        }
    }
    catch (error) {
        console.error("Ошибка при инициализации подключения к Neon:", error);
        throw error;
    }
}
/**
 * Закрывает подключение к Neon
 */
export async function closeNeonStorage() {
    sql = null;
    initialized = false;
}
/**
 * Проверяет, инициализировано ли подключение к базе данных
 */
function ensureInitialized() {
    if (!initialized || !sql) {
        throw new Error("Neon хранилище не инициализировано. Вызовите initializeNeonStorage() перед использованием.");
    }
}
// ===== ПОЛЬЗОВАТЕЛИ И ПРОЕКТЫ =====
/**
 * Создает нового пользователя
 */
export async function createUser(telegramId, username, firstName, lastName) {
    ensureInitialized();
    try {
        const userRes = await sql `
      INSERT INTO Users (telegram_id, username, first_name, last_name)
      VALUES (${telegramId}, ${username || null}, ${firstName || null}, ${lastName || null})
      ON CONFLICT (telegram_id) DO UPDATE 
      SET username = ${username || null}, 
          first_name = ${firstName || null}, 
          last_name = ${lastName || null},
          last_active_at = CURRENT_TIMESTAMP
      RETURNING id, telegram_id, username, first_name, last_name, subscription_level
    `;
        return userRes[0];
    }
    catch (error) {
        console.error("Ошибка при создании/обновлении пользователя:", error);
        throw error;
    }
}
/**
 * Получает пользователя по Telegram ID
 */
export async function getUserByTelegramId(telegramId) {
    ensureInitialized();
    try {
        const userRes = await sql `
      SELECT id, telegram_id, username, first_name, last_name, subscription_level, subscription_expires_at
      FROM Users
      WHERE telegram_id = ${telegramId}
    `;
        return userRes.length > 0 ? userRes[0] : null;
    }
    catch (error) {
        console.error("Ошибка при получении пользователя:", error);
        throw error;
    }
}
/**
 * Создает новый проект
 */
export async function createProject(userId, name, description, industry) {
    ensureInitialized();
    try {
        const projectRes = await sql `
      INSERT INTO Projects (user_id, name, description, industry)
      VALUES (${userId}, ${name}, ${description || null}, ${industry || null})
      RETURNING id, user_id, name, description, industry, is_active
    `;
        return projectRes[0];
    }
    catch (error) {
        console.error("Ошибка при создании проекта:", error);
        throw error;
    }
}
/**
 * Получает проекты пользователя
 */
export async function getProjectsByUserId(userId) {
    ensureInitialized();
    try {
        const projectsRes = await sql `
      SELECT id, user_id, name, description, industry, is_active
      FROM Projects
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
        return projectsRes;
    }
    catch (error) {
        console.error("Ошибка при получении проектов пользователя:", error);
        throw error;
    }
}
// ===== КОНКУРЕНТЫ И ХЭШТЕГИ =====
/**
 * Добавляет аккаунт конкурента
 */
export async function addCompetitorAccount(projectId, instagramUrl, accountName, notes, priority = 0) {
    ensureInitialized();
    try {
        const accountRes = await sql `
      INSERT INTO CompetitorAccounts (project_id, instagram_url, account_name, notes, priority)
      VALUES (${projectId}, ${instagramUrl}, ${accountName || null}, ${notes || null}, ${priority})
      RETURNING id, project_id, instagram_url, instagram_username, account_name, notes, is_active, priority, last_parsed_at
    `;
        return accountRes[0];
    }
    catch (error) {
        console.error("Ошибка при добавлении аккаунта конкурента:", error);
        throw error;
    }
}
/**
 * Получает аккаунты конкурентов проекта
 */
export async function getCompetitorAccounts(projectId, activeOnly = true) {
    ensureInitialized();
    try {
        let query = `
      SELECT id, project_id, instagram_url, instagram_username, account_name, notes, is_active, priority, last_parsed_at
      FROM CompetitorAccounts
      WHERE project_id = $1
    `;
        const params = [projectId];
        let paramCount = 2;
        if (activeOnly) {
            query += ` AND is_active = $${paramCount++}`;
            params.push(1);
        }
        query += " ORDER BY priority ASC, created_at ASC";
        // Выполняем запрос, вызывая sql.query
        const accountsRes = await sql.query(query, params);
        return accountsRes;
    }
    catch (error) {
        console.error("Ошибка при получении аккаунтов конкурентов:", error);
        throw error;
    }
}
/**
 * Добавляет хэштег для отслеживания
 */
export async function addTrackingHashtag(projectId, hashtag, displayName, notes, priority = 0) {
    ensureInitialized();
    try {
        // Удаляем символ # в начале хэштега, если он есть
        const cleanHashtag = hashtag.startsWith("#")
            ? hashtag.substring(1)
            : hashtag;
        const hashtagRes = await sql `
      INSERT INTO TrackingHashtags (project_id, hashtag, display_name, notes, priority)
      VALUES (${projectId}, ${cleanHashtag}, ${displayName || `#${cleanHashtag}`}, ${notes || null}, ${priority})
      RETURNING id, project_id, hashtag, display_name, notes, is_active, priority, last_parsed_at
    `;
        return hashtagRes[0];
    }
    catch (error) {
        console.error("Ошибка при добавлении хэштега:", error);
        throw error;
    }
}
/**
 * Получает хэштеги проекта
 */
export async function getTrackingHashtags(projectId, activeOnly = true) {
    ensureInitialized();
    try {
        let query = `
      SELECT id, project_id, hashtag, display_name, notes, is_active, priority, last_parsed_at
      FROM TrackingHashtags
      WHERE project_id = $1
    `;
        const params = [projectId];
        let paramCount = 2;
        if (activeOnly) {
            query += ` AND is_active = $${paramCount++}`;
            params.push(1);
        }
        query += " ORDER BY priority ASC, created_at ASC";
        // Выполняем запрос, вызывая sql.query
        const hashtagsRes = await sql.query(query, params);
        return hashtagsRes;
    }
    catch (error) {
        console.error("Ошибка при получении хэштегов:", error);
        throw error;
    }
}
// ===== СОХРАНЕНИЕ И ПОЛУЧЕНИЕ REELS =====
/**
 * Сохраняет Instagram Reels и связывает их с источником
 */
export async function saveReels(reels, projectId, sourceType, sourceId) {
    ensureInitialized();
    let savedCount = 0;
    try {
        // Начинаем запись лога парсинга
        const runId = uuidv4();
        const startTime = new Date();
        await sql `
      INSERT INTO ParsingLogs (run_id, project_id, source_type, source_id, status, start_time)
      VALUES (${runId}, ${projectId}, ${sourceType}, ${sourceId}, 'running', ${startTime})
    `;
        // Сохраняем каждый Reel и связываем его с источником
        let errors = 0;
        for (const reel of reels) {
            try {
                // Проверяем, существует ли уже такой Reel
                const existingRes = await sql `
          SELECT id FROM InstagramReels WHERE reels_url = ${reel.reels_url}
        `;
                let reelId;
                if (existingRes.length === 0) {
                    // Сохраняем новый Reel
                    const reelRes = await sql `
            INSERT INTO InstagramReels (
              reels_url, publication_date, views_count, likes_count, comments_count, 
              description, author_username, author_id, audio_title, audio_artist,
              thumbnail_url, duration_seconds, raw_data
            )
            VALUES (
              ${reel.reels_url},
              ${reel.publication_date || null},
              ${reel.views_count || null},
              ${reel.likes_count || null},
              ${reel.comments_count || null},
              ${reel.description || null},
              ${reel.author_username || null},
              ${reel.author_id || null},
              ${reel.audio_title || null},
              ${reel.audio_artist || null},
              ${reel.thumbnail_url || null},
              ${reel.duration_seconds || null},
              ${reel.raw_data ? JSON.stringify(reel.raw_data) : null}
            )
            RETURNING id
          `;
                    reelId = reelRes[0].id;
                    savedCount++;
                }
                else {
                    // Обновляем существующий Reel
                    reelId = existingRes[0].id;
                    await sql `
            UPDATE InstagramReels
            SET 
              views_count = COALESCE(${reel.views_count}, views_count),
              likes_count = COALESCE(${reel.likes_count}, likes_count),
              comments_count = COALESCE(${reel.comments_count}, comments_count),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${reelId}
          `;
                }
                // Создаем связь с источником, если такой еще нет
                const existingLinkRes = await sql `
          SELECT id FROM ContentSources
          WHERE reels_id = ${reelId}
            AND project_id = ${projectId}
            AND source_type = ${sourceType}
            AND CASE 
                WHEN ${sourceType} = 'competitor' THEN competitor_id = ${sourceId}
                WHEN ${sourceType} = 'hashtag' THEN hashtag_id = ${sourceId}
                ELSE false
              END
        `;
                if (existingLinkRes.length === 0) {
                    // Создаем новую связь
                    if (sourceType === "competitor") {
                        await sql `
              INSERT INTO ContentSources (
                reels_id, source_type, competitor_id, hashtag_id, project_id
              ) VALUES (
                ${reelId}, ${sourceType}, ${sourceId}, null, ${projectId}
              )
            `;
                    }
                    else {
                        await sql `
              INSERT INTO ContentSources (
                reels_id, source_type, competitor_id, hashtag_id, project_id
              ) VALUES (
                ${reelId}, ${sourceType}, null, ${sourceId}, ${projectId}
              )
            `;
                    }
                }
            }
            catch (error) {
                console.error(`Ошибка при сохранении Reel ${reel.reels_url}:`, error);
                errors++;
            }
        }
        // Обновляем дату последнего парсинга источника
        if (sourceType === "competitor") {
            await sql `
        UPDATE CompetitorAccounts
        SET last_parsed_at = CURRENT_TIMESTAMP
        WHERE id = ${sourceId}
      `;
        }
        else {
            await sql `
        UPDATE TrackingHashtags
        SET last_parsed_at = CURRENT_TIMESTAMP
        WHERE id = ${sourceId}
      `;
        }
        // Завершаем запись лога парсинга
        const endTime = new Date();
        await sql `
      UPDATE ParsingLogs
      SET 
        status = ${errors > 0 ? "error" : "completed"},
        reels_added_count = ${savedCount},
        errors_count = ${errors},
        end_time = ${endTime},
        log_message = ${`Обработано ${reels.length} Reels, добавлено ${savedCount}, ошибок: ${errors}`}
      WHERE run_id = ${runId}
    `;
        return savedCount;
    }
    catch (error) {
        console.error("Ошибка при сохранении Reels:", error);
        throw error;
    }
}
/**
 * Получает Instagram Reels для проекта с возможностью фильтрации
 */
export async function getReels(projectId, filters = {}) {
    ensureInitialized();
    try {
        const limit = filters.limit || 100;
        const offset = filters.offset || 0;
        // Строим базовый запрос
        let query = `
      SELECT 
        r.id,
        r.reels_url,
        r.publication_date,
        r.views_count,
        r.likes_count,
        r.comments_count,
        r.description,
        r.author_username,
        r.author_id,
        r.audio_title,
        r.audio_artist,
        r.thumbnail_url,
        r.duration_seconds,
        r.parsed_at,
        cs.source_type,
        CASE 
          WHEN cs.source_type = 'competitor' THEN cs.competitor_id
          WHEN cs.source_type = 'hashtag' THEN cs.hashtag_id
        END as source_id,
        CASE 
          WHEN cs.source_type = 'competitor' THEN ca.account_name
          WHEN cs.source_type = 'hashtag' THEN th.display_name
        END as source_name
      FROM InstagramReels r
      JOIN ContentSources cs ON r.id = cs.reels_id
      LEFT JOIN CompetitorAccounts ca ON cs.competitor_id = ca.id
      LEFT JOIN TrackingHashtags th ON cs.hashtag_id = th.id
      WHERE cs.project_id = $1
    `;
        const params = [projectId];
        let paramIndex = 2; // начинаем с 2, так как $1 уже используется
        // Добавляем условия фильтрации
        if (filters.sourceType) {
            query += ` AND cs.source_type = $${paramIndex}`;
            params.push(filters.sourceType);
            paramIndex++;
        }
        if (filters.sourceId) {
            query += ` AND (
        (cs.source_type = 'competitor' AND cs.competitor_id = $${paramIndex}) OR
        (cs.source_type = 'hashtag' AND cs.hashtag_id = $${paramIndex})
      )`;
            params.push(filters.sourceId);
            paramIndex++;
        }
        if (filters.minViews) {
            query += ` AND r.views_count >= $${paramIndex}`;
            params.push(filters.minViews);
            paramIndex++;
        }
        if (filters.maxDaysOld) {
            query += ` AND r.publication_date >= $${paramIndex}`;
            params.push(new Date(Date.now() - filters.maxDaysOld * 24 * 60 * 60 * 1000));
            paramIndex++;
        }
        // Строим запрос для общего количества
        const countQuery = `SELECT COUNT(*) FROM (${query}) as filtered_reels`;
        // Добавляем сортировку и пагинацию
        query += ` ORDER BY r.publication_date DESC, r.views_count DESC`;
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
        // Выполняем запросы
        const totalRes = await sql.query(countQuery, params.slice(0, -2));
        const total = parseInt(totalRes[0].count);
        const reelsRes = await sql.query(query, params);
        return {
            reels: reelsRes,
            total,
        };
    }
    catch (error) {
        console.error("Ошибка при получении Reels:", error);
        throw error;
    }
}
/**
 * Получает статистику по спарсенным Reels для проекта
 */
export async function getProjectStats(projectId) {
    ensureInitialized();
    try {
        // Общее количество Reels и просмотров
        const statsRes = await sql `
      SELECT
        COUNT(DISTINCT r.id) as total_reels,
        SUM(r.views_count) as total_views,
        COUNT(DISTINCT cs.competitor_id) as competitors_count,
        COUNT(DISTINCT cs.hashtag_id) as hashtags_count
      FROM InstagramReels r
      JOIN ContentSources cs ON r.id = cs.reels_id
      WHERE cs.project_id = ${projectId}
    `;
        // Получаем самые популярные Reels
        const popularReelsRes = await sql `
      SELECT 
        r.id,
        r.reels_url,
        r.publication_date,
        r.views_count,
        r.likes_count,
        r.comments_count,
        r.description,
        r.author_username
      FROM InstagramReels r
      JOIN ContentSources cs ON r.id = cs.reels_id
      WHERE cs.project_id = ${projectId}
      ORDER BY r.views_count DESC
      LIMIT 5
    `;
        return {
            total_reels: parseInt(statsRes[0].total_reels) || 0,
            total_views: parseInt(statsRes[0].total_views) || 0,
            competitors_count: parseInt(statsRes[0].competitors_count) || 0,
            hashtags_count: parseInt(statsRes[0].hashtags_count) || 0,
            most_popular_reels: popularReelsRes,
        };
    }
    catch (error) {
        console.error("Ошибка при получении статистики проекта:", error);
        throw error;
    }
}
// ===== УПРАВЛЕНИЕ ИЗБРАННЫМ И ВЗАИМОДЕЙСТВИЯ =====
/**
 * Добавляет Reel в избранное пользователя
 */
export async function addToFavorites(userId, reelId) {
    ensureInitialized();
    try {
        await sql `
      INSERT INTO UserContentInteractions (user_id, reels_id, is_favorite)
      VALUES (${userId}, ${reelId}, true)
      ON CONFLICT (user_id, reels_id) 
      DO UPDATE SET is_favorite = true, updated_at = CURRENT_TIMESTAMP
    `;
    }
    catch (error) {
        console.error("Ошибка при добавлении в избранное:", error);
        throw error;
    }
}
/**
 * Удаляет Reel из избранного пользователя
 */
export async function removeFromFavorites(userId, reelId) {
    ensureInitialized();
    try {
        await sql `
      UPDATE UserContentInteractions
      SET is_favorite = false, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${userId} AND reels_id = ${reelId}
    `;
    }
    catch (error) {
        console.error("Ошибка при удалении из избранного:", error);
        throw error;
    }
}
/**
 * Получает избранные Reels пользователя
 */
export async function getFavoriteReels(userId, limit = 100, offset = 0) {
    ensureInitialized();
    try {
        const totalRes = await sql `
      SELECT COUNT(*) as count
      FROM UserContentInteractions uci
      JOIN InstagramReels r ON uci.reels_id = r.id
      WHERE uci.user_id = ${userId} AND uci.is_favorite = true
    `;
        const reelsRes = await sql `
      SELECT 
        r.id,
        r.reels_url,
        r.publication_date,
        r.views_count,
        r.likes_count,
        r.comments_count,
        r.description,
        r.author_username,
        r.author_id,
        r.audio_title,
        r.audio_artist,
        r.thumbnail_url,
        r.duration_seconds
      FROM UserContentInteractions uci
      JOIN InstagramReels r ON uci.reels_id = r.id
      WHERE uci.user_id = ${userId} AND uci.is_favorite = true
      ORDER BY uci.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
        return {
            reels: reelsRes,
            total: parseInt(totalRes[0].count),
        };
    }
    catch (error) {
        console.error("Ошибка при получении избранных Reels:", error);
        throw error;
    }
}
/**
 * Скрывает Reel для пользователя
 */
export async function hideReel(userId, reelId) {
    ensureInitialized();
    try {
        await sql `
      INSERT INTO UserContentInteractions (user_id, reels_id, is_hidden)
      VALUES (${userId}, ${reelId}, true)
      ON CONFLICT (user_id, reels_id) 
      DO UPDATE SET is_hidden = true, updated_at = CURRENT_TIMESTAMP
    `;
    }
    catch (error) {
        console.error("Ошибка при скрытии Reel:", error);
        throw error;
    }
}
/**
 * Проверяет статус взаимодействия пользователя с Reel
 */
export async function getReelInteraction(userId, reelId) {
    ensureInitialized();
    try {
        const interactionRes = await sql `
      SELECT is_favorite, is_hidden, notes
      FROM UserContentInteractions
      WHERE user_id = ${userId} AND reels_id = ${reelId}
    `;
        return interactionRes.length > 0 ? interactionRes[0] : null;
    }
    catch (error) {
        console.error("Ошибка при получении взаимодействия:", error);
        throw error;
    }
}
// ===== ЛОГИ ПАРСИНГА =====
/**
 * Получает логи парсинга для проекта
 */
export async function getParsingLogs(projectId, limit = 50) {
    ensureInitialized();
    try {
        const logsRes = await sql `
      SELECT 
        run_id, project_id, source_type, source_id, status,
        reels_added_count, errors_count, start_time, end_time,
        log_message, error_details
      FROM ParsingLogs
      WHERE project_id = ${projectId}
      ORDER BY start_time DESC
      LIMIT ${limit}
    `;
        return logsRes;
    }
    catch (error) {
        console.error("Ошибка при получении логов парсинга:", error);
        throw error;
    }
}
/**
 * Получает всех активных пользователей (активных в последние 30 дней)
 */
export async function getAllActiveUsers() {
    ensureInitialized();
    try {
        const usersRes = await sql `
      SELECT id, telegram_id, username, first_name, last_name, subscription_level, subscription_expires_at
      FROM Users
      WHERE last_active_at > NOW() - INTERVAL '30 days'
      ORDER BY last_active_at DESC
    `;
        return usersRes;
    }
    catch (error) {
        console.error("Ошибка при получении активных пользователей:", error);
        throw error;
    }
}
/**
 * Записывает информацию о процессе скрапинга
 */
export async function logParsingRun(log) {
    ensureInitialized();
    try {
        // Если это новая запись
        if (!log.end_time) {
            // Создаем новую запись для запуска парсинга
            const logRes = await sql `
        INSERT INTO ParsingLogs (
          run_id, project_id, source_type, source_id, status, 
          reels_added_count, errors_count, start_time, log_message
        )
        VALUES (
          ${log.run_id}, ${log.project_id}, ${log.source_type}, ${log.source_id}, ${log.status || "running"}, 
          ${log.reels_added_count || 0}, ${log.errors_count || 0}, ${log.start_time}, ${log.log_message || null}
        )
        RETURNING *
      `;
            return logRes[0];
        }
        else {
            // Обновляем существующую запись при завершении или ошибке
            const logRes = await sql `
        UPDATE ParsingLogs 
        SET 
          status = ${log.status}, 
          reels_added_count = ${log.reels_added_count || 0}, 
          errors_count = ${log.errors_count || 0}, 
          end_time = ${log.end_time}, 
          log_message = ${log.log_message || null},
          error_details = ${log.error_details ? JSON.stringify(log.error_details) : null}
        WHERE run_id = ${log.run_id} 
          AND project_id = ${log.project_id}
          AND source_type = ${log.source_type}
          AND source_id = ${log.source_id}
        RETURNING *
      `;
            return logRes[0];
        }
    }
    catch (error) {
        console.error("Ошибка при логировании процесса скрапинга:", error);
        throw error;
    }
}
