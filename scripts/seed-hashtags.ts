import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

// Получаем dirname для ES модулей
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// import {
//   initializeNeonStorage,
//   closeNeonStorage,
//   getUserByTelegramId,
//   getProjectsByUserId,
//   addTrackingHashtag,
//   getTrackingHashtags,
//   saveReels,
//   scrapeInstagramReels, // Этот импорт скорее всего должен идти из agent/instagram-scraper
// } from "../index"

// Загружаем переменные окружения
dotenv.config({ path: path.join(__dirname, "../../.env") })

// Конфигурация
const TELEGRAM_ID = process.env.DEMO_USER_ID || "12345678"
const APIFY_TOKEN = process.env.APIFY_TOKEN
const DEMO_MODE = !APIFY_TOKEN || APIFY_TOKEN === "your_apify_token_here"

// Список хэштегов из документации AGENT_SCRAPER
const HASHTAGS = [
  "aestheticmedicine",
  "aestheticclinic",
  "cosmetology",
  "hydrafacial",
  "botox",
  "fillers",
  "beautyclinic",
  "skincare",
  "prpfacial",
  "rfmicroneedling",
  "skinrejuvenation",
  "facialtreatment",
  "aesthetictreatment",
]

// Функция для генерации фиктивных данных для демо-режима
function generateDemoReels(hashtag: string) {
  const now = new Date()
  const demoReels = []

  for (let i = 0; i < 5; i++) {
    // Случайная дата публикации за последние 14 дней
    const pubDate = new Date(now)
    pubDate.setDate(now.getDate() - Math.floor(Math.random() * 14))

    // Случайное количество просмотров от 50,000 до 500,000
    const views = Math.floor(Math.random() * 450000) + 50000

    demoReels.push({
      reels_url: `https://www.instagram.com/reel/demo-tag-${hashtag}-${i}/`,
      publication_date: pubDate,
      views_count: views,
      likes_count: Math.floor(views * 0.1),
      comments_count: Math.floor(views * 0.01),
      description: `Демонстрационный Reel по хэштегу #${hashtag} для тестирования #${hashtag} #testing`,
      author_username: `demo_user_${i}`,
      author_id: `user-${Math.floor(Math.random() * 10000)}`,
      audio_title: `Trending Audio ${i}`,
      audio_artist: `Popular Artist ${i % 5}`,
      thumbnail_url: `https://demo-thumbnails.com/hashtag/${hashtag}/${i}.jpg`,
      duration_seconds: Math.floor(Math.random() * 30) + 10,
      raw_data: { demoData: true, hashtag },
    })
  }

  return demoReels
}

async function main() {
  if (!DEMO_MODE && !APIFY_TOKEN) {
    console.error("Ошибка: Не указан APIFY_TOKEN в .env файле")
    console.log(
      "Используйте --demo для запуска в демонстрационном режиме без API ключа"
    )
    process.exit(1)
  }

  try {
    console.log("Инициализация подключения к Neon...")
    // await initializeNeonStorage() // Закомментировано

    // 1. Находим пользователя
    console.log(`Поиск пользователя с Telegram ID: ${TELEGRAM_ID}`)
    // const user = await getUserByTelegramId(Number(TELEGRAM_ID)) // Закомментировано
    const user: any = { id: "mockUserId", username: "mockUsername" } // Заглушка

    if (!user) {
      console.error(
        `Пользователь с Telegram ID ${TELEGRAM_ID} не найден. Сначала запустите seed-competitors.ts для создания пользователя.`
      )
      process.exit(1)
    }

    console.log(`Найден пользователь: ${user.username} (ID: ${user.id})`)

    // 2. Находим проект
    console.log(`Поиск проекта для пользователя ID: ${user.id}`)
    // const projects = await getProjectsByUserId(user.id) // Закомментировано
    const projects: any[] = [{ id: "mockProjectId", name: "mockProjectName" }] // Заглушка

    if (!projects || projects.length === 0) {
      console.error(
        `Проекты для пользователя ID: ${user.id} не найдены. Сначала запустите seed-competitors.ts для создания проекта.`
      )
      process.exit(1)
    }

    const project = projects[0]
    console.log(`Найден проект: ${project.name} (ID: ${project.id})`)

    // 3. Добавляем хэштеги для отслеживания
    console.log("Добавление хэштегов для отслеживания:")
    // const existingHashtags = await getTrackingHashtags(project.id) // Закомментировано
    const existingHashtags: any[] = [] // Заглушка

    // Если existingHashtags не массив, создаем пустой массив
    const existingHashtagsList = Array.isArray(existingHashtags)
      ? existingHashtags
      : []

    // Получаем список уже добавленных хэштегов
    const existingTags = existingHashtagsList.map(
      (
        tag: any // Типизация tag
      ) => tag.hashtag.toLowerCase()
    )

    // Фильтруем и добавляем только новые хэштеги
    const hashtagsToAdd = HASHTAGS.filter(
      tag => !existingTags.includes(tag.toLowerCase())
    )

    if (hashtagsToAdd.length === 0) {
      console.log("Все хэштеги уже добавлены в проект.")
    } else {
      // Добавляем новые хэштеги
      for (const tag of hashtagsToAdd) {
        // const hashtag = await addTrackingHashtag( // Закомментировано
        //   project.id,
        //   tag,
        //   `#${tag}`,
        //   `Автоматически добавлен для мониторинга`
        // )
        // console.log(`Добавлен хэштег: #${tag} (ID: ${hashtag.id})`)
        console.log(`Добавлен хэштег (заглушка): #${tag}`)
      }
    }

    // 4. Получаем все добавленные хэштеги
    // const hashtags = await getTrackingHashtags(project.id) // Закомментировано
    const hashtags: any[] = [
      { hashtag: "aestheticmedicine", id: "mockHashtagId" },
    ] // Заглушка
    const hashtagsList = Array.isArray(hashtags) ? hashtags : []

    if (hashtagsList.length === 0) {
      console.log("Не найдено хэштегов для скрапинга.")
      return
    }

    console.log(`Найдено ${hashtagsList.length} хэштегов для скрапинга.`)

    // 5. Выбираем первый хэштег для демонстрации
    const targetHashtag = hashtagsList[0]
    console.log(
      `\nЗапуск скрапинга данных по хэштегу #${targetHashtag.hashtag}...`
    )

    if (DEMO_MODE) {
      console.log(
        `ДЕМО-РЕЖИМ: Симуляция скрапинга для хэштега #${targetHashtag.hashtag}`
      )

      // Создаем демо-данные
      const demoReels = generateDemoReels(targetHashtag.hashtag)

      // Сохраняем демо-данные
      // await saveReels(demoReels, project.id, "hashtag", targetHashtag.id) // Закомментировано
      console.log(
        `Сохранено (заглушка) ${demoReels.length} демо Reels по хэштегу #${targetHashtag.hashtag} в базу данных Neon.`
      )
    } else {
      // Запуск реального скрапинга с Apify
      try {
        console.log(`Запуск скрапинга для хэштега #${targetHashtag.hashtag}...`)

        // Запускаем скрапинг
        // const reels = await scrapeInstagramReels(`#${targetHashtag.hashtag}`, { // Закомментировано
        //   apifyToken: APIFY_TOKEN,
        //   minViews: 50000,
        //   maxAgeDays: 14,
        // })
        const reels: any[] = [] // Заглушка

        console.log(
          `Получено ${reels.length} Reels по хэштегу #${targetHashtag.hashtag} (заглушка).`
        )

        // Сохраняем данные в базу
        // await saveReels(reels, project.id, "hashtag", targetHashtag.id) // Закомментировано
        console.log(
          `Сохранено (заглушка) ${reels.length} Reels в базу данных Neon.`
        )
      } catch (error) {
        console.error("Ошибка при скрапинге:", error)
      }
    }

    console.log("\nРабота скрипта успешно завершена!")
  } catch (error) {
    console.error("Ошибка при выполнении скрипта:", error)
  } finally {
    // await closeNeonStorage() // Закомментировано
    console.log("Соединение с БД закрыто (заглушка).")
  }
}

// Запускаем основную функцию
main()
