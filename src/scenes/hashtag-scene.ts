import { Scenes, Markup } from "telegraf";
import { ScraperBotContext } from "../types";
import { NeonAdapter } from "../adapters/neon-adapter";
import { ScraperSceneStep, ScraperSceneSessionData } from "@/types";
// import { User } from "../types"; // Remove unused import

/**
 * Сцена для управления хештегами проекта
 */
export const hashtagScene = new Scenes.BaseScene<
  ScraperBotContext & { scene: { session: ScraperSceneSessionData } }
>("instagram_scraper_hashtags");

// Вход в сцену - показ хештегов для проекта
hashtagScene.enter(async (ctx) => {
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
    // TODO: Получить хештеги
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
            [Markup.button.callback("Назад к проекту", `project_${projectId}`)], // Кнопка возврата к управлению проектом
          ]).reply_markup,
        }
      );
    } else {
      const hashtagList = hashtags
        .map((h, i) => `${i + 1}. #${h.hashtag}`)
        .join("\n");
      // TODO: Добавить кнопки удаления
      const hashtagButtons = hashtags.map((h) => [
        Markup.button.callback(
          `🗑️ Удалить #${h.hashtag}`,
          `delete_hashtag_${projectId}_${h.hashtag}`
        ),
      ]);

      await ctx.reply(
        `Хештеги в проекте "${projectName}":\n\n${hashtagList}\n\nЧто вы хотите сделать дальше?`,
        {
          reply_markup: Markup.inlineKeyboard([
            ...hashtagButtons, // Добавляем кнопки удаления
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
    // Не покидаем сцену, даем шанс попробовать еще раз или вернуться
  } finally {
    if (adapter) {
      await adapter.close();
    }
  }
});

// Обработка кнопки "Добавить хештег"
hashtagScene.action(/add_hashtag_(\d+)/, async (ctx) => {
  const projectId = parseInt(ctx.match[1], 10);
  if (isNaN(projectId)) {
    console.error(
      `Invalid projectId parsed from add_hashtag action: ${ctx.match[1]}`
    );
    await ctx.reply("Ошибка выбора проекта. Пожалуйста, вернитесь назад.");
    await ctx.answerCbQuery();
    return;
  }
  ctx.scene.session.projectId = projectId; // Убедимся, что projectId в сессии
  ctx.scene.session.step = ScraperSceneStep.ADD_HASHTAG;
  await ctx.reply("Введите хештег для добавления (без #):", {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback("Отмена", `cancel_hashtag_input_${projectId}`)],
    ]).reply_markup,
  });
  await ctx.answerCbQuery();
});

// Обработка кнопки "Отмена" при вводе хештега
hashtagScene.action(/cancel_hashtag_input_(\d+)/, async (ctx) => {
  await ctx.deleteMessage(); // Удаляем сообщение с запросом ввода
  ctx.scene.session.step = undefined;
  await ctx.answerCbQuery("Ввод отменен.");
  // Возвращаемся к отображению хештегов
  ctx.scene.reenter();
});

// Обработка текстовых сообщений (ввод хештега)
hashtagScene.on("text", async (ctx) => {
  if (ctx.scene.session.step !== ScraperSceneStep.ADD_HASHTAG) {
    return; // Ничего не делаем, если не ожидаем ввод хештега
  }

  const adapter = ctx.storage as NeonAdapter;
  const projectId = ctx.scene.session.projectId;
  let hashtagInput = ctx.message.text.trim();

  if (!projectId) {
    await ctx.reply("Ошибка: проект не определен. Начните сначала.");
    ctx.scene.session.step = undefined;
    return ctx.scene.leave();
  }

  // Убираем # если пользователь его ввел
  if (hashtagInput.startsWith("#")) {
    hashtagInput = hashtagInput.substring(1);
  }

  // Простая валидация
  if (!hashtagInput || hashtagInput.includes(" ") || hashtagInput.length < 2) {
    await ctx.reply(
      "Некорректный хештег. Введите одно слово без пробелов (минимум 2 символа), # ставить не нужно."
    );
    // Остаемся в состоянии ожидания ввода
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
    ctx.scene.session.step = undefined; // Сбрасываем шаг
    ctx.scene.reenter(); // Перезаходим, чтобы показать обновленный список
  }
});

// Обработка удаления хештега
hashtagScene.action(/delete_hashtag_(\d+)_(.+)/, async (ctx) => {
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
    await adapter.removeHashtag(projectId, hashtag); // Используем существующий метод
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
    ctx.scene.reenter(); // Перезаходим для обновления списка
  }
});

// Кнопка Назад к проекту (выход из сцены хештегов)
hashtagScene.action(/project_(\d+)/, async (ctx) => {
  // TODO: Возможно, лучше переходить в projectScene, а не просто выходить?
  // Пока просто выходим
  await ctx.scene.leave();
  // Можно добавить сообщение о возврате к проекту
  await ctx.reply("Возврат к управлению проектом...");
  await ctx.answerCbQuery();
  // Вызываем команду /projects, чтобы инициировать projectScene
  // Это не лучший способ, в идеале нужно ctx.scene.enter('project_scene_id')
  // но для этого нужно передавать projectId или как-то его сохранять
  // ctx.telegram.sendMessage(ctx.chat.id, '/projects'); // Не сработает корректно из callback
});

export default hashtagScene;
