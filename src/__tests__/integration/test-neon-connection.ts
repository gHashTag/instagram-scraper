import { Client } from "pg"
import dotenv from "dotenv"

dotenv.config()

async function main() {
  const client = new Client({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  const res = await client.query("SELECT 1 as result")
  console.log("Результат запроса:", res.rows)
  await client.end()
}

main().catch(err => {
  console.error("Ошибка подключения или запроса:", err)
  process.exit(1)
})
