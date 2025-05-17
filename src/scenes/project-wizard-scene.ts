import { Scenes, Markup } from "telegraf";
import type { ScraperBotContext, Project } from "../types";
import { ScraperSceneStep } from "../types";
import {
  generateProjectsKeyboard,
  generateProjectMenuKeyboard,
} from "./components/project-keyboard";
import { isValidProjectName } from "../utils/validation";
import { logger } from "../logger";

/**
 * Очищает состояние сессии перед выходом из сцены
 * @param ctx Контекст Telegraf
 * @param reason Причина очистки состояния (для логирования)
 */
function clearSessionState(ctx: ScraperBotContext, reason: string = "general"): void {
  if (ctx.scene.session) {
    logger.info(`[ProjectWizard] Clearing session state before leaving (reason: ${reason})`);
    // Очистка всех необходимых полей состояния
    ctx.scene.session.step = undefined;
    ctx.scene.session.currentProjectId = undefined;
    // Для Wizard-сцен
    if (ctx.wizard && ctx.wizard.state) {
      ctx.wizard.state = {};
    }
  }
}

/**
 * Выполняет безопасный переход в другую сцену с обработкой ошибок
 * @param ctx Контекст Telegraf
 * @param targetScene Целевая сцена
 * @param reason Причина перехода (для логирования)
 */
async function safeSceneTransition(
  ctx: ScraperBotContext,
  targetScene: string = "instagram_scraper_projects",
  reason: string = "general"
): Promise<void> {
  try {
    logger.info(`[ProjectWizard] Transitioning to ${targetScene} scene (reason: ${reason})`);
    await ctx.scene.enter(targetScene);
  } catch (error) {
    logger.error(`[ProjectWizard] Error entering ${targetScene} scene:`, error);
    await ctx.scene.leave();
  }
}

/**
 * Wizard-сцена для управления проектами
 */
export const projectWizardScene = new Scenes.WizardScene<ScraperBotContext>(
  "project_wizard",

  // Шаг 1: Отображение списка проектов
  async (ctx) => {
    logger.info(`[ProjectWizard] Шаг 1: Отображение списка проектов`);
    logger.debug(`[ProjectWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

    if (!ctx.from) {
      logger.error("[ProjectWizard] ctx.from is undefined");
      await ctx.reply(
        "Не удалось определить пользователя. Попробуйте перезапустить бота командой /start."
      );
      clearSessionState(ctx, "missing_user");
      return ctx.scene.leave();
    }

    const telegramId = ctx.from.id;
    const username = ctx.from.username;
    const firstName = ctx.from.first_name;
    const lastName = ctx.from.last_name;

    try {
      await ctx.storage.initialize();
      logger.info(`[ProjectWizard] User ${telegramId} entered project scene.`);

      const user = await ctx.storage.findUserByTelegramIdOrCreate(
        telegramId,
        username,
        firstName,
        lastName
      );

      if (!user) {
        logger.error(
          `[ProjectWizard] Could not find or create user for telegram_id: ${telegramId}`
        );
        await ctx.reply(
          "Произошла ошибка при получении данных пользователя. Попробуйте позже."
        );
        clearSessionState(ctx, "user_not_found");
        return ctx.scene.leave();
      }

      logger.info(
        `[ProjectWizard] User found/created: ${user.id} (tg: ${telegramId})`
      );

      const projects: Project[] | null = await ctx.storage.getProjectsByUserId(
        user.id
      );

      if (!projects || projects.length === 0) {
        logger.info(`[ProjectWizard] No projects found for user ${user.id}`);
        await ctx.reply(
          "У вас еще нет проектов. Хотите создать первый?",
          generateProjectsKeyboard([])
        );
      } else {
        logger.info(
          `[ProjectWizard] Found ${projects.length} projects for user ${user.id}`
        );
        await ctx.reply("Ваши проекты:", generateProjectsKeyboard(projects));
      }
    } catch (error) {
      logger.error("[ProjectWizard] Error in enter handler:", error);
      await ctx.reply(
        "Произошла ошибка при загрузке ваших проектов. Попробуйте еще раз."
      );
      clearSessionState(ctx, "error_loading_projects");
      return ctx.scene.leave();
    } finally {
      await ctx.storage.close();
    }

    // Остаемся на текущем шаге
    return;
  },

  // Шаг 2: Создание нового проекта
  async (ctx) => {
    logger.info(`[ProjectWizard] Шаг 2: Создание нового проекта`);
    logger.debug(`[ProjectWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

    // Проверяем, есть ли текст сообщения
    if (ctx.message && 'text' in ctx.message) {
      if (!ctx.from) {
        logger.error("[ProjectWizard] ctx.from is undefined");
        await ctx.reply("Не удалось определить пользователя. Попробуйте /start.");
        clearSessionState(ctx, "missing_user_on_input");
        return ctx.scene.leave();
      }

      const telegramId = ctx.from.id;
      const projectName = ctx.message.text.trim();

      if (!isValidProjectName(projectName)) {
        await ctx.reply(
          "Название проекта должно быть от 3 до 100 символов. Пожалуйста, введите корректное название:"
        );
        return;
      }

      try {
        await ctx.storage.initialize();
        const user = await ctx.storage.getUserByTelegramId(telegramId);
        if (!user) {
          logger.error(
            `[ProjectWizard] User not found for telegram_id: ${telegramId} during project creation`
          );
          await ctx.reply(
            "Произошла ошибка: пользователь не найден. Попробуйте /start."
          );
          clearSessionState(ctx, "user_not_found_on_input");
          return ctx.scene.leave();
        }

        const newProject = await ctx.storage.createProject(user.id, projectName);
        if (newProject) {
          logger.info(
            `[ProjectWizard] Project "${projectName}" created for user ${user.id}`
          );
          await ctx.reply(`Проект "${newProject.name}" успешно создан!`);
          ctx.wizard.state.currentProjectId = newProject.id;

          // Возвращаемся к списку проектов (шаг 1)
          return ctx.wizard.selectStep(0);
        } else {
          logger.error(
            `[ProjectWizard] Failed to create project "${projectName}" for user ${user.id}`
          );
          await ctx.reply(
            "Не удалось создать проект. Попробуйте еще раз или обратитесь в поддержку."
          );
        }
      } catch (error) {
        logger.error(
          `[ProjectWizard] Error creating project "${projectName}":`,
          error
        );
        await ctx.reply("Произошла серьезная ошибка при создании проекта.");
        clearSessionState(ctx, "error_creating_project");
        return ctx.scene.leave();
      } finally {
        await ctx.storage.close();
      }
    } else {
      await ctx.reply("Пожалуйста, введите название нового проекта:");
    }

    // Остаемся на текущем шаге
    return;
  },

  // Шаг 3: Меню проекта
  async (ctx) => {
    logger.info(`[ProjectWizard] Шаг 3: Меню проекта`);
    logger.debug(`[ProjectWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

    const projectId = ctx.wizard.state.currentProjectId;

    if (!projectId) {
      logger.error("[ProjectWizard] Project ID is undefined");
      await ctx.reply("Ошибка: не удалось определить проект. Вернитесь к списку проектов.");
      return ctx.wizard.selectStep(0);
    }

    try {
      await ctx.storage.initialize();
      const project = await ctx.storage.getProjectById(projectId);

      if (project) {
        await ctx.reply(
          `Проект "${project.name}". Что вы хотите сделать?`,
          generateProjectMenuKeyboard(project.id)
        );
      } else {
        await ctx.reply("Проект не найден. Возможно, он был удален.");
        return ctx.wizard.selectStep(0);
      }
    } catch (error) {
      logger.error(`[ProjectWizard] Error loading project menu:`, error);
      await ctx.reply("Произошла ошибка при загрузке меню проекта.");
      return ctx.wizard.selectStep(0);
    } finally {
      await ctx.storage.close();
    }

    // Остаемся на текущем шаге
    return;
  }
);

// Регистрируем обработчики кнопок на уровне сцены
projectWizardScene.action("exit_scene", async (ctx) => {
  logger.info(`[ProjectWizard] Обработчик кнопки 'exit_scene' вызван`);
  await ctx.answerCbQuery();
  await ctx.reply("Вы вышли из меню проектов.");

  // Очистка состояния и выход из сцены
  clearSessionState(ctx, "exit_button_clicked");
  return ctx.scene.leave();
});

projectWizardScene.action("create_project", async (ctx) => {
  logger.info(`[ProjectWizard] Обработчик кнопки 'create_project' вызван`);
  await ctx.answerCbQuery();

  await ctx.reply(
    "Введите название нового проекта (например, 'Клиника Аврора МСК'):",
    Markup.inlineKeyboard([
      Markup.button.callback("Отмена", "back_to_projects"),
    ])
  );

  // Переходим к шагу создания проекта
  return ctx.wizard.next();
});

projectWizardScene.action("back_to_projects", async (ctx) => {
  logger.info(`[ProjectWizard] Обработчик кнопки 'back_to_projects' вызван`);
  await ctx.answerCbQuery();

  // Возвращаемся к списку проектов (шаг 1)
  return ctx.wizard.selectStep(0);
});

// Обработчик для выбора проекта
projectWizardScene.action(/project_(\d+)/, async (ctx) => {
  logger.info(`[ProjectWizard] Обработчик кнопки 'project_id' вызван`);
  const projectId = parseInt(ctx.match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[ProjectWizard] Invalid project ID from action match");
    await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    return ctx.wizard.selectStep(0);
  }

  ctx.wizard.state.currentProjectId = projectId;
  await ctx.answerCbQuery();

  // Переходим к шагу меню проекта
  return ctx.wizard.selectStep(2);
});

// Обработчик для управления хештегами
projectWizardScene.action(/manage_hashtags_(\d+)/, async (ctx) => {
  logger.info(`[ProjectWizard] Обработчик кнопки 'manage_hashtags' вызван`);
  const projectId = parseInt(ctx.match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[ProjectWizard] Invalid project ID for hashtags from action match");
    await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    return ctx.wizard.selectStep(0);
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.projectId = projectId;
  await ctx.answerCbQuery();

  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "manage_hashtags_clicked");
  await safeSceneTransition(ctx, "hashtag_wizard", "manage_hashtags_clicked");
});

// Обработчик для запуска скрапинга
projectWizardScene.action(/scrape_project_(\d+)/, async (ctx) => {
  logger.info(`[ProjectWizard] Обработчик кнопки 'scrape_project' вызван`);
  const projectId = parseInt(ctx.match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[ProjectWizard] Invalid project ID for scraping from action match");
    await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    return ctx.wizard.selectStep(0);
  }

  ctx.scene.session.currentProjectId = projectId;
  await ctx.answerCbQuery();

  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "scrape_project_clicked");
  await safeSceneTransition(ctx, "scraping_wizard", "scrape_project_clicked");
});

// Обработчик для просмотра Reels
projectWizardScene.action(/reels_list_(\d+)/, async (ctx) => {
  logger.info(`[ProjectWizard] Обработчик кнопки 'reels_list' вызван`);
  const projectId = parseInt(ctx.match[1], 10);

  if (isNaN(projectId)) {
    logger.warn("[ProjectWizard] Invalid project ID for reels from action match");
    await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    return ctx.wizard.selectStep(0);
  }

  ctx.scene.session.currentProjectId = projectId;
  await ctx.answerCbQuery();

  // Очистка состояния и безопасный переход в другую сцену
  clearSessionState(ctx, "reels_list_clicked");
  await safeSceneTransition(ctx, "reels_wizard", "reels_list_clicked");
});

// Добавляем обработчик для команды /projects
export function setupProjectWizard(bot: any) {
  bot.command('projects', async (ctx: any) => {
    logger.info("[ProjectWizard] Command /projects triggered");
    await ctx.scene.enter('project_wizard');
  });

  // Добавляем обработчик для кнопки "Проекты" в главном меню
  bot.hears('📊 Проекты', async (ctx: any) => {
    logger.info("[ProjectWizard] Button '📊 Проекты' clicked");
    await ctx.scene.enter('project_wizard');
  });
}

export default projectWizardScene;
