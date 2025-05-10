/**
 * Instagram Scraper Bot - Drizzle Studio
 *
 * Запускает Drizzle Studio для администрирования БД через веб-интерфейс
 */

import { spawn } from "child_process"
import path from "path"
import { fileURLToPath } from "url"
import open from "open"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, "..")

const STUDIO_PORT = 3457
const STUDIO_URL = `http://localhost:${STUDIO_PORT}`

console.log(`🚀 Запуск Drizzle Studio на ${STUDIO_URL}...`)

// Запускаем Drizzle Studio через CLI
const drizzleProcess = spawn(
  "bunx",
  ["drizzle-kit", "studio", "--port", STUDIO_PORT.toString()],
  {
    cwd: ROOT_DIR,
    stdio: ["ignore", "pipe", "pipe"],
  }
)

// Обрабатываем вывод
drizzleProcess.stdout.on("data", data => {
  const output = data.toString()
  console.log(output)

  // Когда сервер запустится, откроем его в браузере
  if (
    output.includes("Server started") ||
    output.includes("studio is running")
  ) {
    console.log(`✨ Drizzle Studio запущен на ${STUDIO_URL}`)
    open(STUDIO_URL)
  }
})

drizzleProcess.stderr.on("data", data => {
  console.error(`❌ Ошибка: ${data}`)
})

// Обработка завершения процесса
drizzleProcess.on("close", code => {
  if (code !== 0) {
    console.log(`❌ Drizzle Studio завершился с кодом: ${code}`)
  } else {
    console.log("✅ Drizzle Studio успешно завершил работу")
  }
})

// Обработка сигналов для корректного завершения
process.on("SIGINT", () => {
  drizzleProcess.kill("SIGINT")
  process.exit(0)
})

process.on("SIGTERM", () => {
  drizzleProcess.kill("SIGTERM")
  process.exit(0)
})
