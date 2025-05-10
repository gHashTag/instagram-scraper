import { Scenes /*, Markup*/ } from "telegraf";
import {
  ScraperBotContext,
  ScraperSceneStep,
  ScraperSceneSessionData,
} from "@/types";
import { generateProjectsKeyboard } from "./components/project-keyboard";
import {
  generateProjectMenuKeyboard,
  generateNewProjectKeyboard,
} from "./components/project-keyboard";

/**
 * Сцена для управления проектами
 */
export const projectScene = new Scenes.BaseScene<
  ScraperBotContext & { scene: { session: ScraperSceneSessionData } }
>("instagram_scraper_projects");

// Вход в сцену - показываем список проектов
projectScene.enter(async (ctx) => {
  try {
    await ctx.storage?.initialize();

    const user = await ctx.storage?.getUserByTelegramId(ctx.from?.id || 0);

    if (!user) {
      await ctx.reply(
        "Вы не зарегистрированы. Пожалуйста, используйте сначала основные команды бота."
      );
      await ctx.storage?.close();
      return await ctx.scene.leave();
    }

    const projects = await ctx.storage?.getProjectsByUserId(user.id);

    await ctx.reply(
      projects && projects.length > 0
        ? "Ваши проекты:"
        : "У вас пока нет проектов. Хотите создать новый?",
      {
        reply_markup: generateProjectsKeyboard(projects || []).reply_markup,
      }
    );

    await ctx.storage?.close();
  } catch (error) {
    console.error("Ошибка при получении проектов:", error);
    await ctx.reply(
      "Произошла ошибка при получении проектов. Пожалуйста, попробуйте позже."
    );
    await ctx.storage?.close();
    await ctx.scene.leave();
  }
});

// Обработка выхода из сцены
projectScene.action("exit_scene", async (ctx) => {
  await ctx.answerCbQuery("Выход из режима управления проектами");
  await ctx.reply("Вы вышли из режима управления проектами", {
    reply_markup: { remove_keyboard: true },
  });
  return await ctx.scene.leave();
});

// Обработка создания нового проекта
projectScene.action("create_project", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    "Введите название нового проекта (например, 'Мой косметологический центр'):"
  );
  // Устанавливаем следующий шаг - ожидание ввода названия проекта
  ctx.scene.session.step = ScraperSceneStep.ADD_PROJECT;
});

// Обработка текстовых сообщений
projectScene.on("text", async (ctx) => {
  // Обработка шага создания проекта
  if (ctx.scene.session.step === ScraperSceneStep.ADD_PROJECT) {
    try {
      await ctx.storage?.initialize();

      const user = await ctx.storage?.getUserByTelegramId(ctx.from.id);
      if (!user) {
        await ctx.reply("Ошибка: пользователь не найден.");
        await ctx.storage?.close();
        return await ctx.scene.leave();
      }

      const projectName = ctx.message.text.trim();
      if (projectName.length < 3) {
        await ctx.reply(
          "Название проекта должно содержать не менее 3 символов. Попробуйте еще раз:"
        );
        return;
      }

      const project = await ctx.storage?.createProject(user.id, projectName);

      if (project) {
        await ctx.reply(`Проект "${projectName}" успешно создан!`, {
          reply_markup: generateNewProjectKeyboard(project.id).reply_markup,
        });
      } else {
        await ctx.reply("Ошибка при создании проекта. Попробуйте позже.");
      }

      // Сбрасываем шаг
      ctx.scene.session.step = undefined;
      await ctx.storage?.close();
    } catch (error) {
      console.error("Ошибка при создании проекта:", error);
      await ctx.reply(
        "Произошла ошибка при создании проекта. Пожалуйста, попробуйте позже."
      );
      await ctx.storage?.close();
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
  return await ctx.scene.reenter();
});

// Обработка выбора проекта
projectScene.action(/project_(\d+)/, async (ctx) => {
  const projectId = parseInt(ctx.match[1]);
  await ctx.answerCbQuery();

  try {
    await ctx.storage?.initialize();
    // Здесь можно загрузить детали проекта и показать меню управления
    const project = await ctx.storage?.getProjectById(projectId);

    if (project) {
      await ctx.reply(`Проект "${project.name}". Выберите действие:`, {
        reply_markup: generateProjectMenuKeyboard(projectId).reply_markup,
      });
    } else {
      await ctx.reply("Проект не найден. Возможно, он был удален.");
      await ctx.scene.reenter();
    }

    await ctx.storage?.close();
  } catch (error) {
    console.error(`Ошибка при получении проекта ${projectId}:`, error);
    await ctx.reply(
      "Произошла ошибка при получении данных проекта. Пожалуйста, попробуйте позже."
    );
    await ctx.storage?.close();
  }
});

// Добавить другие обработчики для действий add_competitor, add_hashtag, scrape_project и т.д.

export default projectScene;
