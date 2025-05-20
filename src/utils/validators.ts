/**
 * Утилиты для валидации данных
 */

/**
 * Проверяет, является ли строка валидным URL Instagram
 * @param url URL для проверки
 * @returns true, если URL валиден, иначе false
 */
export function isValidInstagramUrl(url: string): boolean {
  if (!url) return false;
  
  // Проверяем, что URL начинается с http:// или https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }
  
  // Проверяем, что URL содержит instagram.com
  if (!url.includes('instagram.com')) {
    return false;
  }
  
  // Проверяем, что URL не содержит пробелов
  if (url.includes(' ')) {
    return false;
  }
  
  return true;
}

/**
 * Извлекает имя пользователя из URL Instagram
 * @param url URL Instagram
 * @returns Имя пользователя или null, если не удалось извлечь
 */
export function extractUsernameFromUrl(url: string): string | null {
  if (!isValidInstagramUrl(url)) {
    return null;
  }
  
  try {
    // Создаем объект URL для парсинга
    const urlObj = new URL(url);
    
    // Получаем путь URL (например, /username)
    const path = urlObj.pathname;
    
    // Удаляем начальный слеш и разбиваем путь на части
    const parts = path.replace(/^\//, '').split('/');
    
    // Первая часть должна быть именем пользователя
    // Игнорируем специальные пути, такие как /p/, /reel/, /stories/
    if (parts.length > 0 && !['p', 'reel', 'reels', 'stories', 'explore', 'tv'].includes(parts[0])) {
      return parts[0];
    }
    
    return null;
  } catch (error) {
    console.error('Ошибка при извлечении имени пользователя из URL:', error);
    return null;
  }
}

/**
 * Проверяет, является ли строка валидным хэштегом
 * @param hashtag Хэштег для проверки
 * @returns true, если хэштег валиден, иначе false
 */
export function isValidHashtag(hashtag: string): boolean {
  if (!hashtag) return false;
  
  // Удаляем начальный символ #, если он есть
  const tag = hashtag.startsWith('#') ? hashtag.substring(1) : hashtag;
  
  // Проверяем, что хэштег не пустой
  if (tag.length === 0) {
    return false;
  }
  
  // Проверяем, что хэштег не содержит пробелов
  if (tag.includes(' ')) {
    return false;
  }
  
  // Проверяем, что хэштег содержит только допустимые символы
  // (буквы, цифры, подчеркивания)
  const validHashtagRegex = /^[a-zA-Z0-9_]+$/;
  return validHashtagRegex.test(tag);
}

/**
 * Нормализует хэштег (добавляет # в начало, если его нет)
 * @param hashtag Хэштег для нормализации
 * @returns Нормализованный хэштег
 */
export function normalizeHashtag(hashtag: string): string {
  if (!hashtag) return '';
  
  // Удаляем начальный символ #, если он есть
  const tag = hashtag.startsWith('#') ? hashtag.substring(1) : hashtag;
  
  // Возвращаем хэштег с символом # в начале
  return `#${tag}`;
}
