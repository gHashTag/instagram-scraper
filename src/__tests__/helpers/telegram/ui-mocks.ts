/**
 * @file Моки для UI-элементов Telegram
 * @description Содержит функции для создания моков инлайн-клавиатур и других UI-элементов
 */

// Импорты типов не требуются, так как мы используем только базовые типы

/**
 * Создает мок инлайн-клавиатуры
 * @param buttons Кнопки клавиатуры в формате [[{text, callback_data}, ...], ...]
 * @returns Объект инлайн-клавиатуры
 */
export function createInlineKeyboardMock(
  buttons: Array<Array<{ text: string; callback_data: string }>>
): any {
  return {
    reply_markup: {
      inline_keyboard: buttons
    }
  };
}

/**
 * Создает мок кнопки "Назад"
 * @param callbackData Данные для callback_query
 * @returns Объект кнопки
 */
export function createBackButtonMock(callbackData: string = "back"): any {
  return createInlineKeyboardMock([[{ text: "◀️ Назад", callback_data: callbackData }]]);
}

/**
 * Создает мок кнопок для списка проектов
 * @param projects Массив проектов
 * @returns Объект инлайн-клавиатуры с кнопками для проектов
 */
export function createProjectListKeyboardMock(
  projects: Array<{ id: number; name: string }>
): any {
  const buttons = projects.map(project => [{
    text: project.name,
    callback_data: `project_${project.id}`
  }]);

  buttons.push([{ text: "➕ Создать новый проект", callback_data: "create_project" }]);
  buttons.push([{ text: "◀️ Назад", callback_data: "back" }]);

  return createInlineKeyboardMock(buttons);
}

/**
 * Создает мок кнопок для меню проекта
 * @param projectId ID проекта
 * @returns Объект инлайн-клавиатуры с кнопками для меню проекта
 */
export function createProjectMenuKeyboardMock(projectId: number): any {
  const buttons = [
    [{ text: "👥 Конкуренты", callback_data: `competitors_${projectId}` }],
    [{ text: "#️⃣ Хештеги", callback_data: `hashtags_${projectId}` }],
    [{ text: "🔄 Запустить парсинг", callback_data: `start_parsing_${projectId}` }],
    [{ text: "📊 Результаты парсинга", callback_data: `parsing_results_${projectId}` }],
    [{ text: "◀️ Назад", callback_data: "back" }]
  ];

  return createInlineKeyboardMock(buttons);
}

/**
 * Создает мок кнопок для списка конкурентов
 * @param projectId ID проекта
 * @param competitors Массив конкурентов
 * @returns Объект инлайн-клавиатуры с кнопками для конкурентов
 */
export function createCompetitorListKeyboardMock(
  projectId: number,
  competitors: Array<{ id: number; username: string }>
): any {
  const buttons = competitors.map(competitor => [{
    text: `@${competitor.username}`,
    callback_data: `competitor_${competitor.id}`
  }]);

  buttons.push([{ text: "➕ Добавить конкурента", callback_data: `add_competitor_${projectId}` }]);
  buttons.push([{ text: "◀️ Назад", callback_data: `project_${projectId}` }]);

  return createInlineKeyboardMock(buttons);
}

/**
 * Создает мок кнопок для списка хештегов
 * @param projectId ID проекта
 * @param hashtags Массив хештегов
 * @returns Объект инлайн-клавиатуры с кнопками для хештегов
 */
export function createHashtagListKeyboardMock(
  projectId: number,
  hashtags: Array<{ id: number; name: string }>
): any {
  const buttons = hashtags.map(hashtag => [{
    text: `#${hashtag.name}`,
    callback_data: `hashtag_${hashtag.id}`
  }]);

  buttons.push([{ text: "➕ Добавить хештег", callback_data: `add_hashtag_${projectId}` }]);
  buttons.push([{ text: "◀️ Назад", callback_data: `project_${projectId}` }]);

  return createInlineKeyboardMock(buttons);
}

/**
 * Создает мок кнопок для результатов парсинга
 * @param projectId ID проекта
 * @param parsingRunIds Массив ID запусков парсинга
 * @returns Объект инлайн-клавиатуры с кнопками для результатов парсинга
 */
export function createParsingResultsKeyboardMock(
  projectId: number,
  parsingRunIds: number[]
): any {
  const buttons = parsingRunIds.map(id => [{
    text: `Запуск #${id}`,
    callback_data: `parsing_run_${id}`
  }]);

  buttons.push([{ text: "◀️ Назад", callback_data: `project_${projectId}` }]);

  return createInlineKeyboardMock(buttons);
}
