import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { desc } from "drizzle-orm";
import * as schema from "../src/db/schema";
import {
  initializeDBConnection,
  closeDBConnection,
  getDB,
} from "../src/db/neonDB";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем переменные окружения (предполагаем, что .env.development или .env существует в корне)
const envPath =
  process.env.NODE_ENV === "development"
    ? path.join(__dirname, "../.env.development")
    : path.join(__dirname, "../.env");

dotenv.config({ path: envPath });
console.log(`Используется файл окружения: ${envPath}`);

async function viewRecentReels() {
  console.log("Получение последних Reels из базы данных...");
  try {
    await initializeDBConnection();
    const db = getDB();

    const recentReels = await db
      .select()
      .from(schema.reelsTable)
      .orderBy(desc(schema.reelsTable.created_at))
      .limit(15); // Покажем последние 15

    if (recentReels.length === 0) {
      console.log("В базе данных не найдено Reels.");
    } else {
      console.log(`Найдено ${recentReels.length} последних Reels:`);
      recentReels.forEach((reel, index) => {
        console.log(`\n--- Reel ${index + 1} (ID: ${reel.id}) ---`);
        console.log(`URL: ${reel.reel_url}`);
        console.log(`Автор: ${reel.author_username}`);
        console.log(`Просмотры: ${reel.views_count}`);
        console.log(`Дата публикации: ${reel.published_at}`);
        // Выведем только часть описания, чтобы не перегружать вывод
        console.log(`Описание: ${reel.description?.substring(0, 150)}...`);
        console.log(`Добавлен в БД: ${reel.created_at}`);
      });
    }
  } catch (error) {
    console.error("Ошибка при получении Reels:", error);
  } finally {
    console.log("Закрытие соединения с БД...");
    await closeDBConnection();
  }
}

viewRecentReels();
