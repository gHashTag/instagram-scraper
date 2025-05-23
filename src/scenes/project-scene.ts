import { Scenes, Markup } from "telegraf";
import type { ScraperBotContext, Project } from "../types";
import { ScraperSceneStep } from "../types";
import {
  generateProjectsKeyboard,
  generateProjectMenuKeyboard,
} from "./components/project-keyboard";
import { isValidProjectName } from "../utils/validation";
import { logger } from "../logger";
import { registerButtons } from "../utils/button-handler";

export const projectScene = new Scenes.BaseScene<ScraperBotContext>(
  "instagram_scraper_projects"
);

// --- Command Handlers ---
projectScene.command("start", async (ctx) => {
  console.log("PROJECT_SCENE_DEBUG: command /start triggered");
  await ctx.scene.enter("instagram_scraper_projects");
});

// --- Enter Scene Handler ---
export async function handleProjectEnter(ctx: ScraperBotContext) {
  console.log("PROJECT_SCENE_DEBUG: enter handler triggered");
  console.log("PROJECT_SCENE_DEBUG: Context type:", ctx.updateType);
  console.log("PROJECT_SCENE_DEBUG: Session state at enter:", JSON.stringify(ctx.scene.session));

  if (!ctx.from) {
    logger.error("projectScene.enter: ctx.from is undefined");
    console.log("PROJECT_SCENE_DEBUG: ctx.from is undefined, leaving scene");
    await ctx.reply(
      "Не удалось определить пользователя. Попробуйте перезапустить бота командой /start."
    );
    return ctx.scene.leave();
  }

  const telegramId = ctx.from.id;
  const username = ctx.from.username;
  const firstName = ctx.from.first_name;
  const lastName = ctx.from.last_name;
  let userSession = ctx.scene.session;
  userSession.step = undefined;

  try {
    await ctx.storage.initialize();
    logger.info(`[ProjectScene] User ${telegramId} entered project scene.`);

    const user = await ctx.storage.findUserByTelegramIdOrCreate(
      telegramId,
      username,
      firstName,
      lastName
    );

    if (!user) {
      logger.error(
        `[ProjectScene] Could not find or create user for telegram_id: ${telegramId}`
      );
      await ctx.reply(
        "Произошла ошибка при получении данных пользователя. Попробуйте позже."
      );
      return ctx.scene.leave();
    }
    logger.info(
      `[ProjectScene] User found/created: ${user.id} (tg: ${telegramId})`
    );

    const projects: Project[] | null = await ctx.storage.getProjectsByUserId(
      user.id
    );

    if (!projects || projects.length === 0) {
      logger.info(`[ProjectScene] No projects found for user ${user.id}`);
      await ctx.reply(
        "У вас еще нет проектов. Хотите создать первый?",
        generateProjectsKeyboard([])
      );
      userSession.step = ScraperSceneStep.PROJECT_LIST;
    } else {
      logger.info(
        `[ProjectScene] Found ${projects.length} projects for user ${user.id}`
      );
      await ctx.reply("Ваши проекты:", generateProjectsKeyboard(projects));
      userSession.step = ScraperSceneStep.PROJECT_LIST;
    }
  } catch (error) {
    logger.error("[ProjectScene] Error in enter handler:", error);
    await ctx.reply(
      "Произошла ошибка при загрузке ваших проектов. Попробуйте еще раз."
    );
    await ctx.scene.leave();
  } finally {
    await ctx.storage.close();
  }
}
projectScene.enter(handleProjectEnter);

// --- Action Handlers (Обработчики кнопок) ---
export async function handleExitSceneAction(ctx: ScraperBotContext) {
  console.log("PROJECT_SCENE_DEBUG: handleExitSceneAction triggered");
  await ctx.reply("Вы вышли из меню проектов.");
  await ctx.scene.leave();
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }
}

export async function handleCreateProjectAction(ctx: ScraperBotContext) {
  console.log("PROJECT_SCENE_DEBUG: handleCreateProjectAction triggered");
  console.log("PROJECT_SCENE_DEBUG: Callback query data:", ctx.callbackQuery?.data);
  console.log("PROJECT_SCENE_DEBUG: Current session state:", JSON.stringify(ctx.scene.session));

  ctx.scene.session.step = ScraperSceneStep.CREATE_PROJECT;
  console.log("PROJECT_SCENE_DEBUG: Set session step to CREATE_PROJECT:", ctx.scene.session.step);

  await ctx.reply(
    "Введите название нового проекта (например, 'Клиника Аврора МСК'):",
    Markup.inlineKeyboard([
      Markup.button.callback("Отмена", "back_to_projects"),
    ])
  );
  console.log("PROJECT_SCENE_DEBUG: Sent reply with prompt for project name");

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
    console.log("PROJECT_SCENE_DEBUG: Answered callback query");
  } else {
    console.log("PROJECT_SCENE_DEBUG: No callback query to answer");
  }

  console.log("PROJECT_SCENE_DEBUG: handleCreateProjectAction completed");
}

export async function handleBackToProjectsAction(ctx: ScraperBotContext) {
  console.log("PROJECT_SCENE_DEBUG: handleBackToProjectsAction triggered");
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }
  await ctx.scene.reenter();
}

export async function handleProjectSelectionAction(ctx: ScraperBotContext) {
  console.log("PROJECT_SCENE_DEBUG: handleProjectSelectionAction triggered");
  const projectId = parseInt((ctx.match as unknown as RegExpExecArray)[1], 10);
  if (isNaN(projectId)) {
    logger.warn("[ProjectScene] Invalid project ID from action match");
    if (ctx.callbackQuery)
      await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    await ctx.scene.reenter();
    return;
  }

  try {
    await ctx.storage.initialize();
    const project = await ctx.storage.getProjectById(projectId);
    if (project) {
      ctx.scene.session.currentProjectId = project.id;
      ctx.scene.session.step = ScraperSceneStep.PROJECT_MENU;
      await ctx.reply(
        `Проект "${project.name}". Что вы хотите сделать?`,
        generateProjectMenuKeyboard(project.id)
      );
    } else {
      await ctx.reply("Проект не найден. Возможно, он был удален.");
      await ctx.scene.reenter();
    }
  } catch (error) {
    logger.error("[ProjectScene] Error selecting project:", error);
    await ctx.reply("Ошибка при выборе проекта.");
  } finally {
    await ctx.storage.close();
  }
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }
  return;
}

export async function handleManageHashtagsAction(ctx: ScraperBotContext) {
  console.log("PROJECT_SCENE_DEBUG: handleManageHashtagsAction triggered");
  const projectId = parseInt((ctx.match as unknown as RegExpExecArray)[1], 10);
  if (isNaN(projectId)) {
    logger.warn(
      "[ProjectScene] Invalid project ID for hashtags from action match"
    );
    if (ctx.callbackQuery)
      await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    await ctx.scene.reenter();
    return;
  }
  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.projectId = projectId;
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }
  // Переходим в wizard-сцену для хештегов
  await ctx.scene.enter("hashtag_wizard");
  return;
}

// Обработчик для запуска скрапинга
export async function handleScrapeProjectAction(ctx: ScraperBotContext) {
  console.log("PROJECT_SCENE_DEBUG: handleScrapeProjectAction triggered");
  const projectId = parseInt((ctx.match as unknown as RegExpExecArray)[1], 10);
  if (isNaN(projectId)) {
    logger.warn("[ProjectScene] Invalid project ID for scraping from action match");
    if (ctx.callbackQuery)
      await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    await ctx.scene.reenter();
    return;
  }
  ctx.scene.session.currentProjectId = projectId;
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }
  await ctx.scene.enter("instagram_scraper_scraping", { projectId: projectId });
  return;
}

// Обработчик для просмотра Reels
export async function handleReelsListAction(ctx: ScraperBotContext) {
  console.log("PROJECT_SCENE_DEBUG: handleReelsListAction triggered");
  const projectId = parseInt((ctx.match as unknown as RegExpExecArray)[1], 10);
  if (isNaN(projectId)) {
    logger.warn("[ProjectScene] Invalid project ID for reels from action match");
    if (ctx.callbackQuery)
      await ctx.answerCbQuery("Ошибка: неверный ID проекта.");
    await ctx.scene.reenter();
    return;
  }
  ctx.scene.session.currentProjectId = projectId;
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
  }
  await ctx.scene.enter("instagram_scraper_reels", { projectId: projectId });
  return;
}

// Регистрация обработчиков кнопок с использованием централизованного обработчика
registerButtons(projectScene, [
  {
    id: "exit_scene",
    handler: handleExitSceneAction,
    errorMessage: "Произошла ошибка при выходе из меню проектов. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: "create_project",
    handler: handleCreateProjectAction,
    errorMessage: "Произошла ошибка при создании проекта. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: "back_to_projects",
    handler: handleBackToProjectsAction,
    errorMessage: "Произошла ошибка при возврате к списку проектов. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /project_(\d+)/,
    handler: handleProjectSelectionAction,
    errorMessage: "Произошла ошибка при выборе проекта. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /manage_hashtags_(\d+)/,
    handler: handleManageHashtagsAction,
    errorMessage: "Произошла ошибка при переходе к управлению хештегами. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /scrape_project_(\d+)/,
    handler: handleScrapeProjectAction,
    errorMessage: "Произошла ошибка при запуске скрапинга. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /reels_list_(\d+)/,
    handler: handleReelsListAction,
    errorMessage: "Произошла ошибка при просмотре Reels. Попробуйте еще раз.",
    verbose: true
  }
]);

// --- Text Handler (Обработчик текстовых сообщений) ---
export async function handleProjectText(ctx: ScraperBotContext) {
  console.log("PROJECT_SCENE_DEBUG: handleProjectText triggered");
  console.log("PROJECT_SCENE_DEBUG: Current session state:", JSON.stringify(ctx.scene.session));

  if (!ctx.message || !("text" in ctx.message)) {
    logger.warn(
      "[ProjectScene] handleProjectText: Received non-text message or no message"
    );
    console.log("PROJECT_SCENE_DEBUG: Received non-text message or no message");
    return;
  }

  const text = ctx.message.text;
  console.log(`PROJECT_SCENE_DEBUG: Received text message: "${text}"`);

  const userSession = ctx.scene.session;
  console.log(`PROJECT_SCENE_DEBUG: Current step: ${userSession.step}`);

  if (userSession.step === ScraperSceneStep.CREATE_PROJECT) {
    console.log("PROJECT_SCENE_DEBUG: Processing CREATE_PROJECT step");
    if (!ctx.from) {
      logger.error("handleProjectText: ctx.from is undefined");
      await ctx.reply("Не удалось определить пользователя. Попробуйте /start.");
      return ctx.scene.leave();
    }
    const telegramId = ctx.from.id;
    const projectName = text.trim();

    if (!isValidProjectName(projectName)) {
      await ctx.reply(
        "Название проекта должно быть от 3 до 100 символов. Пожалуйста, введите корректное название:"
      );
      return;
    }

    try {
      console.log(`PROJECT_SCENE_DEBUG: Initializing storage for project creation: "${projectName}"`);
      await ctx.storage.initialize();

      console.log(`PROJECT_SCENE_DEBUG: Getting user by telegram ID: ${telegramId}`);
      const user = await ctx.storage.getUserByTelegramId(telegramId);

      if (!user) {
        logger.error(
          `[ProjectScene] User not found for telegram_id: ${telegramId} during project creation`
        );
        console.log(`PROJECT_SCENE_DEBUG: User not found for telegram_id: ${telegramId}`);
        await ctx.reply(
          "Произошла ошибка: пользователь не найден. Попробуйте /start."
        );
        userSession.step = undefined;
        return ctx.scene.leave();
      }

      console.log(`PROJECT_SCENE_DEBUG: Creating project "${projectName}" for user ID: ${user.id}`);
      const newProject = await ctx.storage.createProject(user.id, projectName);

      if (newProject) {
        logger.info(
          `[ProjectScene] Project "${projectName}" created for user ${user.id}`
        );
        console.log(`PROJECT_SCENE_DEBUG: Project created successfully with ID: ${newProject.id}`);

        await ctx.reply(`Проект "${newProject.name}" успешно создан!`);
        console.log(`PROJECT_SCENE_DEBUG: Success message sent to user`);

        userSession.currentProjectId = newProject.id;
        userSession.step = undefined;
        console.log(`PROJECT_SCENE_DEBUG: Session updated, reentering scene`);
        console.log(`PROJECT_SCENE_DEBUG: Session state before reenter:`, JSON.stringify(userSession));

        await ctx.scene.reenter();
        console.log(`PROJECT_SCENE_DEBUG: Scene reentered after project creation`);
      } else {
        logger.error(
          `[ProjectScene] Failed to create project "${projectName}" for user ${user.id}`
        );
        console.log(`PROJECT_SCENE_DEBUG: Failed to create project`);

        await ctx.reply(
          "Не удалось создать проект. Попробуйте еще раз или обратитесь в поддержку."
        );
      }
    } catch (error) {
      logger.error(
        `[ProjectScene] Error creating project "${projectName}":`,
        error
      );
      await ctx.reply("Произошла серьезная ошибка при создании проекта.");
      userSession.step = undefined;
      await ctx.scene.leave();
    } finally {
      await ctx.storage.close();
    }
  }
}
projectScene.on("text", handleProjectText);
