#!/usr/bin/env bun

/**
 * Скрипт для генерации тестовых данных с граничными случаями
 * 
 * Этот скрипт:
 * 1. Создает тестовые данные с граничными случаями (длинные названия, специальные символы и т.д.)
 * 2. Генерирует большое количество данных для тестирования производительности
 * 3. Создает данные для тестирования обработки ошибок
 * 
 * Использование:
 * bun run scripts/generate-edge-cases.ts
 * 
 * Опции:
 * --performance - генерировать данные для тестирования производительности
 * --errors - генерировать данные для тестирования обработки ошибок
 * --all - генерировать все типы данных
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Database } from 'bun:sqlite';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Парсим аргументы командной строки
const args = process.argv.slice(2);
const generatePerformance = args.includes('--performance') || args.includes('--all');
const generateErrors = args.includes('--errors') || args.includes('--all');
const generateAll = args.includes('--all');

// Если нет аргументов, генерируем только граничные случаи
const generateEdgeCases = args.length === 0 || generateAll;

// Конфигурация
const config = {
  dbPath: path.join(rootDir, '.dev', 'test-sqlite.db'),
  edgeCases: {
    projects: [
      { 
        name: 'A'.repeat(100), // Очень длинное название
        userId: 1 
      },
      { 
        name: 'Project with special chars: !@#$%^&*()_+{}[]|\\:;"\'<>,.?/', 
        userId: 1 
      },
      { 
        name: 'Project with emojis: 😀🎉🚀💯🔥', 
        userId: 1 
      },
      { 
        name: '', // Пустое название (должно вызвать ошибку)
        userId: 1 
      },
      { 
        name: ' '.repeat(50), // Только пробелы
        userId: 1 
      }
    ],
    competitors: [
      { 
        projectId: 1, 
        username: 'A'.repeat(100), // Очень длинное имя пользователя
        instagramUrl: 'https://www.instagram.com/' + 'A'.repeat(100) 
      },
      { 
        projectId: 1, 
        username: 'user with spaces', 
        instagramUrl: 'https://www.instagram.com/user with spaces' 
      },
      { 
        projectId: 1, 
        username: 'user_with_special_chars!@#$%', 
        instagramUrl: 'https://www.instagram.com/user_with_special_chars!@#$%' 
      },
      { 
        projectId: 1, 
        username: 'not_instagram_url', 
        instagramUrl: 'https://www.example.com/not_instagram_url' // Не Instagram URL
      },
      { 
        projectId: 1, 
        username: '', // Пустое имя пользователя
        instagramUrl: 'https://www.instagram.com/' 
      }
    ],
    hashtags: [
      { 
        projectId: 1, 
        name: 'A'.repeat(100) // Очень длинный хештег
      },
      { 
        projectId: 1, 
        name: 'hashtag with spaces' // Хештег с пробелами
      },
      { 
        projectId: 1, 
        name: 'hashtag_with_special_chars!@#$%' // Хештег со специальными символами
      },
      { 
        projectId: 1, 
        name: '#already_has_hash' // Хештег уже с символом #
      },
      { 
        projectId: 1, 
        name: '' // Пустой хештег
      }
    ],
    reels: [
      { 
        projectId: 1, 
        sourceType: 'competitor', 
        sourceId: 1, 
        instagramId: 'reel_with_long_id_' + 'A'.repeat(100), 
        caption: 'A'.repeat(1000), // Очень длинное описание
        url: 'https://www.instagram.com/reel/reel_with_long_id',
        viewCount: 9999999, // Очень большое количество просмотров
        likesCount: 9999999,
        commentsCount: 9999999,
        publishedAt: new Date().toISOString()
      },
      { 
        projectId: 1, 
        sourceType: 'competitor', 
        sourceId: 1, 
        instagramId: 'reel_with_special_chars', 
        caption: 'Caption with special chars: !@#$%^&*()_+{}[]|\\:;"\'<>,.?/',
        url: 'https://www.instagram.com/reel/reel_with_special_chars',
        viewCount: 0, // Нулевое количество просмотров
        likesCount: 0,
        commentsCount: 0,
        publishedAt: new Date().toISOString()
      },
      { 
        projectId: 1, 
        sourceType: 'competitor', 
        sourceId: 1, 
        instagramId: 'reel_with_emojis', 
        caption: 'Caption with emojis: 😀🎉🚀💯🔥',
        url: 'https://www.instagram.com/reel/reel_with_emojis',
        viewCount: 100000,
        likesCount: 5000,
        commentsCount: 200,
        publishedAt: new Date().toISOString()
      },
      { 
        projectId: 1, 
        sourceType: 'competitor', 
        sourceId: 1, 
        instagramId: 'reel_with_no_caption', 
        caption: '', // Пустое описание
        url: 'https://www.instagram.com/reel/reel_with_no_caption',
        viewCount: 100000,
        likesCount: 5000,
        commentsCount: 200,
        publishedAt: new Date().toISOString()
      },
      { 
        projectId: 1, 
        sourceType: 'competitor', 
        sourceId: 1, 
        instagramId: 'reel_with_old_date', 
        caption: 'Reel with very old date',
        url: 'https://www.instagram.com/reel/reel_with_old_date',
        viewCount: 100000,
        likesCount: 5000,
        commentsCount: 200,
        publishedAt: new Date(2000, 0, 1).toISOString() // Очень старая дата
      }
    ]
  },
  performanceData: {
    // Функция для генерации большого количества проектов
    generateProjects: (count: number, userId: number) => {
      const projects = [];
      for (let i = 0; i < count; i++) {
        projects.push({
          name: `Performance Test Project ${i + 1}`,
          userId
        });
      }
      return projects;
    },
    // Функция для генерации большого количества конкурентов
    generateCompetitors: (count: number, projectId: number) => {
      const competitors = [];
      for (let i = 0; i < count; i++) {
        competitors.push({
          projectId,
          username: `competitor_${i + 1}`,
          instagramUrl: `https://www.instagram.com/competitor_${i + 1}`
        });
      }
      return competitors;
    },
    // Функция для генерации большого количества хештегов
    generateHashtags: (count: number, projectId: number) => {
      const hashtags = [];
      for (let i = 0; i < count; i++) {
        hashtags.push({
          projectId,
          name: `hashtag_${i + 1}`
        });
      }
      return hashtags;
    },
    // Функция для генерации большого количества Reels
    generateReels: (count: number, projectId: number, sourceType: string, sourceId: number) => {
      const reels = [];
      for (let i = 0; i < count; i++) {
        reels.push({
          projectId,
          sourceType,
          sourceId,
          instagramId: `performance_reel_${i + 1}`,
          caption: `Performance test reel ${i + 1}`,
          url: `https://www.instagram.com/reel/performance_reel_${i + 1}`,
          viewCount: Math.floor(Math.random() * 1000000),
          likesCount: Math.floor(Math.random() * 50000),
          commentsCount: Math.floor(Math.random() * 5000),
          publishedAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString()
        });
      }
      return reels;
    }
  },
  errorData: {
    // Данные для тестирования обработки ошибок
    projects: [
      { 
        name: null, // NULL вместо строки
        userId: 1 
      },
      { 
        name: 'Project with invalid user',
        userId: 9999 // Несуществующий пользователь
      }
    ],
    competitors: [
      { 
        projectId: 9999, // Несуществующий проект
        username: 'competitor_for_nonexistent_project',
        instagramUrl: 'https://www.instagram.com/competitor_for_nonexistent_project'
      },
      { 
        projectId: 1,
        username: null, // NULL вместо строки
        instagramUrl: 'https://www.instagram.com/null_username'
      },
      { 
        projectId: 1,
        username: 'competitor_with_invalid_url',
        instagramUrl: 'not_a_valid_url' // Некорректный URL
      }
    ],
    hashtags: [
      { 
        projectId: 9999, // Несуществующий проект
        name: 'hashtag_for_nonexistent_project'
      },
      { 
        projectId: 1,
        name: null // NULL вместо строки
      }
    ],
    reels: [
      { 
        projectId: 9999, // Несуществующий проект
        sourceType: 'competitor',
        sourceId: 1,
        instagramId: 'reel_for_nonexistent_project',
        caption: 'Reel for nonexistent project',
        url: 'https://www.instagram.com/reel/reel_for_nonexistent_project',
        viewCount: 100000,
        likesCount: 5000,
        commentsCount: 200,
        publishedAt: new Date().toISOString()
      },
      { 
        projectId: 1,
        sourceType: 'competitor',
        sourceId: 9999, // Несуществующий источник
        instagramId: 'reel_for_nonexistent_source',
        caption: 'Reel for nonexistent source',
        url: 'https://www.instagram.com/reel/reel_for_nonexistent_source',
        viewCount: 100000,
        likesCount: 5000,
        commentsCount: 200,
        publishedAt: new Date().toISOString()
      },
      { 
        projectId: 1,
        sourceType: 'invalid_source_type', // Некорректный тип источника
        sourceId: 1,
        instagramId: 'reel_with_invalid_source_type',
        caption: 'Reel with invalid source type',
        url: 'https://www.instagram.com/reel/reel_with_invalid_source_type',
        viewCount: 100000,
        likesCount: 5000,
        commentsCount: 200,
        publishedAt: new Date().toISOString()
      },
      { 
        projectId: 1,
        sourceType: 'competitor',
        sourceId: 1,
        instagramId: null, // NULL вместо строки
        caption: 'Reel with null instagram_id',
        url: 'https://www.instagram.com/reel/null_instagram_id',
        viewCount: 100000,
        likesCount: 5000,
        commentsCount: 200,
        publishedAt: new Date().toISOString()
      },
      { 
        projectId: 1,
        sourceType: 'competitor',
        sourceId: 1,
        instagramId: 'reel_with_invalid_date',
        caption: 'Reel with invalid date',
        url: 'https://www.instagram.com/reel/reel_with_invalid_date',
        viewCount: 100000,
        likesCount: 5000,
        commentsCount: 200,
        publishedAt: 'not_a_valid_date' // Некорректная дата
      }
    ]
  }
};

// Функция для логирования
function log(message: string) {
  console.log(message);
}

// Функция для генерации данных с граничными случаями
function generateEdgeCaseData(db: Database) {
  log('\n🔍 Генерация данных с граничными случаями...');
  
  // Добавляем проекты с граничными случаями
  for (const project of config.edgeCases.projects) {
    try {
      db.prepare(
        'INSERT OR IGNORE INTO Projects (user_id, name) VALUES (?, ?)'
      ).run(project.userId, project.name);
      log(`✅ Добавлен проект с граничным случаем: "${project.name.substring(0, 30)}${project.name.length > 30 ? '...' : ''}"`);
    } catch (error) {
      log(`❌ Ошибка при добавлении проекта: ${error}`);
    }
  }
  
  // Добавляем конкурентов с граничными случаями
  for (const competitor of config.edgeCases.competitors) {
    try {
      db.prepare(
        'INSERT OR IGNORE INTO Competitors (project_id, username, instagram_url) VALUES (?, ?, ?)'
      ).run(competitor.projectId, competitor.username, competitor.instagramUrl);
      log(`✅ Добавлен конкурент с граничным случаем: "${competitor.username.substring(0, 30)}${competitor.username.length > 30 ? '...' : ''}"`);
    } catch (error) {
      log(`❌ Ошибка при добавлении конкурента: ${error}`);
    }
  }
  
  // Добавляем хештеги с граничными случаями
  for (const hashtag of config.edgeCases.hashtags) {
    try {
      db.prepare(
        'INSERT OR IGNORE INTO Hashtags (project_id, name) VALUES (?, ?)'
      ).run(hashtag.projectId, hashtag.name);
      log(`✅ Добавлен хештег с граничным случаем: "${hashtag.name.substring(0, 30)}${hashtag.name.length > 30 ? '...' : ''}"`);
    } catch (error) {
      log(`❌ Ошибка при добавлении хештега: ${error}`);
    }
  }
  
  // Добавляем Reels с граничными случаями
  for (const reel of config.edgeCases.reels) {
    try {
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
      log(`✅ Добавлен Reel с граничным случаем: "${reel.instagramId.substring(0, 30)}${reel.instagramId.length > 30 ? '...' : ''}"`);
    } catch (error) {
      log(`❌ Ошибка при добавлении Reel: ${error}`);
    }
  }
  
  log('✅ Генерация данных с граничными случаями завершена');
}

// Функция для генерации данных для тестирования производительности
function generatePerformanceData(db: Database) {
  log('\n🚀 Генерация данных для тестирования производительности...');
  
  // Создаем проект для тестирования производительности
  let performanceProjectId: number;
  try {
    const result = db.prepare(
      'INSERT INTO Projects (user_id, name) VALUES (?, ?) RETURNING id'
    ).get(1, 'Performance Test Project');
    performanceProjectId = result.id;
    log(`✅ Создан проект для тестирования производительности (ID: ${performanceProjectId})`);
  } catch (error) {
    log(`❌ Ошибка при создании проекта для тестирования производительности: ${error}`);
    return;
  }
  
  // Добавляем большое количество конкурентов
  const competitorsCount = 50;
  const competitors = config.performanceData.generateCompetitors(competitorsCount, performanceProjectId);
  for (const competitor of competitors) {
    try {
      db.prepare(
        'INSERT INTO Competitors (project_id, username, instagram_url) VALUES (?, ?, ?)'
      ).run(competitor.projectId, competitor.username, competitor.instagramUrl);
    } catch (error) {
      log(`❌ Ошибка при добавлении конкурента: ${error}`);
    }
  }
  log(`✅ Добавлено ${competitorsCount} конкурентов`);
  
  // Добавляем большое количество хештегов
  const hashtagsCount = 50;
  const hashtags = config.performanceData.generateHashtags(hashtagsCount, performanceProjectId);
  for (const hashtag of hashtags) {
    try {
      db.prepare(
        'INSERT INTO Hashtags (project_id, name) VALUES (?, ?)'
      ).run(hashtag.projectId, hashtag.name);
    } catch (error) {
      log(`❌ Ошибка при добавлении хештега: ${error}`);
    }
  }
  log(`✅ Добавлено ${hashtagsCount} хештегов`);
  
  // Добавляем большое количество Reels
  const reelsCount = 200;
  const reels = config.performanceData.generateReels(reelsCount, performanceProjectId, 'competitor', 1);
  for (const reel of reels) {
    try {
      db.prepare(
        'INSERT INTO ReelsContent (project_id, source_type, source_id, instagram_id, caption, url, view_count, likes_count, comments_count, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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
    } catch (error) {
      log(`❌ Ошибка при добавлении Reel: ${error}`);
    }
  }
  log(`✅ Добавлено ${reelsCount} Reels`);
  
  log('✅ Генерация данных для тестирования производительности завершена');
}

// Функция для генерации данных для тестирования обработки ошибок
function generateErrorData(db: Database) {
  log('\n⚠️ Генерация данных для тестирования обработки ошибок...');
  
  // Добавляем проекты с ошибками
  for (const project of config.errorData.projects) {
    try {
      db.prepare(
        'INSERT OR IGNORE INTO Projects (user_id, name) VALUES (?, ?)'
      ).run(project.userId, project.name);
      log(`✅ Добавлен проект с ошибкой: "${project.name}"`);
    } catch (error) {
      log(`✅ Ожидаемая ошибка при добавлении проекта: ${error}`);
    }
  }
  
  // Добавляем конкурентов с ошибками
  for (const competitor of config.errorData.competitors) {
    try {
      db.prepare(
        'INSERT OR IGNORE INTO Competitors (project_id, username, instagram_url) VALUES (?, ?, ?)'
      ).run(competitor.projectId, competitor.username, competitor.instagramUrl);
      log(`✅ Добавлен конкурент с ошибкой: "${competitor.username}"`);
    } catch (error) {
      log(`✅ Ожидаемая ошибка при добавлении конкурента: ${error}`);
    }
  }
  
  // Добавляем хештеги с ошибками
  for (const hashtag of config.errorData.hashtags) {
    try {
      db.prepare(
        'INSERT OR IGNORE INTO Hashtags (project_id, name) VALUES (?, ?)'
      ).run(hashtag.projectId, hashtag.name);
      log(`✅ Добавлен хештег с ошибкой: "${hashtag.name}"`);
    } catch (error) {
      log(`✅ Ожидаемая ошибка при добавлении хештега: ${error}`);
    }
  }
  
  // Добавляем Reels с ошибками
  for (const reel of config.errorData.reels) {
    try {
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
      log(`✅ Добавлен Reel с ошибкой: "${reel.instagramId}"`);
    } catch (error) {
      log(`✅ Ожидаемая ошибка при добавлении Reel: ${error}`);
    }
  }
  
  log('✅ Генерация данных для тестирования обработки ошибок завершена');
}

// Основная функция
function main() {
  console.log('🚀 Генерация тестовых данных с граничными случаями...');
  
  // Проверяем, существует ли база данных
  if (!fs.existsSync(config.dbPath)) {
    console.error(`❌ База данных не найдена по пути ${config.dbPath}`);
    console.log('Сначала запустите скрипт подготовки тестовой среды: bun run scripts/prepare-test-env.ts');
    process.exit(1);
  }
  
  // Открываем базу данных
  const db = new Database(config.dbPath);
  
  // Генерируем данные в зависимости от аргументов
  if (generateEdgeCases) {
    generateEdgeCaseData(db);
  }
  
  if (generatePerformance) {
    generatePerformanceData(db);
  }
  
  if (generateErrors) {
    generateErrorData(db);
  }
  
  // Закрываем базу данных
  db.close();
  
  console.log('\n✅ Генерация тестовых данных завершена!');
  console.log('\n📋 Для запуска тестирования:');
  console.log('1. Запустите бота: bun run dev');
  console.log('2. Откройте бота в Telegram и отправьте команду /start');
  console.log('3. Следуйте инструкциям в чек-листе: docs/MVP_TESTING_CHECKLIST.md');
}

// Запускаем основную функцию
main();
