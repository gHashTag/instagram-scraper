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

// ИМПОРТИРУЕМ NeonAdapter
import { NeonAdapter } from "../adapters/neon-adapter";

/**
 * Сцена для управления проектами
 */
export const projectScene = new Scenes.BaseScene<
  ScraperBotContext & { scene: { session: ScraperSceneSessionData } }
>("instagram_scraper_projects");

// СОЗДАЕМ ЭКЗЕМПЛЯР АДАПТЕРА
const neonAdapter = new NeonAdapter();

// Вход в сцену - показываем список проектов
projectScene.enter(async (ctx) => {
  try {
    // Используем neonAdapter
    await neonAdapter.initialize();

    const user = await neonAdapter.getUserByTelegramId(ctx.from?.id || 0);

    if (!user) {
      await ctx.reply(
        "Вы не зарегистрированы. Пожалуйста, используйте сначала основные команды бота."
      );
      await neonAdapter.close();
      return ctx.scene.leave();
    }

    const projects = await neonAdapter.getProjectsByUserId(user.id as number); // Приведение типа

    await ctx.reply(
      projects && projects.length > 0
        ? "Ваши проекты:"
        : "У вас пока нет проектов. Хотите создать новый?",
      {
        reply_markup: generateProjectsKeyboard(projects || []).reply_markup,
      }
    );

    await neonAdapter.close();
  } catch (error) {
    console.error("Ошибка при получении проектов:", error);
    await ctx.reply(
      "Произошла ошибка при получении проектов. Пожалуйста, попробуйте позже."
    );
    // neonAdapter.close(); // Уже закрывается в try или не должен если ошибка не связана с ним
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
      // Используем neonAdapter
      await neonAdapter.initialize();

      const user = await neonAdapter.getUserByTelegramId(ctx.from.id);
      if (!user) {
        await ctx.reply("Ошибка: пользователь не найден.");
        await neonAdapter.close();
        return ctx.scene.leave();
      }

      const projectName = ctx.message.text.trim();
      if (projectName.length < 3) {
        await ctx.reply(
          "Название проекта должно содержать не менее 3 символов. Попробуйте еще раз:"
        );
        return; // Не закрываем адаптер, т.к. пользователь может попробовать еще раз
      }

      const project = await neonAdapter.createProject(
        user.id as number,
        projectName
      ); // Приведение типа

      if (project) {
        await ctx.reply(`Проект "${projectName}" успешно создан!`, {
          reply_markup: generateNewProjectKeyboard(project.id).reply_markup,
        });
      } else {
        await ctx.reply("Ошибка при создании проекта. Попробуйте позже.");
      }

      // Сбрасываем шаг
      ctx.scene.session.step = undefined;
      await neonAdapter.close();
    } catch (error) {
      console.error("Ошибка при создании проекта:", error);
      await ctx.reply(
        "Произошла ошибка при создании проекта. Пожалуйста, попробуйте позже."
      );
      // neonAdapter.close(); // Если ошибка, возможно, не стоит закрывать, или в finally
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
  const projectId = parseInt(ctx.match[1]);
  await ctx.answerCbQuery();

  try {
    // Используем neonAdapter
    await neonAdapter.initialize();

    const project = await neonAdapter.getProjectById(projectId);

    if (project) {
      await ctx.reply(`Проект "${project.name}". Выберите действие:`, {
        reply_markup: generateProjectMenuKeyboard(projectId).reply_markup,
      });
    } else {
      await ctx.reply("Проект не найден. Возможно, он был удален.");
      await ctx.scene.reenter(); // Re-enter покажет обновленный список или сообщение об отсутствии проектов
    }

    await neonAdapter.close();
  } catch (error) {
    console.error(`Ошибка при получении проекта ${projectId}:`, error);
    await ctx.reply(
      "Произошла ошибка при получении данных проекта. Пожалуйста, попробуйте позже."
    );
    // neonAdapter.close();
  }
});

// Добавить другие обработчики для действий add_competitor, add_hashtag, scrape_project и т.д.

export default projectScene;
