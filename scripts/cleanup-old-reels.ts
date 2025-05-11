import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
// import { drizzle } from "drizzle-orm/neon-http"; // Не используется
import { lt, or, isNull } from "drizzle-orm"; // Исправлено or_ на or, удален неиспользуемый sql
import * as schema from "../src/db/schema";
import {
  initializeDBConnection,
  closeDBConnection,
  getDB,
  // NeonDB, // Закомментировано, так как тип получается через ReturnType<typeof getDB>
  // PGClient, // Закомментировано, так как тип получается через ReturnType<typeof getPG>
} from "../src/db/neonDB";

// Получаем dirname для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем переменные окружения (предполагаем, что .env.development или .env существует в корне)
const envPath =
  process.env.NODE_ENV === "development"
    ? path.join(__dirname, "../.env.development")
    : path.join(__dirname, "../.env");

dotenv.config({ path: envPath });

console.log(`Используется файл окружения: ${envPath}`);

const MIN_VIEWS = parseInt(process.env.MIN_VIEWS || "0");
const MAX_AGE_DAYS = parseInt(process.env.MAX_AGE_DAYS || "180");

async function cleanupOldReels() {
  console.log("Начало процесса очистки старых/нерелевантных Reels...");

  try {
    await initializeDBConnection();
    const db = getDB();

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - MAX_AGE_DAYS);
    console.log(
      `Удаление Reels старше ${fourteenDaysAgo.toISOString()} или с просмотрами < ${MIN_VIEWS}...`
    );

    const result = await db
      .delete(schema.reelsTable)
      .where(
        or(
          lt(schema.reelsTable.views_count, MIN_VIEWS),
          lt(schema.reelsTable.published_at, fourteenDaysAgo),
          isNull(schema.reelsTable.published_at)
        )
      )
      .returning({ deletedId: schema.reelsTable.id }); // Возвращаем ID удаленных записей

    console.log(`УСПЕШНО УДАЛЕНО: ${result.length} Reels.`);
    if (result.length > 0 && result.length <= 20) {
      // Показываем несколько ID для примера, если их немного
      console.log(
        "Пример ID удаленных Reels:",
        result.map((r) => r.deletedId).join(", ")
      );
    }
  } catch (error) {
    console.error("Ошибка во время очистки Reels:", error);
  } finally {
    console.log(
      "Завершение работы скрипта очистки, закрытие соединения с БД..."
    );
    await closeDBConnection();
  }
}

cleanupOldReels();
