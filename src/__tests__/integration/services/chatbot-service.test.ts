import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { ChatbotService } from "../../../services/chatbot-service";
import { EmbeddingsService } from "../../../services/embeddings-service";
import { NeonAdapter } from "../../../adapters/neon-adapter";
import { config } from "dotenv";

// Загружаем переменные окружения из .env файла
config();

// Пропускаем тесты, если нет ключа API или URL базы данных
const skipTests = !process.env.OPENAI_API_KEY || !process.env.DATABASE_URL;

// Создаем описание тестов
(skipTests ? describe.skip : describe)("ChatbotService Integration Tests", () => {
  let adapter: NeonAdapter;
  let embeddingsService: EmbeddingsService;
  let chatbotService: ChatbotService;
  let testReelId: string;
  let testUserId: string;

  // Перед всеми тестами
  beforeAll(async () => {
    // Создаем адаптер хранилища
    adapter = new NeonAdapter();

    // Создаем сервисы
    embeddingsService = new EmbeddingsService(adapter, process.env.OPENAI_API_KEY);
    chatbotService = new ChatbotService(adapter, embeddingsService, process.env.OPENAI_API_KEY);

    // Создаем тестовые данные
    testReelId = `test_reel_${Date.now()}`;
    testUserId = `test_user_${Date.now()}`;

    // Создаем тестовый Reel и эмбеддинг
    await adapter.initialize();
    await adapter.executeQuery(
      `INSERT INTO reels (instagram_id, url, caption, project_id, source_type, source_id, transcript, transcript_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (instagram_id) DO NOTHING`,
      [testReelId, "https://example.com", "Test Reel", 1, "test", "test", "This is a test transcript for chatbot testing.", "completed"]
    );

    // Создаем эмбеддинг для тестового Reel
    await embeddingsService.createAndSaveEmbedding(
      testReelId,
      "This is a test transcript for chatbot testing."
    );
  });

  // После всех тестов
  afterAll(async () => {
    // Удаляем тестовые данные
    await adapter.initialize();

    // Удаляем историю чата
    await adapter.executeQuery(
      `DELETE FROM chat_history WHERE user_id = $1 AND reel_id = $2`,
      [testUserId, testReelId]
    );

    // Удаляем эмбеддинг
    await adapter.executeQuery(
      `DELETE FROM transcript_embeddings WHERE reel_id = $1`,
      [testReelId]
    );

    // Удаляем Reel
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

  // Тест сохранения сообщения в истории чата
  it("should save chat message", async () => {
    const messageId = await chatbotService.saveChatMessage(
      testUserId,
      testReelId,
      "Hello, chatbot!",
      "user"
    );

    expect(messageId).not.toBeNull();
    expect(typeof messageId).toBe("number");
  });

  // Тест получения истории чата
  it("should get chat history", async () => {
    // Сначала сохраняем несколько сообщений
    await chatbotService.saveChatMessage(testUserId, testReelId, "How are you?", "user");
    await chatbotService.saveChatMessage(testUserId, testReelId, "I'm fine, thank you!", "assistant");

    // Получаем историю чата
    const history = await chatbotService.getChatHistory(testUserId, testReelId);

    expect(history).not.toBeNull();
    expect(Array.isArray(history)).toBe(true);
    expect(history?.length).toBeGreaterThanOrEqual(3); // Включая предыдущее сообщение из первого теста

    // Проверяем последние два сообщения
    const lastMessages = history?.slice(-2);
    expect(lastMessages?.[0].role).toBe("user");
    expect(lastMessages?.[0].content).toBe("How are you?");
    expect(lastMessages?.[1].role).toBe("assistant");
    expect(lastMessages?.[1].content).toBe("I'm fine, thank you!");
  });

  // Тест генерации ответа
  it("should generate response", async () => {
    const response = await chatbotService.generateResponse(
      testUserId,
      testReelId,
      "What is this transcript about?"
    );

    expect(response).not.toBeNull();
    expect(typeof response).toBe("string");
    expect(response?.length).toBeGreaterThan(0);
  });

  // Тест очистки истории чата
  it("should clear chat history", async () => {
    // Очищаем историю чата
    const result = await chatbotService.clearChatHistory(testUserId, testReelId);

    expect(result).toBe(true);

    // Проверяем, что история чата пуста
    const history = await chatbotService.getChatHistory(testUserId, testReelId);
    expect(history?.length).toBe(0);
  });
});
