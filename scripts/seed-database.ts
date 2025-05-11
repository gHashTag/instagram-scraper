import dotenv from "dotenv";
import path from "path";
// import { db } from "@/db/neonDB"; // Старый неверный импорт
import { getDB } from "@/db/neonDB"; // Правильный импорт функции
import { usersTable, projectsTable, competitorsTable } from "@/db/schema";
import { eq, and } from "drizzle-orm"; // and был не использован, но может понадобиться

async function seedDatabase() {
  console.log("Начало заполнения базы данных тестовыми данными...");

  // Загружаем переменные окружения для подключения к БД
  const projectRoot = path.resolve(process.cwd());
  const envDevelopmentPath = path.join(projectRoot, ".env.development");
  const envLoadResult = dotenv.config({ path: envDevelopmentPath });

  if (envLoadResult.error) {
    console.error(
      "Ошибка загрузки .env.development для seed скрипта:",
      envLoadResult.error
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL не найден. Убедитесь, что он есть в .env.development."
    );
    process.exit(1);
  }

  const db = getDB(); // Получаем экземпляр DB через функцию
  console.log("Экземпляр БД получен через getDB().");

  try {
    // 1. Создание пользователя
    const telegramIdToTest = 3003;
    console.log(
      `Проверка существования пользователя с telegram_id: ${telegramIdToTest}`
    );
    let existingUser = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegram_id, telegramIdToTest))
      .limit(1);

    let userId: string;

    if (existingUser.length > 0) {
      console.log("Пользователь уже существует:", existingUser[0]);
      userId = existingUser[0].id;
    } else {
      console.log("Создание нового пользователя...");
      const newUser = await db
        .insert(usersTable)
        .values({
          telegram_id: telegramIdToTest,
          email: "seed.user.3003@example.com",
          name: "АвтоСид Пользователь",
          subscription_level: "free",
        })
        .returning({ id: usersTable.id });
      userId = newUser[0].id;
      console.log("Новый пользователь создан с ID:", userId);
    }

    // 2. Создание проекта
    const projectName = "АвтоСид Проект Клиники";
    console.log(
      `Проверка существования проекта '${projectName}' для пользователя ID: ${userId}`
    );

    // Ищем проект, строго связанный с этим пользователем
    let existingProjectQuery = await db
      .select()
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.name, projectName),
          eq(projectsTable.user_id, userId)
        )
      )
      .limit(1);

    let projectId: number;

    if (existingProjectQuery.length > 0) {
      console.log(
        "Проект уже существует для этого пользователя:",
        existingProjectQuery[0]
      );
      projectId = existingProjectQuery[0].id;
    } else {
      console.log("Создание нового проекта...");
      const newProject = await db
        .insert(projectsTable)
        .values({
          user_id: userId,
          name: projectName,
          industry: "Эстетическая медицина",
          is_active: true,
        })
        .returning({ id: projectsTable.id });
      projectId = newProject[0].id;
      console.log("Новый проект создан с ID:", projectId);
    }

    // 3. Добавление конкурентов
    const competitorsFromRule = [
      "clinicajoelleofficial",
      "kayaclinicarabia",
      "lips_for_kiss",
      "ziedasclinic", // Примечание: в AGENT_SCRAPER тут URL с igsh, берем только username
      "med_yu_med", // Аналогично
      "milena_aesthetic_clinic",
      "graise.aesthetics",
    ];

    for (const competitorUsername of competitorsFromRule) {
      console.log(
        `Проверка/добавление конкурента '${competitorUsername}' для проекта ID: ${projectId}`
      );
      let existingCompetitorQuery = await db
        .select()
        .from(competitorsTable)
        .where(
          and(
            eq(competitorsTable.project_id, projectId),
            eq(competitorsTable.username, competitorUsername)
          )
        )
        .limit(1);

      if (existingCompetitorQuery.length > 0) {
        console.log(
          `Конкурент ${competitorUsername} уже существует для этого проекта.`
        );
      } else {
        console.log(`Добавление нового конкурента ${competitorUsername}...`);
        await db.insert(competitorsTable).values({
          project_id: projectId,
          username: competitorUsername,
          profile_url: `https://www.instagram.com/${competitorUsername}/`, // Добавляем слеш в конце URL
          full_name: `${competitorUsername} (AutoSeed)`, // Можно будет уточнить позже, если нужно
          is_active: true,
        });
        console.log(
          `Конкурент ${competitorUsername} добавлен к проекту ID: ${projectId}`
        );
      }
    }

    console.log("Заполнение базы данных тестовыми данными успешно завершено!");
  } catch (error) {
    console.error("Ошибка при заполнении базы данных:", error);
    process.exit(1);
  } finally {
    // db.end() не нужен для HTTP-соединения Neon
    console.log("Завершение работы seed скрипта.");
  }
}

seedDatabase();
