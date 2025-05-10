/**
 * Instagram Scraper Bot - Инициализация базы данных для разработки
 *
 * Этот скрипт создает и инициализирует SQLite базу данных для локальной разработки
 * с демо-данными для тестирования модуля Instagram Scraper Bot.
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { Database } from "bun:sqlite"
import dotenv from "dotenv"

// Initialize environment variables
dotenv.config()

// Set up paths
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, "..")
const DEV_DIR = path.resolve(ROOT_DIR, ".dev")
const SQLITE_DB_PATH =
  process.env.SQLITE_DB_PATH || path.resolve(DEV_DIR, "sqlite.db")

// Make sure .dev directory exists
if (!fs.existsSync(DEV_DIR)) {
  fs.mkdirSync(DEV_DIR, { recursive: true })
}

console.log(`🗃️ Инициализация SQLite базы данных: ${SQLITE_DB_PATH}`)

// Create or open SQLite database
const db = new Database(SQLITE_DB_PATH)

// Enable foreign keys
db.exec("PRAGMA foreign_keys = ON;")

// Create tables
console.log("📊 Создание таблиц...")

// Users table
db.exec(`
  CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL UNIQUE,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(telegram_id)
  );
`)

// Projects table
db.exec(`
  CREATE TABLE IF NOT EXISTS Projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
  );
`)

// Competitors table
db.exec(`
  CREATE TABLE IF NOT EXISTS Competitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    full_name TEXT,
    profile_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, username)
  );
`)

// Hashtags table
db.exec(`
  CREATE TABLE IF NOT EXISTS Hashtags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, name)
  );
`)

// ReelsContent table
db.exec(`
  CREATE TABLE IF NOT EXISTS ReelsContent (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    source_type TEXT NOT NULL,
    source_id INTEGER NOT NULL,
    instagram_id TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    caption TEXT,
    owner_username TEXT,
    owner_id TEXT,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    duration INTEGER,
    thumbnail_url TEXT,
    audio_title TEXT,
    published_at TEXT NOT NULL,
    fetched_at TEXT DEFAULT (datetime('now')),
    is_processed INTEGER DEFAULT 0,
    processing_status TEXT,
    processing_result TEXT,
    FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE,
    UNIQUE(instagram_id)
  );
`)

// Check if we need to add demo data
const isDemoDataExists = db
  .prepare("SELECT COUNT(*) as count FROM Users")
  .get() as { count: number }

if (isDemoDataExists.count === 0 || process.env.NODE_ENV === "test") {
  console.log("🧪 Добавление демо-данных...")

  // Add demo user
  const insertUser = db.prepare(`
    INSERT INTO Users (telegram_id, username, first_name, last_name)
    VALUES (?, ?, ?, ?)
  `)

  const userResult = insertUser.run("12345678", "test_user", "Test", "User")
  const userId = userResult.lastInsertRowid

  console.log(`👤 Создан тестовый пользователь с ID: ${userId}`)

  // Add demo projects
  const insertProject = db.prepare(`
    INSERT INTO Projects (user_id, name, description)
    VALUES (?, ?, ?)
  `)

  const projectResult = insertProject.run(
    userId,
    "Эстетическая косметология",
    "Проект для мониторинга конкурентов в сфере эстетической косметологии"
  )
  const projectId = projectResult.lastInsertRowid

  console.log(`📋 Создан тестовый проект с ID: ${projectId}`)

  // Add demo competitors
  const insertCompetitor = db.prepare(`
    INSERT INTO Competitors (project_id, username, full_name, profile_url)
    VALUES (?, ?, ?, ?)
  `)

  const competitors = [
    {
      username: "beauty_clinic",
      fullName: "Beauty Clinic",
      profileUrl: "https://instagram.com/beauty_clinic",
    },
    {
      username: "luxury_beauty",
      fullName: "Luxury Beauty Center",
      profileUrl: "https://instagram.com/luxury_beauty",
    },
    {
      username: "cosmetology_pro",
      fullName: "Professional Cosmetology",
      profileUrl: "https://instagram.com/cosmetology_pro",
    },
    {
      username: "skin_experts",
      fullName: "Skin Care Experts",
      profileUrl: "https://instagram.com/skin_experts",
    },
    {
      username: "plastic_surgery",
      fullName: "Plastic Surgery Center",
      profileUrl: "https://instagram.com/plastic_surgery",
    },
  ]

  let competitorCount = 0
  for (const competitor of competitors) {
    insertCompetitor.run(
      projectId,
      competitor.username,
      competitor.fullName,
      competitor.profileUrl
    )
    competitorCount++
  }

  console.log(`👥 Добавлено ${competitorCount} тестовых конкурентов`)

  // Add demo hashtags
  const insertHashtag = db.prepare(`
    INSERT INTO Hashtags (project_id, name)
    VALUES (?, ?)
  `)

  const hashtags = [
    "красота",
    "косметология",
    "уходзалицом",
    "инъекции",
    "филлеры",
    "пластика",
    "ринопластика",
  ]

  let hashtagCount = 0
  for (const hashtag of hashtags) {
    insertHashtag.run(projectId, hashtag)
    hashtagCount++
  }

  console.log(`🔖 Добавлено ${hashtagCount} тестовых хэштегов`)

  // Add some demo Reels content
  const insertReel = db.prepare(`
    INSERT INTO ReelsContent (
      project_id, source_type, source_id, instagram_id, url, caption,
      owner_username, owner_id, view_count, like_count, comment_count,
      duration, thumbnail_url, audio_title, published_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Function to generate random date within last 14 days
  const randomDate = () => {
    const date = new Date()
    date.setDate(date.getDate() - Math.floor(Math.random() * 14))
    return date.toISOString()
  }

  // Generate some Reels from competitors
  const competitorIds = db
    .prepare(`SELECT id FROM Competitors WHERE project_id = ?`)
    .all(projectId) as { id: number }[]

  let reelsCount = 0
  for (const { id: competitorId } of competitorIds) {
    // Add 3-5 Reels per competitor
    const reelsToAdd = Math.floor(Math.random() * 3) + 3

    for (let i = 0; i < reelsToAdd; i++) {
      const viewCount = Math.floor(Math.random() * 200000) + 50000 // 50k-250k
      const likeCount = Math.floor(viewCount * (Math.random() * 0.1 + 0.05)) // 5-15%
      const commentCount = Math.floor(likeCount * (Math.random() * 0.1 + 0.01)) // 1-11%

      const reelId = `demo_${Date.now()}_${Math.floor(Math.random() * 10000)}`

      insertReel.run(
        projectId,
        "competitor",
        competitorId,
        reelId,
        `https://instagram.com/reel/${reelId}/`,
        "Демо-контент для тестирования. #красота #косметология #тест",
        `competitor_${competitorId}`,
        `owner_${competitorId}`,
        viewCount,
        likeCount,
        commentCount,
        Math.floor(Math.random() * 45) + 15, // 15-60 сек
        `https://example.com/thumbnails/${reelId}.jpg`,
        `Демо-аудио ${Math.floor(Math.random() * 100)}`,
        randomDate()
      )

      reelsCount++
    }
  }

  // Generate some Reels from hashtags
  const hashtagIds = db
    .prepare(`SELECT id FROM Hashtags WHERE project_id = ?`)
    .all(projectId) as { id: number }[]

  for (const { id: hashtagId } of hashtagIds) {
    // Add 3-7 Reels per hashtag
    const reelsToAdd = Math.floor(Math.random() * 5) + 3

    for (let i = 0; i < reelsToAdd; i++) {
      const viewCount = Math.floor(Math.random() * 200000) + 50000 // 50k-250k
      const likeCount = Math.floor(viewCount * (Math.random() * 0.1 + 0.05)) // 5-15%
      const commentCount = Math.floor(likeCount * (Math.random() * 0.1 + 0.01)) // 1-11%

      const reelId = `demo_hashtag_${Date.now()}_${Math.floor(Math.random() * 10000)}`

      insertReel.run(
        projectId,
        "hashtag",
        hashtagId,
        reelId,
        `https://instagram.com/reel/${reelId}/`,
        "Демо-контент по хэштегу для тестирования. #красота #косметология #тест",
        `random_user_${Math.floor(Math.random() * 1000)}`,
        `random_owner_${Math.floor(Math.random() * 10000)}`,
        viewCount,
        likeCount,
        commentCount,
        Math.floor(Math.random() * 45) + 15, // 15-60 сек
        `https://example.com/thumbnails/${reelId}.jpg`,
        `Демо-аудио хэштег ${Math.floor(Math.random() * 100)}`,
        randomDate()
      )

      reelsCount++
    }
  }

  console.log(`🎬 Добавлено ${reelsCount} тестовых Reels`)
}

// Close the database connection
db.close()

console.log("✅ Инициализация базы данных завершена успешно!")
