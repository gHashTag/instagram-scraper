import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { NeonAdapter } from "../../../adapters/neon-adapter";
import { config } from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Загружаем переменные окружения из .env файла
config();

// Пропускаем тесты, если нет URL базы данных
const skipTests = !process.env.DATABASE_URL;

// Создаем описание тестов
(skipTests ? describe.skip : describe)("PGVector SQL Setup Tests", () => {
  let adapter: NeonAdapter;
  let sqlScript: string;

  // Перед всеми тестами
  beforeAll(async () => {
    // Создаем адаптер хранилища
    adapter = new NeonAdapter();

    // Загружаем SQL-скрипт
    sqlScript = fs.readFileSync(
      path.join(process.cwd(), "sql", "setup_pgvector.sql"),
      "utf-8"
    );

    // Выполняем SQL-скрипт
    await adapter.initialize();
    await adapter.executeQuery(sqlScript);
  });

  // После всех тестов
  afterAll(async () => {
    await adapter.close();
  });

  // Тест проверки наличия расширения pgvector
  it("should have pgvector extension installed", async () => {
    const result = await adapter.executeQuery(
      `SELECT * FROM pg_extension WHERE extname = 'vector'`
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].extname).toBe("vector");
  });

  // Тест проверки наличия таблицы transcript_embeddings
  it("should have transcript_embeddings table", async () => {
    const result = await adapter.executeQuery(
      `SELECT * FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'transcript_embeddings'`
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].table_name).toBe("transcript_embeddings");
  });

  // Тест проверки наличия таблицы chat_history
  it("should have chat_history table", async () => {
    const result = await adapter.executeQuery(
      `SELECT * FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'chat_history'`
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].table_name).toBe("chat_history");
  });

  // Тест проверки наличия индексов
  it("should have required indexes", async () => {
    const result = await adapter.executeQuery(
      `SELECT indexname FROM pg_indexes
       WHERE tablename IN ('transcript_embeddings', 'chat_history')`
    );

    const indexNames = result.rows.map(row => row.indexname);

    expect(indexNames).toContain("transcript_embeddings_reel_id_idx");
    expect(indexNames).toContain("transcript_embeddings_embedding_idx");
    expect(indexNames).toContain("chat_history_user_id_idx");
    expect(indexNames).toContain("chat_history_reel_id_idx");
    expect(indexNames).toContain("chat_history_user_reel_idx");
  });

  // Тест проверки наличия триггера
  it("should have update_updated_at_column trigger", async () => {
    const result = await adapter.executeQuery(
      `SELECT * FROM information_schema.triggers
       WHERE trigger_name = 'update_transcript_embeddings_updated_at'`
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].trigger_name).toBe("update_transcript_embeddings_updated_at");
  });

  // Тест проверки наличия функции search_similar_transcripts
  it("should have search_similar_transcripts function", async () => {
    const result = await adapter.executeQuery(
      `SELECT * FROM information_schema.routines
       WHERE routine_name = 'search_similar_transcripts'`
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].routine_name).toBe("search_similar_transcripts");
  });

  // Тест работы функции search_similar_transcripts
  it("should be able to search similar transcripts", async () => {
    // Создаем тестовый эмбеддинг
    const testReelId = `test_reel_${Date.now()}`;
    const testEmbedding = Array(1536).fill(0).map(() => Math.random());

    // Создаем тестовый Reel
    await adapter.executeQuery(
      `INSERT INTO reels (instagram_id, url, caption, project_id, source_type, source_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (instagram_id) DO NOTHING`,
      [testReelId, "https://example.com", "Test Reel", 1, "test", "test"]
    );

    // Создаем тестовый эмбеддинг
    await adapter.executeQuery(
      `INSERT INTO transcript_embeddings (reel_id, transcript, embedding)
       VALUES ($1, $2, $3)`,
      [testReelId, "This is a test transcript for SQL testing.", testEmbedding]
    );

    // Выполняем поиск похожих расшифровок
    const result = await adapter.executeQuery(
      `SELECT * FROM search_similar_transcripts($1, 0.5, 5)`,
      [testEmbedding]
    );

    // Проверяем результат
    expect(result.rows.length).toBeGreaterThan(0);

    // Находим наш тестовый эмбеддинг в результатах
    const foundTestEmbedding = result.rows.find(row => row.reel_id === testReelId);
    expect(foundTestEmbedding).toBeDefined();
    expect(foundTestEmbedding?.similarity).toBeGreaterThan(0.5);

    // Удаляем тестовые данные
    await adapter.executeQuery(
      `DELETE FROM transcript_embeddings WHERE reel_id = $1`,
      [testReelId]
    );

    await adapter.executeQuery(
      `DELETE FROM reels WHERE instagram_id = $1`,
      [testReelId]
    );
  });
});
