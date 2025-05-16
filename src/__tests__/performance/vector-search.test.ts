import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { NeonStorageAdapter } from "../../adapters/neon-adapter";
import { EmbeddingsService } from "../../services/embeddings-service";
import { config } from "dotenv";

// Загружаем переменные окружения из .env файла
config();

// Пропускаем тесты, если нет ключа API или URL базы данных
const skipTests = !process.env.OPENAI_API_KEY || !process.env.DATABASE_URL;

// Создаем описание тестов
(skipTests ? describe.skip : describe)("Vector Search Performance Tests", () => {
  let adapter: NeonStorageAdapter;
  let embeddingsService: EmbeddingsService;
  let testReelIds: string[] = [];
  let testEmbeddings: number[][] = [];
  const numTestEmbeddings = 100;

  // Перед всеми тестами
  beforeAll(async () => {
    // Создаем адаптер хранилища
    adapter = new NeonStorageAdapter({
      connectionString: process.env.DATABASE_URL as string,
    });

    // Создаем сервис эмбеддингов
    embeddingsService = new EmbeddingsService(adapter, process.env.OPENAI_API_KEY);

    // Создаем тестовые данные
    await adapter.initialize();

    // Создаем тестовые Reels и эмбеддинги
    for (let i = 0; i < numTestEmbeddings; i++) {
      const testReelId = `test_reel_perf_${Date.now()}_${i}`;
      testReelIds.push(testReelId);

      // Создаем случайный эмбеддинг
      const testEmbedding = Array(1536).fill(0).map(() => Math.random());
      testEmbeddings.push(testEmbedding);

      // Создаем тестовый Reel
      await adapter.executeQuery(
        `INSERT INTO reels (instagram_id, url, caption, project_id, source_type, source_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (instagram_id) DO NOTHING`,
        [testReelId, "https://example.com", `Test Reel ${i}`, 1, "test", "test"]
      );

      // Создаем тестовый эмбеддинг
      await adapter.executeQuery(
        `INSERT INTO transcript_embeddings (reel_id, transcript, embedding)
         VALUES ($1, $2, $3)`,
        [testReelId, `This is a test transcript for performance testing ${i}.`, testEmbedding]
      );
    }

    await adapter.close();
  });

  // После всех тестов
  afterAll(async () => {
    // Удаляем тестовые данные
    await adapter.initialize();

    // Удаляем тестовые эмбеддинги
    for (const testReelId of testReelIds) {
      await adapter.executeQuery(
        `DELETE FROM transcript_embeddings WHERE reel_id = $1`,
        [testReelId]
      );

      // Удаляем тестовые Reels
      await adapter.executeQuery(
        `DELETE FROM reels WHERE instagram_id = $1`,
        [testReelId]
      );
    }

    await adapter.close();
  });

  // Тест производительности поиска по векторам
  it("should measure vector search performance", async () => {
    await adapter.initialize();

    // Выполняем поиск по векторам
    const startTime = performance.now();

    // Выполняем поиск для каждого эмбеддинга
    for (let i = 0; i < 10; i++) {
      const queryEmbedding = testEmbeddings[i];

      // Выполняем поиск похожих расшифровок
      const result = await adapter.executeQuery(
        `SELECT id, reel_id, transcript, 1 - (embedding <=> $1) as similarity
         FROM transcript_embeddings
         ORDER BY embedding <=> $1
         LIMIT 5`,
        [queryEmbedding]
      );

      // Проверяем результат
      expect(result.rows.length).toBeGreaterThan(0);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`Vector search performance: ${duration.toFixed(2)} ms for 10 searches`);
    console.log(`Average search time: ${(duration / 10).toFixed(2)} ms per search`);

    await adapter.close();
  });

  // Тест производительности поиска по векторам с использованием функции
  it("should measure vector search performance using function", async () => {
    await adapter.initialize();

    // Выполняем поиск по векторам
    const startTime = performance.now();

    // Выполняем поиск для каждого эмбеддинга
    for (let i = 0; i < 10; i++) {
      const queryEmbedding = testEmbeddings[i];

      // Выполняем поиск похожих расшифровок
      const result = await adapter.executeQuery(
        `SELECT * FROM search_similar_transcripts($1, 0.5, 5)`,
        [queryEmbedding]
      );

      // Проверяем результат
      expect(result.rows.length).toBeGreaterThan(0);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`Vector search performance using function: ${duration.toFixed(2)} ms for 10 searches`);
    console.log(`Average search time using function: ${(duration / 10).toFixed(2)} ms per search`);

    await adapter.close();
  });

  // Тест производительности поиска по векторам с использованием сервиса
  it("should measure vector search performance using service", async () => {
    await adapter.initialize();

    // Выполняем поиск по векторам
    const startTime = performance.now();

    // Выполняем поиск для 10 запросов
    for (let i = 0; i < 10; i++) {
      const query = `Test query ${i}`;

      // Выполняем поиск похожих расшифровок
      const results = await embeddingsService.searchSimilarTranscripts(query, 5);

      // Проверяем результат
      expect(results).not.toBeNull();
      expect(Array.isArray(results)).toBe(true);
      expect(results?.length).toBeGreaterThan(0);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`Vector search performance using service: ${duration.toFixed(2)} ms for 10 searches`);
    console.log(`Average search time using service: ${(duration / 10).toFixed(2)} ms per search`);

    await adapter.close();
  });
});
