#!/bin/bash

# Instagram Scraper Bot - Скрипт запуска интеграционных тестов
# 
# Этот скрипт запускает интеграционные тесты для модуля Instagram Scraper Bot
# с использованием локальной SQLite базы данных.

# Цвета для вывода
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

# Директория модуля
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(cd "$MODULE_DIR/../../../../" && pwd)"
DEV_DIR="$MODULE_DIR/.dev"
INTEGRATION_TESTS_DIR="$MODULE_DIR/__tests__/integration"

# Лог-файл
LOG_FILE="$DEV_DIR/dev.log"

# Создаем .dev директорию, если не существует
if [ ! -d "$DEV_DIR" ]; then
  mkdir -p "$DEV_DIR"
fi

# Создаем лог-файл, если не существует
if [ ! -f "$LOG_FILE" ]; then
  echo "🚀 Лог разработки Instagram Scraper Bot" > "$LOG_FILE"
  echo "" >> "$LOG_FILE"
fi

# Функция логирования
log() {
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  echo -e "$timestamp $1" | tee -a "$LOG_FILE"
}

# Функция для создания временной тестовой базы данных
create_test_db() {
  log "${YELLOW}🔄 Создание временной тестовой базы данных...${NC}"
  
  # Создаем временную копию базы данных для тестов
  TEST_DB="$DEV_DIR/test-sqlite.db"
  
  # Удаляем старую тестовую БД, если она существует
  if [ -f "$TEST_DB" ]; then
    rm "$TEST_DB"
  fi
  
  # Создаем новую тестовую БД
  # Используем NODE_ENV=test для переопределения настроек
  cd "$MODULE_DIR"
  NODE_ENV=test SQLITE_DB_PATH="$TEST_DB" bun run scripts/init-dev-db.ts
  
  if [ $? -eq 0 ]; then
    log "${GREEN}✅ Тестовая база данных успешно создана.${NC}"
    return 0
  else
    log "${RED}❌ Ошибка при создании тестовой базы данных.${NC}"
    return 1
  fi
}

# Функция для запуска интеграционных тестов
run_tests() {
  log "${YELLOW}🧪 Запуск интеграционных тестов...${NC}"
  
  # Запускаем тесты с использованием тестовой базы данных
  cd "$ROOT_DIR"
  NODE_ENV=test SQLITE_DB_PATH="$DEV_DIR/test-sqlite.db" \
    bun vitest run "$INTEGRATION_TESTS_DIR" --reporter verbose
  
  TEST_RESULT=$?
  
  if [ $TEST_RESULT -eq 0 ]; then
    log "${GREEN}✅ Интеграционные тесты успешно пройдены.${NC}"
  else
    log "${RED}❌ Интеграционные тесты завершились с ошибками.${NC}"
  fi
  
  return $TEST_RESULT
}

# Функция для очистки после тестов
cleanup() {
  log "${YELLOW}🧹 Очистка после тестов...${NC}"
  
  # Удаляем временную тестовую БД
  if [ -f "$DEV_DIR/test-sqlite.db" ]; then
    rm "$DEV_DIR/test-sqlite.db"
    log "${GREEN}✅ Временная тестовая база данных удалена.${NC}"
  fi
  
  return 0
}

# Главная функция
main() {
  log "${BLUE}🚀 Начало интеграционного тестирования Instagram Scraper Bot${NC}"
  
  # 1. Создание тестовой базы данных
  create_test_db
  if [ $? -ne 0 ]; then
    log "${RED}❌ Не удалось создать тестовую базу данных. Прерывание тестирования.${NC}"
    return 1
  fi
  
  # 2. Запуск тестов
  run_tests
  TEST_RESULT=$?
  
  # 3. Очистка
  cleanup
  
  # 4. Результат
  if [ $TEST_RESULT -eq 0 ]; then
    log "${GREEN}🎉 Интеграционное тестирование успешно завершено!${NC}"
  else
    log "${RED}⚠️ Интеграционное тестирование завершено с ошибками!${NC}"
  fi
  
  return $TEST_RESULT
}

# Проверяем, существует ли директория интеграционных тестов
if [ ! -d "$INTEGRATION_TESTS_DIR" ]; then
  log "${YELLOW}⚠️ Директория интеграционных тестов не найдена: $INTEGRATION_TESTS_DIR${NC}"
  log "${YELLOW}ℹ️ Создание директории для интеграционных тестов...${NC}"
  
  mkdir -p "$INTEGRATION_TESTS_DIR"
  
  # Создаем пример интеграционного теста
  cat > "$INTEGRATION_TESTS_DIR/sqlite-adapter.test.ts" << EOL
/**
 * Интеграционный тест для SQLite адаптера Instagram Scraper Bot
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { SqliteAdapter } from '../../adapters/sqlite-adapter'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dbPath = process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../../.dev/test-sqlite.db')

describe('SQLite Adapter - Интеграционный тест', () => {
  let adapter: SqliteAdapter

  beforeAll(async () => {
    // Проверяем, что тестовая база данных существует
    expect(fs.existsSync(dbPath)).toBe(true)
    
    // Инициализируем адаптер
    adapter = new SqliteAdapter({ dbPath })
    await adapter.connect()
  })

  afterAll(async () => {
    // Закрываем соединение с базой данных
    await adapter.disconnect()
  })

  it('должен получать список проектов', async () => {
    const projects = await adapter.getProjects(1) // ID пользователя
    expect(Array.isArray(projects)).toBe(true)
    expect(projects.length).toBeGreaterThan(0)
  })

  it('должен получать список конкурентов для проекта', async () => {
    const competitors = await adapter.getCompetitors(1) // ID проекта
    expect(Array.isArray(competitors)).toBe(true)
    expect(competitors.length).toBeGreaterThan(0)
  })

  it('должен получать список хэштегов для проекта', async () => {
    const hashtags = await adapter.getHashtags(1) // ID проекта
    expect(Array.isArray(hashtags)).toBe(true)
    expect(hashtags.length).toBeGreaterThan(0)
  })

  it('должен сохранять новый Reel в базу данных', async () => {
    const newReel = {
      project_id: 1,
      source_type: 'competitor',
      source_id: 1,
      instagram_id: 'test_' + Date.now(),
      url: 'https://instagram.com/reel/test' + Date.now(),
      caption: 'Тестовый Reel из интеграционного теста',
      owner_username: 'test_user',
      owner_id: 'test_owner_id',
      view_count: 50000,
      like_count: 1000,
      comment_count: 50,
      duration: 30,
      thumbnail_url: 'https://example.com/thumb_test.jpg',
      audio_title: 'Тестовый аудио трек',
      published_at: new Date().toISOString()
    }
    
    const result = await adapter.saveReel(newReel)
    expect(result).toBeTruthy()
    expect(result.id).toBeDefined()
  })

  it('должен возвращать сохраненные Reels', async () => {
    const reels = await adapter.getReels(1, { limit: 10 }) // ID проекта
    expect(Array.isArray(reels)).toBe(true)
    expect(reels.length).toBeGreaterThan(0)
    
    // Проверяем структуру первого Reel
    const firstReel = reels[0]
    expect(firstReel).toHaveProperty('id')
    expect(firstReel).toHaveProperty('url')
    expect(firstReel).toHaveProperty('caption')
    expect(firstReel).toHaveProperty('view_count')
  })
})
EOL

  log "${GREEN}✅ Пример интеграционного теста создан в: $INTEGRATION_TESTS_DIR/sqlite-adapter.test.ts${NC}"
fi

# Запуск главной функции
main
exit $? 