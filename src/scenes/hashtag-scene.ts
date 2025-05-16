import { Scenes, Markup } from "telegraf";
import type { ScraperBotContext } from "@/types";
import { NeonAdapter } from "../adapters/neon-adapter";
import { ScraperSceneStep, ScraperSceneSessionData } from "@/types";
// import { PAGINATION_LIMIT } from "./components/keyboard-pagination"; // Удаляем этот импорт
// import { User } from "../types"; // Remove unused import
import { registerButtons } from "../utils/button-handler";

/**
 * Обработчик входа в сцену управления хештегами
 */
export async function handleHashtagEnter(
  ctx: ScraperBotContext & {
    scene: { session: ScraperSceneSessionData; leave: () => void };
  }
) {
  const adapter = ctx.storage as NeonAdapter;
  const projectId = ctx.scene.session.projectId;

  if (!projectId) {
    await ctx.reply(
      "Ошибка: проект не определен. Пожалуйста, вернитесь и выберите проект."
    );
    return ctx.scene.leave();
  }

  try {
    await adapter.initialize();
    const hashtags = await adapter.getHashtagsByProjectId(projectId);
    const projectName =
      (await adapter.getProjectById(projectId))?.name ||
      `Проект ID ${projectId}`;

    if (!hashtags || hashtags.length === 0) {
      await ctx.reply(
        `В проекте "${projectName}" нет отслеживаемых хештегов. Хотите добавить первый?`,
        {
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "Добавить хештег",
                `add_hashtag_${projectId}`
              ),
            ],
            [Markup.button.callback("Назад к проекту", `project_${projectId}`)],
          ]).reply_markup,
        }
      );
    } else {
      const hashtagList = hashtags
        .map((h, i) => `${i + 1}. #${h.hashtag}`)
        .join("\n");
      const hashtagButtons = hashtags.map((h) => [
        Markup.button.callback(
          `#${h.hashtag}`,
          `hashtag_${projectId}_${h.id}`
        ),
        Markup.button.callback(
          `👀`,
          `reels_list_${projectId}_hashtag_${h.id}`
        ),
        Markup.button.callback(
          `🗑️`,
          `delete_hashtag_${projectId}_${h.hashtag}`
        ),
      ]);

      await ctx.reply(
        `Хештеги в проекте "${projectName}":\n\n${hashtagList}\n\nЧто вы хотите сделать дальше?`,
        {
          reply_markup: Markup.inlineKeyboard([
            ...hashtagButtons,
            [
              Markup.button.callback(
                "Добавить хештег",
                `add_hashtag_${projectId}`
              ),
            ],
            [Markup.button.callback("Назад к проекту", `project_${projectId}`)],
          ]).reply_markup,
        }
      );
    }
  } catch (error) {
    console.error(
      `Ошибка при получении хештегов для проекта ${projectId}:`,
      error
    );
    await ctx.reply("Не удалось загрузить список хештегов. Попробуйте позже.");
  } finally {
    if (adapter) {
      await adapter.close();
    }
  }
}

/**
 * Обработчик нажатия кнопки "Добавить хештег"
 */
export async function handleAddHashtagAction(
  ctx: ScraperBotContext & {
    scene: { session: ScraperSceneSessionData };
    match: RegExpExecArray;
    answerCbQuery: () => Promise<boolean>;
  }
) {
  const projectId = parseInt(ctx.match[1], 10);
  if (isNaN(projectId)) {
    console.error(
      `Invalid projectId parsed from add_hashtag action: ${ctx.match[1]}`
    );
    await ctx.reply("Ошибка выбора проекта. Пожалуйста, вернитесь назад.");
    await ctx.answerCbQuery();
    return;
  }
  ctx.scene.session.projectId = projectId;
  ctx.scene.session.step = ScraperSceneStep.ADD_HASHTAG;
  await ctx.reply("Введите хештег для добавления (без #):", {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback("Отмена", `cancel_hashtag_input_${projectId}`)],
    ]).reply_markup,
  });
  await ctx.answerCbQuery();
}

/**
 * Обработчик нажатия кнопки "Отмена" при вводе хештега
 */
export async function handleCancelHashtagInputAction(
  ctx: ScraperBotContext & {
    scene: { session: ScraperSceneSessionData; reenter: () => void };
    answerCbQuery: (text?: string) => Promise<boolean>;
    deleteMessage: () => Promise<boolean>;
  }
) {
  await ctx.deleteMessage();
  ctx.scene.session.step = undefined;
  await ctx.answerCbQuery("Ввод отменен.");
  ctx.scene.reenter();
}

/**
 * Обработчик ввода текста хештега
 */
export async function handleHashtagTextInput(
  ctx: ScraperBotContext & {
    scene: {
      session: ScraperSceneSessionData;
      leave: () => void;
      reenter: () => void;
    };
    message: { text: string };
  }
) {
  if (ctx.scene.session.step !== ScraperSceneStep.ADD_HASHTAG) {
    return;
  }

  const adapter = ctx.storage as NeonAdapter;
  const projectId = ctx.scene.session.projectId;
  let hashtagInput = ctx.message.text.trim();

  if (!projectId) {
    await ctx.reply("Ошибка: проект не определен. Начните сначала.");
    ctx.scene.session.step = undefined;
    return ctx.scene.leave();
  }

  if (hashtagInput.startsWith("#")) {
    hashtagInput = hashtagInput.substring(1);
  }

  if (!hashtagInput || hashtagInput.includes(" ") || hashtagInput.length < 2) {
    await ctx.reply(
      "Некорректный хештег. Введите одно слово без пробелов (минимум 2 символа), # ставить не нужно."
    );
    return;
  }

  try {
    await adapter.initialize();
    const addedHashtag = await adapter.addHashtag(projectId, hashtagInput);
    if (addedHashtag) {
      await ctx.reply(`Хештег #${hashtagInput} успешно добавлен.`);
    } else {
      await ctx.reply(
        `Не удалось добавить хештег #${hashtagInput}. Возможно, он уже существует или произошла ошибка.`
      );
    }
  } catch (error) {
    console.error(
      `Ошибка при добавлении хештега ${hashtagInput} в проект ${projectId}:`,
      error
    );
    await ctx.reply("Произошла техническая ошибка при добавлении хештега.");
  } finally {
    if (adapter) {
      await adapter.close();
    }
    ctx.scene.session.step = undefined;
    ctx.scene.reenter();
  }
}

/**
 * Обработчик удаления хештега
 */
export async function handleDeleteHashtagAction(
  ctx: ScraperBotContext & {
    scene: { session: ScraperSceneSessionData; reenter: () => void };
    match: RegExpExecArray;
    answerCbQuery: (text?: string) => Promise<boolean>;
  }
) {
  const adapter = ctx.storage as NeonAdapter;
  const projectId = parseInt(ctx.match[1], 10);
  const hashtag = ctx.match[2];

  if (isNaN(projectId) || !hashtag) {
    console.error(
      `Invalid data parsed from delete hashtag action: projectId=${ctx.match[1]}, hashtag=${ctx.match[2]}`
    );
    await ctx.reply("Ошибка при удалении хештега.");
    await ctx.answerCbQuery("Ошибка");
    return;
  }

  try {
    await adapter.initialize();
    await adapter.removeHashtag(projectId, hashtag);
    await ctx.reply(`Хештег #${hashtag} удален.`);
    await ctx.answerCbQuery("Удалено");
  } catch (error) {
    console.error(
      `Ошибка при удалении хештега ${hashtag} из проекта ${projectId}:`,
      error
    );
    await ctx.reply("Произошла ошибка при удалении хештега.");
    await ctx.answerCbQuery("Ошибка");
  } finally {
    if (adapter) {
      await adapter.close();
    }
    ctx.scene.reenter();
  }
}

/**
 * Обработчик кнопки Назад к проекту
 */
export async function handleBackToProjectAction(
  ctx: ScraperBotContext & {
    scene: { leave: () => void };
    answerCbQuery: () => Promise<boolean>;
    // match: RegExpExecArray; // match не нужен здесь, но может понадобиться для входа в projectScene
  }
) {
  await ctx.scene.leave();
  await ctx.reply("Возврат к управлению проектом...");
  await ctx.answerCbQuery();
  // TODO: Рассмотреть ctx.scene.enter('instagram_scraper_projects') с передачей projectId
}

/**
 * Сцена для управления хештегами проекта
 */
export const hashtagScene = new Scenes.BaseScene<
  ScraperBotContext & { scene: { session: ScraperSceneSessionData } }
>("instagram_scraper_hashtags");

// Привязываем экспортированные обработчики к событиям сцены
hashtagScene.enter(handleHashtagEnter);
hashtagScene.on("text", handleHashtagTextInput);

// Обработчик для просмотра Reels хештега
export async function handleReelsListAction(
  ctx: ScraperBotContext
) {
  const match = ctx.match as unknown as RegExpExecArray;
  const projectId = parseInt(match[1], 10);
  const sourceType = match[2] as "hashtag";
  const hashtagId = parseInt(match[3], 10);

  if (isNaN(projectId) || isNaN(hashtagId)) {
    console.error(
      `Invalid data parsed from reels_list action: projectId=${match[1]}, hashtagId=${match[3]}`
    );
    await ctx.reply("Ошибка при переходе к просмотру Reels.");
    if (ctx.callbackQuery) await ctx.answerCbQuery("Ошибка");
    return;
  }

  ctx.scene.session.currentProjectId = projectId;
  ctx.scene.session.currentSourceType = sourceType;
  ctx.scene.session.currentSourceId = hashtagId;

  await ctx.answerCbQuery();
  await ctx.scene.enter("instagram_scraper_reels", {
    projectId,
    sourceType,
    sourceId: hashtagId
  });
}

// Регистрация обработчиков кнопок с использованием централизованного обработчика
registerButtons(hashtagScene, [
  {
    id: /add_hashtag_(\d+)/,
    handler: handleAddHashtagAction,
    errorMessage: "Произошла ошибка при добавлении хештега. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /cancel_hashtag_input_(\d+)/,
    handler: handleCancelHashtagInputAction,
    errorMessage: "Произошла ошибка при отмене ввода. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /delete_hashtag_(\d+)_(.+)/,
    handler: handleDeleteHashtagAction,
    errorMessage: "Произошла ошибка при удалении хештега. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /project_(\d+)/,
    handler: handleBackToProjectAction,
    errorMessage: "Произошла ошибка при возврате к проекту. Попробуйте еще раз.",
    verbose: true
  },
  {
    id: /reels_list_(\d+)_(.+)_(\d+)/,
    handler: handleReelsListAction,
    errorMessage: "Произошла ошибка при просмотре Reels. Попробуйте еще раз.",
    verbose: true
  }
]);

export default hashtagScene;
