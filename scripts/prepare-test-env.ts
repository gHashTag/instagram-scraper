#!/usr/bin/env bun

/**
 * Скрипт для подготовки тестовой среды
 * 
 * Этот скрипт:
 * 1. Проверяет наличие всех необходимых зависимостей
 * 2. Инициализирует тестовую базу данных SQLite
 * 3. Заполняет базу данных тестовыми данными
 * 
 * Использование:
 * bun run scripts/prepare-test-env.ts
 * 
 * Опции:
 * --reset - сбросить базу данных перед инициализацией
 * --verbose - подробный вывод
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Database } from 'bun:sqlite';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Парсим аргументы командной строки
const args = process.argv.slice(2);
const resetDb = args.includes('--reset');
const verbose = args.includes('--verbose');

// Конфигурация
const config = {
  dbPath: path.join(rootDir, '.dev', 'test-sqlite.db'),
  devDir: path.join(rootDir, '.dev'),
  requiredDeps: ['telegraf', 'zod', 'bun:sqlite'],
  testData: {
    users: [
      { telegramId: 123456789, username: 'test_user', firstName: 'Test', lastName: 'User' }
    ],
    projects: [
      { name: 'Тестовый проект 1', userId: 1 },
      { name: 'Тестовый проект 2', userId: 1 }
    ],
    competitors: [
      { projectId: 1, username: 'beauty_clinic', instagramUrl: 'https://www.instagram.com/beauty_clinic' },
      { projectId: 1, username: 'luxury_beauty', instagramUrl: 'https://www.instagram.com/luxury_beauty' },
      { projectId: 2, username: 'skincare_expert', instagramUrl: 'https://www.instagram.com/skincare_expert' }
    ],
    hashtags: [
      { projectId: 1, name: 'красота' },
      { projectId: 1, name: 'косметология' },
      { projectId: 2, name: 'уходзакожей' }
    ],
    reels: [
      { 
        projectId: 1, 
        sourceType: 'competitor', 
        sourceId: 1, 
        instagramId: 'reel123456', 
        caption: 'Тестовый Reel 1', 
        url: 'https://www.instagram.com/reel/reel123456',
        viewCount: 100000,
        likesCount: 5000,
        commentsCount: 200,
        publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 дней назад
      },
      { 
        projectId: 1, 
        sourceType: 'competitor', 
        sourceId: 2, 
        instagramId: 'reel234567', 
        caption: 'Тестовый Reel 2', 
        url: 'https://www.instagram.com/reel/reel234567',
        viewCount: 75000,
        likesCount: 3000,
        commentsCount: 150,
        publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 дня назад
      },
      { 
        projectId: 2, 
        sourceType: 'hashtag', 
        sourceId: 3, 
        instagramId: 'reel345678', 
        caption: 'Тестовый Reel 3', 
        url: 'https://www.instagram.com/reel/reel345678',
        viewCount: 120000,
        likesCount: 6000,
        commentsCount: 300,
        publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 дня назад
      }
    ],
    collections: [
      {
        projectId: 1,
        name: 'Тестовая коллекция 1',
        description: 'Описание тестовой коллекции 1',
        isProcessed: false
      }
    ],
    notificationSettings: [
      {
        userId: 1,
        newReelsEnabled: true,
        trendsEnabled: true,
        weeklyReportEnabled: false,
        viewsThreshold: 50000,
        notificationTime: '10:00'
      }
    ]
  }
};

// Функция для логирования
function log(message: string, isVerbose = false) {
  if (isVerbose && !verbose) return;
  console.log(message);
}

// Функция для проверки зависимостей
async function checkDependencies() {
  log('Проверка зависимостей...', true);
  
  try {
    const { stdout } = await execAsync('bun pm ls --json');
    const installedDeps = JSON.parse(stdout);
    
    for (const dep of config.requiredDeps) {
      if (dep.startsWith('bun:')) continue; // Встроенные модули Bun
      
      if (!installedDeps[dep]) {
        console.error(`❌ Зависимость ${dep} не установлена. Установите её с помощью 'bun install ${dep}'`);
        process.exit(1);
      }
    }
    
    log('✅ Все зависимости установлены', true);
  } catch (error) {
    console.error('❌ Ошибка при проверке зависимостей:', error);
    process.exit(1);
  }
}

// Функция для инициализации директории .dev
function initDevDir() {
  log('Инициализация директории .dev...', true);
  
  if (!fs.existsSync(config.devDir)) {
    fs.mkdirSync(config.devDir, { recursive: true });
    log(`✅ Создана директория ${config.devDir}`, true);
  } else {
    log(`✅ Директория ${config.devDir} уже существует`, true);
  }
}

// Функция для инициализации базы данных
function initDatabase() {
  log('Инициализация базы данных...');
  
  if (resetDb && fs.existsSync(config.dbPath)) {
    fs.unlinkSync(config.dbPath);
    log(`🗑️ Удалена существующая база данных ${config.dbPath}`, true);
  }
  
  const db = new Database(config.dbPath);
  
  // Создаем таблицы
  db.exec(`
    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER UNIQUE,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS Projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES Users(id)
    );
    
    CREATE TABLE IF NOT EXISTS Competitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      username TEXT NOT NULL,
      instagram_url TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES Projects(id)
    );
    
    CREATE TABLE IF NOT EXISTS Hashtags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES Projects(id)
    );
    
    CREATE TABLE IF NOT EXISTS ReelsContent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      source_type TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      instagram_id TEXT UNIQUE,
      caption TEXT,
      url TEXT,
      view_count INTEGER,
      likes_count INTEGER,
      comments_count INTEGER,
      published_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      transcript TEXT,
      FOREIGN KEY (project_id) REFERENCES Projects(id)
    );
    
    CREATE TABLE IF NOT EXISTS ParsingRunLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      status TEXT,
      reels_found INTEGER,
      reels_saved INTEGER,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      error_message TEXT,
      FOREIGN KEY (project_id) REFERENCES Projects(id)
    );
    
    CREATE TABLE IF NOT EXISTS NotificationSettings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      new_reels_enabled BOOLEAN DEFAULT 1,
      trends_enabled BOOLEAN DEFAULT 1,
      weekly_report_enabled BOOLEAN DEFAULT 0,
      views_threshold INTEGER DEFAULT 50000,
      notification_time TEXT DEFAULT '10:00',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES Users(id)
    );
    
    CREATE TABLE IF NOT EXISTS ReelsCollections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      is_processed BOOLEAN DEFAULT 0,
      processing_status TEXT,
      content_format TEXT,
      content_data TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES Projects(id)
    );
    
    CREATE TABLE IF NOT EXISTS ReelsCollectionItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER,
      reel_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (collection_id) REFERENCES ReelsCollections(id),
      FOREIGN KEY (reel_id) REFERENCES ReelsContent(id)
    );
    
    CREATE TABLE IF NOT EXISTS Embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reel_id TEXT,
      embedding TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reel_id) REFERENCES ReelsContent(instagram_id)
    );
    
    CREATE TABLE IF NOT EXISTS ChatHistory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      reel_id TEXT,
      message TEXT,
      response TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES Users(id),
      FOREIGN KEY (reel_id) REFERENCES ReelsContent(instagram_id)
    );
  `);
  
  log('✅ Таблицы базы данных созданы');
  
  return db;
}

// Функция для заполнения базы данных тестовыми данными
function fillTestData(db: Database) {
  log('Заполнение базы данных тестовыми данными...');
  
  // Добавляем пользователей
  for (const user of config.testData.users) {
    db.prepare(
      'INSERT OR IGNORE INTO Users (telegram_id, username, first_name, last_name) VALUES (?, ?, ?, ?)'
    ).run(user.telegramId, user.username, user.firstName, user.lastName);
  }
  log(`✅ Добавлено ${config.testData.users.length} пользователей`);
  
  // Добавляем проекты
  for (const project of config.testData.projects) {
    db.prepare(
      'INSERT OR IGNORE INTO Projects (user_id, name) VALUES (?, ?)'
    ).run(project.userId, project.name);
  }
  log(`✅ Добавлено ${config.testData.projects.length} проектов`);
  
  // Добавляем конкурентов
  for (const competitor of config.testData.competitors) {
    db.prepare(
      'INSERT OR IGNORE INTO Competitors (project_id, username, instagram_url) VALUES (?, ?, ?)'
    ).run(competitor.projectId, competitor.username, competitor.instagramUrl);
  }
  log(`✅ Добавлено ${config.testData.competitors.length} конкурентов`);
  
  // Добавляем хештеги
  for (const hashtag of config.testData.hashtags) {
    db.prepare(
      'INSERT OR IGNORE INTO Hashtags (project_id, name) VALUES (?, ?)'
    ).run(hashtag.projectId, hashtag.name);
  }
  log(`✅ Добавлено ${config.testData.hashtags.length} хештегов`);
  
  // Добавляем Reels
  for (const reel of config.testData.reels) {
    db.prepare(
      'INSERT OR IGNORE INTO ReelsContent (project_id, source_type, source_id, instagram_id, caption, url, view_count, likes_count, comments_count, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      reel.projectId, 
      reel.sourceType, 
      reel.sourceId, 
      reel.instagramId, 
      reel.caption, 
      reel.url, 
      reel.viewCount, 
      reel.likesCount, 
      reel.commentsCount, 
      reel.publishedAt
    );
  }
  log(`✅ Добавлено ${config.testData.reels.length} Reels`);
  
  // Добавляем коллекции
  for (const collection of config.testData.collections) {
    db.prepare(
      'INSERT OR IGNORE INTO ReelsCollections (project_id, name, description, is_processed) VALUES (?, ?, ?, ?)'
    ).run(
      collection.projectId, 
      collection.name, 
      collection.description, 
      collection.isProcessed ? 1 : 0
    );
  }
  log(`✅ Добавлено ${config.testData.collections.length} коллекций`);
  
  // Добавляем настройки уведомлений
  for (const settings of config.testData.notificationSettings) {
    db.prepare(
      'INSERT OR IGNORE INTO NotificationSettings (user_id, new_reels_enabled, trends_enabled, weekly_report_enabled, views_threshold, notification_time) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      settings.userId, 
      settings.newReelsEnabled ? 1 : 0, 
      settings.trendsEnabled ? 1 : 0, 
      settings.weeklyReportEnabled ? 1 : 0, 
      settings.viewsThreshold, 
      settings.notificationTime
    );
  }
  log(`✅ Добавлены настройки уведомлений`);
}

// Функция для проверки переменных окружения
function checkEnvVars() {
  log('Проверка переменных окружения...', true);
  
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) {
    log('⚠️ Файл .env не найден. Создаем его...', true);
    
    const envContent = `# Переменные окружения для тестирования
NEON_DATABASE_URL=sqlite:///.dev/test-sqlite.db
APIFY_TOKEN=mock_apify_token_for_testing
MIN_VIEWS=50000
MAX_AGE_DAYS=14
TEST_MODE=true
`;
    
    fs.writeFileSync(envPath, envContent);
    log('✅ Файл .env создан', true);
  } else {
    log('✅ Файл .env уже существует', true);
  }
}

// Основная функция
async function main() {
  console.log('🚀 Подготовка тестовой среды...');
  
  try {
    await checkDependencies();
    initDevDir();
    checkEnvVars();
    const db = initDatabase();
    fillTestData(db);
    db.close();
    
    console.log('\n✅ Тестовая среда успешно подготовлена!');
    console.log('\n📋 Для запуска тестирования:');
    console.log('1. Запустите бота: bun run dev');
    console.log('2. Откройте бота в Telegram и отправьте команду /start');
    console.log('3. Следуйте инструкциям в чек-листе: docs/MVP_TESTING_CHECKLIST.md');
  } catch (error) {
    console.error('\n❌ Ошибка при подготовке тестовой среды:', error);
    process.exit(1);
  }
}

// Запускаем основную функцию
main();
