import { Markup } from "telegraf";
import type { Project } from "@/types"; // Раскомментировано и исправлен путь

/**
 * Генерирует inline клавиатуру для списка проектов
 * @param projects Массив проектов
 * @returns Объект с reply_markup для Telegraf
 */
export function generateProjectsKeyboard(projects: Project[]) {
  if (!projects || projects.length === 0) {
    return Markup.inlineKeyboard([
      [Markup.button.callback("Создать проект", "create_project")],
      [Markup.button.callback("Выйти", "exit_scene")],
    ]);
  }

  const projectButtons = projects.map((project) => [
    Markup.button.callback(
      `${project.name} (${project.is_active ? "Активен" : "Неактивен"})`,
      `project_${project.id}`
    ),
  ]);

  projectButtons.push([
    Markup.button.callback("Создать новый проект", "create_project"),
  ]);
  projectButtons.push([Markup.button.callback("Выйти", "exit_scene")]);

  return Markup.inlineKeyboard(projectButtons);
}

/**
 * Генерирует inline клавиатуру для управления конкретным проектом
 * @param projectId ID проекта
 * @returns Объект с reply_markup для Telegraf
 */
export function generateProjectMenuKeyboard(projectId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "👥 Управлять конкурентами",
        `competitors_project_${projectId}`
      ),
    ],
    [
      Markup.button.callback(
        "📊 Управлять хештегами",
        `manage_hashtags_${projectId}`
      ),
    ],
    [
      Markup.button.callback(
        "▶️ Запустить скрапинг",
        `scrape_project_${projectId}`
      ),
    ],
    [
      Markup.button.callback(
        "👀 Просмотр Reels",
        `reels_list_${projectId}`
      ),
    ],
    [
      Markup.button.callback(
        "📋 Коллекции Reels",
        `collections_project_${projectId}`
      ),
    ],

    [Markup.button.callback("🔙 Назад к проектам", "back_to_projects")],
  ]);
}

/**
 * Генерирует inline клавиатуру после создания проекта
 * @param projectId ID нового проекта
 * @returns Объект с reply_markup для Telegraf
 */
export function generateNewProjectKeyboard(projectId: number) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🔙 К списку проектов", "back_to_projects")],
    [
      Markup.button.callback(
        "👥 Добавить конкурента",
        `add_competitor_${projectId}`
      ),
    ],
    [Markup.button.callback("📊 Добавить хештег", `add_hashtag_${projectId}`)],
  ]);
}
