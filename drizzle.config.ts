import { defineConfig } from "drizzle-kit"
import dotenv from "dotenv"
import path from "path"
import fs from "fs" // Import fs to check for file existence

// Determine which .env file to load
const envDevelopmentPath = path.resolve(process.cwd(), ".env.development")
const envPath = path.resolve(process.cwd(), ".env")

if (fs.existsSync(envDevelopmentPath)) {
  dotenv.config({ path: envDevelopmentPath })
} else {
  dotenv.config({ path: envPath })
}

// Debug: Log DATABASE_URL to check if it's loaded
// console.log("DATABASE_URL (in drizzle.config.ts):", process.env.DATABASE_URL)
// console.log("Attempting to load .env from:", fs.existsSync(envDevelopmentPath) ? envDevelopmentPath : envPath)

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is not set for drizzle-kit"
  )
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle_migrations", // Directory to store migration files
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  schemaFilter: ["public"], // Explicitly specify the schema to use
  verbose: true,
  strict: true,
})
