import { Markup } from "telegraf";
import { ReelContent } from "../../schemas";

/**
 * Создает клавиатуру для списка Reels
 * @param reels Массив Reels
 * @param projectId ID проекта
 * @param page Текущая страница
 * @param totalPages Общее количество страниц
 * @param sourceType Тип источника (competitor или hashtag)
 * @param sourceId ID источника
 * @returns Объект клавиатуры
 */
export function createReelsListKeyboard(
  reels: ReelContent[],
  projectId: number,
  page: number = 1,
  totalPages: number = 1,
  sourceType?: "competitor" | "hashtag",
  sourceId?: string | number
) {
  const keyboard = [];

  // Добавляем кнопки для каждого Reel
  for (const reel of reels) {
    // Формируем текст кнопки (ограничиваем длину описания)
    const caption = reel.caption
      ? reel.caption.length > 30
        ? reel.caption.substring(0, 27) + "..."
        : reel.caption
      : "Без описания";

    // Добавляем информацию о просмотрах, если она есть
    const viewsInfo = reel.views ? ` (${reel.views} 👁️)` : "";

    // Формируем текст кнопки
    const buttonText = `${caption}${viewsInfo}`;

    // Добавляем кнопку для Reel
    keyboard.push([
      Markup.button.callback(
        buttonText,
        `reel_details_${projectId}_${reel.instagram_id}`
      ),
    ]);
  }

  // Добавляем кнопки пагинации, если есть несколько страниц
  if (totalPages > 1) {
    const paginationButtons = [];

    // Кнопка "Предыдущая страница"
    if (page > 1) {
      paginationButtons.push(
        Markup.button.callback(
          "⬅️ Предыдущая",
          sourceType && sourceId
            ? `reels_page_${projectId}_${page - 1}_${sourceType}_${sourceId}`
            : `reels_page_${projectId}_${page - 1}`
        )
      );
    }

    // Информация о текущей странице
    paginationButtons.push(
      Markup.button.callback(
        `${page} из ${totalPages}`,
        `reels_current_page`
      )
    );

    // Кнопка "Следующая страница"
    if (page < totalPages) {
      paginationButtons.push(
        Markup.button.callback(
          "Следующая ➡️",
          sourceType && sourceId
            ? `reels_page_${projectId}_${page + 1}_${sourceType}_${sourceId}`
            : `reels_page_${projectId}_${page + 1}`
        )
      );
    }

    keyboard.push(paginationButtons);
  }

  // Добавляем кнопки фильтрации и сортировки
  keyboard.push([
    Markup.button.callback("🔍 Фильтры", `reels_filter_${projectId}`),
    Markup.button.callback("📊 Аналитика", `reels_analytics_${projectId}`),
  ]);

  // Добавляем кнопку для перехода к коллекциям Reels
  keyboard.push([
    Markup.button.callback("📋 Коллекции Reels", `collections_project_${projectId}`),
  ]);

  // Добавляем кнопки навигации
  if (sourceType && sourceId) {
    // Если просматриваем Reels конкретного источника
    if (sourceType === "competitor") {
      keyboard.push([
        Markup.button.callback(
          "🔙 К конкуренту",
          `competitor_${projectId}_${sourceId}`
        ),
      ]);
    } else if (sourceType === "hashtag") {
      keyboard.push([
        Markup.button.callback(
          "🔙 К хештегу",
          `hashtag_${projectId}_${sourceId}`
        ),
      ]);
    }
  }

  // Кнопка возврата к проекту
  keyboard.push([
    Markup.button.callback("🔙 К проекту", `project_${projectId}`),
  ]);

  return Markup.inlineKeyboard(keyboard);
}

/**
 * Создает клавиатуру для детальной информации о Reel
 * @param reel Объект Reel
 * @param projectId ID проекта
 * @param sourceType Тип источника (competitor или hashtag)
 * @param sourceId ID источника
 * @returns Объект клавиатуры
 */
export function createReelDetailsKeyboard(
  reel: ReelContent,
  projectId: number,
  sourceType?: "competitor" | "hashtag",
  sourceId?: string | number
) {
  const keyboard = [];

  // Кнопка для перехода к Reel в Instagram
  keyboard.push([
    Markup.button.url("🎬 Открыть в Instagram", reel.url),
  ]);

  // Кнопки для работы с расшифровкой
  if (reel.transcript_status === "completed") {
    // Если расшифровка уже есть
    keyboard.push([
      Markup.button.callback("📝 Просмотреть расшифровку", `view_transcript_${projectId}_${reel.instagram_id}`),
      Markup.button.callback("🔄 Обновить расшифровку", `transcribe_reel_${projectId}_${reel.instagram_id}`),
    ]);

    // Добавляем кнопку для чат-бота
    keyboard.push([
      Markup.button.callback("🤖 Общаться с видео", `chat_with_reel_${projectId}_${reel.instagram_id}`),
    ]);
  } else if (reel.transcript_status === "processing") {
    // Если расшифровка в процессе
    keyboard.push([
      Markup.button.callback("🔄 Проверить статус расшифровки", `check_transcript_${projectId}_${reel.instagram_id}`),
    ]);
  } else {
    // Если расшифровки нет или она не удалась
    keyboard.push([
      Markup.button.callback("🎙️ Расшифровать видео", `transcribe_reel_${projectId}_${reel.instagram_id}`),
    ]);
  }

  // Кнопки навигации
  if (sourceType && sourceId) {
    // Если просматриваем Reel конкретного источника
    keyboard.push([
      Markup.button.callback(
        "🔙 К списку Reels",
        `reels_list_${projectId}_${sourceType}_${sourceId}`
      ),
    ]);
  } else {
    // Если просматриваем все Reels проекта
    keyboard.push([
      Markup.button.callback(
        "🔙 К списку Reels",
        `reels_list_${projectId}`
      ),
    ]);
  }

  // Кнопка возврата к проекту
  keyboard.push([
    Markup.button.callback("🔙 К проекту", `project_${projectId}`),
  ]);

  return Markup.inlineKeyboard(keyboard);
}

/**
 * Создает клавиатуру для фильтрации Reels
 * @param projectId ID проекта
 * @param sourceType Тип источника (competitor или hashtag)
 * @param sourceId ID источника
 * @returns Объект клавиатуры
 */
export function createReelsFilterKeyboard(
  projectId: number,
  sourceType?: "competitor" | "hashtag",
  sourceId?: string | number
) {
  const keyboard = [];

  // Кнопки для фильтрации по просмотрам
  keyboard.push([
    Markup.button.callback(
      "👁️ > 1000 просмотров",
      `reels_filter_views_${projectId}_1000${sourceType && sourceId ? `_${sourceType}_${sourceId}` : ""}`
    ),
    Markup.button.callback(
      "👁️ > 5000 просмотров",
      `reels_filter_views_${projectId}_5000${sourceType && sourceId ? `_${sourceType}_${sourceId}` : ""}`
    ),
  ]);

  // Кнопки для фильтрации по дате
  keyboard.push([
    Markup.button.callback(
      "📅 За неделю",
      `reels_filter_date_${projectId}_week${sourceType && sourceId ? `_${sourceType}_${sourceId}` : ""}`
    ),
    Markup.button.callback(
      "📅 За месяц",
      `reels_filter_date_${projectId}_month${sourceType && sourceId ? `_${sourceType}_${sourceId}` : ""}`
    ),
  ]);

  // Кнопки для сортировки
  keyboard.push([
    Markup.button.callback(
      "📈 По просмотрам",
      `reels_sort_${projectId}_views${sourceType && sourceId ? `_${sourceType}_${sourceId}` : ""}`
    ),
    Markup.button.callback(
      "📅 По дате",
      `reels_sort_${projectId}_date${sourceType && sourceId ? `_${sourceType}_${sourceId}` : ""}`
    ),
  ]);

  // Кнопка сброса фильтров
  keyboard.push([
    Markup.button.callback(
      "🔄 Сбросить фильтры",
      `reels_filter_reset_${projectId}${sourceType && sourceId ? `_${sourceType}_${sourceId}` : ""}`
    ),
  ]);

  // Кнопки навигации
  if (sourceType && sourceId) {
    // Если просматриваем Reels конкретного источника
    keyboard.push([
      Markup.button.callback(
        "🔙 К списку Reels",
        `reels_list_${projectId}_${sourceType}_${sourceId}`
      ),
    ]);
  } else {
    // Если просматриваем все Reels проекта
    keyboard.push([
      Markup.button.callback(
        "🔙 К списку Reels",
        `reels_list_${projectId}`
      ),
    ]);
  }

  return Markup.inlineKeyboard(keyboard);
}

/**
 * Форматирует дату для отображения
 * @param dateString Строка с датой в формате ISO
 * @returns Отформатированная дата
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Форматирует количество просмотров для отображения
 * @param views Количество просмотров
 * @returns Отформатированное количество просмотров
 */
export function formatViews(views?: number): string {
  if (!views) return "Нет данных";

  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  } else if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  } else {
    return views.toString();
  }
}
