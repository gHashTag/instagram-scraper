import { Scenes, Markup } from "telegraf";
import { ScraperBotContext } from "../types";
import { NeonAdapter } from "../adapters/neon-adapter";
import { ScraperSceneStep, ScraperSceneSessionData } from "@/types";
import {
  isValidInstagramUrl,
  extractUsernameFromUrl,
} from "../utils/validation";

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
export async function handleCompetitorEnter(ctx: ScraperBotContext) {
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
        // Добавляем логирование для отладки
        console.log(`Отображение кнопок для проекта ${projects[0].id} (${projects[0].name})`);

        await ctx.reply(
          `В проекте "${projects[0].name}" нет добавленных конкурентов. Хотите добавить?`,
          {
            reply_markup: Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "➕ Добавить конкурента",
                  `add_competitor_${projects[0].id}`
                ),
              ],
              [Markup.button.callback("❌ Выйти", "exit_scene")],
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

  } catch (error) {
    console.error("Ошибка при получении конкурентов:", error);
    await ctx.reply(
      "Не удалось загрузить данные для управления конкурентами. Попробуйте позже или обратитесь в поддержку."
    );
    await ctx.scene.leave();
  } finally {
    try {
      if (adapter && typeof adapter.close === "function") {
        await adapter.close();
      }
    } catch (closeError) {
      console.error("Ошибка при закрытии соединения с базой данных:", closeError);
    }
  }
}

competitorScene.enter(handleCompetitorEnter);

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

      // Формируем клавиатуру с кнопками для каждого конкурента
      const competitorButtons = competitors.map((c) => [
        Markup.button.callback(
          `${c.username}`,
          `competitor_${projectId}_${c.id}`
        ),
        Markup.button.callback(
          `👀`,
          `reels_list_${projectId}_competitor_${c.id}`
        ),
        Markup.button.callback(
          `🗑️`,
          `delete_competitor_${projectId}_${c.username}`
        ),
      ]);

      await ctx.reply(
        `Конкуренты в выбранном проекте:\n\n${competitorList}\n\nВыберите конкурента для действий или используйте кнопки ниже:`,
        {
          parse_mode: "Markdown",
          reply_markup: Markup.inlineKeyboard([
            ...competitorButtons, // Добавляем кнопки для каждого конкурента
            [
              Markup.button.callback(
                "➕ Добавить конкурента",
                `add_competitor_${projectId}`
              ),
            ],
            [Markup.button.callback("🔙 Назад к проектам", "back_to_projects")],
            [Markup.button.callback("❌ Выйти", "exit_scene")],
          ]).reply_markup,
        }
      );
    }

  } catch (error) {
    console.error(
      `Ошибка при получении конкурентов проекта ${projectId}:`,
      error
    );
    await ctx.reply(
      "Не удалось загрузить список конкурентов для этого проекта. Попробуйте позже или обратитесь в поддержку."
    );
  } finally {
    try {
      if (adapter && typeof adapter.close === "function") {
        await adapter.close();
      }
    } catch (closeError) {
      console.error("Ошибка при закрытии соединения с базой данных:", closeError);
    }
  }

  await ctx.answerCbQuery();
}

/**
 * Обработчик инициирования добавления нового конкурента
 */
export async function handleAddCompetitorAction(
  ctx: ScraperBotContext & { match: RegExpExecArray }
) {
  console.log("[DEBUG] Обработчик кнопки 'Добавить конкурента' вызван");
  console.log("[DEBUG] match:", ctx.match);

  try {
    const projectId = parseInt(ctx.match![1]);
    console.log(`[DEBUG] Извлеченный projectId: ${projectId}`);

    if (isNaN(projectId)) {
      console.error(`Invalid projectId parsed from action: ${ctx.match![1]}`);
      await ctx.reply(
        "Ошибка выбора проекта. Пожалуйста, вернитесь назад и выберите проект снова."
      );
      await ctx.answerCbQuery();
      return;
    }

    console.log(`[DEBUG] Установка projectId в сессии: ${projectId}`);
    ctx.scene.session.projectId = projectId;

    await ctx.reply(
      "Введите Instagram URL конкурента (например, https://www.instagram.com/example):"
    );

    console.log(`[DEBUG] Установка шага в сессии: ${ScraperSceneStep.ADD_COMPETITOR}`);
    ctx.scene.session.step = ScraperSceneStep.ADD_COMPETITOR;

    await ctx.answerCbQuery();
  } catch (error) {
    console.error("[ERROR] Ошибка в обработчике кнопки 'Добавить конкурента':", error);
    try {
      await ctx.reply("Произошла ошибка при добавлении конкурента. Пожалуйста, попробуйте снова.");
      await ctx.answerCbQuery("Произошла ошибка");
    } catch (e) {
      console.error("[ERROR] Не удалось отправить сообщение об ошибке:", e);
    }
  }
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
  if (ctx.scene.session.step !== ScraperSceneStep.ADD_COMPETITOR) {
    return;
  }

  const adapter = ctx.storage; // Используем ctx.storage напрямую
  const { projectId } = ctx.scene.session;
  const instagramUrl = ctx.message.text;

  if (!projectId) {
    await ctx.reply("Ошибка: не указан проект. Начните сначала.");
    ctx.scene.session.step = undefined; // Сброс шага
    return ctx.scene.reenter();
  }

  if (!isValidInstagramUrl(instagramUrl)) {
    await ctx.reply(
      "Пожалуйста, введите корректный URL Instagram-аккаунта (например, https://www.instagram.com/example):"
    );
    // Не сбрасываем шаг, даем пользователю попробовать еще раз
    return;
  }

  const username = extractUsernameFromUrl(instagramUrl);
  if (!username) {
    await ctx.reply(
      "Не удалось извлечь имя пользователя из URL. Пожалуйста, проверьте URL и попробуйте снова."
    );
    // Не сбрасываем шаг
    return;
  }

  try {
    await adapter.initialize();
    const user = await adapter.getUserByTelegramId(ctx.from?.id || 0);

    if (!user) {
      console.error(
        `handleCompetitorText: User not found for telegramId: ${ctx.from?.id}`
      );
      await ctx.reply(
        "Ошибка: Пользователь не найден. Пожалуйста, используйте /start."
      );
      ctx.scene.session.step = undefined;
      return ctx.scene.leave();
    }

    const competitor = await adapter.addCompetitorAccount(
      projectId,
      username,
      instagramUrl
    );

    if (competitor) {
      await ctx.reply(
        `Конкурент @${username} успешно добавлен!`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "Добавить еще",
              `add_competitor_${projectId}`
            ),
          ],
          [
            Markup.button.callback(
              "Посмотреть всех конкурентов",
              `competitors_project_${projectId}`
            ),
          ],
          [Markup.button.callback("Вернуться к проектам", "back_to_projects")],
        ])
      );
    } else {
      await ctx.reply(
        `Не удалось добавить конкурента @${username}. Возможно, он уже добавлен или произошла ошибка базы данных.`
      );
    }
    ctx.scene.session.step = undefined; // Сброс шага после попытки добавления
    return; // Явный return
  } catch (error) {
    console.error("Ошибка при добавлении конкурента в сцене:", error);
    await ctx.reply(
      "Произошла внутренняя ошибка при добавлении конкурента. Попробуйте позже."
    );
    ctx.scene.session.step = undefined; // Сброс шага в случае ошибки
    return; // Явный return
  } finally {
    if (adapter && typeof adapter.close === "function") {
      await adapter.close();
    }
  }
  // Неявный return здесь, так как все пути выше имеют return или throw
}

// Обработка текстовых сообщений
competitorScene.on("text", handleCompetitorText);

/**
 * Обработчик кнопки "Выйти"
 */
export async function handleExitCompetitorSceneAction(ctx: ScraperBotContext) {
  console.log("[DEBUG] Обработчик кнопки 'Выйти' вызван");

  try {
    await ctx.reply("Вы вышли из режима управления конкурентами.", {
      reply_markup: { remove_keyboard: true },
    });

    // Если есть ID проекта в сессии, переходим в сцену проектов с этим ID
    if (ctx.scene.session.currentProjectId) {
      console.log(`[DEBUG] Переход в сцену проектов с ID: ${ctx.scene.session.currentProjectId}`);
      await ctx.scene.leave();
      await ctx.scene.enter("projectScene", {
        projectId: ctx.scene.session.currentProjectId,
      });
    } else {
      console.log("[DEBUG] Выход из сцены без перехода в другую сцену");
      await ctx.scene.leave();
    }

    await ctx.answerCbQuery();
  } catch (error) {
    console.error("[ERROR] Ошибка в обработчике кнопки 'Выйти':", error);
    // Пытаемся выйти из сцены даже при ошибке
    try {
      await ctx.scene.leave();
    } catch (e) {
      console.error("[ERROR] Не удалось выйти из сцены:", e);
    }
    await ctx.answerCbQuery("Произошла ошибка").catch(() => {});
  }
}

/**
 * Обработчик кнопки "Назад к проектам"
 */
export async function handleBackToProjectsCompetitorAction(
  ctx: ScraperBotContext & { customSceneEnterMock?: any }
) {
  await ctx.answerCbQuery();
  // Предполагается, что эта сцена всегда должна вести обратно в projectScene
  if (ctx.customSceneEnterMock) {
    await ctx.customSceneEnterMock("instagram_scraper_projects");
  } else {
    await ctx.scene.enter("instagram_scraper_projects"); // Имя главной сцены проектов
  }
}

// Импортируем утилиту для обработки кнопок
import { registerButtons } from '../utils/button-handler';

// Регистрация обработчиков в сцене
console.log("[DEBUG] Регистрация обработчиков действий в сцене конкурентов");

// Регистрируем все обработчики кнопок с помощью нашей утилиты
registerButtons(competitorScene, [
  {
    id: /competitors_project_(\d+)/,
    handler: handleCompetitorsProjectAction,
    errorMessage: "Не удалось загрузить список конкурентов для этого проекта. Попробуйте позже.",
    verbose: true
  },
  {
    id: /add_competitor_(\d+)/,
    handler: handleAddCompetitorAction,
    errorMessage: "Произошла ошибка при добавлении конкурента. Пожалуйста, попробуйте снова.",
    verbose: true
  },
  {
    id: "exit_scene",
    handler: handleExitCompetitorSceneAction,
    errorMessage: "Произошла ошибка при выходе из сцены. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: "back_to_projects",
    handler: handleBackToProjectsCompetitorAction as any, // Используем as any из-за временного изменения сигнатуры
    errorMessage: "Произошла ошибка при возврате к проектам. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /delete_competitor_(\d+)_(.+)/,
    handler: handleDeleteCompetitorAction,
    errorMessage: "Произошла ошибка при удалении конкурента. Попробуйте еще раз.",
    verbose: true
  }
]);


export default competitorScene;
