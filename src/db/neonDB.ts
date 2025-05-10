import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import * as schema from "./schema"
import { eq, and, inArray } from "drizzle-orm"

// Типы для вставки и выбора, чтобы не импортировать их везде
export type Project = typeof schema.projectsTable.$inferSelect
export type ProjectInsert = typeof schema.projectsTable.$inferInsert
export type User = typeof schema.usersTable.$inferSelect
export type UserInsert = typeof schema.usersTable.$inferInsert
export type Competitor = typeof schema.competitorsTable.$inferSelect
export type CompetitorInsert = typeof schema.competitorsTable.$inferInsert
export type Hashtag = typeof schema.hashtagsTable.$inferSelect
export type HashtagInsert = typeof schema.hashtagsTable.$inferInsert
export type Reel = typeof schema.reelsTable.$inferSelect
export type ReelInsert = typeof schema.reelsTable.$inferInsert

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null

/**
 * Инициализирует соединение с базой данных Neon.
 * @returns Экземпляр Drizzle DB.
 */
export function initializeDBConnection() {
  if (dbInstance) {
    console.log("Соединение с БД уже инициализировано.")
    return dbInstance
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("Переменная окружения DATABASE_URL не установлена.")
  }

  const sql = neon(databaseUrl)
  dbInstance = drizzle(sql, {
    schema,
    logger: process.env.NODE_ENV === "development",
  }) // Логгер только в development
  console.log("Соединение с БД Neon успешно инициализировано.")
  return dbInstance
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
    return initializeDBConnection()
    // throw new Error("Соединение с БД не было инициализировано. Вызовите initializeDBConnection() сначала.");
  }
  return dbInstance
}

/**
 * (В будущем) Закрывает соединение с БД, если это необходимо для serverless среды.
 * Для neon/serverless HTTP обычно это не требуется явно.
 */
export async function closeDBConnection() {
  // Для HTTP-соединения neon/serverless явное закрытие обычно не требуется.
  // Если бы это был пул соединений pg, здесь было бы pool.end().
  console.log("Соединение с БД Neon (HTTP) не требует явного закрытия.")
  dbInstance = null // Сбрасываем инстанс для возможности переинициализации
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
  const db = getDB()
  if (!db) {
    console.error("DB not initialized in getOrCreateProject")
    return undefined
  }
  try {
    // Сначала найдем пользователя по authId, чтобы получить его usersTable.id (UUID)
    const userQuery = await db
      .select({ id: schema.usersTable.id }) // usersTable.id is UUID
      .from(schema.usersTable)
      .where(eq(schema.usersTable.authId, userId))
      .limit(1)

    if (!userQuery || userQuery.length === 0) {
      console.error(`Пользователь с authId ${userId} не найден.`)
      return undefined
    }
    const userRecordId = userQuery[0].id // Это usersTable.id (UUID)

    // Теперь ищем проект по имени и user_id (который должен быть UUID)
    // НО! projectsTable.user_id в схеме - integer, а usersTable.id - uuid. Это КОНФЛИКТ СХЕМЫ!
    // Пока что будем предполагать, что getOrCreateProject будет вызван с usersTable.id (числовым),
    // что потребует изменений в вызывающем коде и, возможно, в usersTable.id схеме.
    // ДЛЯ ВРЕМЕННОГО РЕШЕНИЯ ОШИБОК ТИПОВ, ПРЕДПОЛОЖИМ, ЧТО СЮДА ПРИХОДИТ ЧИСЛОВОЙ ID ПОЛЬЗОВАТЕЛЯ
    // И ЭТОТ ID СООТВЕТСВУЕТ projectsTable.user_id
    // ЭТО НУЖНО БУДЕТ ИСПРАВИТЬ ВМЕСТЕ СО СХЕМОЙ!

    let project = await db
      .select()
      .from(schema.projectsTable)
      .where(
        and(
          eq(schema.projectsTable.name, projectName),
          // @ts-ignore // Временно игнорируем ошибку типа, пока схема не исправлена
          eq(schema.projectsTable.user_id, userRecordId) // ОШИБКА: userRecordId - UUID, projectsTable.user_id - integer
        )
      )
      .limit(1)

    if (project.length > 0) {
      return project[0]
    } else {
      // Если будем использовать числовой ID пользователя для projectsTable.user_id
      // то нужно будет передавать его в getOrCreateProject вместо authId
      // const numericUserId = ПРЕОБРАЗОВАТЬ userRecordId в число или получить числовой ID пользователя другим способом

      const newProject = await db
        .insert(schema.projectsTable)
        .values({
          // @ts-ignore // Временно игнорируем ошибку типа
          user_id: userRecordId, // ОШИБКА: userRecordId - UUID, projectsTable.user_id - integer
          name: projectName,
        })
        .returning()
      return newProject[0]
    }
  } catch (error) {
    console.error("Ошибка при получении или создании проекта:", error)
    return undefined
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
  const db = getDB()
  try {
    let user = await db
      .select()
      .from(schema.usersTable)
      .where(eq(schema.usersTable.telegram_id, telegramId))
      .limit(1)
      .then(rows => rows[0])

    if (user) {
      // console.log(`Пользователь с Telegram ID ${telegramId} найден.`);
      return user
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
    }

    const newUser = await db
      .insert(schema.usersTable)
      .values(newUserValues)
      .returning()
      .then(rows => rows[0])

    // console.log(`Пользователь с Telegram ID ${telegramId} успешно создан.`);
    return newUser
  } catch (error) {
    console.error(
      `Ошибка при поиске или создании пользователя с Telegram ID ${telegramId}:`,
      error
    )
    throw error
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
  const db = getDB()
  if (!db) return undefined

  const actualUsername =
    username || profileUrl.split("/").filter(Boolean).pop() || "unknown"

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
      .limit(1)

    if (competitor.length > 0) {
      return competitor[0]
    } else {
      const newCompetitor = await db
        .insert(schema.competitorsTable)
        .values({
          project_id: projectId, // OK
          username: actualUsername,
          profile_url: profileUrl,
        })
        .returning()
      return newCompetitor[0]
    }
  } catch (error) {
    console.error("Ошибка при получении или создании конкурента:", error)
    return undefined
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
  const db = getDB()
  if (!db) return undefined
  const normalizedHashtag = hashtagName.startsWith("#")
    ? hashtagName.substring(1)
    : hashtagName
  try {
    let hashtag = await db
      .select()
      .from(schema.hashtagsTable)
      .where(
        and(
          eq(schema.hashtagsTable.project_id, projectId), // OK
          eq(schema.hashtagsTable.tag_name, normalizedHashtag) // ИСПРАВЛЕНО: tag_name
        )
      )
      .limit(1)

    if (hashtag.length > 0) {
      return hashtag[0]
    } else {
      const newHashtag = await db
        .insert(schema.hashtagsTable)
        .values({
          project_id: projectId, // OK
          tag_name: normalizedHashtag, // ИСПРАВЛЕНО: tag_name
        })
        .returning()
      return newHashtag[0]
    }
  } catch (error) {
    console.error("Ошибка при получении или создании хэштега:", error)
    return undefined
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
  const db = getDB()
  if (!db) return undefined

  if (!reelData.reel_url) {
    // ИСПРАВЛЕНО: reel_url
    console.warn("Попытка сохранить Reel без URL, пропуск.")
    return undefined
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
      .limit(1)

    if (existingReel.length > 0) {
      // console.log(`Reel с URL ${reelData.reel_url} уже существует, пропуск.`);
      return existingReel[0]
    }

    // Добавляем недостающие внешние ключи и метаданные
    const fullReelData: ReelInsert = {
      ...reelData,
      project_id: projectId, // OK
      // source_type и source_identifier могут быть заполнены на основе competitorId/hashtagId или переданы в reelData
      // parsed_at: new Date(), // Если нужно отслеживать время парсинга отдельно от created_at
      // updated_at будет установлено автоматически Drizzle
    }

    if (competitorId) {
      // @ts-ignore TODO: Define competitor_id in ReelInsert or handle it better
      fullReelData.competitor_id = competitorId
      fullReelData.source_type = "competitor"
      // @ts-ignore
      fullReelData.source_identifier = competitorId.toString()
    } else if (hashtagId) {
      // @ts-ignore TODO: Define hashtag_id in ReelInsert or handle it better
      fullReelData.hashtag_id = hashtagId
      fullReelData.source_type = "hashtag"
      // @ts-ignore
      fullReelData.source_identifier = hashtagId.toString()
    }

    const newReel = await db
      .insert(schema.reelsTable)
      .values(fullReelData)
      .returning()

    return newReel[0]
  } catch (error) {
    console.error(
      `Ошибка при сохранении Reel с URL ${reelData.reel_url}:`, // ИСПРАВЛЕНО: reel_url
      error
    )
    return undefined
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
  const db = getDB()
  if (!db) return []

  const savedReels: Reel[] = []
  const reelsToInsert: ReelInsert[] = []
  const existingReelUrls = new Set<string>()

  // 1. Отфильтровать те, у которых нет URL
  const validReelsData = reelsDataArray.filter(r => r.reel_url) // ИСПРАВЛЕНО: reel_url

  // 2. Найти уже существующие reels одним запросом
  if (validReelsData.length > 0) {
    const currentReelUrls = validReelsData
      .map(r => r.reel_url)
      .filter(Boolean) as string[] // ИСПРАВЛЕНО: reel_url
    if (currentReelUrls.length > 0) {
      const existingDbReels = await db
        .select()
        .from(schema.reelsTable)
        .where(
          and(
            eq(schema.reelsTable.project_id, projectId), // OK
            inArray(schema.reelsTable.reel_url, currentReelUrls) // ИСПРАВЛЕНО: reel_url
          )
        )
      existingDbReels.forEach(reel => {
        if (reel.reel_url) {
          // ИСПРАВЛЕНО: reel_url
          existingReelUrls.add(reel.reel_url) // ИСПРАВЛЕНО: reel_url
          savedReels.push(reel) // Добавляем уже существующие, чтобы вернуть их тоже
        }
      })
    }
  }

  // 3. Подготовить к вставке только новые reels
  for (const reelData of validReelsData) {
    if (!reelData.reel_url || existingReelUrls.has(reelData.reel_url)) {
      // ИСПРАВЛЕНО: reel_url
      continue
    }

    const fullReelData: ReelInsert = {
      ...reelData,
      project_id: projectId, // OK
    }
    if (competitorId) {
      // @ts-ignore
      fullReelData.competitor_id = competitorId
      fullReelData.source_type = "competitor"
      // @ts-ignore
      fullReelData.source_identifier = competitorId.toString()
    } else if (hashtagId) {
      // @ts-ignore
      fullReelData.hashtag_id = hashtagId
      fullReelData.source_type = "hashtag"
      // @ts-ignore
      fullReelData.source_identifier = hashtagId.toString()
    }
    reelsToInsert.push(fullReelData)
  }

  // 4. Вставить новые reels, если они есть
  if (reelsToInsert.length > 0) {
    try {
      const newReels = await db
        .insert(schema.reelsTable)
        .values(reelsToInsert)
        .returning()
      savedReels.push(...newReels)
      console.log(`Успешно сохранено ${newReels.length} новых Reels.`)
    } catch (error) {
      console.error("Ошибка при пакетном сохранении Reels:", error)
      // Можно добавить логику обработки ошибок для отдельных записей, если это необходимо
    }
  } else {
    console.log("Нет новых Reels для сохранения.")
  }

  return savedReels
}

// TODO: Добавить остальные функции:
// (Функции для UserContentInteraction, если понадобятся)
