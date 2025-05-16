import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { EmbeddingsService } from "../../../services/embeddings-service";
import { NeonAdapter } from "../../../adapters/neon-adapter";
import { config } from "dotenv";

// Загружаем переменные окружения из .env файла
config();

// Пропускаем тесты, если нет ключа API или URL базы данных
const skipTests = !process.env.OPENAI_API_KEY || !process.env.DATABASE_URL;

// Создаем описание тестов
(skipTests ? describe.skip : describe)("EmbeddingsService Integration Tests", () => {
  let adapter: NeonAdapter;
  let embeddingsService: EmbeddingsService;
  let testReelId: string;
  let testEmbeddingId: number | null;

  // Перед всеми тестами
  beforeAll(async () => {
    // Создаем адаптер хранилища
    adapter = new NeonAdapter();

    // Создаем сервис эмбеддингов
    embeddingsService = new EmbeddingsService(adapter, process.env.OPENAI_API_KEY);

    // Создаем тестовый Reel
    testReelId = `test_reel_${Date.now()}`;
    await adapter.initialize();
    await adapter.executeQuery(
      `INSERT INTO reels (instagram_id, url, caption, project_id, source_type, source_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (instagram_id) DO NOTHING`,
      [testReelId, "https://example.com", "Test Reel", 1, "test", "test"]
    );
  });

  // После всех тестов
  afterAll(async () => {
    // Удаляем тестовый Reel
    await adapter.executeQuery(
      `DELETE FROM reels WHERE instagram_id = $1`,
      [testReelId]
    );
    await adapter.close();
  });

  // Перед каждым тестом
  beforeEach(async () => {
    await adapter.initialize();
  });

  // После каждого теста
  afterEach(async () => {
    await adapter.close();
  });

  // Тест создания и сохранения эмбеддинга
  it("should create and save embedding", async () => {
    const transcript = "This is a test transcript for integration testing.";
    testEmbeddingId = await embeddingsService.createAndSaveEmbedding(testReelId, transcript);

    expect(testEmbeddingId).not.toBeNull();
    expect(typeof testEmbeddingId).toBe("number");
  });

  // Тест получения эмбеддинга по ID Reel
  it("should get embedding by reel ID", async () => {
    const embedding = await embeddingsService.getEmbeddingByReelId(testReelId);

    expect(embedding).not.toBeNull();
    expect(embedding?.reel_id).toBe(testReelId);
    expect(embedding?.transcript).toBe("This is a test transcript for integration testing.");
    expect(Array.isArray(embedding?.embedding)).toBe(true);
    expect(embedding?.embedding.length).toBe(1536);
  });

  // Тест поиска похожих расшифровок
  it("should search similar transcripts", async () => {
    const query = "test transcript";
    const results = await embeddingsService.searchSimilarTranscripts(query, 5);

    expect(results).not.toBeNull();
    expect(Array.isArray(results)).toBe(true);
    expect(results?.length).toBeGreaterThan(0);

    // Проверяем, что наш тестовый эмбеддинг находится в результатах
    const foundTestEmbedding = results?.find(result => result.reel_id === testReelId);
    expect(foundTestEmbedding).toBeDefined();
    expect(foundTestEmbedding?.similarity).toBeGreaterThan(0.5);
  });

  // Тест обновления эмбеддинга
  it("should update embedding", async () => {
    const newTranscript = "This is an updated test transcript for integration testing.";
    const result = await embeddingsService.updateEmbedding(testReelId, newTranscript);

    expect(result).toBe(true);

    // Проверяем, что эмбеддинг обновился
    const embedding = await embeddingsService.getEmbeddingByReelId(testReelId);
    expect(embedding?.transcript).toBe(newTranscript);
  });

  // Тест удаления эмбеддинга
  it("should delete embedding", async () => {
    const result = await embeddingsService.deleteEmbedding(testReelId);

    expect(result).toBe(true);

    // Проверяем, что эмбеддинг удалился
    const embedding = await embeddingsService.getEmbeddingByReelId(testReelId);
    expect(embedding).toBeNull();
  });
});
