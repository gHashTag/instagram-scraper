import { Scenes, Markup } from "telegraf";
import { ScraperBotContext } from "../types";
import { NeonAdapter } from "../adapters/neon-adapter";
import { ScraperSceneStep, ScraperSceneSessionData } from "@/types";
import { User } from "../types";

/**
 * Обработчик действия для удаления конкурента.
 */
export const handleDeleteCompetitorAction = async (
  ctx: ScraperBotContext & { match: RegExpExecArray }
) => {
  const adapter = ctx.storage as NeonAdapter;
  const projectId = parseInt(ctx.match[1], 10);
  const username = ctx.match[2];

  if (isNaN(projectId) || !username) {
    console.error(
      `Invalid data parsed from delete action: projectId=${ctx.match[1]}, username=${ctx.match[2]}`
    );
    await ctx.reply(
      "Ошибка при удалении конкурента. Пожалуйста, попробуйте снова."
    );
    await ctx.answerCbQuery("Ошибка");
    return;
  }

  let success = false;
  try {
    await adapter.initialize();
    success = await adapter.deleteCompetitorAccount(projectId, username);

    if (success) {
      await ctx.reply(`Конкурент "${username}" успешно удален из проекта.`);
      await ctx.editMessageReplyMarkup(undefined);
      await ctx.answerCbQuery("Удалено");
    } else {
      await ctx.reply(
        `Не удалось найти или удалить конкурента "${username}". Возможно, он уже был удален.`
      );
      await ctx.answerCbQuery("Ошибка удаления");
    }
  } catch (error) {
    console.error(
      `Ошибка при удалении конкурента ${username} из проекта ${projectId}:`,
      error
    );
    await ctx.reply(
      "Произошла техническая ошибка при удалении конкурента. Попробуйте позже."
    );
    await ctx.answerCbQuery("Ошибка");
  } finally {
    if (adapter) {
      await adapter.close();
    }
  }
};

/**
 * Сцена для управления конкурентами
 */
export const competitorScene = new Scenes.BaseScene<
  ScraperBotContext & { scene: { session: ScraperSceneSessionData } }
>("instagram_scraper_competitors");

// Вход в сцену - выбор проекта или показ конкурентов если проект один
competitorScene.enter(async (ctx) => {
  const adapter = ctx.storage as NeonAdapter;
  try {
    // Используем adapter вместо neonAdapter
    await adapter.initialize();

    const user = await adapter.getUserByTelegramId(ctx.from?.id || 0);

    if (!user) {
      await ctx.reply(
        "Вы не зарегистрированы. Пожалуйста, используйте /start для начала работы."
      );
      await adapter.close();
      return ctx.scene.leave(); // Явный return
    }

    const projects = await adapter.getProjectsByUserId(user.id as number); // Приведение типа user.id

    if (!projects || projects.length === 0) {
      await ctx.reply(
        "У вас нет проектов. Создайте проект с помощью команды /projects"
      );
      await adapter.close();
      return ctx.scene.leave(); // Явный return
    }

    // Если есть только один проект, сразу показываем конкурентов
    if (projects.length === 1) {
      const competitors = await adapter.getCompetitorAccounts(projects[0].id);

      if (!competitors || competitors.length === 0) {
        await ctx.reply(
          `В проекте "${projects[0].name}" нет добавленных конкурентов. Хотите добавить?`,
          {
            reply_markup: Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "Добавить конкурента",
                  `add_competitor_${projects[0].id}`
                ),
              ],
              [Markup.button.callback("Выйти", "exit_scene")],
            ]).reply_markup,
          }
        );
      } else {
        const competitorList = competitors
          .map((c, i) => `${i + 1}. [${c.username}](${c.instagram_url})`)
          .join("\n");

        // Формируем клавиатуру с кнопками удаления
        const competitorButtons = competitors.map((c) => [
          Markup.button.callback(
            `🗑️ Удалить ${c.username}`,
            `delete_competitor_${projects[0].id}_${c.username}`
          ),
        ]);

        await ctx.reply(
          `Конкуренты в проекте "${projects[0].name}":\n\n${competitorList}\n\nЧто вы хотите сделать дальше?`,
          {
            parse_mode: "Markdown",
            reply_markup: Markup.inlineKeyboard([
              ...competitorButtons, // Добавляем кнопки удаления
              [
                Markup.button.callback(
                  "Добавить конкурента",
                  `add_competitor_${projects[0].id}`
                ),
              ],
              [Markup.button.callback("Выйти", "exit_scene")],
            ]).reply_markup,
          }
        );
      }
    } else {
      // Если несколько проектов, просим выбрать
      const projectButtons = projects.map((project) => [
        Markup.button.callback(
          project.name,
          `competitors_project_${project.id}`
        ),
      ]);

      projectButtons.push([Markup.button.callback("Выйти", "exit_scene")]);

      await ctx.reply("Выберите проект для просмотра конкурентов:", {
        reply_markup: Markup.inlineKeyboard(projectButtons).reply_markup,
      });
    }

    await adapter.close();
  } catch (error) {
    console.error("Ошибка при получении конкурентов:", error);
    await ctx.reply(
      "Не удалось загрузить данные для управления конкурентами. Попробуйте позже или обратитесь в поддержку."
    );
    // await adapter.close(); // Закрываем в finally или если ошибка не связана с адаптером
    await ctx.scene.leave();
  }
});

/**
 * Обработчик выбора проекта для просмотра конкурентов
 */
export async function handleCompetitorsProjectAction(
  ctx: ScraperBotContext & { match: RegExpExecArray }
) {
  const adapter = ctx.storage as NeonAdapter;
  const projectId = parseInt(ctx.match![1]); // ctx.match гарантированно есть по логике action

  try {
    await adapter.initialize();

    const competitors = await adapter.getCompetitorAccounts(projectId);

    if (!competitors || competitors.length === 0) {
      await ctx.reply(
        "В выбранном проекте нет добавленных конкурентов. Хотите добавить?",
        {
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "Добавить конкурента",
                `add_competitor_${projectId}`
              ),
            ],
            [Markup.button.callback("Назад к проектам", "back_to_projects")],
            [Markup.button.callback("Выйти", "exit_scene")],
          ]).reply_markup,
        }
      );
    } else {
      const competitorList = competitors
        .map((c, i) => `${i + 1}. [${c.username}](${c.instagram_url})`)
        .join("\n");

      // Формируем клавиатуру с кнопками удаления
      const competitorButtons = competitors.map((c) => [
        Markup.button.callback(
          `🗑️ Удалить ${c.username}`,
          `delete_competitor_${projectId}_${c.username}`
        ),
      ]);

      await ctx.reply(
        `Конкуренты в выбранном проекте:\n\n${competitorList}\n\nЧто вы хотите сделать дальше?`,
        {
          parse_mode: "Markdown",
          reply_markup: Markup.inlineKeyboard([
            ...competitorButtons, // Добавляем кнопки удаления
            [
              Markup.button.callback(
                "Добавить конкурента",
                `add_competitor_${projectId}`
              ),
            ],
            [Markup.button.callback("Назад к проектам", "back_to_projects")],
            [Markup.button.callback("Выйти", "exit_scene")],
          ]).reply_markup,
        }
      );
    }

    await adapter.close();
  } catch (error) {
    console.error(
      `Ошибка при получении конкурентов проекта ${projectId}:`,
      error
    );
    await ctx.reply(
      "Не удалось загрузить список конкурентов для этого проекта. Попробуйте позже или обратитесь в поддержку."
    );
    // await adapter.close();
  }

  await ctx.answerCbQuery();
}

/**
 * Обработчик инициирования добавления нового конкурента
 */
export async function handleAddCompetitorAction(
  ctx: ScraperBotContext & { match: RegExpExecArray }
) {
  const projectId = parseInt(ctx.match![1]);

  if (isNaN(projectId)) {
    console.error(`Invalid projectId parsed from action: ${ctx.match![1]}`);
    await ctx.reply(
      "Ошибка выбора проекта. Пожалуйста, вернитесь назад и выберите проект снова."
    );
    await ctx.answerCbQuery();
    return;
  }

  ctx.scene.session.projectId = projectId;
  await ctx.reply(
    "Введите Instagram URL конкурента (например, https://www.instagram.com/example):"
  );
  ctx.scene.session.step = ScraperSceneStep.ADD_COMPETITOR;
  await ctx.answerCbQuery();
}

/**
 * Обработчик текстовых сообщений для competitorScene
 */
export async function handleCompetitorText(
  ctx: ScraperBotContext & {
    scene: {
      session: ScraperSceneSessionData;
      leave: () => void;
      reenter: () => void;
    };
    message: { text: string };
  }
) {
  const adapter = ctx.storage as NeonAdapter;
  if (ctx.scene.session.step === ScraperSceneStep.ADD_COMPETITOR) {
    const instagramUrl = ctx.message.text.trim();
    const projectId = ctx.scene.session.projectId;

    let user: User | null = null;

    if (!projectId) {
      await ctx.reply("Ошибка: не указан проект. Начните сначала.");
      return ctx.scene.reenter(); // Используем reenter, чтобы пользователь мог попробовать снова в той же сцене
    }

    if (!instagramUrl.toLowerCase().includes("instagram.com/")) {
      await ctx.reply(
        "Пожалуйста, введите корректный URL Instagram-аккаунта (например, https://www.instagram.com/example):"
      );
      return;
    }

    try {
      await adapter.initialize();
      user = await adapter.getUserByTelegramId(ctx.from?.id || 0);
      if (!user) {
        console.error(
          `Error in onText handler: User not found for telegramId: ${ctx.from?.id}`
        );
        await ctx.reply(
          "Ошибка: Пользователь не найден. Пожалуйста, используйте /start."
        );
        ctx.scene.session.step = undefined;
        // await adapter.close(); // Закрываем в finally
        return ctx.scene.leave();
      }

      let username = instagramUrl.substring(instagramUrl.lastIndexOf("/") + 1);
      username = username.split("?")[0];
      if (username.endsWith("/")) {
        username = username.slice(0, -1);
      }

      if (!username) {
        await ctx.reply(
          "Не удалось извлечь имя пользователя из URL. Пожалуйста, проверьте URL и попробуйте снова."
        );
        return;
      }

      const competitor = await adapter.addCompetitorAccount(
        projectId,
        username,
        instagramUrl
      );

      if (competitor) {
        const successMessage = `Конкурент @${username} успешно добавлен!`;
        const successKeyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "Посмотреть всех конкурентов",
              `competitors_project_${projectId}`
            ),
          ],
          [
            Markup.button.callback(
              "Добавить еще конкурента",
              `add_competitor_${projectId}`
            ),
          ],
          [Markup.button.callback("Выйти", "exit_scene")],
        ]);
        await ctx.reply(successMessage, {
          reply_markup: successKeyboard.reply_markup,
        });
      } else {
        const errorMessage = `Не удалось добавить конкурента @${username}. Возможно, он уже добавлен или произошла ошибка базы данных.`;
        await ctx.reply(errorMessage);
      }
      ctx.scene.session.step = undefined;
    } catch (error) {
      console.error("Ошибка при добавлении конкурента в сцене:", error);
      await ctx.reply(
        "Произошла внутренняя ошибка при добавлении конкурента. Попробуйте позже."
      );
      ctx.scene.session.step = undefined;
    } finally {
      if (adapter && typeof adapter.close === "function") {
        await adapter.close();
      }
    }
  } else {
    return;
  }
}

// Обработка текстовых сообщений
competitorScene.on("text", handleCompetitorText);

/**
 * Обработчик кнопки "Выйти"
 */
export async function handleExitCompetitorSceneAction(ctx: ScraperBotContext) {
  await ctx.reply("Вы вышли из режима управления конкурентами.", {
    reply_markup: { remove_keyboard: true },
  });
  await ctx.scene.leave();
  await ctx.answerCbQuery();
}

/**
 * Обработчик кнопки "Назад к проектам"
 */
export async function handleBackToProjectsCompetitorAction(
  ctx: ScraperBotContext
) {
  await ctx.scene.reenter();
  await ctx.answerCbQuery();
}

// Регистрация обработчиков в сцене
competitorScene.action(
  /competitors_project_(\d+)/,
  handleCompetitorsProjectAction
);
competitorScene.action(/add_competitor_(\d+)/, handleAddCompetitorAction);
competitorScene.action("exit_scene", handleExitCompetitorSceneAction);
competitorScene.action(
  "back_to_projects",
  handleBackToProjectsCompetitorAction
);
competitorScene.action(
  /delete_competitor_(\d+)_(.+)/,
  handleDeleteCompetitorAction
);

export default competitorScene;
