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
  if (url === null || url === undefined || url === "") {
    return false;
  }
  try {
    const parsedUrl = new URL(url);
    return (
      (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") &&
      (parsedUrl.hostname === "www.instagram.com" ||
        parsedUrl.hostname === "instagram.com")
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
    // Ожидаем, что имя пользователя - первая часть пути, например, /username/
    // или /username?some_query
    if (pathParts.length > 0) {
      // Удаляем возможный конечный слэш
      const usernameCandidate = pathParts[0];
      // Простая проверка, что это не p, reel, story и т.д.
      if (
        ![
          "p",
          "reel",
          "reels",
          "stories",
          "explore",
          "accounts",
          "tags",
        ].includes(usernameCandidate)
      ) {
        return usernameCandidate;
      }
    }
  } catch (error) {
    return null;
  }
  return null;
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
