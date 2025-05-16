import { StorageAdapter } from "../types";
import { logger } from "../logger";
import { OpenAI } from "openai";
import { EmbeddingsService } from "./embeddings-service";

/**
 * Интерфейс для сообщения чата
 */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Сервис для работы с чат-ботом
 */
export class ChatbotService {
  private storage: StorageAdapter;
  private openai: OpenAI | null = null;
  private apiKey: string | null = null;
  private embeddingsService: EmbeddingsService;

  /**
   * Конструктор сервиса
   * @param storage Адаптер хранилища
   * @param embeddingsService Сервис для работы с эмбеддингами
   * @param apiKey API ключ OpenAI (опционально)
   */
  constructor(storage: StorageAdapter, embeddingsService: EmbeddingsService, apiKey?: string) {
    this.storage = storage;
    this.embeddingsService = embeddingsService;
    
    // Инициализируем OpenAI API, если предоставлен ключ
    if (apiKey) {
      this.apiKey = apiKey;
      this.initOpenAI();
    } else {
      // Пытаемся получить ключ из переменных окружения
      const envApiKey = process.env.OPENAI_API_KEY;
      if (envApiKey) {
        this.apiKey = envApiKey;
        this.initOpenAI();
      } else {
        logger.warn("[ChatbotService] OpenAI API key not provided. Chat will not be available.");
      }
    }
  }

  /**
   * Инициализация клиента OpenAI
   */
  private initOpenAI() {
    if (this.apiKey) {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
      });
    }
  }

  /**
   * Проверка доступности API
   * @returns true, если API доступен
   */
  public isApiAvailable(): boolean {
    return this.openai !== null;
  }

  /**
   * Сохранение сообщения в истории чата
   * @param userId ID пользователя
   * @param reelId ID Reel
   * @param message Текст сообщения
   * @param role Роль сообщения (user или assistant)
   * @returns ID сообщения или null в случае ошибки
   */
  public async saveChatMessage(
    userId: string,
    reelId: string,
    message: string,
    role: "user" | "assistant"
  ): Promise<number | null> {
    try {
      if (this.storage.executeQuery) {
        const result = await this.storage.executeQuery(
          `INSERT INTO chat_history (user_id, reel_id, message, role)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [userId, reelId, message, role]
        );

        if (result && result.rows && result.rows.length > 0) {
          return result.rows[0].id;
        }
      }

      return null;
    } catch (error) {
      logger.error("[ChatbotService] Error saving chat message:", error);
      return null;
    }
  }

  /**
   * Получение истории чата
   * @param userId ID пользователя
   * @param reelId ID Reel
   * @param limit Максимальное количество сообщений
   * @returns Массив сообщений
   */
  public async getChatHistory(
    userId: string,
    reelId: string,
    limit: number = 10
  ): Promise<ChatMessage[] | null> {
    try {
      if (this.storage.executeQuery) {
        const result = await this.storage.executeQuery(
          `SELECT role, message
           FROM chat_history
           WHERE user_id = $1 AND reel_id = $2
           ORDER BY created_at ASC
           LIMIT $3`,
          [userId, reelId, limit]
        );

        if (result && result.rows) {
          return result.rows.map((row) => ({
            role: row.role,
            content: row.message,
          }));
        }
      }

      return null;
    } catch (error) {
      logger.error("[ChatbotService] Error getting chat history:", error);
      return null;
    }
  }

  /**
   * Генерация ответа на запрос пользователя
   * @param userId ID пользователя
   * @param reelId ID Reel
   * @param query Запрос пользователя
   * @returns Ответ чат-бота
   */
  public async generateResponse(
    userId: string,
    reelId: string,
    query: string
  ): Promise<string | null> {
    if (!this.isApiAvailable()) {
      logger.error("[ChatbotService] OpenAI API is not available");
      return null;
    }

    try {
      // Сохраняем запрос пользователя в истории чата
      await this.saveChatMessage(userId, reelId, query, "user");

      // Получаем расшифровку для Reel
      const embedding = await this.embeddingsService.getEmbeddingByReelId(reelId);
      if (!embedding) {
        logger.warn(`[ChatbotService] No embedding found for reel ${reelId}`);
        return "Извините, я не могу ответить на этот вопрос, так как у меня нет информации о данном видео.";
      }

      // Получаем историю чата
      const chatHistory = await this.getChatHistory(userId, reelId);
      const messages: ChatMessage[] = [];

      // Добавляем системное сообщение с контекстом
      messages.push({
        role: "system",
        content: `Ты - помощник, который отвечает на вопросы о видео на основе его расшифровки. 
        Вот расшифровка видео: ${embedding.transcript}
        
        Отвечай только на основе информации из расшифровки. Если в расшифровке нет информации для ответа на вопрос, 
        честно скажи, что не можешь ответить на этот вопрос на основе доступной информации.`,
      });

      // Добавляем историю чата
      if (chatHistory && chatHistory.length > 0) {
        messages.push(...chatHistory);
      }

      // Генерируем ответ
      const response = await this.openai!.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
      });

      const answer = response.choices[0].message.content;

      // Сохраняем ответ в истории чата
      if (answer) {
        await this.saveChatMessage(userId, reelId, answer, "assistant");
      }

      return answer;
    } catch (error) {
      logger.error("[ChatbotService] Error generating response:", error);
      return null;
    }
  }

  /**
   * Очистка истории чата
   * @param userId ID пользователя
   * @param reelId ID Reel
   * @returns true, если очистка успешна
   */
  public async clearChatHistory(userId: string, reelId: string): Promise<boolean> {
    try {
      if (this.storage.executeQuery) {
        const result = await this.storage.executeQuery(
          `DELETE FROM chat_history
           WHERE user_id = $1 AND reel_id = $2`,
          [userId, reelId]
        );

        return result !== null;
      }

      return false;
    } catch (error) {
      logger.error("[ChatbotService] Error clearing chat history:", error);
      return false;
    }
  }
}
