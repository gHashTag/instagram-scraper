import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import {
  initializeDBConnection,
  closeDBConnection,
  getAllActiveUsers,
  getProjectsByUserId,
  getCompetitorAccountsByProjectId,
  getTrackingHashtagsByProjectId,
  logParsingRun,
  updateParsingRun,
  User, // Типы теперь из neonDB
  Project,
  Competitor,
  Hashtag,
  ParsingRunInsert,
  getDB,
} from "../src/db/neonDB"; // Путь к функциям и типам БД
import { scrapeInstagramReels } from "../src/agent"; // scrapeInstagramReels из agent/index.ts -> agent/instagram-scraper.ts

// Добавляем необходимые импорты для нового типа db
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema"; // Используем относительный путь, т.к. мы в /scripts

// Получаем dirname для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем переменные окружения
const devEnvPath = path.join(__dirname, "../.env.development");
const prodEnvPath = path.join(__dirname, "../.env");

let loadedEnvFile = "";

// Пытаемся загрузить .env.development
const devConfig = dotenv.config({ path: devEnvPath });
if (devConfig.error) {
  console.warn(`Не удалось загрузить ${devEnvPath}:`, devConfig.error.message);
  // Пытаемся загрузить .env, если .env.development не найден или вызвал ошибку
  const prodConfig = dotenv.config({ path: prodEnvPath });
  if (prodConfig.error) {
    console.error(
      `КРИТИЧЕСКАЯ ОШИБКА: Не удалось загрузить ни ${devEnvPath}, ни ${prodEnvPath}. Ошибка для ${prodEnvPath}:`,
      prodConfig.error.message
    );
    // Можно решить остановить скрипт, если ни один .env не загружен, но пока продолжим,
    // чтобы увидеть ошибки отсутствия переменных ниже по коду.
    loadedEnvFile = "НИ ОДИН .env ФАЙЛ НЕ ЗАГРУЖЕН";
  } else if (prodConfig.parsed) {
    console.log(`Загружен основной файл окружения: ${prodEnvPath}`);
    loadedEnvFile = prodEnvPath;
  } else {
    console.warn(
      `Основной файл окружения ${prodEnvPath} пуст или не содержит переменных.`
    );
    loadedEnvFile = prodEnvPath + " (пуст)";
  }
} else if (devConfig.parsed) {
  console.log(`Загружен файл окружения для разработки: ${devEnvPath}`);
  loadedEnvFile = devEnvPath;
} else {
  console.warn(
    `Файл окружения для разработки ${devEnvPath} пуст или не содержит переменных.`
  );
  // Попытаемся загрузить .env в этом случае тоже
  const prodConfig = dotenv.config({ path: prodEnvPath });
  if (prodConfig.error) {
    console.error(
      `КРИТИЧЕСКАЯ ОШИБКА: Не удалось загрузить и ${prodEnvPath} после пустого ${devEnvPath}. Ошибка для ${prodEnvPath}:`,
      prodConfig.error.message
    );
    loadedEnvFile = "НИ ОДИН .env ФАЙЛ НЕ ЗАГРУЖЕН";
  } else if (prodConfig.parsed) {
    console.log(
      `Загружен основной файл окружения (после пустого .env.development): ${prodEnvPath}`
    );
    loadedEnvFile = prodEnvPath;
  } else {
    console.warn(
      `Основной файл окружения ${prodEnvPath} также пуст или не содержит переменных.`
    );
    loadedEnvFile = prodEnvPath + " (оба пусты)";
  }
}

console.log(`Используемый файл конфигурации: ${loadedEnvFile}`);

// Конфигурация
const APIFY_TOKEN = process.env.APIFY_TOKEN || "";
// const MAX_REELS_PER_SOURCE = 3; // Убрали, чтобы использовать дефолтный лимит агента (50)
const MIN_VIEWS = parseInt(process.env.MIN_VIEWS || "0"); // Minimum views to consider a reel (0 = no filter)
const MAX_AGE_DAYS = parseInt(process.env.MAX_AGE_DAYS || "180"); // Max age of a reel in days
const DRY_RUN = process.env.DRY_RUN === "true";

if (!APIFY_TOKEN && !DRY_RUN) {
  console.error("Ошибка: Не указан APIFY_TOKEN в .env файле");
  process.exit(1);
}

/**
 * Функция для скрапинга данных по одному источнику (аккаунт или хэштег)
 */
const scrapeSource = async (
  db: ReturnType<typeof drizzle<typeof schema>>,
  projectId: number,
  sourceType: "competitor" | "hashtag",
  sourceDbId: number, // ID конкурента или хэштега в нашей БД
  sourceValue: string, // URL аккаунта или имя хэштега
  apifyToken: string
): Promise<number> => {
  let sourceRunId = uuidv4(); // Генерируем ID для этого конкретного запуска источника
  let reelsFound = 0;
  let reelsAddedToDb = 0;
  const startTime = new Date();

  await logParsingRun({
    run_id: sourceRunId,
    project_id: projectId,
    source_type: sourceType,
    source_id: sourceDbId,
    status: "running",
    started_at: startTime,
    log_message: `Начало скрапинга для ${sourceType} ${sourceValue}`,
  });

  try {
    console.log(
      `Начало скрапинга для ${sourceType} ${sourceValue}, проект ID: ${projectId}`
    );
    reelsAddedToDb = await scrapeInstagramReels(
      db,
      projectId,
      sourceType,
      sourceDbId,
      sourceValue,
      {
        apifyToken: apifyToken,
        minViews: MIN_VIEWS,
        maxAgeDays: MAX_AGE_DAYS,
      }
    );

    // reelsFound будет равно reelsAddedToDb, так как scrapeInstagramReels теперь возвращает количество добавленных
    reelsFound = reelsAddedToDb;

    console.log(
      `Получено ${reelsAddedToDb} Reels для ${sourceType} ${sourceValue}`
    );

    await updateParsingRun(sourceRunId, {
      status: "completed",
      ended_at: new Date(),
      reels_found_count: reelsFound,
      reels_added_count: reelsAddedToDb,
      log_message: `Скрапинг для ${sourceType} ${sourceValue} завершен. Найдено ${reelsFound} Reels, сохранено ${reelsAddedToDb} новых.`,
    });
    return reelsAddedToDb;
  } catch (error: any) {
    console.error(`Ошибка при скрапинге ${sourceType} ${sourceValue}:`, error);
    await updateParsingRun(sourceRunId, {
      status: "failed",
      ended_at: new Date(),
      errors_count: 1,
      log_message: `Ошибка при скрапинге ${sourceType} ${sourceValue}: ${error?.message || "Неизвестная ошибка"}`,
      error_details: {
        message: error?.message || "Неизвестная ошибка",
        stack: error?.stack || "",
      },
    });
    return 0;
  }
};

/**
 * Основная функция для выполнения ежедневного скрапинга
 */
async function runDailyScraping() {
  const overallRunId = uuidv4();
  const startTime = new Date();
  let totalReelsAddedThisRun = 0;
  let totalErrorsThisRun = 0;

  console.log(
    `\n======= НАЧАЛО ЕЖЕДНЕВНОГО СКРАПИНГА (${startTime.toISOString()}) =======`
  );
  console.log(`Общий Run ID: ${overallRunId}`);

  if (!DRY_RUN) {
    const overallLogData: ParsingRunInsert = {
      run_id: overallRunId,
      project_id: null,
      source_type: "overall_run",
      source_id: null,
      status: "started",
      started_at: startTime,
    };
    await logParsingRun(overallLogData);
  }

  if (DRY_RUN) {
    console.log("РЕЖИМ ТЕСТИРОВАНИЯ: Реальный скрапинг выполняться не будет");
  }

  try {
    console.log("Инициализация подключения к Neon...");
    await initializeDBConnection();
    const db = getDB();

    let users: User[] = [];
    if (DRY_RUN) {
      console.log(
        "[DRY RUN] Симуляция получения пользователей. Возвращаем пустой массив."
      );
    } else {
      users = await getAllActiveUsers();
    }
    console.log(`Найдено ${users.length} пользователей для обработки`);

    for (const user of users) {
      console.log(
        `\nОбработка пользователя: ${user.username || user.telegram_id} (User UUID: ${user.id}, Telegram ID: ${user.telegram_id})`
      );
      const userIdForProjects = user.id;
      let projects: Project[] = [];
      if (DRY_RUN) {
        console.log(
          `[DRY RUN] Симуляция получения проектов для пользователя ${userIdForProjects}. Возвращаем пустой массив.`
        );
      } else {
        projects = await getProjectsByUserId(
          userIdForProjects, // Теперь передаем UUID
          true
        ); // true для activeOnly
      }
      console.log(
        `Найдено ${projects.length} активных проектов для пользователя ${user.username || user.telegram_id}`
      );

      for (const project of projects) {
        console.log(
          `\nОбработка проекта: ${project.name} (Project ID: ${project.id})`
        );
        const projectRunId = uuidv4(); // ВОССТАНОВЛЕНО: ID для логов этого проекта
        let projectReelsAdded = 0; // ВОССТАНОВЛЕНО
        let projectErrors = 0; // ВОССТАНОВЛЕНО

        // ВОССТАНОВЛЕНО: Логируем начало обработки проекта
        if (!DRY_RUN) {
          await logParsingRun({
            run_id: projectRunId,
            project_id: project.id,
            source_type: "project_processing",
            status: "started",
            started_at: new Date(),
          });
        }

        let competitors: Competitor[] = [];
        if (DRY_RUN) {
          console.log(
            `[DRY RUN] Симуляция получения конкурентов для проекта ${project.id}. Возвращаем пустой массив.`
          );
        } else {
          competitors = await getCompetitorAccountsByProjectId(project.id);
        }
        console.log(
          `Найдено ${competitors.length} конкурентов для проекта ${project.name}`
        );

        for (const competitor of competitors) {
          console.log(
            // ИСПРАВЛЕНО: Используем competitor.username для логов и передачи в scrapeSource
            `Скрапинг конкурента: ${competitor.username} (Competitor ID: ${competitor.id})`
          );
          if (DRY_RUN) {
            console.log(
              `[DRY RUN] Пропуск скрапинга конкурента ${competitor.username}`
            );
            continue;
          }
          try {
            const savedCount = await scrapeSource(
              db,
              project.id,
              "competitor",
              competitor.id,
              competitor.username, // ИСПРАВЛЕНО: Передаем username
              APIFY_TOKEN
            );
            projectReelsAdded += savedCount; // ВОССТАНОВЛЕНО
          } catch (e) {
            console.error(
              `Критическая ошибка при вызове scrapeSource для конкурента ${competitor.username}:`,
              e
            );
            projectErrors++; // ВОССТАНОВЛЕНО
          }
        }

        let hashtags: Hashtag[] = [];
        if (DRY_RUN) {
          console.log(
            `[DRY RUN] Симуляция получения хэштегов для проекта ${project.id}. Возвращаем пустой массив.`
          );
        } else {
          hashtags = await getTrackingHashtagsByProjectId(project.id);
        }
        console.log(
          `Найдено ${hashtags.length} хэштегов для проекта ${project.name}`
        );

        for (const hashtag of hashtags) {
          console.log(
            // ИСПРАВЛЕНО: Используем hashtag.tag_name
            `Скрапинг хэштега: ${hashtag.tag_name} (Hashtag ID: ${hashtag.id})`
          );
          if (DRY_RUN) {
            console.log(
              `[DRY RUN] Пропуск скрапинга хэштега ${hashtag.tag_name}`
            );
            continue;
          }
          try {
            const savedCount = await scrapeSource(
              db,
              project.id,
              "hashtag",
              hashtag.id,
              hashtag.tag_name, // ИСПРАВЛЕНО: Передаем tag_name
              APIFY_TOKEN
            );
            projectReelsAdded += savedCount; // ВОССТАНОВЛЕНО
          } catch (e) {
            console.error(
              `Критическая ошибка при вызове scrapeSource для хэштега ${hashtag.tag_name}:`,
              e
            );
            projectErrors++; // ВОССТАНОВЛЕНО
          }
        }

        // ВОССТАНОВЛЕНО: Обновляем общий лог по проекту
        totalReelsAddedThisRun += projectReelsAdded;
        totalErrorsThisRun += projectErrors;
        if (!DRY_RUN) {
          await updateParsingRun(projectRunId, {
            status: projectErrors > 0 ? "completed_with_errors" : "completed",
            ended_at: new Date(),
            reels_added_count: projectReelsAdded,
            errors_count: projectErrors,
            log_message: `Обработка проекта ${project.name} завершена. Добавлено Reels: ${projectReelsAdded}, Ошибок: ${projectErrors}.`,
          });
        }
        console.log(
          `Завершение обработки проекта ${project.name}. Добавлено Reels: ${projectReelsAdded}, Ошибок: ${projectErrors}.`
        );
      } // end project loop
    } // end user loop
  } catch (error: any) {
    console.error(
      "Критическая ошибка в основном процессе runDailyScraping:",
      error
    );
    totalErrorsThisRun++;
    if (!DRY_RUN) {
      await updateParsingRun(overallRunId, {
        status: "failed",
        ended_at: new Date(),
        errors_count: totalErrorsThisRun, // Увеличиваем на 1 из-за этой критической ошибки
        log_message: `Критическая ошибка в runDailyScraping: ${error?.message || "Неизвестная ошибка"}`,
        error_details: {
          message: error?.message || "Неизвестная ошибка",
          stack: error?.stack || "",
        },
      });
    }
  } finally {
    if (!DRY_RUN) {
      await updateParsingRun(overallRunId, {
        status: totalErrorsThisRun > 0 ? "completed_with_errors" : "completed",
        ended_at: new Date(),
        reels_added_count: totalReelsAddedThisRun,
        errors_count: totalErrorsThisRun,
        log_message: `Ежедневный скрапинг завершен. Всего добавлено Reels: ${totalReelsAddedThisRun}, Всего ошибок: ${totalErrorsThisRun}.`,
      });
    }
    console.log(
      `\n======= ЗАВЕРШЕНИЕ ЕЖЕДНЕВНОГО СКРАПИНГА (${new Date().toISOString()}) =======`
    );
    console.log(
      `Всего добавлено Reels за этот запуск: ${totalReelsAddedThisRun}, Всего ошибок: ${totalErrorsThisRun}.`
    );
    await closeDBConnection();
    console.log("Соединение с NeonDB закрыто.");
  }
}

runDailyScraping();
