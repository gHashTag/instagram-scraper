import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { neon } from "@neondatabase/serverless"

// Получаем dirname для ES модулей
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Загружаем переменные окружения
dotenv.config({ path: path.join(__dirname, "../.env") })

/**
 * Скрипт для создания структуры мультитенантной базы данных
 * для сервиса анализа Instagram Reels конкурентов
 */
async function rebuildMultiTenantDatabase() {
  // Проверка подтверждения
  if (process.env.CONFIRM !== "YES") {
    console.log(
      "\n⚠️  ВНИМАНИЕ! Этот скрипт удалит ВСЕ существующие таблицы и создаст новую структуру."
    )
    console.log("⚠️  Все данные будут безвозвратно удалены!")
    console.log(
      "⚠️  Для подтверждения передайте CONFIRM=YES как аргумент командной строки."
    )
    console.log(
      "\n⛔ Операция отменена. Добавьте CONFIRM=YES для подтверждения."
    )
    return
  }

  if (!process.env.NEON_DATABASE_URL) {
    console.error("❌ Не найдена переменная окружения NEON_DATABASE_URL")
    process.exit(1)
  }

  // Инициализация SQL клиента
  const sql = neon(process.env.NEON_DATABASE_URL)

  try {
    console.log("🔄 Подключение к Neon Database...")

    // Получаем список всех таблиц
    const tablesRes = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `
    const tables = tablesRes.map(r => r.table_name)

    console.log("📋 Найдены таблицы:", tables.join(", ") || "таблиц нет")

    // Удаляем все существующие таблицы
    console.log("🗑️ Удаление всех существующих таблиц...")

    // Сначала удаляем зависимые таблицы, затем основные
    for (const table of tables) {
      // Используем sql.raw для безопасной динамической вставки имени таблицы
      await sql`DROP TABLE IF EXISTS "${sql.unsafe(table)}" CASCADE`
      console.log(`  ✓ Таблица "${table}" удалена`)
    }

    console.log("\n🏗️ Создание новой структуры мультитенантных таблиц...")

    // 1. Создаем таблицу Users (Пользователи)
    console.log("📊 Создание таблицы Users...")
    await sql`
      CREATE TABLE Users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        subscription_level VARCHAR(50) DEFAULT 'free',
        subscription_expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        last_active_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        settings JSONB
      )
    `

    // 2. Создаем таблицу Projects (Проекты пользователей)
    console.log("📊 Создание таблицы Projects...")
    await sql`
      CREATE TABLE Projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        industry VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        settings JSONB
      )
    `

    // 3. Создаем таблицу CompetitorAccounts (Аккаунты конкурентов)
    console.log("📊 Создание таблицы CompetitorAccounts...")
    await sql`
      CREATE TABLE CompetitorAccounts (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES Projects(id) ON DELETE CASCADE,
        instagram_url VARCHAR(255) NOT NULL,
        instagram_username VARCHAR(100),
        account_name VARCHAR(255),
        notes TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        last_parsed_at TIMESTAMPTZ,
        priority INTEGER DEFAULT 0
      )
    `

    // 4. Создаем таблицу TrackingHashtags (Отслеживаемые хэштеги)
    console.log("📊 Создание таблицы TrackingHashtags...")
    await sql`
      CREATE TABLE TrackingHashtags (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES Projects(id) ON DELETE CASCADE,
        hashtag VARCHAR(100) NOT NULL,
        display_name VARCHAR(255),
        notes TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        last_parsed_at TIMESTAMPTZ,
        priority INTEGER DEFAULT 0
      )
    `

    // 5. Создаем таблицу InstagramReels (Данные о спарсенных Reels)
    console.log("📊 Создание таблицы InstagramReels...")
    await sql`
      CREATE TABLE InstagramReels (
        id SERIAL PRIMARY KEY,
        reels_url VARCHAR(255) UNIQUE NOT NULL,
        publication_date TIMESTAMPTZ,
        views_count BIGINT,
        likes_count BIGINT,
        comments_count INTEGER,
        description TEXT,
        author_username VARCHAR(100),
        author_id VARCHAR(100),
        audio_title TEXT,
        audio_artist VARCHAR(255),
        thumbnail_url VARCHAR(255),
        duration_seconds INTEGER,
        raw_data JSONB,
        parsed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `

    // 6. Создаем таблицу ContentSources (Связь контента с источниками)
    console.log("📊 Создание таблицы ContentSources...")
    await sql`
      CREATE TABLE ContentSources (
        id SERIAL PRIMARY KEY,
        reels_id INTEGER REFERENCES InstagramReels(id) ON DELETE CASCADE,
        source_type VARCHAR(20) NOT NULL,
        competitor_id INTEGER REFERENCES CompetitorAccounts(id) ON DELETE SET NULL,
        hashtag_id INTEGER REFERENCES TrackingHashtags(id) ON DELETE SET NULL,
        project_id INTEGER REFERENCES Projects(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CHECK (
          (source_type = 'competitor' AND competitor_id IS NOT NULL AND hashtag_id IS NULL) OR
          (source_type = 'hashtag' AND hashtag_id IS NOT NULL AND competitor_id IS NULL)
        )
      )
    `

    // 7. Создаем таблицу UserContentInteractions (Взаимодействия пользователей с контентом)
    console.log("📊 Создание таблицы UserContentInteractions...")
    await sql`
      CREATE TABLE UserContentInteractions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
        reels_id INTEGER REFERENCES InstagramReels(id) ON DELETE CASCADE,
        is_favorite BOOLEAN DEFAULT FALSE,
        is_hidden BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, reels_id)
      )
    `

    // 8. Создаем таблицу ParsingLogs (Логи парсинга)
    console.log("📊 Создание таблицы ParsingLogs...")
    await sql`
      CREATE TABLE ParsingLogs (
        id SERIAL PRIMARY KEY,
        run_id UUID NOT NULL,
        project_id INTEGER REFERENCES Projects(id) ON DELETE CASCADE,
        source_type VARCHAR(20) NOT NULL,
        source_id INTEGER,
        status VARCHAR(20) NOT NULL,
        reels_added_count INTEGER DEFAULT 0,
        errors_count INTEGER DEFAULT 0,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ,
        log_message TEXT,
        error_details JSONB
      )
    `

    // Создаем индексы для оптимизации запросов
    console.log("\n📈 Создание индексов для оптимизации запросов...")

    // Индексы для Users
    await sql`CREATE INDEX idx_users_telegram_id ON Users (telegram_id)`

    // Индексы для Projects
    await sql`CREATE INDEX idx_projects_user_id ON Projects (user_id)`
    await sql`CREATE INDEX idx_projects_is_active ON Projects (is_active)`

    // Индексы для CompetitorAccounts
    await sql`CREATE INDEX idx_competitor_accounts_project_id ON CompetitorAccounts (project_id)`
    await sql`CREATE INDEX idx_competitor_accounts_is_active ON CompetitorAccounts (is_active)`
    await sql`CREATE INDEX idx_competitor_accounts_last_parsed_at ON CompetitorAccounts (last_parsed_at)`

    // Индексы для TrackingHashtags
    await sql`CREATE INDEX idx_tracking_hashtags_project_id ON TrackingHashtags (project_id)`
    await sql`CREATE INDEX idx_tracking_hashtags_is_active ON TrackingHashtags (is_active)`
    await sql`CREATE INDEX idx_tracking_hashtags_hashtag ON TrackingHashtags (hashtag)`

    // Индексы для InstagramReels
    await sql`CREATE INDEX idx_instagram_reels_publication_date ON InstagramReels (publication_date)`
    await sql`CREATE INDEX idx_instagram_reels_views_count ON InstagramReels (views_count)`
    await sql`CREATE INDEX idx_instagram_reels_author_username ON InstagramReels (author_username)`

    // Индексы для ContentSources
    await sql`CREATE INDEX idx_content_sources_reels_id ON ContentSources (reels_id)`
    await sql`CREATE INDEX idx_content_sources_project_id ON ContentSources (project_id)`
    await sql`CREATE INDEX idx_content_sources_competitor_id ON ContentSources (competitor_id)`
    await sql`CREATE INDEX idx_content_sources_hashtag_id ON ContentSources (hashtag_id)`

    // Индексы для UserContentInteractions
    await sql`CREATE INDEX idx_user_content_interactions_user_id ON UserContentInteractions (user_id)`
    await sql`CREATE INDEX idx_user_content_interactions_reels_id ON UserContentInteractions (reels_id)`
    await sql`CREATE INDEX idx_user_content_interactions_is_favorite ON UserContentInteractions (is_favorite)`

    // Индексы для ParsingLogs
    await sql`CREATE INDEX idx_parsing_logs_project_id ON ParsingLogs (project_id)`
    await sql`CREATE INDEX idx_parsing_logs_run_id ON ParsingLogs (run_id)`

    console.log("\n✅ Структура мультитенантной базы данных успешно создана!")

    // Выводим информацию о созданных таблицах
    console.log("\n🔍 Проверка структуры новых таблиц:")

    const newTablesRes = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `
    const newTables = newTablesRes.map(r => r.table_name)

    for (const table of newTables) {
      const columnsRes = await sql`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = ${table} 
        ORDER BY ordinal_position
      `

      console.log(`\n📋 Таблица: ${table}`)
      columnsRes.forEach(col => {
        console.log(
          `  - ${col.column_name} (${col.data_type})${col.is_nullable === "NO" ? " NOT NULL" : ""}`
        )
      })
    }

    // Создаем тестового пользователя и проект для тестирования
    console.log("\n📝 Создание тестовых данных...")

    // Тестовый пользователь
    const testUserRes = await sql`
      INSERT INTO Users (telegram_id, username, first_name, last_name, subscription_level) 
      VALUES (123456789, 'test_user', 'Test', 'User', 'premium')
      RETURNING id
    `
    const testUserId = testUserRes[0].id
    console.log(`  ✓ Тестовый пользователь создан (ID: ${testUserId})`)

    // Тестовый проект
    const testProjectRes = await sql`
      INSERT INTO Projects (user_id, name, description, industry) 
      VALUES (${testUserId}, 'Эстетическая Клиника', 'Тестовый проект для анализа конкурентов', 'Эстетическая медицина')
      RETURNING id
    `
    const testProjectId = testProjectRes[0].id
    console.log(`  ✓ Тестовый проект создан (ID: ${testProjectId})`)

    // Добавляем аккаунты конкурентов
    const accounts = [
      "https://www.instagram.com/clinicajoelleofficial",
      "https://www.instagram.com/kayaclinicarabia/",
      "https://www.instagram.com/lips_for_kiss",
      "https://www.instagram.com/ziedasclinic",
      "https://www.instagram.com/med_yu_med",
      "https://www.instagram.com/milena_aesthetic_clinic/",
      "https://www.instagram.com/graise.aesthetics",
    ]

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i]
      await sql`
        INSERT INTO CompetitorAccounts (project_id, instagram_url, account_name, priority) 
        VALUES (${testProjectId}, ${account}, ${`Конкурент ${i + 1}`}, ${i})
      `
      console.log(`  ✓ Аккаунт конкурента "${account}" добавлен`)
    }

    // Добавляем хэштеги
    const hashtags = [
      "aestheticmedicine",
      "aestheticclinic",
      "cosmetology",
      "hydrafacial",
      "botox",
      "fillers",
      "beautyclinic",
      "skincare",
      "prpfacial",
      "rfmicroneedling",
      "skinrejuvenation",
      "facialtreatment",
      "aesthetictreatment",
    ]

    for (let i = 0; i < hashtags.length; i++) {
      const hashtag = hashtags[i]
      await sql`
        INSERT INTO TrackingHashtags (project_id, hashtag, display_name, priority) 
        VALUES (${testProjectId}, ${hashtag}, ${`#${hashtag}`}, ${i})
      `
      console.log(`  ✓ Хэштег "#${hashtag}" добавлен`)
    }

    console.log("\n🎉 Мультитенантная база данных успешно подготовлена!")
  } catch (error) {
    console.error("❌ Ошибка при создании мультитенантной базы данных:", error)
    process.exit(1)
  }
}

// Выполняем функцию
rebuildMultiTenantDatabase()
