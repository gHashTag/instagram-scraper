import dotenv from "dotenv";
import path from "path";
import pg from "pg"; // Используем pg напрямую для чистоты теста

// Загружаем .env.development из корня проекта
const projectRoot = path.resolve(process.cwd());
const envDevelopmentPath = path.join(projectRoot, ".env.development");

const configResult = dotenv.config({ path: envDevelopmentPath });

if (configResult.error) {
  console.error("Ошибка загрузки .env.development:", configResult.error);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("Переменная DATABASE_URL не найдена в .env.development");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
console.log(
  `Пытаюсь подключиться к Neon используя DATABASE_URL: ${databaseUrl.substring(0, databaseUrl.indexOf(":") + 15)}... (остальная часть скрыта)`
); // Логгируем только часть URL без пароля

const { Client } = pg;
const client = new Client({
  connectionString: databaseUrl,
  // Neon требует SSL, pg по умолчанию пытается использовать SSL для postgresql:// строк
  // Можно явно добавить ssl: { rejectUnauthorized: false } для тестов, если есть проблемы с сертификатом,
  // но обычно для Neon это не требуется, если строка правильная и содержит sslmode=require.
});

async function testConnection() {
  try {
    console.log("Подключение...");
    await client.connect();
    console.log("УСПЕШНО ПОДКЛЮЧЕНО к Neon!");
    const res = await client.query("SELECT NOW()");
    console.log("Результат тестового запроса (SELECT NOW()):", res.rows[0]);
  } catch (err) {
    console.error("ОШИБКА ПОДКЛЮЧЕНИЯ или выполнения запроса:", err);
  } finally {
    console.log("Завершение работы клиента...");
    await client.end();
    console.log("Клиент завершил работу.");
  }
}

testConnection();
