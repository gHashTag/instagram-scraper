import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { NeonAdapter } from "../src/adapters/neon-adapter";

// Получаем dirname для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем переменные окружения
const envPath = path.join(__dirname, "../.env");
console.log("Путь к .env:", envPath);
dotenv.config({ path: envPath });

// Проверяем загруженные переменные
console.log("NEON_DATABASE_URL загружен:", !!process.env.NEON_DATABASE_URL);
console.log("APIFY_TOKEN загружен:", !!process.env.APIFY_TOKEN);

async function testNeonConnection() {
  const adapter = new NeonAdapter();
  try {
    await adapter.initialize();
    console.log("Успешно подключились к базе данных Neon");

    // Пробное получение проектов для тестового пользователя
    let user = await adapter.getUserByTelegramId(1);
    if (!user) {
      user = await adapter.createUser(1, "test-user");
      console.log("Создан новый пользователь:", user);
    }
    const projects = await adapter.getProjectsByUserId(user.id as any);
    console.log("Проекты пользователя:", projects);

    // Если нет проектов, создадим тестовый проект
    if (projects.length === 0) {
      const newProject = await adapter.createProject(
        user.id as any,
        "Тестовый проект"
      );
      console.log("Создан новый проект:", newProject);
    }
  } catch (error) {
    console.error("Ошибка при тестировании подключения к Neon:", error);
  } finally {
    await adapter.close();
  }
}

testNeonConnection();
