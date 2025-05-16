import { StorageAdapter } from "../types";
import { logger } from "../logger";
import { OpenAI } from "openai";

/**
 * Сервис для работы с эмбеддингами расшифровок видео
 */
export class EmbeddingsService {
  private storage: StorageAdapter;
  private openai: OpenAI | null = null;
  private apiKey: string | null = null;

  /**
   * Конструктор сервиса
   * @param storage Адаптер хранилища
   * @param apiKey API ключ OpenAI (опционально)
   */
  constructor(storage: StorageAdapter, apiKey?: string) {
    this.storage = storage;
    
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
        logger.warn("[EmbeddingsService] OpenAI API key not provided. Embeddings will not be available.");
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
   * Создание эмбеддинга для текста
   * @param text Текст для создания эмбеддинга
   * @returns Эмбеддинг в виде массива чисел
   */
  public async createEmbedding(text: string): Promise<number[] | null> {
    if (!this.isApiAvailable()) {
      logger.error("[EmbeddingsService] OpenAI API is not available");
      return null;
    }

    try {
      const response = await this.openai!.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        dimensions: 1536,
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error("[EmbeddingsService] Error creating embedding:", error);
      return null;
    }
  }

  /**
   * Создание и сохранение эмбеддинга для расшифровки
   * @param reelId ID Reel
   * @param transcript Текст расшифровки
   * @returns ID созданного эмбеддинга или null в случае ошибки
   */
  public async createAndSaveEmbedding(reelId: string, transcript: string): Promise<number | null> {
    try {
      // Создаем эмбеддинг
      const embedding = await this.createEmbedding(transcript);
      if (!embedding) {
        return null;
      }

      // Сохраняем эмбеддинг в базе данных
      if (this.storage.executeQuery) {
        const result = await this.storage.executeQuery(
          `INSERT INTO transcript_embeddings (reel_id, transcript, embedding) 
           VALUES ($1, $2, $3) 
           RETURNING id`,
          [reelId, transcript, embedding]
        );

        if (result && result.rows && result.rows.length > 0) {
          return result.rows[0].id;
        }
      }

      return null;
    } catch (error) {
      logger.error("[EmbeddingsService] Error creating and saving embedding:", error);
      return null;
    }
  }

  /**
   * Поиск похожих расшифровок
   * @param query Текст запроса
   * @param limit Максимальное количество результатов
   * @returns Массив похожих расшифровок
   */
  public async searchSimilarTranscripts(query: string, limit: number = 5): Promise<any[] | null> {
    try {
      // Создаем эмбеддинг для запроса
      const queryEmbedding = await this.createEmbedding(query);
      if (!queryEmbedding) {
        return null;
      }

      // Ищем похожие расшифровки в базе данных
      if (this.storage.executeQuery) {
        const result = await this.storage.executeQuery(
          `SELECT id, reel_id, transcript, 1 - (embedding <=> $1) as similarity
           FROM transcript_embeddings
           ORDER BY embedding <=> $1
           LIMIT $2`,
          [queryEmbedding, limit]
        );

        if (result && result.rows) {
          return result.rows;
        }
      }

      return null;
    } catch (error) {
      logger.error("[EmbeddingsService] Error searching similar transcripts:", error);
      return null;
    }
  }

  /**
   * Получение эмбеддинга по ID Reel
   * @param reelId ID Reel
   * @returns Эмбеддинг или null, если не найден
   */
  public async getEmbeddingByReelId(reelId: string): Promise<any | null> {
    try {
      if (this.storage.executeQuery) {
        const result = await this.storage.executeQuery(
          `SELECT id, reel_id, transcript, embedding
           FROM transcript_embeddings
           WHERE reel_id = $1
           LIMIT 1`,
          [reelId]
        );

        if (result && result.rows && result.rows.length > 0) {
          return result.rows[0];
        }
      }

      return null;
    } catch (error) {
      logger.error("[EmbeddingsService] Error getting embedding by reel ID:", error);
      return null;
    }
  }

  /**
   * Обновление эмбеддинга для расшифровки
   * @param reelId ID Reel
   * @param transcript Новый текст расшифровки
   * @returns true, если обновление успешно
   */
  public async updateEmbedding(reelId: string, transcript: string): Promise<boolean> {
    try {
      // Создаем новый эмбеддинг
      const embedding = await this.createEmbedding(transcript);
      if (!embedding) {
        return false;
      }

      // Обновляем эмбеддинг в базе данных
      if (this.storage.executeQuery) {
        const result = await this.storage.executeQuery(
          `UPDATE transcript_embeddings
           SET transcript = $2, embedding = $3, updated_at = CURRENT_TIMESTAMP
           WHERE reel_id = $1`,
          [reelId, transcript, embedding]
        );

        return result !== null;
      }

      return false;
    } catch (error) {
      logger.error("[EmbeddingsService] Error updating embedding:", error);
      return false;
    }
  }

  /**
   * Удаление эмбеддинга
   * @param reelId ID Reel
   * @returns true, если удаление успешно
   */
  public async deleteEmbedding(reelId: string): Promise<boolean> {
    try {
      if (this.storage.executeQuery) {
        const result = await this.storage.executeQuery(
          `DELETE FROM transcript_embeddings
           WHERE reel_id = $1`,
          [reelId]
        );

        return result !== null;
      }

      return false;
    } catch (error) {
      logger.error("[EmbeddingsService] Error deleting embedding:", error);
      return false;
    }
  }
}
