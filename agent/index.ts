/**
 * Instagram Scraper - функциональность скрапинга Instagram Reels
 *
 * Отвечает за:
 * - Скрапинг Reels с аккаунтов конкурентов и хэштегов
 * - Фильтрацию контента по просмотрам и дате публикации
 * - Преобразование данных для сохранения в базу данных
 */

// Экспорт функций скрапинга
export { scrapeInstagramReels } from "./instagram-scraper";
export type { ScrapeOptions } from "./instagram-scraper";

// Экспорт функций работы с хранилищем данных
// export {
//   initializeNeonStorage,
//   closeNeonStorage,
//   createUser,
//   createProject,
//   addCompetitorAccount,
//   addTrackingHashtag,
//   saveReels,
// } from "../storage/neonStorage-multitenant"

// Дополнительные типы, которые должны быть экспортированы
export interface ContentSource {
  id: number;
  reels_id: number;
  source_type: "competitor" | "hashtag";
  competitor_id?: number;
  hashtag_id?: number;
  project_id: number;
  created_at?: Date;
}

export interface UserContentInteraction {
  id: number;
  user_id: number;
  reels_id: number;
  is_favorite?: boolean;
  is_hidden?: boolean;
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Тип для данных, возвращаемых из `scrapeInstagramReels`.
 * Это сырые данные от Apify после первичной обработки в `instagram-scraper.ts`.
 */
export interface ApifyReelOutput {
  reels_url?: string;
  publication_date?: Date;
  views_count?: number;
  likes_count?: number;
  comments_count?: number;
  description?: string;
  author_username?: string;
  author_id?: string;
  audio_title?: string;
  audio_artist?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  raw_data_apify?: any; // Поле из старой версии, оставим опциональным для совместимости или для отладки
}

/**
 * Конвертирует InstagramReelRaw в формат Reel для сохранения в базу данных
 * @param reelRaw Данные Reel от скрапера
 * @param projectId ID проекта, к которому относится Reel
 * @param sourceType Тип источника (competitor/hashtag)
 * @param sourceId ID источника (конкурента или хэштега)
 * @returns Объект для сохранения в базу данных
 */
export function convertToStorageReel(
  reelRaw: any,
  projectId: number,
  sourceType: "competitor" | "hashtag",
  sourceId: number
) {
  return {
    project_id: projectId,
    source_type: sourceType,
    source_id: sourceId,
    reels_url: reelRaw.url,
    publication_date: reelRaw.publishedAt
      ? new Date(reelRaw.publishedAt)
      : new Date(),
    views_count: reelRaw.viewCount || 0,
    likes_count: reelRaw.likeCount,
    comments_count: reelRaw.commentCount,
    description: reelRaw.description,
    author_username: reelRaw.ownerUsername,
    author_id: reelRaw.ownerId,
    audio_title: reelRaw.audioTitle,
    audio_artist: reelRaw.audioArtist,
    parsed_at: new Date(),
    updated_at: new Date(),
  };
}

interface RunScraperAgentCycleOptions {
  apifyToken: string;
  userAuthId: string;
  projectName: string;
  competitorUrls: string[];
  hashtagNames?: string[]; // Пока не используется в scrapeInstagramReels
  minViews?: number;
  maxAgeDays?: number;
  scrapeLimitPerSource?: number;
}

/**
 * Основная оркестрирующая функция для запуска цикла Scraper Agent.
 */
export async function runScraperAgentCycle(
  options: RunScraperAgentCycleOptions
) {
  /* // ЗАКОММЕНТИРОВАНО УСТАРЕВШЕЕ ТЕЛО ФУНКЦИИ
  console.log("Запуск цикла Scraper Agent...")
  const {
    apifyToken,
    userAuthId,
    projectName,
    competitorUrls,
    hashtagNames = [],
    minViews = 50000,
    maxAgeDays = 14,
    scrapeLimitPerSource = 10,
  } = options

  if (!apifyToken) {
    console.error("Apify токен не предоставлен! Завершение работы.")
    return
  }
  if (!projectName) {
    console.error("Имя проекта не предоставлено! Завершение работы.")
    return
  }
  if (competitorUrls.length === 0 && hashtagNames.length === 0) {
    console.warn(
      "Не предоставлены URL конкурентов или хэштеги для скрапинга. Завершение работы."
    )
    return
  }

  try {
    initializeDBConnection()
    console.log(
      `Получение или создание проекта: ${projectName} для пользователя ${userAuthId}`
    )
    const project = await getOrCreateProject(userAuthId, projectName)
    if (!project || !project.id) {
      console.error(
        "Не удалось получить или создать проект. Завершение работы."
      )
      return
    }
    const projectId = project.id
    console.log(`Проект ID: ${projectId}`)

    // Скрапинг по конкурентам
    for (const competitorUrl of competitorUrls) {
      console.log(`Обработка конкурента: ${competitorUrl}`)
      const competitor = await getOrCreateCompetitor(
        projectId,
        competitorUrl,
        competitorUrl.split("/").filter(Boolean).pop()
      )
      if (!competitor || !competitor.id) {
        console.error(
          `Не удалось получить или создать конкурента для URL: ${competitorUrl}`
        )
        continue
      }
      const competitorId = competitor.id
      console.log(`ID конкурента ${competitor.username}: ${competitorId}`)

      try {
        console.log(`Запуск скрапинга Reels для конкурента: ${competitorUrl}`)
        const rawReelsFromApify = await scrapeInstagramReels(competitorUrl, {
          apifyToken,
          minViews,
          maxAgeDays,
          limit: scrapeLimitPerSource,
        })

        if (rawReelsFromApify && rawReelsFromApify.length > 0) {
          console.log(
            `Получено ${rawReelsFromApify.length} raw reels от Apify для ${competitorUrl}. Конвертация и сохранение...`
          )
          const reelsToSave = rawReelsFromApify
            .filter((rawReel: ApifyReelOutput) => rawReel.reels_url)
            .map((rawReel: ApifyReelOutput) =>
              convertApifyReelToStorageFormat(rawReel)
            )

          if (reelsToSave.length > 0) {
            await saveMultipleReels(
              reelsToSave,
              projectId,
              competitorId,
              undefined
            )
            console.log(
              `Reels для конкурента ${competitorUrl} успешно обработаны и сохранены.`
            )
          } else {
            console.log(
              `Не найдено Reels с корректным URL для сохранения для ${competitorUrl}.`
            )
          }
        } else {
          console.log(
            `Не найдено Reels для конкурента ${competitorUrl} или произошла ошибка скрапинга.`
          )
        }
      } catch (scrapeError) {
        console.error(
          `Ошибка при скрапинге или сохранении Reels для конкурента ${competitorUrl}:`,
          scrapeError
        )
      }
      console.log("--- Следующий конкурент ---")
    }

    // TODO: Скрапинг по хэштегам (когда scrapeInstagramReels будет это поддерживать или будет отдельная функция)
    // for (const hashtagName of hashtagNames) { ... }

    console.log("Цикл Scraper Agent успешно завершен.")
  } catch (error) {
    console.error("Ошибка в основном цикле Scraper Agent:", error)
  } finally {
    await closeDBConnection()
    console.log("Соединение с БД закрыто (или сброшен инстанс).")
  }
  */
  // КОНЕЦ ЗАКОММЕНТИРОВАННОГО БЛОКА
  if (options) {
    console.log(
      "runScraperAgentCycle called with options:",
      options.projectName
    ); // Пример использования
  }
}

/**
 * Функция для тестирования (можно удалить или обновить)
 */
async function testRun() {
  /* // ЗАКОММЕНТИРОВАНО УСТАРЕВШЕЕ ТЕЛО ФУНКЦИИ
  const testOptions: RunScraperAgentCycleOptions = {
    apifyToken: process.env.APIFY_TOKEN || "", // Убедитесь, что токен есть в .env
    userAuthId: "test-user-auth-id-123",
    projectName: "Instagram Reels - Эстетика Тест",
    competitorUrls: [
      "https://www.instagram.com/clinicajoelleofficial",
      // "https://www.instagram.com/kayaclinicarabia/" // Для теста пока один
    ],
    // hashtagNames: ["aestheticmedicine", "cosmetology"],
    minViews: 1000, // Для теста снизим планку
    maxAgeDays: 90, // Для теста расширим диапазон, чтобы точно что-то найти
    scrapeLimitPerSource: 3, // Для теста меньше, чтобы не ждать долго
  }

  await runScraperAgentCycle(testOptions)
  */
  // КОНЕЦ ЗАКОММЕНТИРОВАННОГО БЛОКА
}

// testRun(); // Убедимся, что тестовый запуск тоже закомментирован

// Запуск тестового прогона, если файл запускается напрямую
// Это условие проверяет, был ли файл запущен напрямую (node agent/index.ts или tsx agent/index.ts)
// а не импортирован как модуль.
const mainModule = require.main;
if (mainModule && mainModule.filename === __filename) {
  console.log("Файл agent/index.ts запущен напрямую, выполняем testRun()...");
  testRun().catch((e) => {
    console.error("Ошибка во время тестового запуска агента:", e);
    process.exit(1); // Выход с ошибкой
  });
}
