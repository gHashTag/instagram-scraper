import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import { eq, and, inArray } from "drizzle-orm";

// Тип для инстанса Drizzle DB
export type NeonDB = ReturnType<typeof drizzle<typeof schema>>;

// Типы для вставки и выбора, чтобы не импортировать их везде
export type Project = typeof schema.projectsTable.$inferSelect;
export type ProjectInsert = typeof schema.projectsTable.$inferInsert;
export type User = typeof schema.usersTable.$inferSelect;
export type UserInsert = typeof schema.usersTable.$inferInsert;
export type Competitor = typeof schema.competitorsTable.$inferSelect;
export type CompetitorInsert = typeof schema.competitorsTable.$inferInsert;
export type Hashtag = typeof schema.hashtagsTable.$inferSelect;
export type HashtagInsert = typeof schema.hashtagsTable.$inferInsert;
export type Reel = typeof schema.reelsTable.$inferSelect;
export type ReelInsert = typeof schema.reelsTable.$inferInsert;
export type ParsingRun = typeof schema.parsingRunsTable.$inferSelect;
export type ParsingRunInsert = typeof schema.parsingRunsTable.$inferInsert;

let dbInstance: NeonDB | null = null;

/**
 * Инициализирует соединение с базой данных Neon.
 * @returns Экземпляр Drizzle DB.
 */
export function initializeDBConnection() {
  if (dbInstance) {
    console.log("Соединение с БД уже инициализировано.");
    return dbInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Переменная окружения DATABASE_URL не установлена.");
  }

  const sql = neon(databaseUrl);
  dbInstance = drizzle(sql, {
    schema,
    logger: process.env.NODE_ENV === "development",
  }); // Логгер только в development
  console.log("Соединение с БД Neon успешно инициализировано.");
  return dbInstance;
}

/**
 * Возвращает активный экземпляр Drizzle DB.
 * Вызовите initializeDBConnection() перед использованием этой функции.
 * @returns Экземпляр Drizzle DB.
 * @throws Ошибка, если соединение не было инициализировано.
 */
export function getDB() {
  if (!dbInstance) {
    // Попытка инициализировать, если еще не было
    return initializeDBConnection();
    // throw new Error("Соединение с БД не было инициализировано. Вызовите initializeDBConnection() сначала.");
  }
  return dbInstance;
}

/**
 * (В будущем) Закрывает соединение с БД, если это необходимо для serverless среды.
 * Для neon/serverless HTTP обычно это не требуется явно.
 */
export async function closeDBConnection() {
  // Для HTTP-соединения neon/serverless явное закрытие обычно не требуется.
  // Если бы это был пул соединений pg, здесь было бы pool.end().
  console.log("Соединение с БД Neon (HTTP) не требует явного закрытия.");
  dbInstance = null; // Сбрасываем инстанс для возможности переинициализации
}

/**
 * Находит проект по имени или создает новый, если он не существует.
 * @param projectName Имя проекта.
 * @returns Promise с объектом проекта.
 */
export async function getOrCreateProject(
  userId: string, // Предполагаем, что authId (UUID string) пользователя передается сюда
  projectName: string
): Promise<Project | undefined> {
  const db = getDB();
  if (!db) {
    console.error("DB not initialized in getOrCreateProject");
    return undefined;
  }
  try {
    // Сначала найдем пользователя по authId, чтобы получить его usersTable.id (UUID)
    const userQuery = await db
      .select({ id: schema.usersTable.id }) // usersTable.id is UUID
      .from(schema.usersTable)
      .where(eq(schema.usersTable.authId, userId))
      .limit(1);

    if (!userQuery || userQuery.length === 0) {
      console.error(`Пользователь с authId ${userId} не найден.`);
      return undefined;
    }
    const userRecordId = userQuery[0].id; // Это usersTable.id (UUID)

    // Теперь ищем проект по имени и user_id (который должен быть UUID)
    let project = await db
      .select()
      .from(schema.projectsTable)
      .where(
        and(
          eq(schema.projectsTable.name, projectName),
          eq(schema.projectsTable.user_id, userRecordId) // Теперь это сравнение uuid с uuid, @ts-ignore не нужен
        )
      )
      .limit(1);

    if (project.length > 0) {
      return project[0];
    } else {
      const newProject = await db
        .insert(schema.projectsTable)
        .values({
          user_id: userRecordId, // Теперь это uuid, @ts-ignore не нужен
          name: projectName,
        })
        .returning();
      return newProject[0];
    }
  } catch (error) {
    console.error("Ошибка при получении или создании проекта:", error);
    return undefined;
  }
}

/**
 * Находит пользователя по telegram_id или создает нового.
 * @param telegramId Уникальный идентификатор пользователя в Telegram.
 * @param userData (Опционально) Дополнительные данные пользователя для создания.
 * @returns Promise с объектом пользователя.
 */
export async function getOrCreateUser(
  telegramId: number,
  userData?: Partial<UserInsert> // Omit<UserInsert, 'telegram_id' | 'project_id'>
): Promise<User> {
  const db = getDB();
  try {
    let user = await db
      .select()
      .from(schema.usersTable)
      .where(eq(schema.usersTable.telegram_id, telegramId))
      .limit(1)
      .then((rows) => rows[0]);

    if (user) {
      // console.log(`Пользователь с Telegram ID ${telegramId} найден.`);
      return user;
    }

    // console.log(`Пользователь с Telegram ID ${telegramId} не найден, создаем нового...`);
    const newUserValues: UserInsert = {
      telegram_id: telegramId,
      authId: userData?.authId || null, // Используем null, если не предоставлено
      email: userData?.email || null,
      name: userData?.name || null,
      avatarUrl: userData?.avatarUrl || null,
      username: userData?.username || null,
      first_name: userData?.first_name || null,
      last_name: userData?.last_name || null,
      subscription_level: userData?.subscription_level || "free",
      created_at: new Date(),
      updated_at: new Date(),
    };

    const newUser = await db
      .insert(schema.usersTable)
      .values(newUserValues)
      .returning()
      .then((rows) => rows[0]);

    // console.log(`Пользователь с Telegram ID ${telegramId} успешно создан.`);
    return newUser;
  } catch (error) {
    console.error(
      `Ошибка при поиске или создании пользователя с Telegram ID ${telegramId}:`,
      error
    );
    throw error;
  }
}

/**
 * Находит аккаунт конкурента по URL в рамках проекта или создает новый.
 * @param projectId ID проекта.
 * @param competitorUrl URL аккаунта конкурента.
 * @param competitorName (Опционально) Имя/название конкурента.
 * @returns Promise с объектом конкурента.
 */
export async function getOrCreateCompetitor(
  projectId: number, // Теперь это число
  profileUrl: string,
  username?: string
): Promise<Competitor | undefined> {
  const db = getDB();
  if (!db) return undefined;

  const actualUsername =
    username || profileUrl.split("/").filter(Boolean).pop() || "unknown";

  try {
    let competitor = await db
      .select()
      .from(schema.competitorsTable)
      .where(
        and(
          eq(schema.competitorsTable.project_id, projectId), // OK
          eq(schema.competitorsTable.profile_url, profileUrl)
        )
      )
      .limit(1);

    if (competitor.length > 0) {
      return competitor[0];
    } else {
      const newCompetitor = await db
        .insert(schema.competitorsTable)
        .values({
          project_id: projectId, // OK
          username: actualUsername,
          profile_url: profileUrl,
        })
        .returning();
      return newCompetitor[0];
    }
  } catch (error) {
    console.error("Ошибка при получении или создании конкурента:", error);
    return undefined;
  }
}

/**
 * Находит хэштег по имени в рамках проекта или создает новый.
 * @param projectId ID проекта.
 * @param hashtagName Имя хэштега (без #).
 * @returns Promise с объектом хэштега.
 */
export async function getOrCreateHashtag(
  projectId: number, // Теперь это число
  hashtagName: string
): Promise<Hashtag | undefined> {
  const db = getDB();
  if (!db) return undefined;

  const cleanHashtagName = hashtagName.startsWith("#")
    ? hashtagName.substring(1)
    : hashtagName;

  try {
    let hashtag = await db
      .select()
      .from(schema.hashtagsTable)
      .where(
        and(
          eq(schema.hashtagsTable.project_id, projectId), // OK
          eq(schema.hashtagsTable.tag_name, cleanHashtagName)
        )
      )
      .limit(1);

    if (hashtag.length > 0) {
      return hashtag[0];
    } else {
      const newHashtag = await db
        .insert(schema.hashtagsTable)
        .values({
          project_id: projectId, // OK
          tag_name: cleanHashtagName,
        })
        .returning();
      return newHashtag[0];
    }
  } catch (error) {
    console.error("Ошибка при получении или создании хэштега:", error);
    return undefined;
  }
}

/**
 * Сохраняет данные одного Reel в базу данных.
 * Проверяет на дубликаты по reels_url и project_id.
 * @param reelData Данные для вставки в таблицу Reels.
 * @param projectId ID проекта, к которому относится Reel.
 * @param competitorId (Опционально) ID связанного конкурента.
 * @param hashtagId (Опционально) ID связанного хэштега.
 * @returns Promise с объектом сохраненного Reel или существующего, если найден дубликат.
 */
export async function saveReelData(
  reelData: Omit<
    ReelInsert,
    "project_id" | "competitor_id" | "hashtag_id" | "parsed_at" | "updated_at"
  >,
  projectId: number, // Теперь это число
  competitorId?: number,
  hashtagId?: number
): Promise<Reel | undefined> {
  const db = getDB();
  if (!db) return undefined;

  if (!reelData.reel_url) {
    // ИСПРАВЛЕНО: reel_url
    console.warn("Попытка сохранить Reel без URL, пропуск.");
    return undefined;
  }

  try {
    // Проверка на дубликат по URL и project_id
    const existingReel = await db
      .select()
      .from(schema.reelsTable)
      .where(
        and(
          eq(schema.reelsTable.project_id, projectId), // OK
          eq(schema.reelsTable.reel_url, reelData.reel_url) // ИСПРАВЛЕНО: reel_url
        )
      )
      .limit(1);

    if (existingReel.length > 0) {
      // console.log(`Reel с URL ${reelData.reel_url} уже существует, пропуск.`);
      return existingReel[0];
    }

    // Добавляем недостающие внешние ключи и метаданные
    const fullReelData: ReelInsert = {
      ...reelData,
      project_id: projectId, // OK
      // source_type и source_identifier могут быть заполнены на основе competitorId/hashtagId или переданы в reelData
      // parsed_at: new Date(), // Если нужно отслеживать время парсинга отдельно от created_at
      // updated_at будет установлено автоматически Drizzle
    };

    if (competitorId) {
      // @ts-ignore TODO: Define competitor_id in ReelInsert or handle it better
      fullReelData.competitor_id = competitorId;
      fullReelData.source_type = "competitor";
      // @ts-ignore
      fullReelData.source_identifier = competitorId.toString();
    } else if (hashtagId) {
      // @ts-ignore TODO: Define hashtag_id in ReelInsert or handle it better
      fullReelData.hashtag_id = hashtagId;
      fullReelData.source_type = "hashtag";
      // @ts-ignore
      fullReelData.source_identifier = hashtagId.toString();
    }

    const newReel = await db
      .insert(schema.reelsTable)
      .values(fullReelData)
      .returning();

    return newReel[0];
  } catch (error) {
    console.error(
      `Ошибка при сохранении Reel с URL ${reelData.reel_url}:`, // ИСПРАВЛЕНО: reel_url
      error
    );
    return undefined;
  }
}

/**
 * Сохраняет массив данных Reels в базу данных.
 * @param reelsDataArray Массив объектов ReelInsert.
 * @param projectId ID проекта.
 * @param competitorId (Опционально) ID связанного конкурента (если все Reels из одного источника-конкурента).
 * @param hashtagId (Опционально) ID связанного хэштега (если все Reels из одного источника-хэштега).
 * @returns Promise с массивом сохраненных (или существующих) Reels.
 */
export async function saveMultipleReels(
  reelsDataArray: Omit<
    ReelInsert,
    "project_id" | "competitor_id" | "hashtag_id" | "parsed_at" | "updated_at"
  >[],
  projectId: number, // Теперь это число
  competitorId?: number,
  hashtagId?: number
): Promise<Reel[]> {
  const db = getDB();
  if (!db) return [];

  const savedReels: Reel[] = [];
  const reelsToInsert: ReelInsert[] = [];
  const existingReelUrls = new Set<string>();

  // 1. Отфильтровать те, у которых нет URL
  const validReelsData = reelsDataArray.filter((r) => r.reel_url); // ИСПРАВЛЕНО: reel_url

  // 2. Найти уже существующие reels одним запросом
  if (validReelsData.length > 0) {
    const currentReelUrls = validReelsData
      .map((r) => r.reel_url)
      .filter(Boolean) as string[]; // ИСПРАВЛЕНО: reel_url
    if (currentReelUrls.length > 0) {
      const existingDbReels = await db
        .select()
        .from(schema.reelsTable)
        .where(
          and(
            eq(schema.reelsTable.project_id, projectId), // OK
            inArray(schema.reelsTable.reel_url, currentReelUrls) // ИСПРАВЛЕНО: reel_url
          )
        );
      existingDbReels.forEach((reel) => {
        if (reel.reel_url) {
          // ИСПРАВЛЕНО: reel_url
          existingReelUrls.add(reel.reel_url); // ИСПРАВЛЕНО: reel_url
          savedReels.push(reel); // Добавляем уже существующие, чтобы вернуть их тоже
        }
      });
    }
  }

  // 3. Подготовить к вставке только новые reels
  for (const reelData of validReelsData) {
    if (!reelData.reel_url || existingReelUrls.has(reelData.reel_url)) {
      // ИСПРАВЛЕНО: reel_url
      continue;
    }

    const fullReelData: ReelInsert = {
      ...reelData,
      project_id: projectId, // OK
    };
    if (competitorId) {
      // @ts-ignore
      fullReelData.competitor_id = competitorId;
      fullReelData.source_type = "competitor";
      // @ts-ignore
      fullReelData.source_identifier = competitorId.toString();
    } else if (hashtagId) {
      // @ts-ignore
      fullReelData.hashtag_id = hashtagId;
      fullReelData.source_type = "hashtag";
      // @ts-ignore
      fullReelData.source_identifier = hashtagId.toString();
    }
    reelsToInsert.push(fullReelData);
  }

  // 4. Вставить новые reels, если они есть
  if (reelsToInsert.length > 0) {
    try {
      const newReels = await db
        .insert(schema.reelsTable)
        .values(reelsToInsert)
        .returning();
      savedReels.push(...newReels);
      console.log(`Успешно сохранено ${newReels.length} новых Reels.`);
    } catch (error) {
      console.error("Ошибка при пакетном сохранении Reels:", error);
      // Можно добавить логику обработки ошибок для отдельных записей, если это необходимо
    }
  } else {
    console.log("Нет новых Reels для сохранения.");
  }

  return savedReels;
}

/**
 * Возвращает всех пользователей из базы данных.
 * В текущей схеме usersTable нет поля is_active, поэтому возвращаются все пользователи.
 * @returns Promise с массивом пользователей.
 */
export async function getAllActiveUsers(): Promise<User[]> {
  const db = getDB();
  try {
    const users = await db.select().from(schema.usersTable);
    return users;
  } catch (error) {
    console.error("Ошибка при получении всех пользователей:", error);
    throw error; // или return [] в зависимости от желаемой обработки ошибок
  }
}

/**
 * Находит все проекты для указанного пользователя.
 * ВНИМАНИЕ: Эта функция предполагает, что переданный userId (число)
 * соответствует projectsTable.user_id (integer).
 * Существует несоответствие со схемой usersTable.id (uuid).
 * @param userId Числовой ID пользователя (соответствующий projectsTable.user_id).
 * @param activeOnly (Опционально) Если true, возвращает только активные проекты. По умолчанию true.
 * @returns Promise с массивом проектов.
 */
export async function getProjectsByUserId(
  userId: string, // Изменено на string для UUID
  activeOnly = true
): Promise<Project[]> {
  const db = getDB();
  try {
    const conditions = [eq(schema.projectsTable.user_id, userId)];
    if (activeOnly) {
      conditions.push(eq(schema.projectsTable.is_active, true));
    }
    const projects = await db
      .select()
      .from(schema.projectsTable)
      .where(and(...conditions));
    return projects;
  } catch (error) {
    console.error(
      `Ошибка при получении проектов для пользователя ID ${userId}:`,
      error
    );
    throw error;
  }
}

/**
 * Находит все аккаунты конкурентов для указанного проекта.
 * @param projectId ID проекта.
 * @param activeOnly (Опционально) Если true, возвращает только активных конкурентов. По умолчанию true.
 * @returns Promise с массивом конкурентов.
 */
export async function getCompetitorAccountsByProjectId(
  projectId: number,
  activeOnly = true
): Promise<Competitor[]> {
  const db = getDB();
  try {
    const conditions = [eq(schema.competitorsTable.project_id, projectId)];
    if (activeOnly) {
      conditions.push(eq(schema.competitorsTable.is_active, true));
    }
    const competitors = await db
      .select()
      .from(schema.competitorsTable)
      .where(and(...conditions));
    return competitors;
  } catch (error) {
    console.error(
      `Ошибка при получении конкурентов для проекта ID ${projectId}:`,
      error
    );
    throw error;
  }
}

/**
 * Находит все хэштеги для указанного проекта.
 * @param projectId ID проекта.
 * @param activeOnly (Опционально) Если true, возвращает только активные хэштеги. По умолчанию true.
 * @returns Promise с массивом хэштегов.
 */
export async function getTrackingHashtagsByProjectId(
  projectId: number,
  activeOnly = true
): Promise<Hashtag[]> {
  const db = getDB();
  try {
    const conditions = [eq(schema.hashtagsTable.project_id, projectId)];
    if (activeOnly) {
      conditions.push(eq(schema.hashtagsTable.is_active, true));
    }
    const hashtags = await db
      .select()
      .from(schema.hashtagsTable)
      .where(and(...conditions));
    return hashtags;
  } catch (error) {
    console.error(
      `Ошибка при получении хэштегов для проекта ID ${projectId}:`,
      error
    );
    throw error;
  }
}

/**
 * Сохраняет массив Reels для указанного источника (конкурент или хэштег).
 * Обертка над saveMultipleReels для удобства использования в скриптах скрапинга.
 * @param reelsDataArray Массив данных Reels для сохранения (без project_id, source_type, source_identifier).
 * @param projectId ID проекта.
 * @param sourceType Тип источника ('competitor' или 'hashtag').
 * @param sourceId ID источника (ID конкурента или хэштега).
 * @returns Promise с массивом сохраненных Reels.
 */
export async function saveReelsForSource(
  reelsDataArray: Omit<
    ReelInsert,
    | "project_id"
    | "source_type"
    | "source_identifier"
    | "parsed_at"
    | "updated_at"
  >[],
  projectId: number,
  sourceType: "competitor" | "hashtag",
  sourceId: number
): Promise<Reel[]> {
  const db = getDB();
  if (!db) return [];

  const reelsToInsert: ReelInsert[] = reelsDataArray.map((reel) => ({
    ...reel,
    project_id: projectId,
    source_type: sourceType,
    source_identifier: sourceId.toString(), // Сохраняем ID как строку
    // parsed_at: new Date(), // parsed_at отсутствует в схеме reelsTable. Удаляем эту строку.
    // created_at и updated_at будут установлены по умолчанию в схеме
  }));

  if (reelsToInsert.length === 0) {
    return [];
  }

  try {
    // Используем insert...onConflict...doNothing для игнорирования дубликатов по reel_url
    const result = await db
      .insert(schema.reelsTable)
      .values(reelsToInsert)
      .onConflictDoNothing({ target: schema.reelsTable.reel_url }) // Игнорировать дубликаты по reel_url
      .returning(); // Возвращаем вставленные (или проигнорированные, если ничего не вернулось)

    // console.log(`${result.length} Reels были успешно сохранены или уже существовали для проекта ${projectId}, источника ${sourceType}:${sourceId}.`);
    return result;
  } catch (error) {
    console.error(
      `Ошибка при сохранении Reels для проекта ${projectId}, источника ${sourceType}:${sourceId}:`,
      error
    );
    return []; // Возвращаем пустой массив в случае ошибки
  }
}

/**
 * Логирует информацию о запуске парсинга.
 * @param logData Данные для лога.
 * @returns Promise с объектом созданной записи лога.
 */
export async function logParsingRun(
  logData: ParsingRunInsert
): Promise<ParsingRun | undefined> {
  const db = getDB();
  if (!db) return undefined;

  try {
    const newLogEntry = await db
      .insert(schema.parsingRunsTable)
      .values(logData)
      .returning();
    return newLogEntry[0];
  } catch (error) {
    console.error("Ошибка при логировании запуска парсинга:", error);
    return undefined;
  }
}

// Можно добавить функции для обновления записи лога, например, при завершении или ошибке.
export async function updateParsingRun(
  run_id: string, // UUID
  updateData: Partial<
    Omit<ParsingRunInsert, "run_id" | "project_id" | "started_at">
  >
): Promise<ParsingRun | undefined> {
  const db = getDB();
  if (!db) return undefined;

  try {
    const updatedLogEntry = await db
      .update(schema.parsingRunsTable)
      .set({ ...updateData, updated_at: new Date() })
      .where(eq(schema.parsingRunsTable.run_id, run_id))
      .returning();

    if (updatedLogEntry.length > 0) {
      return updatedLogEntry[0];
    } else {
      console.warn(`Запись лога с run_id ${run_id} не найдена для обновления.`);
      return undefined;
    }
  } catch (error) {
    console.error(`Ошибка при обновлении записи лога ${run_id}:`, error);
    return undefined;
  }
}

/**
 * Проверяет существование Reel в базе данных по URL.
 * @param db Экземпляр NeonDB.
 * @param reelUrl URL проверяемого Reel.
 * @returns Promise<boolean> - true, если Reel существует, иначе false.
 */
export async function checkReelExists(
  db: NeonDB,
  reelUrl: string
): Promise<boolean> {
  if (!reelUrl) {
    console.warn("checkReelExists вызван с пустым reelUrl.");
    return false;
  }
  try {
    const existingReel = await db
      .select({ id: schema.reelsTable.id })
      .from(schema.reelsTable)
      .where(eq(schema.reelsTable.reel_url, reelUrl))
      .limit(1);
    return existingReel.length > 0;
  } catch (error) {
    console.error(
      `Ошибка при проверке существования Reel с URL ${reelUrl}:`,
      error
    );
    return false; // В случае ошибки считаем, что не существует, чтобы избежать дублирования при сбоях БД
  }
}

/**
 * Сохраняет один Reel в базу данных.
 * @param db Экземпляр NeonDB.
 * @param data Данные Reel для сохранения (тип ReelInsert).
 * @returns Promise<Reel[]> - Массив с сохраненным Reel (или пустой массив при ошибке).
 */
export async function saveReel(db: NeonDB, data: ReelInsert): Promise<Reel[]> {
  if (!data.reel_url) {
    const errorMsg = "Попытка сохранить Reel без reel_url.";
    console.error(errorMsg, data);
    // Вместо throw new Error, который остановит весь процесс,
    // можно просто вернуть пустой массив, а ошибку залогировать выше.
    // Но для такого критичного поля, как reel_url, остановка может быть оправдана.
    // Пока оставим throw, чтобы явно видеть проблему.
    throw new Error(errorMsg);
  }
  // Дополнительные проверки на null для других notNull полей из schema.ts можно добавить здесь
  // Например, project_id, source_type, source_identifier (если они notNull в схеме)

  try {
    return db.insert(schema.reelsTable).values(data).returning();
  } catch (error) {
    console.error(`Ошибка при сохранении Reel ${data.reel_url} в БД:`, error);
    // В зависимости от стратегии обработки ошибок, можно либо пробросить ошибку дальше,
    // либо вернуть пустой массив/специальное значение.
    throw error; // Пробрасываем ошибку, чтобы вызывающий код мог ее обработать
  }
}

// TODO: Добавить остальные функции:
// (Функции для UserContentInteraction, если понадобятся)
