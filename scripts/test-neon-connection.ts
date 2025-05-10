import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { neon } from "@neondatabase/serverless"

// Получаем dirname для ES модулей
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Загружаем переменные окружения
const envPath = path.join(__dirname, "../.env")
console.log("Путь к .env:", envPath)
dotenv.config({ path: envPath })

// Проверяем загруженные переменные
console.log("NEON_DATABASE_URL загружен:", !!process.env.NEON_DATABASE_URL)
console.log("APIFY_TOKEN загружен:", !!process.env.APIFY_TOKEN)

async function testConnection() {
  try {
    if (!process.env.NEON_DATABASE_URL) {
      throw new Error("NEON_DATABASE_URL не найден в переменных окружения")
    }

    console.log("Подключаемся к Neon Database...")
    const sql = neon(process.env.NEON_DATABASE_URL)

    console.log("Выполняем тестовый запрос...")
    const result = await sql`SELECT 'Подключение успешно!' as message`
    console.log("Результат:", result[0].message)

    console.log("Считаем пользователей...")
    const users = await sql`SELECT COUNT(*) FROM Users`
    console.log("Количество пользователей:", users[0].count)

    console.log("Считаем проекты...")
    const projects = await sql`SELECT COUNT(*) FROM Projects`
    console.log("Количество проектов:", projects[0].count)

    console.log("Считаем конкурентов...")
    const competitors = await sql`SELECT COUNT(*) FROM CompetitorAccounts`
    console.log("Количество конкурентов:", competitors[0].count)

    console.log("Считаем Reels...")
    const reels = await sql`SELECT COUNT(*) FROM InstagramReels`
    console.log("Количество Reels:", reels[0].count)

    console.log("\n✅ Тест подключения завершен успешно!")
  } catch (error) {
    console.error("❌ Ошибка при подключении к Neon:", error)
    process.exit(1)
  }
}

testConnection()
