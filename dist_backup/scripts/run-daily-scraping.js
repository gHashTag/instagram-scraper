import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
// Получаем dirname для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { initializeNeonStorage, closeNeonStorage, getAllActiveUsers, getProjectsByUserId, getCompetitorAccounts, getTrackingHashtags, scrapeInstagramReels, saveReels, logParsingRun, } from "../index";
// Загружаем переменные окружения
dotenv.config({ path: path.join(__dirname, "../../.env") });
// Конфигурация
const APIFY_TOKEN = process.env.APIFY_TOKEN || "";
const MIN_VIEWS = parseInt(process.env.MIN_VIEWS || "50000");
const MAX_AGE_DAYS = parseInt(process.env.MAX_AGE_DAYS || "14");
const DRY_RUN = process.env.DRY_RUN === "true";
if (!APIFY_TOKEN && !DRY_RUN) {
    console.error("Ошибка: Не указан APIFY_TOKEN в .env файле");
    process.exit(1);
}
/**
 * Функция для скрапинга данных по одному источнику (аккаунт или хэштег)
 */
async function scrapeSource(projectId, sourceType, sourceId, sourceUrl, runId) {
    try {
        console.log(`Скрапинг ${sourceType === "competitor" ? "аккаунта" : "хэштега"}: ${sourceUrl}`);
        // Создаем запись о начале скрапинга
        await logParsingRun({
            run_id: runId,
            project_id: projectId,
            source_type: sourceType,
            source_id: sourceId,
            status: "running",
            start_time: new Date(),
            reels_added_count: 0,
            errors_count: 0,
        });
        // Если это тестовый запуск, не выполняем реальный скрапинг
        if (DRY_RUN) {
            console.log(`[DRY RUN] Симуляция скрапинга для ${sourceUrl}`);
            // Логируем успешное завершение тестового запуска
            await logParsingRun({
                run_id: runId,
                project_id: projectId,
                source_type: sourceType,
                source_id: sourceId,
                status: "completed",
                reels_added_count: 0,
                errors_count: 0,
                end_time: new Date(),
                log_message: "[DRY RUN] Симуляция скрапинга завершена успешно",
            });
            return 0;
        }
        // Запускаем реальный скрапинг
        const reels = await scrapeInstagramReels(sourceUrl, {
            apifyToken: APIFY_TOKEN,
            minViews: MIN_VIEWS,
            maxAgeDays: MAX_AGE_DAYS,
        });
        console.log(`Получено ${reels.length} Reels для ${sourceUrl}`);
        // Сохраняем данные в базу
        const savedCount = await saveReels(reels, projectId, sourceType, sourceId);
        // Логируем успешное завершение
        await logParsingRun({
            run_id: runId,
            project_id: projectId,
            source_type: sourceType,
            source_id: sourceId,
            status: "completed",
            reels_added_count: savedCount,
            end_time: new Date(),
            log_message: `Скрапинг завершен успешно. Получено ${reels.length} Reels, сохранено ${savedCount} новых.`,
        });
        return savedCount;
    }
    catch (error) {
        console.error(`Ошибка при скрапинге ${sourceUrl}:`, error);
        // Логируем ошибку
        await logParsingRun({
            run_id: runId,
            project_id: projectId,
            source_type: sourceType,
            source_id: sourceId,
            status: "failed",
            errors_count: 1,
            end_time: new Date(),
            log_message: `Ошибка при скрапинге: ${error?.message || "Неизвестная ошибка"}`,
            error_details: {
                message: error?.message || "Неизвестная ошибка",
                stack: error?.stack || "",
            },
        });
        return 0;
    }
}
/**
 * Основная функция для выполнения ежедневного скрапинга
 */
async function runDailyScraping() {
    const runId = uuidv4(); // Генерируем уникальный ID для текущего запуска
    const startTime = new Date();
    let totalReelsAdded = 0;
    let totalErrors = 0;
    console.log(`\n======= НАЧАЛО ЕЖЕДНЕВНОГО СКРАПИНГА (${startTime.toISOString()}) =======`);
    console.log(`Run ID: ${runId}`);
    if (DRY_RUN) {
        console.log("РЕЖИМ ТЕСТИРОВАНИЯ: Реальный скрапинг выполняться не будет");
    }
    try {
        console.log("Инициализация подключения к Neon...");
        await initializeNeonStorage();
        // Получаем всех активных пользователей
        const users = await getAllActiveUsers();
        console.log(`Найдено ${users.length} активных пользователей`);
        // Обрабатываем каждого пользователя
        for (const user of users) {
            console.log(`\nОбработка пользователя: ${user.username || user.telegram_id} (ID: ${user.id})`);
            // Получаем активные проекты пользователя
            const projects = await getProjectsByUserId(user.id);
            const activeProjects = projects.filter(p => p.is_active);
            console.log(`Найдено ${activeProjects.length} активных проектов`);
            // Обрабатываем каждый проект
            for (const project of activeProjects) {
                console.log(`\nОбработка проекта: ${project.name} (ID: ${project.id})`);
                // Получаем аккаунты конкурентов для проекта
                const competitors = await getCompetitorAccounts(project.id, true);
                console.log(`Найдено ${competitors.length} активных аккаунтов конкурентов`);
                // Скрапим данные по каждому аккаунту конкурента
                for (const competitor of competitors) {
                    try {
                        const savedCount = await scrapeSource(project.id, "competitor", competitor.id, competitor.instagram_url, runId);
                        if (savedCount) {
                            totalReelsAdded += savedCount;
                        }
                    }
                    catch (error) {
                        console.error(`Ошибка при обработке конкурента ${competitor.instagram_url}:`, error);
                        totalErrors++;
                    }
                }
                // Получаем хэштеги для проекта
                const hashtags = await getTrackingHashtags(project.id, true);
                console.log(`Найдено ${hashtags.length} активных хэштегов`);
                // Скрапим данные по каждому хэштегу
                for (const hashtag of hashtags) {
                    try {
                        const hashtagQuery = `#${hashtag.hashtag}`;
                        const savedCount = await scrapeSource(project.id, "hashtag", hashtag.id, hashtagQuery, runId);
                        if (savedCount) {
                            totalReelsAdded += savedCount;
                        }
                    }
                    catch (error) {
                        console.error(`Ошибка при обработке хэштега #${hashtag.hashtag}:`, error);
                        totalErrors++;
                    }
                }
            }
        }
        const endTime = new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMin = Math.round(durationMs / 60000);
        console.log(`\n======= ЗАВЕРШЕНИЕ ЕЖЕДНЕВНОГО СКРАПИНГА (${endTime.toISOString()}) =======`);
        console.log(`Длительность: ${durationMin} минут`);
        console.log(`Всего добавлено новых Reels: ${totalReelsAdded}`);
        console.log(`Всего ошибок: ${totalErrors}`);
    }
    catch (error) {
        console.error("КРИТИЧЕСКАЯ ОШИБКА при выполнении ежедневного скрапинга:", error);
    }
    finally {
        // Закрываем соединение с базой данных
        await closeNeonStorage();
    }
}
// Запускаем основную функцию
runDailyScraping();
