import { describe, it, expect, beforeAll, afterAll, beforeEach, mock, jest } from "bun:test";
import { Scenes, Context, Markup } from "telegraf";
import { ChatbotScene } from "../../../scenes/chatbot-scene";
import { NeonAdapter } from "../../../adapters/neon-adapter";
import { ScraperSceneSessionData } from "../../../types";
import { config } from "dotenv";

// Загружаем переменные окружения из .env файла
config();

// Пропускаем тесты, если нет ключа API или URL базы данных
const skipTests = !process.env.OPENAI_API_KEY || !process.env.DATABASE_URL;

// Создаем описание тестов
(skipTests ? describe.skip : describe)("ChatbotScene Integration Tests", () => {
  let adapter: NeonAdapter;
  let chatbotScene: ChatbotScene;
  let mockContext: any;
  let testReelId: string;
  let testUserId: number;
  let testProjectId: number;

  // Перед всеми тестами
  beforeAll(async () => {
    // Создаем адаптер хранилища
    adapter = new NeonAdapter();

    // Создаем сцену чат-бота
    chatbotScene = new ChatbotScene(adapter, process.env.OPENAI_API_KEY);

    // Создаем тестовые данные
    testReelId = `test_reel_${Date.now()}`;
    testUserId = 123456789;
    testProjectId = 1;

    // Создаем тестовый Reel и эмбеддинг
    await adapter.initialize();
    await adapter.executeQuery(
      `INSERT INTO reels (instagram_id, url, caption, project_id, source_type, source_id, transcript, transcript_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (instagram_id) DO NOTHING`,
      [testReelId, "https://example.com", "Test Reel", testProjectId, "test", "test", "This is a test transcript for scene testing.", "completed"]
    );

    // Создаем эмбеддинг для тестового Reel
    await adapter.executeQuery(
      `INSERT INTO transcript_embeddings (reel_id, transcript, embedding)
       VALUES ($1, $2, $3)
       ON CONFLICT (reel_id) DO NOTHING`,
      [testReelId, "This is a test transcript for scene testing.", [0.1, 0.2, 0.3]]
    );

    await adapter.close();
  });

  // После всех тестов
  afterAll(async () => {
    // Удаляем тестовые данные
    await adapter.initialize();

    // Удаляем историю чата
    await adapter.executeQuery(
      `DELETE FROM chat_history WHERE user_id = $1 AND reel_id = $2`,
      [testUserId.toString(), testReelId]
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
  beforeEach(() => {
    // Создаем мок контекста
    mockContext = {
      scene: {
        enter: jest.fn(),
        leave: jest.fn(),
        reenter: jest.fn(),
        session: {
          currentProjectId: testProjectId,
          currentReelId: undefined,
        } as ScraperSceneSessionData,
      },
      from: {
        id: testUserId,
      },
      callbackQuery: {
        data: "",
      },
      match: null,
      reply: jest.fn().mockResolvedValue({ message_id: 1 }),
      answerCbQuery: jest.fn(),
      editMessageText: jest.fn(),
      editMessageReplyMarkup: jest.fn(),
      deleteMessage: jest.fn(),
      sendChatAction: jest.fn(),
      storage: adapter,
    };
  });

  // Тест входа в сцену без ID Reel
  it("should show reels with transcripts when entering scene without reel ID", async () => {
    // Вызываем обработчик входа в сцену
    await (chatbotScene as any).onSceneEnter(mockContext);

    // Проверяем, что был вызван метод reply
    expect(mockContext.reply).toHaveBeenCalled();

    // Проверяем, что в сообщении есть упоминание о Reels с расшифровками
    const replyArgs = mockContext.reply.mock.calls[0];
    expect(replyArgs[0]).toContain("Reels с расшифровками");
  });

  // Тест входа в сцену с ID Reel
  it("should start chat with reel when entering scene with reel ID", async () => {
    // Устанавливаем ID Reel в сессии
    mockContext.scene.session.currentReelId = testReelId;

    // Вызываем обработчик входа в сцену
    await (chatbotScene as any).onSceneEnter(mockContext);

    // Проверяем, что был вызван метод reply
    expect(mockContext.reply).toHaveBeenCalled();

    // Проверяем, что в сообщении есть упоминание о чате с видео
    const replyArgs = mockContext.reply.mock.calls[0];
    expect(replyArgs[0]).toContain("Чат с видео");
  });

  // Тест обработки выбора Reel для чата
  it("should handle chat with reel action", async () => {
    // Устанавливаем match для обработчика
    mockContext.match = [`chat_with_reel_${testReelId}`, testReelId];

    // Вызываем обработчик действия
    await (chatbotScene as any).onChatWithReel(mockContext);

    // Проверяем, что был вызван метод reply
    expect(mockContext.reply).toHaveBeenCalled();

    // Проверяем, что в сообщении есть упоминание о чате с видео
    const replyArgs = mockContext.reply.mock.calls[0];
    expect(replyArgs[0]).toContain("Чат с видео");

    // Проверяем, что ID Reel был сохранен в сессии
    expect(mockContext.scene.session.currentReelId).toBe(testReelId);
  });

  // Тест обработки очистки истории чата
  it("should handle clear chat history action", async () => {
    // Устанавливаем ID Reel в сессии
    mockContext.scene.session.currentReelId = testReelId;

    // Вызываем обработчик действия
    await (chatbotScene as any).onClearChatHistory(mockContext);

    // Проверяем, что был вызван метод answerCbQuery
    expect(mockContext.answerCbQuery).toHaveBeenCalled();

    // Проверяем, что был вызван метод reply
    expect(mockContext.reply).toHaveBeenCalled();

    // Проверяем, что в сообщении есть упоминание об очистке истории чата
    const replyArgs = mockContext.reply.mock.calls[0];
    expect(replyArgs[0]).toContain("История чата очищена");
  });

  // Тест обработки возврата к списку Reels
  it("should handle back to reels action", async () => {
    // Вызываем обработчик действия
    await (chatbotScene as any).onBackToReels(mockContext);

    // Проверяем, что был вызван метод leave
    expect(mockContext.scene.leave).toHaveBeenCalled();

    // Проверяем, что был вызван метод enter
    expect(mockContext.scene.enter).toHaveBeenCalledWith("reels_scene");
  });

  // Тест обработки текстового сообщения
  it("should handle text message", async () => {
    // Устанавливаем ID Reel в сессии
    mockContext.scene.session.currentReelId = testReelId;

    // Устанавливаем текстовое сообщение
    mockContext.message = {
      text: "What is this video about?",
    };

    // Вызываем обработчик текстового сообщения
    await (chatbotScene as any).onText(mockContext);

    // Проверяем, что был вызван метод sendChatAction
    expect(mockContext.sendChatAction).toHaveBeenCalledWith("typing");

    // Проверяем, что был вызван метод reply
    expect(mockContext.reply).toHaveBeenCalled();
  });
});
