import {
  User,
  Project,
  Competitor,
  Hashtag,
  ReelContent,
  ParsingRunLog
} from "../../schemas";

/**
 * Создает мок пользователя с заполненными обязательными полями
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  const now = new Date().toISOString();
  
  return {
    id: 1,
    telegram_id: 123456789,
    username: "testuser",
    first_name: null,
    last_name: null,
    created_at: now,
    is_active: true,
    ...overrides
  };
}

/**
 * Создает мок проекта с заполненными обязательными полями
 */
export function createMockProject(overrides: Partial<Project> = {}): Project {
  const now = new Date().toISOString();
  
  return {
    id: 1,
    user_id: 1,
    name: "Test Project",
    description: null,
    created_at: now,
    is_active: true,
    ...overrides
  };
}

/**
 * Создает мок конкурента с заполненными обязательными полями
 */
export function createMockCompetitor(overrides: Partial<Competitor> = {}): Competitor {
  const now = new Date().toISOString();
  
  return {
    id: 1,
    project_id: 1,
    username: "competitor",
    instagram_url: "https://instagram.com/competitor",
    created_at: now,
    is_active: true,
    ...overrides
  };
}

/**
 * Создает мок хештега с заполненными обязательными полями
 */
export function createMockHashtag(overrides: Partial<Hashtag> = {}): Hashtag {
  const now = new Date().toISOString();
  
  return {
    id: 1,
    project_id: 1,
    hashtag: "test",
    created_at: now,
    is_active: true,
    ...overrides
  };
}

/**
 * Создает мок контента Reel с заполненными обязательными полями
 */
export function createMockReelContent(overrides: Partial<ReelContent> = {}): ReelContent {
  const now = new Date().toISOString();
  
  return {
    id: 1,
    project_id: 1,
    source_type: "competitor",
    source_id: "1",
    instagram_id: "reel123",
    url: "https://instagram.com/p/reel123",
    caption: null,
    author_username: null,
    author_id: null,
    views: 0,
    likes: 0,
    comments_count: 0,
    duration: null,
    thumbnail_url: null,
    music_title: null,
    published_at: now,
    fetched_at: now,
    is_processed: false,
    processing_status: null,
    processing_result: null,
    ...overrides
  };
}

/**
 * Создает мок лога запуска парсинга с заполненными обязательными полями
 */
export function createMockParsingRunLog(overrides: Partial<ParsingRunLog> = {}): ParsingRunLog {
  const now = new Date().toISOString();
  
  return {
    id: 1,
    run_id: "run_123",
    project_id: 1,
    source_type: "competitor",
    source_id: "1",
    status: "completed",
    error_message: null,
    started_at: now,
    ended_at: null,
    reels_found_count: 0,
    reels_added_count: 0,
    errors_count: 0,
    ...overrides
  };
}
