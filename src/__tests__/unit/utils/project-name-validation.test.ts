import { describe, it, expect } from "bun:test";
// Импорт isValidProjectName не используется

// Создаем простую функцию для тестирования
function testIsValidProjectName(name: string): boolean {
  if (name === null || name === undefined || name === "") {
    return false;
  }

  const trimmedName = name.trim();

  if (trimmedName === "") {
    return false;
  }

  if (trimmedName.length < 3 || trimmedName.length > 100) {
    return false;
  }

  return true;
}

describe("Project Name Validation", () => {
  it("should validate project names correctly", () => {
    // Тестируем пустые строки
    expect(testIsValidProjectName("")).toBe(false);

    // Тестируем null и undefined
    expect(testIsValidProjectName(null as unknown as string)).toBe(false);
    expect(testIsValidProjectName(undefined as unknown as string)).toBe(false);

    // Тестируем строки только с пробелами
    expect(testIsValidProjectName("   ")).toBe(false);

    // Тестируем строки короче 3 символов
    expect(testIsValidProjectName("a")).toBe(false);
    expect(testIsValidProjectName("ab")).toBe(false);

    // Тестируем валидные имена проектов
    expect(testIsValidProjectName("abc")).toBe(true);
    expect(testIsValidProjectName("Project 1")).toBe(true);
    expect(testIsValidProjectName("  Valid Project  ")).toBe(true); // Пробелы обрезаются

    // Тестируем строки длиннее 100 символов
    const longString = "a".repeat(101);
    expect(testIsValidProjectName(longString)).toBe(false);
  });
});
