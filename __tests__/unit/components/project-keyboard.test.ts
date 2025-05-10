import { describe, it, expect, vi } from "vitest";
import {
  generateProjectsKeyboard,
  generateProjectMenuKeyboard,
  generateNewProjectKeyboard,
} from "../../../scenes/components/project-keyboard";

// Мокируем Markup из Telegraf
vi.mock("telegraf", () => {
  return {
    Markup: {
      inlineKeyboard: (buttons: any) => ({
        reply_markup: { inline_keyboard: buttons },
      }),
      button: {
        callback: (text: any, data: any) => ({
          text,
          callback_data: data,
        }),
        url: (text: any, url: any) => ({
          text,
          url,
        }),
      },
    },
  };
});

// Импортируем наш модуль для тестирования
import "../../setup";

describe("Project Keyboard", () => {
  it("should generate projects keyboard", () => {
    const projects = [
      {
        id: 1,
        user_id: 1,
        name: "Project 1",
        created_at: "2023-01-01T00:00:00Z",
        is_active: true,
      },
      {
        id: 2,
        user_id: 1,
        name: "Project 2",
        created_at: "2023-01-01T00:00:00Z",
        is_active: true,
      },
    ];

    const keyboard = generateProjectsKeyboard(projects);

    expect(keyboard.reply_markup.inline_keyboard).toHaveLength(4); // 2 проекта + кнопки создания и выхода
    expect((keyboard.reply_markup.inline_keyboard[0][0] as any).text).toBe(
      "Project 1 (Активен)"
    );
    expect(
      (keyboard.reply_markup.inline_keyboard[0][0] as any).callback_data
    ).toBe("project_1");
    expect((keyboard.reply_markup.inline_keyboard[1][0] as any).text).toBe(
      "Project 2 (Активен)"
    );
    expect(
      (keyboard.reply_markup.inline_keyboard[1][0] as any).callback_data
    ).toBe("project_2");
    expect((keyboard.reply_markup.inline_keyboard[2][0] as any).text).toBe(
      "Создать новый проект"
    );
    expect((keyboard.reply_markup.inline_keyboard[3][0] as any).text).toBe(
      "Выйти"
    );
  });

  it("should generate project menu keyboard", () => {
    const projectId = 1;
    const keyboard = generateProjectMenuKeyboard(projectId);

    expect(keyboard.reply_markup.inline_keyboard).toHaveLength(5); // 5 кнопок
    expect(keyboard.reply_markup.inline_keyboard[0][0].text).toBe(
      "Добавить конкурента"
    );
    expect(keyboard.reply_markup.inline_keyboard[1][0].text).toBe(
      "Добавить хэштег"
    );
    expect(keyboard.reply_markup.inline_keyboard[2][0].text).toBe(
      "Запустить скрапинг"
    );
    expect(keyboard.reply_markup.inline_keyboard[3][0].text).toBe(
      "Просмотреть Reels"
    );
    expect(keyboard.reply_markup.inline_keyboard[4][0].text).toBe(
      "Назад к проектам"
    );
  });

  it("should generate new project keyboard", () => {
    const projectId = 1;
    const keyboard = generateNewProjectKeyboard(projectId);

    expect(keyboard.reply_markup.inline_keyboard).toHaveLength(3);
    expect(keyboard.reply_markup.inline_keyboard[0][0].text).toBe(
      "К списку проектов"
    );
    expect(keyboard.reply_markup.inline_keyboard[1][0].text).toBe(
      "Добавить конкурента"
    );
    expect(keyboard.reply_markup.inline_keyboard[2][0].text).toBe(
      "Добавить хэштег"
    );
  });
});
