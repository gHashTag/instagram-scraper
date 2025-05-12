import { Scenes /*, Markup*/ } from "telegraf";
import {
  ScraperBotContext,
  ScraperSceneStep,
  ScraperSceneSessionData,
  // Убедимся, что StorageAdapter импортирован, если он используется для приведения типа
  // StorageAdapter,
} from "@/types";
import { generateProjectsKeyboard } from "./components/project-keyboard";
import {
  generateProjectMenuKeyboard,
  generateNewProjectKeyboard,
} from "./components/project-keyboard";

// УДАЛЯЕМ ИМПОРТ И СОЗДАНИЕ ЭКЗЕМПЛЯРА NeonAdapter НА УРОВНЕ МОДУЛЯ
// import { NeonAdapter } from "../adapters/neon-adapter";
// const neonAdapter = new NeonAdapter();

// Для ясности, что мы ожидаем NeonAdapter в ctx.storage
import { NeonAdapter } from "../adapters/neon-adapter";

/**
 * Сцена для управления проектами
 */
export const projectScene = new Scenes.BaseScene<
  ScraperBotContext & { scene: { session: ScraperSceneSessionData } }
>("instagram_scraper_projects");

// Вход в сцену - показываем список проектов
projectScene.enter(async (ctx) => {
  // Используем адаптер из контекста
  const adapter = ctx.storage as NeonAdapter; // Приводим к NeonAdapter
  if (!adapter) {
    await ctx.reply("Ошибка: Адаптер хранилища не найден в контексте.");
    return ctx.scene.leave();
  }

  try {
    await adapter.initialize(); // Вызываем initialize на адаптере из контекста

    const user = await adapter.getUserByTelegramId(ctx.from?.id || 0);

    if (!user) {
      await ctx.reply(
        "Вы не зарегистрированы. Пожалуйста, используйте сначала основные команды бота."
      );
      // await adapter.close(); // Решение о close должно быть консистентным
      return ctx.scene.leave();
    }

    const projects = await adapter.getProjectsByUserId(user.id as number);

    await ctx.reply(
      projects && projects.length > 0
        ? // ? "Ваши проекты:"
          "Ваши проекты: Выберите проект для управления или создайте новый."
        : "У вас пока нет проектов. Хотите создать новый?",
      {
        reply_markup: generateProjectsKeyboard(projects || []).reply_markup,
      }
    );

    // await adapter.close(); // Решение о close должно быть консистентным
  } catch (error) {
    console.error("Ошибка при получении проектов:", error);
    await ctx.reply(
      "Произошла ошибка при получении проектов. Пожалуйста, попробуйте позже."
    );
    // await adapter.close();
    await ctx.scene.leave();
  }
});

// Обработка выхода из сцены
projectScene.action("exit_scene", async (ctx) => {
  await ctx.answerCbQuery("Выход из режима управления проектами");
  await ctx.reply("Вы вышли из режима управления проектами", {
    reply_markup: { remove_keyboard: true },
  });
  return ctx.scene.leave();
});

// Обработка создания нового проекта
projectScene.action("create_project", async (ctx) => {
  await ctx.reply("Введите название нового проекта (минимум 3 символа):");
  ctx.scene.session.step = ScraperSceneStep.CREATE_PROJECT;
  await ctx.answerCbQuery();
});

// Обработка текстовых сообщений
projectScene.on("text", async (ctx) => {
  const adapter = ctx.storage as NeonAdapter;
  if (!adapter) {
    await ctx.reply("Ошибка: Адаптер хранилища не найден в контексте.");
    // Не выходим из сцены, чтобы пользователь мог попробовать еще раз или выйти командой
    return;
  }

  if (ctx.scene.session.step === ScraperSceneStep.CREATE_PROJECT) {
    const projectName = ctx.message.text.trim();
    const telegramId = ctx.from?.id;
    if (projectName.length < 3) {
      await ctx.reply(
        "Название проекта должно содержать не менее 3 символов. Попробуйте еще раз:"
      );
      return;
    }

    try {
      await adapter.initialize();

      const user = await adapter.getUserByTelegramId(telegramId);
      if (!user) {
        await ctx.reply("Ошибка: пользователь не найден.");
        // await adapter.close();
        return ctx.scene.leave();
      }

      const project = await adapter.createProject(
        user.id as number,
        projectName
      );

      if (project) {
        await ctx.reply(
          `Проект \"${projectName}\" успешно создан!\nТеперь вы можете управлять им: добавить конкурентов или хештеги.`,
          {
            reply_markup: generateNewProjectKeyboard(project.id).reply_markup,
          }
        );
      } else {
        await ctx.reply("Ошибка при создании проекта. Попробуйте позже.");
      }
      ctx.scene.session.step = undefined;
      // await adapter.close();
    } catch (error) {
      console.error("Ошибка при создании проекта:", error);
      await ctx.reply(
        "Произошла ошибка при создании проекта. Пожалуйста, попробуйте позже."
      );
    }
  } else {
    await ctx.reply(
      "Я не понимаю эту команду. Используйте кнопки для управления проектами."
    );
  }
});

// Обработка возврата к списку проектов
projectScene.action("back_to_projects", async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.scene.reenter();
});

// Обработка выбора проекта
projectScene.action(/project_(\d+)/, async (ctx) => {
  const adapter = ctx.storage as NeonAdapter;
  if (!adapter) {
    await ctx.reply("Ошибка: Адаптер хранилища не найден в контексте.");
    return;
  }

  const projectId = parseInt(ctx.match[1]);
  await ctx.answerCbQuery();

  try {
    await adapter.initialize();
    const project = await adapter.getProjectById(projectId);

    if (project) {
      await ctx.reply(`Проект "${project.name}". Выберите действие:`, {
        reply_markup: generateProjectMenuKeyboard(projectId).reply_markup,
      });
    } else {
      await ctx.reply("Проект не найден. Возможно, он был удален.");
      await ctx.scene.reenter();
    }
    // await adapter.close();
  } catch (error) {
    console.error(`Ошибка при получении проекта ${projectId}:`, error);
    await ctx.reply(
      "Произошла ошибка при получении данных проекта. Пожалуйста, попробуйте позже."
    );
  }
});

// Обработка кнопки "Управлять хештегами"
projectScene.action(/manage_hashtags_(\d+)/, async (ctx) => {
  const projectId = parseInt(ctx.match[1], 10);

  if (isNaN(projectId)) {
    console.error(
      `Invalid projectId parsed from manage_hashtags action: ${ctx.match[1]}`
    );
    await ctx.reply("Ошибка выбора проекта.");
    await ctx.answerCbQuery();
    return;
  }

  // Сохраняем projectId в сессии для hashtagScene
  ctx.scene.session.projectId = projectId;

  await ctx.answerCbQuery(); // Отвечаем на нажатие кнопки
  await ctx.scene.enter("instagram_scraper_hashtags"); // Входим в сцену управления хештегами
});

// Добавить другие обработчики для действий scrape_project, show_reels и т.д.

export default projectScene;
