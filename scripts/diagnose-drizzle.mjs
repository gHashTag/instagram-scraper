import dotenv from "dotenv"
import path from "path"
import fs from "fs"

console.log("--- Starting Drizzle Diagnosis Script (URL Extraction Mode) ---")

const envPath = path.resolve(process.cwd(), ".env")
console.log(`Attempting to load .env file from: ${envPath}`)

if (fs.existsSync(envPath)) {
  console.log(".env file found.")
  dotenv.config({ path: envPath })
  console.log("dotenv.config() called.")
} else {
  console.error(".env file NOT FOUND at expected location!")
}

const dbUrl = process.env.DATABASE_URL
console.log("DATABASE_URL (after dotenv in diagnostic script):", dbUrl)

if (dbUrl) {
  try {
    fs.writeFileSync("temp_db_url.txt", dbUrl, "utf8")
    console.log("DATABASE_URL written to temp_db_url.txt")
  } catch (writeError) {
    console.error("Error writing DATABASE_URL to temp_db_url.txt:", writeError)
  }
} else {
  console.error("DATABASE_URL is not defined, cannot write to file.")
}

const drizzleConfigPath = path.resolve(process.cwd(), "drizzle.config.ts")
console.log(`Attempting to import drizzle.config.ts from: ${drizzleConfigPath}`)

try {
  if (fs.existsSync(drizzleConfigPath)) {
    console.log("drizzle.config.ts file found. Attempting dynamic import...")
    const configModule = await import(drizzleConfigPath)
    console.log("Successfully imported drizzle.config.ts")

    if (configModule.default && typeof configModule.default === "object") {
      console.log("drizzle.config.ts exports a default object.")
    } else if (configModule.default) {
      console.log(
        "drizzle.config.ts exports a default value, but it is not an object:",
        typeof configModule.default
      )
    } else {
      console.error("drizzle.config.ts does not have a default export.")
    }
  } else {
    console.error("drizzle.config.ts NOT FOUND at expected location!")
  }
} catch (error) {
  console.error(
    "Error during import or processing of drizzle.config.ts:",
    error
  )
}

console.log("--- Drizzle Diagnosis Script (URL Extraction Mode) Finished ---")
