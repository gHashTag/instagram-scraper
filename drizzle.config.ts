import { defineConfig } from "drizzle-kit";
// import dotenv from "dotenv" // Убрали, так как загрузка идет через dotenv-cli
// import path from "path"    // Убрали
// import fs from "fs"        // Убрали

// // Determine which .env file to load
// const envDevelopmentPath = path.resolve(process.cwd(), ".env.development")
// const envPath = path.resolve(process.cwd(), ".env")

// if (fs.existsSync(envDevelopmentPath)) {
//   dotenv.config({ path: envDevelopmentPath })
// } else {
//   dotenv.config({ path: envPath })
// }

// Важно: теперь мы ожидаем, что DATABASE_URL установлен ВНЕ этого файла,
// например, командой "dotenv -e .env.development -- node ..."
console.log(
  "DATABASE_URL (внутри drizzle.config.ts, после удаления внутреннего dotenv):",
  process.env.DATABASE_URL
);

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is not set or not passed to drizzle-kit. Ensure dotenv-cli or similar sets it."
  );
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
});
