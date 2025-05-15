import { describe, it, expect, mock, beforeAll, afterAll } from "bun:test";
import {
  isValidProjectName,
  isValidInstagramUrl,
  extractUsernameFromUrl,
  isValidHashtag,
} from "../../../utils/validation";

describe("Validation Utils", () => {
  // Сохраняем оригинальное значение NODE_ENV
  let originalNodeEnv: string | undefined;

  beforeAll(() => {
    originalNodeEnv = process.env.NODE_ENV;
    // Устанавливаем NODE_ENV=test для тестов
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    // Восстанавливаем оригинальное значение NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });
  describe("isValidInstagramUrl", () => {
    it("should return false for empty string", () => {
      expect(isValidInstagramUrl("")).toBe(false);
    });

    it("should return false for null or undefined", () => {
      expect(isValidInstagramUrl(null as unknown as string)).toBe(false);
      expect(isValidInstagramUrl(undefined as unknown as string)).toBe(false);
    });

    it("should return false for non-URL strings", () => {
      expect(isValidInstagramUrl("not a url")).toBe(false);
    });

    it("should return false for URLs with invalid protocol", () => {
      expect(isValidInstagramUrl("ftp://instagram.com/username")).toBe(false);
    });

    it("should return false for non-Instagram URLs", () => {
      expect(isValidInstagramUrl("https://facebook.com/username")).toBe(false);
      expect(isValidInstagramUrl("https://insta.gram.com/username")).toBe(false);
    });

    it("should return true for valid Instagram URLs", () => {
      expect(isValidInstagramUrl("https://instagram.com/username")).toBe(true);
      expect(isValidInstagramUrl("http://instagram.com/username")).toBe(true);
      expect(isValidInstagramUrl("https://www.instagram.com/username")).toBe(true);
      expect(isValidInstagramUrl("http://www.instagram.com/username")).toBe(true);
    });
  });

  describe("extractUsernameFromUrl", () => {
    it("should return null for invalid Instagram URLs", () => {
      expect(extractUsernameFromUrl("")).toBeNull();
      expect(extractUsernameFromUrl("not a url")).toBeNull();
      expect(extractUsernameFromUrl("https://facebook.com/username")).toBeNull();
    });

    it("should return username from valid Instagram profile URLs", () => {
      expect(extractUsernameFromUrl("https://instagram.com/username")).toBe("username");
      expect(extractUsernameFromUrl("https://www.instagram.com/username/")).toBe("username");
      expect(extractUsernameFromUrl("https://instagram.com/username?hl=en")).toBe("username");
    });

    it("should return null for Instagram URLs that are not profile URLs", () => {
      expect(extractUsernameFromUrl("https://instagram.com/p/12345")).toBeNull();
      expect(extractUsernameFromUrl("https://instagram.com/reel/12345")).toBeNull();
      expect(extractUsernameFromUrl("https://instagram.com/reels/12345")).toBeNull();
      expect(extractUsernameFromUrl("https://instagram.com/stories/12345")).toBeNull();
      expect(extractUsernameFromUrl("https://instagram.com/explore")).toBeNull();
      expect(extractUsernameFromUrl("https://instagram.com/accounts/login")).toBeNull();
      expect(extractUsernameFromUrl("https://instagram.com/tags/travel")).toBeNull();
    });

    it("should handle URLs with invalid path structure", () => {
      // URL is valid but path structure doesn't match expected pattern
      expect(extractUsernameFromUrl("https://instagram.com/")).toBeNull();
    });

    it("should handle errors in URL parsing", () => {
      // Для этого теста мы используем специальный URL, который вызовет ошибку
      expect(extractUsernameFromUrl("error_url_test")).toBeNull();
    });

    it("should work in production environment", () => {
      // Временно меняем NODE_ENV на production
      process.env.NODE_ENV = 'production';

      // Проверяем, что функция работает так же, как и в тестовом окружении
      expect(extractUsernameFromUrl("")).toBeNull();
      expect(extractUsernameFromUrl("not a url")).toBeNull();
      expect(extractUsernameFromUrl("https://facebook.com/username")).toBeNull();
      expect(extractUsernameFromUrl("https://instagram.com/username")).toBe("username");
      expect(extractUsernameFromUrl("https://www.instagram.com/username/")).toBe("username");
      expect(extractUsernameFromUrl("https://instagram.com/username?hl=en")).toBe("username");
      expect(extractUsernameFromUrl("https://instagram.com/p/12345")).toBeNull();
      expect(extractUsernameFromUrl("https://instagram.com/reel/12345")).toBeNull();
      expect(extractUsernameFromUrl("https://instagram.com/reels/12345")).toBeNull();
      expect(extractUsernameFromUrl("https://instagram.com/stories/12345")).toBeNull();
      expect(extractUsernameFromUrl("https://instagram.com/explore")).toBeNull();
      expect(extractUsernameFromUrl("https://instagram.com/accounts/login")).toBeNull();
      expect(extractUsernameFromUrl("https://instagram.com/tags/travel")).toBeNull();
      expect(extractUsernameFromUrl("https://instagram.com/")).toBeNull();

      // Возвращаем NODE_ENV обратно в test
      process.env.NODE_ENV = 'test';
    });
  });

  describe("isValidHashtag", () => {
    it("should return false for empty string", () => {
      expect(isValidHashtag("")).toBe(false);
    });

    it("should return false for null or undefined", () => {
      expect(isValidHashtag(null as unknown as string)).toBe(false);
      expect(isValidHashtag(undefined as unknown as string)).toBe(false);
    });

    it("should return false for hashtags with spaces", () => {
      expect(isValidHashtag("tag with space")).toBe(false);
      expect(isValidHashtag("#tag with space")).toBe(false);
    });

    it("should return false for hashtags with tabs or newlines", () => {
      expect(isValidHashtag("tag\twith\ttab")).toBe(false);
      expect(isValidHashtag("tag\nwith\nnewline")).toBe(false);
    });

    it("should return false for hashtags shorter than 2 characters", () => {
      expect(isValidHashtag("a")).toBe(false);
      expect(isValidHashtag("#a")).toBe(false);
    });

    it("should return true for valid hashtags", () => {
      expect(isValidHashtag("tag")).toBe(true);
      expect(isValidHashtag("#tag")).toBe(true);
      expect(isValidHashtag("tag123")).toBe(true);
      expect(isValidHashtag("#tag123")).toBe(true);
    });

    it("should return false for hashtags longer than 50 characters", () => {
      const longHashtag = "a".repeat(51);
      expect(isValidHashtag(longHashtag)).toBe(false);
      expect(isValidHashtag("#" + longHashtag)).toBe(false);
    });
  });
});
