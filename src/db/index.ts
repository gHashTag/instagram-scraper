import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

// Ensure .env is loaded
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, "../../.env") }) // Adjusted path to root .env

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set")
}

const sql = neon(process.env.DATABASE_URL)
export const db = drizzle(sql)

// Optionally, you can export your schema tables for easy access
export * as schema from "./schema"
