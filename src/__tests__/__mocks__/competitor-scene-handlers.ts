/**
 * Моки обработчиков сцены конкурентов для тестирования
 */
import type { ScraperBotContext } from "../../types";
import { ScraperSceneStep } from "../../types";

/**
 * Обработчик входа в сцену конкурентов
 */
export const enterHandler = async (ctx: ScraperBotContext) => {
  try {
    await ctx.storage?.initialize();

    const user = await ctx.storage?.getUserByTelegramId(ctx.from?.id || 0);

    if (!user) {
      await ctx.reply(
        "Вы не зарегистрированы. Пожалуйста, используйте /start для начала работы."
      );
      await ctx.storage?.close();
      return await ctx.scene.leave();
    }

    const projects = await ctx.storage?.getProjectsByUserId(user.id);

    if (!projects || projects.length === 0) {
      await ctx.reply(
        "У вас нет проектов. Создайте проект с помощью команды /projects"
      );
      await ctx.storage?.close();
      return await ctx.scene.leave();
    }

    // Если есть только один проект, сразу показываем конкурентов
    if (projects.length === 1) {
      const competitors = await ctx.storage?.getCompetitorAccounts(
        projects[0].id
      );

      if (!competitors || competitors.length === 0) {
        await ctx.reply(
          `В проекте "${projects[0].name}" нет добавленных конкурентов. Хотите добавить?`,
          {
            reply_markup: { inline_keyboard: [] }, // Мок для клавиатуры
          }
        );
      } else {
        const competitorList = competitors
          .map(
            (c: { username: string; instagram_url: string }, i: number) =>
              `${i + 1}. [${c.username}](${c.instagram_url})`
          )
          .join("\n");

        await ctx.reply(
          `Конкуренты в проекте "${projects[0].name}":\n\n${competitorList}`,
          {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [] }, // Мок для клавиатуры
          }
        );
      }
    } else {
      // Если несколько проектов, просим выбрать
      await ctx.reply("Выберите проект для просмотра конкурентов:", {
        reply_markup: { inline_keyboard: [] }, // Мок для клавиатуры
      });
    }

    await ctx.storage?.close();
  } catch (error) {
    console.error("Ошибка при получении конкурентов:", error);
    await ctx.reply(
      "Произошла ошибка при получении конкурентов. Пожалуйста, попробуйте позже."
    );
    await ctx.storage?.close();
    await ctx.scene.leave();
  }
};

/**
 * Обработчик выбора проекта для просмотра конкурентов
 */
export const competitorsProjectHandler = async (
  ctx: ScraperBotContext,
  projectId: number
) => {
  try {
    await ctx.storage?.initialize();

    const competitors = await ctx.storage?.getCompetitorAccounts(projectId);

    if (!competitors || competitors.length === 0) {
      await ctx.reply(
        "В выбранном проекте нет добавленных конкурентов. Хотите добавить?",
        {
          reply_markup: { inline_keyboard: [] }, // Мок для клавиатуры
        }
      );
    } else {
      const competitorList = competitors
        .map(
          (c: { username: string; instagram_url: string }, i: number) =>
            `${i + 1}. [${c.username}](${c.instagram_url})`
        )
        .join("\n");

      await ctx.reply(`Конкуренты в выбранном проекте:\n\n${competitorList}`, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [] }, // Мок для клавиатуры
      });
    }

    await ctx.storage?.close();
  } catch (error) {
    console.error(
      `Ошибка при получении конкурентов проекта ${projectId}:`,
      error
    );
    await ctx.reply(
      "Произошла ошибка при получении конкурентов. Пожалуйста, попробуйте позже."
    );
    await ctx.storage?.close();
  }

  await ctx.answerCbQuery();
};

/**
 * Обработчик инициирования добавления нового конкурента
 */
export const addCompetitorHandler = async (
  ctx: ScraperBotContext,
  projectId: number
) => {
  ctx.scene.session.projectId = projectId;

  await ctx.reply(
    "Введите Instagram URL конкурента (например, https://www.instagram.com/example):"
  );
  ctx.scene.session.step = ScraperSceneStep.ADD_COMPETITOR;

  await ctx.answerCbQuery();
};

/**
 * Обработчик текстовых сообщений - добавление конкурента
 */
export const textMessageHandler = async (ctx: ScraperBotContext) => {
  if (ctx.scene.session.step === ScraperSceneStep.ADD_COMPETITOR) {
    // Проверяем наличие сообщения и текста
    if (!ctx.message || !("text" in ctx.message) || !ctx.message.text) {
      await ctx.reply(
        "Ошибка: пожалуйста, отправьте текстовое сообщение с URL Instagram-аккаунта"
      );
      return;
    }

    const instagramUrl = ctx.message.text.trim();
    const projectId = ctx.scene.session.projectId;

    if (!projectId) {
      await ctx.reply("Ошибка: не указан проект. Начните сначала.");
      return await ctx.scene.reenter();
    }

    if (!instagramUrl.includes("instagram.com/")) {
      await ctx.reply(
        "Пожалуйста, введите корректный URL Instagram-аккаунта (например, https://www.instagram.com/example):"
      );
      return;
    }

    try {
      await ctx.storage?.initialize();

      // Извлекаем имя пользователя из URL
      const urlParts = instagramUrl.split("/");
      const username = urlParts[urlParts.length - 1].split("?")[0];

      const competitor = await ctx.storage?.addCompetitorAccount(
        projectId,
        username,
        instagramUrl
      );

      if (competitor) {
        await ctx.reply(`Конкурент @${username} успешно добавлен!`, {
          reply_markup: { inline_keyboard: [] }, // Мок для клавиатуры
        });
      } else {
        await ctx.reply("Ошибка при добавлении конкурента. Попробуйте позже.");
      }

      // Сбрасываем шаг
      ctx.scene.session.step = undefined;
      await ctx.storage?.close();
      return;
    } catch (error) {
      console.error("Ошибка при добавлении конкурента:", error);
      await ctx.reply(
        "Произошла ошибка при добавлении конкурента. Пожалуйста, попробуйте позже."
      );
      await ctx.storage?.close();
      return;
    }
  } else {
    await ctx.reply(
      "Я не понимаю эту команду. Используйте кнопки для управления конкурентами."
    );
    return;
  }
};

/**
 * Обработчик выхода из сцены
 */
export const exitSceneHandler = async (ctx: ScraperBotContext) => {
  await ctx.answerCbQuery("Выход из режима управления конкурентами");
  await ctx.reply("Вы вышли из режима управления конкурентами", {
    reply_markup: { remove_keyboard: true },
  });
  return await ctx.scene.leave();
};

/**
 * Обработчик возврата к проектам
 */
export const backToProjectsHandler = async (ctx: ScraperBotContext) => {
  await ctx.answerCbQuery();
  return await ctx.scene.reenter();
};