import { z } from "zod";
import {
  UserSchema,
  ProjectSchema,
  CompetitorSchema,
  HashtagSchema,
  ReelContentSchema,
  ParsingRunLogSchema,
} from "../schemas";

/**
 * Валидирует данные пользователя с помощью Zod
 * @param data Данные пользователя для валидации
 * @returns Валидированные данные пользователя или null в случае ошибки
 */
export function validateUser(data: unknown) {
  try {
    return UserSchema.parse(data);
  } catch (error) {
    console.error("Ошибка валидации пользователя:", error);
    return null;
  }
}

/**
 * Валидирует данные проекта с помощью Zod
 * @param data Данные проекта для валидации
 * @returns Валидированные данные проекта или null в случае ошибки
 */
export function validateProject(data: unknown) {
  try {
    return ProjectSchema.parse(data);
  } catch (error) {
    console.error("Ошибка валидации проекта:", error);
    return null;
  }
}

/**
 * Валидирует данные конкурента с помощью Zod
 * @param data Данные конкурента для валидации
 * @returns Валидированные данные конкурента или null в случае ошибки
 */
export function validateCompetitor(data: unknown) {
  try {
    return CompetitorSchema.parse(data);
  } catch (error) {
    console.error("Ошибка валидации конкурента:", error);
    return null;
  }
}

/**
 * Валидирует данные хештега с помощью Zod
 * @param data Данные хештега для валидации
 * @returns Валидированные данные хештега или null в случае ошибки
 */
export function validateHashtag(data: unknown) {
  try {
    return HashtagSchema.parse(data);
  } catch (error) {
    console.error("Ошибка валидации хештега:", error);
    return null;
  }
}

/**
 * Валидирует данные Reel с помощью Zod
 * @param data Данные Reel для валидации
 * @returns Валидированные данные Reel или null в случае ошибки
 */
export function validateReelContent(data: unknown) {
  try {
    return ReelContentSchema.parse(data);
  } catch (error) {
    console.error("Ошибка валидации Reel:", error);
    return null;
  }
}

/**
 * Валидирует данные лога запуска парсинга с помощью Zod
 * @param data Данные лога запуска парсинга для валидации
 * @returns Валидированные данные лога запуска парсинга или null в случае ошибки
 */
export function validateParsingRunLog(data: unknown) {
  try {
    return ParsingRunLogSchema.parse(data);
  } catch (error) {
    console.error("Ошибка валидации лога запуска парсинга:", error);
    return null;
  }
}

/**
 * Валидирует массив данных с помощью указанной схемы Zod
 * @param schema Схема Zod для валидации
 * @param data Массив данных для валидации
 * @returns Валидированный массив данных или пустой массив в случае ошибки
 */
export function validateArray<T>(schema: z.ZodType<T>, data: unknown): T[] {
  console.log(`[DEBUG] validateArray: Начало валидации массива данных, тип схемы: ${schema.constructor.name}`);

  if (!Array.isArray(data)) {
    console.error(`[ERROR] validateArray: Данные не являются массивом:`, data);
    return [];
  }

  console.log(`[DEBUG] validateArray: Размер массива: ${data.length}`);

  try {
    const result = z.array(schema).parse(data);
    console.log(`[DEBUG] validateArray: Успешная валидация, результат содержит ${result.length} элементов`);
    return result;
  } catch (error) {
    console.error("Ошибка валидации массива:", error);

    // Попробуем валидировать каждый элемент отдельно, чтобы найти проблемный
    if (Array.isArray(data)) {
      console.log(`[DEBUG] validateArray: Попытка валидации каждого элемента отдельно...`);
      const validItems: T[] = [];

      data.forEach((item, index) => {
        try {
          const validItem = schema.parse(item);
          validItems.push(validItem);
        } catch (itemError) {
          console.error(`[ERROR] validateArray: Ошибка валидации элемента ${index}:`, itemError);
          console.log(`[DEBUG] validateArray: Проблемный элемент:`, item);
        }
      });

      console.log(`[DEBUG] validateArray: Успешно валидировано ${validItems.length} из ${data.length} элементов`);
      return validItems;
    }

    return [];
  }
}

/**
 * Валидирует массив пользователей с помощью Zod
 * @param data Массив данных пользователей для валидации
 * @returns Валидированный массив пользователей или пустой массив в случае ошибки
 */
export function validateUsers(data: unknown) {
  return validateArray(UserSchema, data);
}

/**
 * Валидирует массив проектов с помощью Zod
 * @param data Массив данных проектов для валидации
 * @returns Валидированный массив проектов или пустой массив в случае ошибки
 */
export function validateProjects(data: unknown) {
  return validateArray(ProjectSchema, data);
}

/**
 * Валидирует массив конкурентов с помощью Zod
 * @param data Массив данных конкурентов для валидации
 * @returns Валидированный массив конкурентов или пустой массив в случае ошибки
 */
export function validateCompetitors(data: unknown) {
  console.log(`[DEBUG] validateCompetitors: Начало валидации данных:`, data);
  try {
    const result = validateArray(CompetitorSchema, data);
    console.log(`[DEBUG] validateCompetitors: Результат валидации:`, result);
    return result;
  } catch (error) {
    console.error(`[ERROR] validateCompetitors: Ошибка валидации:`, error);
    return [];
  }
}

/**
 * Валидирует массив хештегов с помощью Zod
 * @param data Массив данных хештегов для валидации
 * @returns Валидированный массив хештегов или пустой массив в случае ошибки
 */
export function validateHashtags(data: unknown) {
  return validateArray(HashtagSchema, data);
}

/**
 * Валидирует массив Reels с помощью Zod
 * @param data Массив данных Reels для валидации
 * @returns Валидированный массив Reels или пустой массив в случае ошибки
 */
export function validateReelContents(data: unknown) {
  return validateArray(ReelContentSchema, data);
}

/**
 * Валидирует массив логов запуска парсинга с помощью Zod
 * @param data Массив данных логов запуска парсинга для валидации
 * @returns Валидированный массив логов запуска парсинга или пустой массив в случае ошибки
 */
export function validateParsingRunLogs(data: unknown) {
  return validateArray(ParsingRunLogSchema, data);
}
