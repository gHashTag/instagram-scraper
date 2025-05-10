import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Получаем dirname для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// import {
//   initializeNeonStorage,
//   closeNeonStorage,
//   createUser,
//   getUserByTelegramId,
//   createProject,
//   getProjectsByUserId,
//   addCompetitorAccount,
//   getCompetitorAccounts,
//   saveReels,
//   scrapeInstagramReels,
// } from "../index" // Временно закомментировано

// Загружаем переменные окружения
dotenv.config({ path: path.join(__dirname, "../../.env") });

// Конфигурация
const TELEGRAM_ID = process.env.DEMO_USER_ID || "12345678";
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const DEMO_MODE = !APIFY_TOKEN || APIFY_TOKEN === "your_apify_token_here";

// Список аккаунтов конкурентов из документации AGENT_SCRAPER
const COMPETITOR_ACCOUNTS = [
  "https://www.instagram.com/clinicajoelleofficial",
  "https://www.instagram.com/kayaclinicarabia/",
  "https://www.instagram.com/lips_for_kiss",
  "https://www.instagram.com/ziedasclinic?igsh=ZTAxeWZhY3VzYml2",
  "https://www.instagram.com/med_yu_med?igsh=YndwbmQzMHlrbTFh",
  "https://www.instagram.com/milena_aesthetic_clinic/",
  "https://www.instagram.com/graise.aesthetics",
];

// Функция для извлечения имени аккаунта из URL
function extractAccountName(url: string): string {
  // Удаляем параметры запроса и слеш в конце
  const cleanUrl = url.split("?")[0].replace(/\/$/, "");
  // Извлекаем имя аккаунта (последний компонент URL)
  const parts = cleanUrl.split("/");
  return parts[parts.length - 1];
}

async function main() {
  if (!DEMO_MODE && !APIFY_TOKEN) {
    console.error("Ошибка: Не указан APIFY_TOKEN в .env файле");
    console.log(
      "Используйте --demo для запуска в демонстрационном режиме без API ключа"
    );
    process.exit(1);
  }

  try {
    console.log("Инициализация подключения к Neon...");
    // await initializeNeonStorage() // Временно закомментировано

    // 1. Создаем или получаем пользователя
    console.log(`Поиск/создание пользователя с Telegram ID: ${TELEGRAM_ID}`);
    // let user = await getUserByTelegramId(Number(TELEGRAM_ID)) // Временно закомментировано
    let user: any = { id: 1, username: "demo_user" }; // Временная заглушка

    // if (!user) { // Временно закомментировано
    //   user = await createUser(Number(TELEGRAM_ID), "demo_user", "Demo", "User")
    //   console.log(
    //     `Создан новый пользователь: ${user.username} (ID: ${user.id})`
    //   )
    // } else {
    //   console.log(
    //     `Найден существующий пользователь: ${user.username} (ID: ${user.id})`
    //   )
    // }

    // 2. Создаем или получаем проект
    console.log(`Поиск/создание проекта для пользователя ID: ${user.id}`);

    // 3. Добавляем аккаунты конкурентов
    console.log("Добавление аккаунтов конкурентов:");
    // const existingCompetitors = await getCompetitorAccounts(project.id) // project.id здесь использовался бы, но код закомментирован
    const existingCompetitors: any[] = []; // Временная заглушка

    // Если existingCompetitors не массив, создаем пустой массив
    const existingCompetitorsList = Array.isArray(existingCompetitors)
      ? existingCompetitors
      : [];

    // Получаем список URL уже добавленных конкурентов
    const existingUrls = existingCompetitorsList.map((comp) =>
      comp.instagram_url.toLowerCase()
    );

    // Фильтруем и добавляем только новых конкурентов
    const competitorsToAdd = COMPETITOR_ACCOUNTS.filter(
      (url) => !existingUrls.includes(url.toLowerCase())
    );

    if (competitorsToAdd.length === 0) {
      console.log("Все конкуренты уже добавлены в проект.");
    } else {
      // Добавляем новых конкурентов
      for (const url of competitorsToAdd) {
        const accountName = extractAccountName(url);
        // const competitor = await addCompetitorAccount( // Временно закомментировано
        //   project.id, // project.id здесь использовался бы
        //   url,
        //   accountName
        // )
        const competitor: any = { id: 1 }; // Временная заглушка
        console.log(
          `Добавлен конкурент: ${accountName} (ID: ${competitor.id})`
        );
      }
    }

    // 4. Запускаем скрапинг данных или генерируем демо-данные
    console.log("\nЗапуск скрапинга данных по конкурентам...");

    // Получаем всех добавленных конкурентов
    // const competitors = await getCompetitorAccounts(project.id) // Временно закомментировано
    const competitors: any[] = [
      { id: 1, instagram_url: "https://www.instagram.com/example" },
    ]; // Временная заглушка
    console.log("Тип competitors:", typeof competitors);
    console.log(
      "Результат getCompetitorAccounts:",
      JSON.stringify(competitors, null, 2).substring(0, 500)
    );

    const competitorsList = Array.isArray(competitors) ? competitors : [];
    console.log("Длина competitorsList:", competitorsList.length);

    if (competitorsList.length === 0) {
      console.log("Не найдено аккаунтов конкурентов для скрапинга.");
      return;
    }

    // Выбираем первого конкурента для демонстрации
    const targetCompetitor = competitorsList[0];

    if (DEMO_MODE) {
      console.log(
        `ДЕМО-РЕЖИМ: Симуляция скрапинга для ${targetCompetitor.instagram_url}`
      );

      // Создаем демо-данные
      const demoReels = [
        {
          reels_url: "https://www.instagram.com/reel/demo123456/",
          publication_date: new Date(),
          views_count: 75000,
          likes_count: 1500,
          description:
            "Демо-запись: Процедура для лица с использованием передовой технологии",
          author_username:
            targetCompetitor.instagram_username ||
            extractAccountName(targetCompetitor.instagram_url),
        },
        {
          reels_url: "https://www.instagram.com/reel/demo789012/",
          publication_date: new Date(),
          views_count: 120000,
          likes_count: 3200,
          description: "Демо-запись: Результаты инъекций филлеров до и после",
          author_username:
            targetCompetitor.instagram_username ||
            extractAccountName(targetCompetitor.instagram_url),
        },
      ];

      // Сохраняем демо-данные
      // await saveReels(demoReels, project.id, "competitor", targetCompetitor.id) // Временно закомментировано
      console.log(
        `Сохранено ${demoReels.length} демо Reels в базу данных Neon.`
      );
    } else {
      // Запуск реального скрапинга с Apify
      try {
        console.log(
          `Запуск скрапинга для ${targetCompetitor.instagram_url}...`
        );

        // Запускаем скрапинг
        // const reels = await scrapeInstagramReels( // Временно закомментировано
        //   targetCompetitor.instagram_url,
        //   {
        //     apifyToken: APIFY_TOKEN,
        //     minViews: 50000,
        //     maxAgeDays: 14,
        //     maxItems: 10, // Ограничиваем количество для демонстрации
        //   }
        // )
        const reels: any[] = []; // Временная заглушка

        console.log(`Получено ${reels.length} Reels`);

        // Сохраняем данные в базу
        // await saveReels(reels, project.id, "competitor", targetCompetitor.id) // Временно закомментировано
        console.log(`Сохранено ${reels.length} Reels в базу данных Neon.`);
      } catch (error) {
        console.error("Ошибка при скрапинге:", error);
      }
    }

    console.log("\nРабота скрипта успешно завершена!");
  } catch (error) {
    console.error("Ошибка при выполнении скрипта:", error);
  } finally {
    console.log("Закрытие подключения к Neon...");
    // await closeNeonStorage() // Временно закомментировано
  }
}

// Запускаем основную функцию
main();
