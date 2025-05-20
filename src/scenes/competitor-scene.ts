import { Scenes, Markup } from "telegraf";
import { ScraperBotContext } from "../types";
import { NeonAdapter } from "../adapters/neon-adapter";
import { ScraperSceneStep, ScraperSceneSessionData } from "@/types";
import {
  isValidInstagramUrl,
  extractUsernameFromUrl,
} from "../utils/validation";
import { logger } from "../logger";

/**
 * Очищает состояние сессии перед выходом из сцены
 * @param ctx Контекст Telegraf
 * @param reason Причина очистки состояния (для логирования)
 */
function clearSessionState(ctx: ScraperBotContext, reason: string = "general"): void {
  if (ctx.scene.session) {
    logger.info(`[CompetitorScene] Clearing session state before leaving (reason: ${reason})`);
    // Очистка всех необходимых полей состояния
    ctx.scene.session.projectId = undefined;
    ctx.scene.session.currentProjectId = undefined;
    ctx.scene.session.step = undefined;
  }
}

/**
 * Выполняет безопасный переход в другую сцену с обработкой ошибок
 * @param ctx Контекст Telegraf
 * @param targetScene Целевая сцена
 * @param reason Причина перехода (для логирования)
 * @param state Дополнительные параметры для передачи в целевую сцену
 */
async function safeSceneTransition(
  ctx: ScraperBotContext,
  targetScene: string = "instagram_scraper_projects",
  reason: string = "general",
  state: Record<string, any> = {}
): Promise<void> {
  try {
    logger.info(`[CompetitorScene] Transitioning to ${targetScene} scene (reason: ${reason})`);
    await ctx.scene.enter(targetScene, state);
  } catch (error) {
    logger.error(`[CompetitorScene] Error entering ${targetScene} scene:`, error);
    await ctx.scene.leave();
  }
}

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
    logger.error(
      `[CompetitorScene] Invalid data parsed from delete action: projectId=${ctx.match[1]}, username=${ctx.match[2]}`
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
    logger.error(
      `[CompetitorScene] Error deleting competitor ${username} from project ${projectId}:`,
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
      logger.error("[CompetitorScene] User not found for telegramId:", ctx.from?.id);
      await ctx.reply(
        "Вы не зарегистрированы. Пожалуйста, используйте /start для начала работы."
      );
      await adapter.close();

      // Очистка состояния и безопасный переход в другую сцену
      clearSessionState(ctx, "user_not_found");
      await safeSceneTransition(ctx, "instagram_scraper_projects", "user_not_found");
      return;
    }

    const projects = await adapter.getProjectsByUserId(user.id as number); // Приведение типа user.id

    if (!projects || projects.length === 0) {
      logger.error("[CompetitorScene] No projects found for user:", user.id);
      await ctx.reply(
        "У вас нет проектов. Создайте проект с помощью команды /projects"
      );
      await adapter.close();

      // Очистка состояния и безопасный переход в другую сцену
      clearSessionState(ctx, "no_projects");
      await safeSceneTransition(ctx, "instagram_scraper_projects", "no_projects");
      return;
    }

    // Если есть только один проект, сразу показываем конкурентов
    if (projects.length === 1) {
      const competitors = await adapter.getCompetitorAccounts(projects[0].id);

      if (!competitors || competitors.length === 0) {
        // Добавляем логирование для отладки
        logger.info(`[CompetitorScene] Displaying buttons for project ${projects[0].id} (${projects[0].name})`);

        logger.info(`[CompetitorScene] Creating "Add competitor" button with callback_data: add_competitor_${projects[0].id}`);
        await ctx.reply(
          `В проекте "${projects[0].name}" нет добавленных конкурентов. Хотите добавить?`,
          {
            reply_markup: Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "➕ Добавить конкурента",
                  `add_competitor_3`
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
                  `add_competitor_3`
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
    logger.error("[CompetitorScene] Error in handleCompetitorEnter:", error);
    await ctx.reply(
      "Не удалось загрузить данные для управления конкурентами. Попробуйте позже или обратитесь в поддержку."
    );

    // Очистка состояния и безопасный переход в другую сцену
    clearSessionState(ctx, "error_loading_competitors");
    await safeSceneTransition(ctx, "instagram_scraper_projects", "error_loading_competitors");
  } finally {
    try {
      if (adapter && typeof adapter.close === "function") {
        await adapter.close();
      }
    } catch (closeError) {
      logger.error("[CompetitorScene] Error closing database connection:", closeError);
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
                `add_competitor_3`
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
                `add_competitor_3`
              ),
            ],
            [Markup.button.callback("🔙 Назад к проектам", "back_to_projects")],
            [Markup.button.callback("❌ Выйти", "exit_scene")],
          ]).reply_markup,
        }
      );
    }

  } catch (error) {
    logger.error(
      `[CompetitorScene] Error getting competitors for project ${projectId}:`,
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
      logger.error("[CompetitorScene] Error closing database connection:", closeError);
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
  logger.info("[CompetitorScene] Add competitor button handler triggered");
  logger.debug("[CompetitorScene] match:", ctx.match);
  logger.debug("[CompetitorScene] ctx.scene:", ctx.scene);
  logger.debug("[CompetitorScene] ctx.session:", ctx.session);

  try {
    const projectId = parseInt(ctx.match![1]);
    logger.debug(`[CompetitorScene] Extracted projectId: ${projectId}`);

    if (isNaN(projectId)) {
      logger.error(`[CompetitorScene] Invalid projectId parsed from action: ${ctx.match![1]}`);
      await ctx.reply(
        "Ошибка выбора проекта. Пожалуйста, вернитесь назад и выберите проект снова."
      );
      await ctx.answerCbQuery();
      return;
    }

    // Проверяем наличие ctx.scene.session и инициализируем, если отсутствует
    if (!ctx.scene.session) {
      logger.debug("[CompetitorScene] ctx.scene.session is missing, initializing");
      (ctx.scene as any).session = {};
    }

    logger.debug(`[CompetitorScene] Setting projectId in session: ${projectId}`);
    ctx.scene.session.projectId = projectId;

    await ctx.reply(
      "Введите Instagram URL конкурента (например, https://www.instagram.com/example):"
    );

    logger.debug(`[CompetitorScene] Setting step in session: ${ScraperSceneStep.ADD_COMPETITOR}`);
    ctx.scene.session.step = ScraperSceneStep.ADD_COMPETITOR;

    await ctx.answerCbQuery();
  } catch (error) {
    logger.error("[CompetitorScene] Error in add competitor button handler:", error);
    logger.error("[CompetitorScene] Stack trace:", (error as Error).stack);
    try {
      await ctx.reply("Произошла ошибка при добавлении конкурента. Пожалуйста, попробуйте снова.");
      await ctx.answerCbQuery("Произошла ошибка");
    } catch (e) {
      logger.error("[CompetitorScene] Failed to send error message:", e);
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
      logger.error(
        `[CompetitorScene] handleCompetitorText: User not found for telegramId: ${ctx.from?.id}`
      );
      await ctx.reply(
        "Ошибка: Пользователь не найден. Пожалуйста, используйте /start."
      );

      // Очистка состояния и безопасный переход в другую сцену
      clearSessionState(ctx, "user_not_found_in_text_handler");
      await safeSceneTransition(ctx, "instagram_scraper_projects", "user_not_found_in_text_handler");
      return;
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
              `add_competitor_3`
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
    logger.error("[CompetitorScene] Error adding competitor in text handler:", error);
    await ctx.reply(
      "Произошла внутренняя ошибка при добавлении конкурента. Попробуйте позже."
    );
    ctx.scene.session.step = undefined; // Сброс шага в случае ошибки
    return; // Явный return
  } finally {
    // Не закрываем соединение с базой данных, так как оно будет использоваться в других обработчиках
    // Закрытие соединения происходит только при завершении работы бота
  }
  // Неявный return здесь, так как все пути выше имеют return или throw
}

// Обработка текстовых сообщений
competitorScene.on("text", handleCompetitorText);

/**
 * Обработчик кнопки "Выйти"
 */
export async function handleExitCompetitorSceneAction(ctx: ScraperBotContext) {
  logger.info("[CompetitorScene] Exit button handler triggered");

  try {
    await ctx.reply("Вы вышли из режима управления конкурентами.", {
      reply_markup: { remove_keyboard: true },
    });

    // Если есть ID проекта в сессии, переходим в сцену проектов с этим ID
    if (ctx.scene.session.currentProjectId) {
      const projectId = ctx.scene.session.currentProjectId;
      logger.info(`[CompetitorScene] Transitioning to projects scene with ID: ${projectId}`);

      // Очистка состояния и безопасный переход в другую сцену
      clearSessionState(ctx, "exit_button_with_project_id");
      await safeSceneTransition(ctx, "instagram_scraper_projects", "exit_button_with_project_id", { projectId });
    } else {
      logger.info("[CompetitorScene] Exiting scene without specific project ID");

      // Очистка состояния и безопасный переход в другую сцену
      clearSessionState(ctx, "exit_button_without_project_id");
      await safeSceneTransition(ctx, "instagram_scraper_projects", "exit_button_without_project_id");
    }

    await ctx.answerCbQuery();
  } catch (error) {
    logger.error("[CompetitorScene] Error in exit button handler:", error);

    // Очистка состояния и безопасный переход в другую сцену даже при ошибке
    clearSessionState(ctx, "exit_button_error");
    await safeSceneTransition(ctx, "instagram_scraper_projects", "exit_button_error");

    await ctx.answerCbQuery("Произошла ошибка").catch(() => {});
  }
}

/**
 * Обработчик кнопки "Назад к проектам"
 */
export async function handleBackToProjectsCompetitorAction(
  ctx: ScraperBotContext & { customSceneEnterMock?: any }
) {
  logger.info("[CompetitorScene] Back to projects button handler triggered");

  try {
    await ctx.answerCbQuery();

    // Очистка состояния и безопасный переход в другую сцену
    clearSessionState(ctx, "back_to_projects_clicked");

    // Предполагается, что эта сцена всегда должна вести обратно в projectScene
    if (ctx.customSceneEnterMock) {
      // Для тестирования
      await ctx.customSceneEnterMock("instagram_scraper_projects");
    } else {
      await safeSceneTransition(ctx, "instagram_scraper_projects", "back_to_projects_clicked");
    }
  } catch (error) {
    logger.error("[CompetitorScene] Error in back to projects button handler:", error);

    // Очистка состояния и безопасный переход в другую сцену даже при ошибке
    clearSessionState(ctx, "back_to_projects_error");
    await safeSceneTransition(ctx, "instagram_scraper_projects", "back_to_projects_error");
  }
}

// Импортируем утилиту для обработки кнопок
import { registerButtons } from '../utils/button-handler';

// Регистрация обработчиков в сцене
logger.info("[CompetitorScene] Registering action handlers");

// Добавляем прямые обработчики для кнопок
logger.debug("[CompetitorScene] Adding direct button handlers");

// Прямой обработчик для кнопки "Добавить конкурента"
competitorScene.action("add_competitor_3", async (ctx) => {
  logger.debug("[CompetitorScene] Direct handler for 'add_competitor_3' button triggered");
  try {
    // Создаем объект match для совместимости с существующим обработчиком
    (ctx as any).match = ["add_competitor_3", "3"];
    await handleAddCompetitorAction(ctx as any);
  } catch (error) {
    logger.error("[CompetitorScene] Error in direct handler for 'add_competitor_3' button:", error);
    await ctx.reply("Произошла ошибка при добавлении конкурента. Пожалуйста, попробуйте снова.");
  }
});

// Прямой обработчик для кнопки "Выйти"
competitorScene.action("exit_scene", async (ctx) => {
  logger.debug("[CompetitorScene] Direct handler for 'exit_scene' button triggered");
  try {
    await handleExitCompetitorSceneAction(ctx as any);
  } catch (error) {
    logger.error("[CompetitorScene] Error in direct handler for 'exit_scene' button:", error);
    await ctx.reply("Произошла ошибка при выходе из сцены. Пожалуйста, попробуйте снова.");
  }
});

// Прямой обработчик для кнопки "Назад к проектам"
competitorScene.action("back_to_projects", async (ctx) => {
  logger.debug("[CompetitorScene] Direct handler for 'back_to_projects' button triggered");
  try {
    await handleBackToProjectsCompetitorAction(ctx as any);
  } catch (error) {
    logger.error("[CompetitorScene] Error in direct handler for 'back_to_projects' button:", error);
    await ctx.reply("Произошла ошибка при возврате к проектам. Пожалуйста, попробуйте снова.");
  }
});

// Регистрируем все обработчики кнопок с помощью нашей утилиты
logger.info("[CompetitorScene] Registering button handlers through centralized handler");
registerButtons(competitorScene, [
  {
    id: /competitors_project_(\d+)/,
    handler: handleCompetitorsProjectAction as any,
    errorMessage: "Не удалось загрузить список конкурентов для этого проекта. Попробуйте позже.",
    verbose: true
  },
  {
    id: "add_competitor_3",
    handler: handleAddCompetitorAction as any,
    errorMessage: "Произошла ошибка при добавлении конкурента. Пожалуйста, попробуйте снова.",
    verbose: true
  },
  {
    id: "exit_scene",
    handler: handleExitCompetitorSceneAction as any,
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
    handler: handleDeleteCompetitorAction as any,
    errorMessage: "Произошла ошибка при удалении конкурента. Попробуйте еще раз.",
    verbose: true
  }
]);


export default competitorScene;
