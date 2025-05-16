import { StorageAdapter } from "../types";
import { logger } from "../logger";
import { OpenAI } from "openai";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";

const execAsync = promisify(exec);

/**
 * Сервис для преобразования видео в текст с использованием OpenAI Whisper API
 */
export class TranscriptService {
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
        logger.warn("[TranscriptService] OpenAI API key not provided. Transcription will not be available.");
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
   * Загрузка видео по URL
   * @param url URL видео
   * @returns Путь к загруженному файлу
   */
  private async downloadVideo(url: string): Promise<string> {
    try {
      // Создаем временную директорию
      const tempDir = path.join(os.tmpdir(), "instagram-scraper-bot");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Генерируем уникальное имя файла
      const videoFileName = `video_${Date.now()}.mp4`;
      const videoPath = path.join(tempDir, videoFileName);

      // Загружаем видео с помощью curl
      logger.info(`[TranscriptService] Downloading video from ${url}`);
      await execAsync(`curl -L "${url}" -o "${videoPath}"`);

      // Проверяем, что файл существует и имеет размер
      if (!fs.existsSync(videoPath) || fs.statSync(videoPath).size === 0) {
        throw new Error("Failed to download video or file is empty");
      }

      logger.info(`[TranscriptService] Video downloaded to ${videoPath}`);
      return videoPath;
    } catch (error) {
      logger.error("[TranscriptService] Error downloading video:", error);
      throw new Error(`Failed to download video: ${error}`);
    }
  }

  /**
   * Извлечение аудио из видео
   * @param videoPath Путь к видео файлу
   * @returns Путь к аудио файлу
   */
  private async extractAudio(videoPath: string): Promise<string> {
    try {
      // Генерируем имя файла для аудио
      const audioFileName = path.basename(videoPath, path.extname(videoPath)) + ".mp3";
      const audioPath = path.join(path.dirname(videoPath), audioFileName);

      // Извлекаем аудио с помощью ffmpeg
      logger.info(`[TranscriptService] Extracting audio from ${videoPath}`);
      await execAsync(`ffmpeg -i "${videoPath}" -q:a 0 -map a "${audioPath}" -y`);

      // Проверяем, что файл существует и имеет размер
      if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size === 0) {
        throw new Error("Failed to extract audio or file is empty");
      }

      logger.info(`[TranscriptService] Audio extracted to ${audioPath}`);
      return audioPath;
    } catch (error) {
      logger.error("[TranscriptService] Error extracting audio:", error);
      throw new Error(`Failed to extract audio: ${error}`);
    }
  }

  /**
   * Преобразование аудио в текст с использованием OpenAI Whisper API
   * @param audioPath Путь к аудио файлу
   * @param language Язык аудио (опционально)
   * @returns Текстовая расшифровка
   */
  private async transcribeAudio(audioPath: string, language?: string): Promise<string> {
    if (!this.openai) {
      throw new Error("OpenAI API is not initialized");
    }

    try {
      logger.info(`[TranscriptService] Transcribing audio ${audioPath}`);
      
      // Открываем аудио файл
      const audioFile = fs.createReadStream(audioPath);
      
      // Отправляем запрос к API
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: language,
      });

      logger.info(`[TranscriptService] Transcription completed`);
      return transcription.text;
    } catch (error) {
      logger.error("[TranscriptService] Error transcribing audio:", error);
      throw new Error(`Failed to transcribe audio: ${error}`);
    }
  }

  /**
   * Очистка временных файлов
   * @param filePaths Массив путей к файлам
   */
  private async cleanupFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.info(`[TranscriptService] Deleted temporary file ${filePath}`);
        }
      } catch (error) {
        logger.warn(`[TranscriptService] Failed to delete temporary file ${filePath}:`, error);
      }
    }
  }

  /**
   * Преобразование видео в текст
   * @param reelId ID Reel
   * @param language Язык видео (опционально)
   * @returns Текстовая расшифровка
   */
  public async transcribeReel(reelId: string, language?: string): Promise<string | null> {
    if (!this.isApiAvailable()) {
      logger.error("[TranscriptService] OpenAI API is not available");
      return null;
    }

    let videoPath: string | null = null;
    let audioPath: string | null = null;

    try {
      // Получаем информацию о Reel
      const reel = await this.storage.getReelById(reelId);
      if (!reel) {
        throw new Error(`Reel with ID ${reelId} not found`);
      }

      // Обновляем статус расшифровки
      await this.storage.updateReel(reelId, {
        transcript_status: "processing",
        transcript_updated_at: new Date().toISOString(),
      });

      // Загружаем видео
      videoPath = await this.downloadVideo(reel.url);

      // Извлекаем аудио
      audioPath = await this.extractAudio(videoPath);

      // Преобразуем аудио в текст
      const transcript = await this.transcribeAudio(audioPath, language);

      // Обновляем Reel с расшифровкой
      await this.storage.updateReel(reelId, {
        transcript,
        transcript_status: "completed",
        transcript_updated_at: new Date().toISOString(),
      });

      return transcript;
    } catch (error) {
      logger.error(`[TranscriptService] Error transcribing Reel ${reelId}:`, error);
      
      // Обновляем статус расшифровки на "failed"
      await this.storage.updateReel(reelId, {
        transcript_status: "failed",
        transcript_updated_at: new Date().toISOString(),
      });
      
      return null;
    } finally {
      // Очищаем временные файлы
      const filesToCleanup = [videoPath, audioPath].filter(Boolean) as string[];
      await this.cleanupFiles(filesToCleanup);
    }
  }

  /**
   * Получение статуса расшифровки
   * @param reelId ID Reel
   * @returns Статус расшифровки
   */
  public async getTranscriptionStatus(reelId: string): Promise<string | null> {
    try {
      const reel = await this.storage.getReelById(reelId);
      return reel?.transcript_status || null;
    } catch (error) {
      logger.error(`[TranscriptService] Error getting transcription status for Reel ${reelId}:`, error);
      return null;
    }
  }

  /**
   * Получение расшифровки
   * @param reelId ID Reel
   * @returns Текстовая расшифровка
   */
  public async getTranscript(reelId: string): Promise<string | null> {
    try {
      const reel = await this.storage.getReelById(reelId);
      return reel?.transcript || null;
    } catch (error) {
      logger.error(`[TranscriptService] Error getting transcript for Reel ${reelId}:`, error);
      return null;
    }
  }
}
