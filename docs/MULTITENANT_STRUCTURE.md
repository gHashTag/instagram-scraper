# Мультитенантная Структура Скрапера Instagram Reels

## 📋 Обзор

Мультитенантная архитектура позволяет использовать единую базу данных и систему скрапинга для обслуживания множества пользователей (клиентов), каждый из которых может иметь свои собственные проекты, списки конкурентов и хэштегов для отслеживания.

### 🔑 Основные Особенности:

1. **Разделение по Пользователям и Проектам**

   - Каждый Telegram-пользователь может иметь несколько проектов (ниш)
   - Каждый проект имеет свой набор конкурентов и хэштегов для отслеживания

2. **Многоуровневое Хранение Данных**

   - Единая таблица Instagram Reels с уникальным контентом
   - Связующие таблицы, связывающие контент с проектами через источники

3. **Управление Взаимодействиями**
   - Пользователи могут добавлять контент в избранное
   - Пользователи могут скрывать нерелевантный контент
   - Возможность добавления заметок к контенту

## 🏗️ Схема Базы Данных

### Основные Таблицы:

#### `Users` - Пользователи Telegram

```sql
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
```

#### `Projects` - Проекты пользователей

```sql
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
```

#### `CompetitorAccounts` - Аккаунты конкурентов

```sql
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
```

#### `TrackingHashtags` - Отслеживаемые хэштеги

```sql
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
```

#### `InstagramReels` - Данные о спарсенных Reels

```sql
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
```

#### `ContentSources` - Связь контента с источниками

```sql
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
```

#### `UserContentInteractions` - Взаимодействие пользователей с контентом

```sql
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
```

#### `ParsingLogs` - Логи парсинга

```sql
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
```

## 📊 Схема Отношений

```
Users (1) --< Projects (1) --< CompetitorAccounts (M) >-- ContentSources (M) --< InstagramReels (1)
             Projects (1) --< TrackingHashtags (M) >---- ContentSources (M)
Users (1) --< UserContentInteractions (M) >------------- InstagramReels (1)
Projects (1) --< ParsingLogs (M)
```

## 🔄 Процесс Работы со Структурой

### 1. Создание и Управление Пользователями

- Когда пользователь начинает взаимодействие с Telegram ботом, он автоматически регистрируется в системе
- Пользователям можно присваивать разные уровни подписки с разными ограничениями

### 2. Создание Проектов (Ниш)

- Пользователь может создать несколько проектов для разных ниш бизнеса
- Каждый проект имеет свои настройки и параметры фильтрации

### 3. Добавление Источников Данных

- Для каждого проекта пользователь может добавить список аккаунтов конкурентов
- Для каждого проекта пользователь может добавить хэштеги для отслеживания

### 4. Процесс Скрапинга

- Система последовательно обрабатывает источники всех активных проектов
- Данные из каждого источника фильтруются и сохраняются в базе
- Создаются связи между контентом, источниками и проектами
- Логируются все операции и ошибки

### 5. Предоставление Результатов

- Пользователь может просматривать Reels по своим проектам
- Пользователь может фильтровать Reels по источникам, просмотрам, дате
- Пользователь может добавлять Reels в избранное или скрывать их

## 📱 API для Работы с Мультитенантной Структурой

API реализовано в модуле `storage/neonStorage-multitenant.ts` и включает функции для работы со всеми аспектами мультитенантной структуры:

### Пользователи и Проекты

- `createUser` - создание/обновление пользователя
- `getUserByTelegramId` - получение пользователя по Telegram ID
- `createProject` - создание нового проекта
- `getProjectsByUserId` - получение проектов пользователя

### Источники Данных

- `addCompetitorAccount` - добавление аккаунта конкурента
- `getCompetitorAccounts` - получение аккаунтов конкурентов проекта
- `addTrackingHashtag` - добавление хэштега для отслеживания
- `getTrackingHashtags` - получение хэштегов проекта

### Обработка Контента

- `saveReels` - сохранение Reels и связывание с источником
- `getReels` - получение Reels с фильтрацией
- `getProjectStats` - получение статистики по проекту

### Взаимодействия Пользователей

- `addToFavorites` - добавление Reel в избранное
- `removeFromFavorites` - удаление из избранного
- `hideReel` - скрытие Reel для пользователя
- `getReelInteraction` - проверка статуса взаимодействия
- `getFavoriteReels` - получение избранных Reels

### Логирование

- `getParsingLogs` - получение логов парсинга для проекта

## 🚀 Запуск и Настройка

### Создание Структуры БД

Для создания полной структуры мультитенантной базы данных используйте:

```bash
CONFIRM=YES bun run storage/rebuild-multi-tenant-tables.ts
```

### Пример Использования API

```typescript
// Инициализация хранилища
await initializeNeonStorage()

// Получение или создание пользователя
const user = await createUser(123456789, "username", "John", "Doe")

// Создание проекта
const project = await createProject(
  user.id,
  "Beauty Clinic",
  "Aesthetic Medicine Project"
)

// Добавление конкурентов и хэштегов
const competitor = await addCompetitorAccount(
  project.id,
  "https://www.instagram.com/competitor"
)
const hashtag = await addTrackingHashtag(project.id, "aestheticmedicine")

// Сохранение Reels
const reels = [
  /* ... массив с данными Reels ... */
]
const savedCount = await saveReels(
  reels,
  project.id,
  "competitor",
  competitor.id
)

// Получение Reels с фильтрацией
const { reels: filteredReels, total } = await getReels(project.id, {
  minViews: 50000,
  maxDaysOld: 14,
  limit: 20,
  offset: 0,
})

// Закрытие соединения
await closeNeonStorage()
```

## 📈 Масштабирование и Перспективы

Мультитенантная структура легко масштабируется для обслуживания большого количества пользователей. Дальнейшие улучшения могут включать:

1. **Шардирование Данных**

   - Разделение базы данных по группам пользователей при росте нагрузки

2. **Расширение Интеграций**

   - Добавление других социальных сетей (TikTok, YouTube Shorts)
   - Интеграция с инструментами аналитики

3. **Автоматизация Процессов**

   - Регулярное обновление данных по расписанию
   - Оповещения о новом релевантном контенте

4. **Улучшение Фильтрации**

   - Использование ML для определения релевантности контента
   - Классификация контента по тематикам

5. **Улучшение Взаимодействия**
   - Интеграция с инструментами для создания похожего контента
   - Система рекомендаций на основе поведения пользователей
