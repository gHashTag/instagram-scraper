/**
 * Моки обработчиков сцены проектов для тестирования
 */
import type { ScraperBotContext } from "../../types";
import { ScraperSceneStep } from "../../types";

/**
 * Обработчик входа в сцену проектов
 */
export const enterHandler = async (ctx: ScraperBotContext) => {
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

    if (!projects || projects.length === 0) {
      await ctx.reply(
        "У вас нет проектов. Создайте проект с помощью кнопки ниже.",
        {
          reply_markup: { inline_keyboard: [] }, // Мок для клавиатуры
        }
      );
    } else {
      await ctx.reply("Ваши проекты:", {
        reply_markup: { inline_keyboard: [] }, // Мок для клавиатуры
      });
    }

    await ctx.storage?.close();
  } catch (error) {
    console.error("Ошибка при получении проектов:", error);
    await ctx.reply(
      "Произошла ошибка при получении проектов. Пожалуйста, попробуйте позже."
    );
    await ctx.storage?.close();
    await ctx.scene.leave();
  }
};

/**
 * Обработчик выхода из сцены
 */
export const exitSceneHandler = async (ctx: ScraperBotContext) => {
  await ctx.answerCbQuery("Выход из режима управления проектами");
  await ctx.reply("Вы вышли из режима управления проектами", {
    reply_markup: { remove_keyboard: true },
  });
  return await ctx.scene.leave();
};

/**
 * Обработчик создания нового проекта
 */
export const createProjectHandler = async (ctx: ScraperBotContext) => {
  await ctx.answerCbQuery();
  await ctx.reply("Введите название нового проекта:", {
    reply_markup: { inline_keyboard: [] }, // Мок для клавиатуры
  });
  if (ctx.scene && ctx.scene.session) {
    ctx.scene.session.step = ScraperSceneStep.CREATE_PROJECT;
  } else if (ctx.scene) {
    (ctx.scene as any).session = { step: ScraperSceneStep.CREATE_PROJECT };
  }
};

/**
 * Обработчик возврата к списку проектов
 */
export const backToProjectsHandler = async (ctx: ScraperBotContext) => {
  await ctx.answerCbQuery();
  return await ctx.scene.reenter();
};

/**
 * Обработчик текстовых сообщений
 */
export const textMessageHandler = async (ctx: ScraperBotContext) => {
  // Проверка на наличие сцены и шага
  if (!ctx.scene || !ctx.scene.session) {
    await ctx.reply(
      "Я не понимаю эту команду. Используйте кнопки для управления проектами."
    );
    return;
  }

  // Если не установлен шаг, значит сцена в неверном состоянии
  if (!ctx.scene.session.step) {
    await ctx.reply(
      "Я не понимаю эту команду. Используйте кнопки для управления проектами."
    );
    return;
  }

  if (ctx.scene.session.step === ScraperSceneStep.CREATE_PROJECT) {
    if (!ctx.message || !("text" in ctx.message) || !ctx.message.text) {
      await ctx.reply("Пожалуйста, введите текстовое название проекта.");
      return;
    }

    const projectName = ctx.message.text.trim();

    if (projectName.length < 3) {
      await ctx.reply(
        "Название проекта должно содержать не менее 3 символов. Пожалуйста, попробуйте еще раз."
      );
      return;
    }

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

      const newProject = await ctx.storage?.createProject(user.id, projectName);

      if (newProject) {
        await ctx.reply(`Проект "${projectName}" успешно создан!`, {
          reply_markup: { inline_keyboard: [] }, // Мок для клавиатуры
        });
      } else {
        await ctx.reply(
          "Произошла ошибка при создании проекта. Пожалуйста, попробуйте позже."
        );
      }

      if (ctx.scene && ctx.scene.session) {
        ctx.scene.session.step = undefined;
      }
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
};
