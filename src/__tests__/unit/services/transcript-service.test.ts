import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { TranscriptService } from "../../../services/transcript-service";
import { createMockReelContent } from "../../helpers/mocks";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";

// Мокируем зависимости
mock.module("../../../logger", () => {
  return {
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    },
  };
});

// Мокируем fs
mock.module("fs", () => {
  return {
    ...fs,
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    createReadStream: jest.fn(),
    statSync: jest.fn(),
    unlinkSync: jest.fn(),
  };
});

// Мокируем path
mock.module("path", () => {
  return {
    ...path,
    join: jest.fn().mockImplementation((...args) => args.join("/")),
    basename: jest.fn().mockImplementation((p, ext) => {
      const base = p.split("/").pop();
      if (ext && base.endsWith(ext)) {
        return base.slice(0, -ext.length);
      }
      return base;
    }),
    dirname: jest.fn().mockImplementation((p) => {
      const parts = p.split("/");
      parts.pop();
      return parts.join("/");
    }),
    extname: jest.fn().mockImplementation((p) => {
      const parts = p.split(".");
      if (parts.length > 1) {
        return "." + parts.pop();
      }
      return "";
    }),
  };
});

// Мокируем child_process
mock.module("child_process", () => {
  return {
    exec: jest.fn(),
  };
});

// Мокируем OpenAI
mock.module("openai", () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => {
      return {
        audio: {
          transcriptions: {
            create: jest.fn().mockResolvedValue({ text: "Mocked transcription text" }),
          },
        },
      };
    }),
  };
});

describe("TranscriptService", () => {
  let mockAdapter: any;
  let transcriptService: TranscriptService;
  let mockExec: jest.Mock;
  let mockExistsSync: jest.Mock;
  let mockMkdirSync: jest.Mock;
  let mockCreateReadStream: jest.Mock;
  let mockStatSync: jest.Mock;
  let mockUnlinkSync: jest.Mock;

  beforeEach(() => {
    // Сбрасываем все моки перед каждым тестом
    jest.clearAllMocks();

    // Настраиваем моки fs
    mockExistsSync = fs.existsSync as jest.Mock;
    mockMkdirSync = fs.mkdirSync as jest.Mock;
    mockCreateReadStream = fs.createReadStream as jest.Mock;
    mockStatSync = fs.statSync as jest.Mock;
    mockUnlinkSync = fs.unlinkSync as jest.Mock;

    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ size: 1024 });
    mockCreateReadStream.mockReturnValue({});

    // Настраиваем мок exec
    mockExec = exec as unknown as jest.Mock;
    mockExec.mockImplementation((cmd, callback) => {
      if (callback) {
        callback(null, { stdout: "success", stderr: "" });
      }
      return {
        on: jest.fn(),
      };
    });

    // Создаем мок адаптера хранилища
    mockAdapter = {
      getReelById: jest.fn(),
      updateReel: jest.fn(),
    };

    // Создаем экземпляр сервиса
    transcriptService = new TranscriptService(mockAdapter, "test-api-key");
  });

  afterEach(() => {
    // Очищаем все моки после каждого теста
    jest.clearAllMocks();
  });

  describe("isApiAvailable", () => {
    it("should return true when API key is provided", () => {
      expect(transcriptService.isApiAvailable()).toBe(true);
    });

    it("should return false when API key is not provided", () => {
      // Мокируем process.env, чтобы убедиться, что OPENAI_API_KEY не определен
      const originalEnv = process.env;
      process.env = { ...originalEnv };
      delete process.env.OPENAI_API_KEY;

      const serviceWithoutKey = new TranscriptService(mockAdapter);
      expect(serviceWithoutKey.isApiAvailable()).toBe(false);

      // Восстанавливаем process.env
      process.env = originalEnv;
    });
  });

  describe("transcribeReel", () => {
    it("should return null if API is not available", async () => {
      const serviceWithoutKey = new TranscriptService(mockAdapter);
      const result = await serviceWithoutKey.transcribeReel("reel123");
      expect(result).toBeNull();
    });

    it("should return null if reel is not found", async () => {
      mockAdapter.getReelById.mockResolvedValue(null);
      const result = await transcriptService.transcribeReel("reel123");
      expect(result).toBeNull();
      expect(mockAdapter.getReelById).toHaveBeenCalledWith("reel123");
    });

    it("should process video and return transcript", async () => {
      // Мокируем данные Reel
      const mockReel = createMockReelContent({
        id: 1,
        instagram_id: "reel123",
        url: "https://example.com/video.mp4",
      });

      mockAdapter.getReelById.mockResolvedValue(mockReel);

      // Мокируем updateReel для возврата обновленного Reel
      mockAdapter.updateReel.mockImplementation((reelId, data) => {
        return Promise.resolve({
          ...mockReel,
          ...data,
        });
      });

      // Мокируем методы сервиса
      const mockVideoPath = "/tmp/video.mp4";
      const mockAudioPath = "/tmp/audio.mp3";

      // Мокируем метод downloadVideo
      jest.spyOn(transcriptService as any, "downloadVideo").mockResolvedValue(mockVideoPath);

      // Мокируем метод extractAudio
      jest.spyOn(transcriptService as any, "extractAudio").mockResolvedValue(mockAudioPath);

      // Мокируем метод transcribeAudio
      jest.spyOn(transcriptService as any, "transcribeAudio").mockResolvedValue("Mocked transcription text");

      // Мокируем метод cleanupFiles
      jest.spyOn(transcriptService as any, "cleanupFiles").mockResolvedValue(undefined);

      const result = await transcriptService.transcribeReel("reel123");

      expect(result).toBe("Mocked transcription text");
      expect(mockAdapter.getReelById).toHaveBeenCalledWith("reel123");
      expect(mockAdapter.updateReel).toHaveBeenCalledTimes(2);

      // Проверяем первый вызов updateReel (установка статуса "processing")
      expect(mockAdapter.updateReel.mock.calls[0][0]).toBe("reel123");
      expect(mockAdapter.updateReel.mock.calls[0][1].transcript_status).toBe("processing");

      // Проверяем второй вызов updateReel (сохранение расшифровки)
      expect(mockAdapter.updateReel.mock.calls[1][0]).toBe("reel123");
      expect(mockAdapter.updateReel.mock.calls[1][1].transcript).toBe("Mocked transcription text");
      expect(mockAdapter.updateReel.mock.calls[1][1].transcript_status).toBe("completed");

      // Проверяем, что методы были вызваны с правильными параметрами
      expect((transcriptService as any).downloadVideo).toHaveBeenCalledWith(mockReel.url);
      expect((transcriptService as any).extractAudio).toHaveBeenCalledWith(mockVideoPath);
      expect((transcriptService as any).transcribeAudio).toHaveBeenCalledWith(mockAudioPath, undefined);
      expect((transcriptService as any).cleanupFiles).toHaveBeenCalledWith([mockVideoPath, mockAudioPath]);
    });

    it("should handle errors during transcription", async () => {
      // Мокируем данные Reel
      const mockReel = createMockReelContent({
        id: 1,
        instagram_id: "reel123",
        url: "https://example.com/video.mp4",
      });

      mockAdapter.getReelById.mockResolvedValue(mockReel);

      // Имитируем ошибку при выполнении команды
      mockExec.mockImplementation((cmd, options, callback) => {
        if (typeof options === "function") {
          callback = options;
          options = {};
        }
        if (callback) {
          callback(new Error("Command failed"), { stdout: "", stderr: "Error" });
        }
        return {
          on: jest.fn(),
        };
      });

      const result = await transcriptService.transcribeReel("reel123");

      expect(result).toBeNull();
      expect(mockAdapter.getReelById).toHaveBeenCalledWith("reel123");
      expect(mockAdapter.updateReel).toHaveBeenCalledTimes(2);

      // Проверяем первый вызов updateReel (установка статуса "processing")
      expect(mockAdapter.updateReel.mock.calls[0][0]).toBe("reel123");
      expect(mockAdapter.updateReel.mock.calls[0][1].transcript_status).toBe("processing");

      // Проверяем второй вызов updateReel (установка статуса "failed")
      expect(mockAdapter.updateReel.mock.calls[1][0]).toBe("reel123");
      expect(mockAdapter.updateReel.mock.calls[1][1].transcript_status).toBe("failed");
    });
  });

  describe("getTranscriptionStatus", () => {
    it("should return transcription status", async () => {
      const mockReel = createMockReelContent({
        id: 1,
        instagram_id: "reel123",
        transcript_status: "completed",
      });

      mockAdapter.getReelById.mockResolvedValue(mockReel);

      const result = await transcriptService.getTranscriptionStatus("reel123");
      expect(result).toBe("completed");
      expect(mockAdapter.getReelById).toHaveBeenCalledWith("reel123");
    });

    it("should return null if reel is not found", async () => {
      mockAdapter.getReelById.mockResolvedValue(null);

      const result = await transcriptService.getTranscriptionStatus("reel123");
      expect(result).toBeNull();
      expect(mockAdapter.getReelById).toHaveBeenCalledWith("reel123");
    });
  });

  describe("getTranscript", () => {
    it("should return transcript", async () => {
      const mockReel = createMockReelContent({
        id: 1,
        instagram_id: "reel123",
        transcript: "Test transcript",
      });

      mockAdapter.getReelById.mockResolvedValue(mockReel);

      const result = await transcriptService.getTranscript("reel123");
      expect(result).toBe("Test transcript");
      expect(mockAdapter.getReelById).toHaveBeenCalledWith("reel123");
    });

    it("should return null if reel is not found", async () => {
      mockAdapter.getReelById.mockResolvedValue(null);

      const result = await transcriptService.getTranscript("reel123");
      expect(result).toBeNull();
      expect(mockAdapter.getReelById).toHaveBeenCalledWith("reel123");
    });
  });
});
