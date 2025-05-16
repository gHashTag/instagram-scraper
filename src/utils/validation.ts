/**
 * Проверяет, является ли имя проекта валидным.
 * Имя проекта должно быть от 3 до 100 символов.
 * @param name Имя проекта для проверки.
 * @returns true, если имя валидно, иначе false.
 */
export function isValidProjectName(name: string): boolean {
  // Проверка на null, undefined или пустую строку
  if (name === null || name === undefined || name === "") {
    return false;
  }

  // Удаляем пробелы в начале и конце строки
  const trimmedName = name.trim();

  // Проверка на пустую строку после удаления пробелов
  if (trimmedName === "") {
    return false;
  }

  // Проверка длины строки
  if (trimmedName.length < 3 || trimmedName.length > 100) {
    return false;
  }

  return true;
}

/**
 * Проверяет, является ли URL валидным Instagram URL.
 * Простая проверка, можно усложнить при необходимости.
 * @param url URL для проверки.
 * @returns true, если URL валиден, иначе false.
 */
export function isValidInstagramUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Проверяем, что URL начинается с http:// или https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);

    // Проверяем, что протокол только http или https
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return false;
    }

    // Проверяем, что хост только instagram.com или www.instagram.com
    return (
      parsedUrl.hostname === "www.instagram.com" ||
      parsedUrl.hostname === "instagram.com"
    );
  } catch (error) {
    return false; // Невалидный URL, если конструктор URL выбросил ошибку
  }
}

/**
 * Извлекает имя пользователя из Instagram URL.
 * @param url Instagram URL.
 * @returns Имя пользователя или null, если не удалось извлечь.
 */
export function extractUsernameFromUrl(url: string): string | null {
  if (!isValidInstagramUrl(url)) {
    return null;
  }
  try {
    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname
      .split("/")
      .filter((part) => part.length > 0);

    // Проверяем, что путь не пустой
    if (pathParts.length === 0) {
      return null;
    }

    // Список специальных путей, которые не являются именами пользователей
    const specialPaths = [
      "p",
      "reel",
      "reels",
      "stories",
      "explore",
      "accounts",
      "tags",
    ];

    // Проверяем, что первая часть пути не является специальным путем
    if (specialPaths.includes(pathParts[0])) {
      return null;
    }

    // Возвращаем имя пользователя
    return pathParts[0];
  } catch (error) {
    return null;
  }
}

/**
 * Проверяет валидность хештега.
 * Хештег не должен содержать пробелы и должен быть длиной от 2 до 50 символов (без #).
 * @param hashtag Хештег для проверки (может быть с # или без).
 * @returns true, если хештег валиден, иначе false.
 */
export function isValidHashtag(hashtag: string): boolean {
  if (!hashtag) {
    return false;
  }
  const cleanHashtag = hashtag.startsWith("#") ? hashtag.substring(1) : hashtag;
  if (
    cleanHashtag.includes(" ") ||
    cleanHashtag.includes("\t") ||
    cleanHashtag.includes("\n")
  ) {
    return false;
  }
  return cleanHashtag.length >= 2 && cleanHashtag.length <= 50;
}
