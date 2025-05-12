import { Scenes, Markup } from "telegraf";
import { ScraperBotContext } from "../types";
import { NeonAdapter } from "../adapters/neon-adapter";
import { ScraperSceneStep, ScraperSceneSessionData } from "@/types";

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

        await ctx.reply(
          `Конкуренты в проекте "${projects[0].name}":\n\n${competitorList}`,
          {
            parse_mode: "Markdown",
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
      "Произошла ошибка при получении конкурентов. Пожалуйста, попробуйте позже."
    );
    // await adapter.close(); // Закрываем в finally или если ошибка не связана с адаптером
    await ctx.scene.leave();
  }
});

// Обработка выбора проекта для просмотра конкурентов
competitorScene.action(/competitors_project_(\d+)/, async (ctx) => {
  const adapter = ctx.storage as NeonAdapter;
  const projectId = parseInt(ctx.match[1]);

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

      await ctx.reply(`Конкуренты в выбранном проекте:\n\n${competitorList}`, {
        parse_mode: "Markdown",
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
      });
    }

    await adapter.close();
  } catch (error) {
    console.error(
      `Ошибка при получении конкурентов проекта ${projectId}:`,
      error
    );
    await ctx.reply(
      "Произошла ошибка при получении конкурентов. Пожалуйста, попробуйте позже."
    );
    // await adapter.close();
  }

  await ctx.answerCbQuery();
});

// Инициирование добавления нового конкурента
competitorScene.action(/add_competitor_(\d+)/, async (ctx) => {
  // Здесь адаптер не используется напрямую, только сессия
  const projectId = parseInt(ctx.match[1]);
  ctx.scene.session.projectId = projectId;

  await ctx.reply(
    "Введите Instagram URL конкурента (например, https://www.instagram.com/example):"
  );
  ctx.scene.session.step = ScraperSceneStep.ADD_COMPETITOR;

  await ctx.answerCbQuery();
});

// Обработка текстовых сообщений
competitorScene.on("text", async (ctx) => {
  const adapter = ctx.storage as NeonAdapter;
  if (ctx.scene.session.step === ScraperSceneStep.ADD_COMPETITOR) {
    const instagramUrl = ctx.message.text.trim();
    const projectId = ctx.scene.session.projectId;

    if (!projectId) {
      await ctx.reply("Ошибка: не указан проект. Начните сначала.");
      return ctx.scene.reenter();
    }

    // Простая проверка URL, можно улучшить
    if (!instagramUrl.toLowerCase().includes("instagram.com/")) {
      await ctx.reply(
        "Пожалуйста, введите корректный URL Instagram-аккаунта (например, https://www.instagram.com/example):"
      );
      return; // Явный выход, если URL некорректен
    }

    try {
      await adapter.initialize();

      // Извлекаем имя пользователя из URL
      let username = instagramUrl.substring(instagramUrl.lastIndexOf("/") + 1);
      // Убираем возможные параметры из URL типа ?igshid=...
      username = username.split("?")[0];
      // Убираем возможный слеш в конце
      if (username.endsWith("/")) {
        username = username.slice(0, -1);
      }

      if (!username) {
        await ctx.reply(
          "Не удалось извлечь имя пользователя из URL. Пожалуйста, проверьте URL и попробуйте снова."
        );
        // await adapter.close(); // Закрытие адаптера в блоке finally
        return; // Явный выход
      }

      const competitor = await adapter.addCompetitorAccount(
        projectId,
        username,
        instagramUrl
      );

      if (competitor) {
        await ctx.reply(`Конкурент @${username} успешно добавлен!`, {
          reply_markup: Markup.inlineKeyboard([
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
          ]).reply_markup,
        });
      } else {
        await ctx.reply("Ошибка при добавлении конкурента. Попробуйте позже.");
      }

      ctx.scene.session.step = undefined; // Сбрасываем шаг
      // await adapter.close(); // Закрытие адаптера в блоке finally
      return; // Явный выход после успешной обработки или ошибки добавления
    } catch (error) {
      console.error("Ошибка при добавлении конкурента в сцене:", error);
      await ctx.reply(
        "Произошла внутренняя ошибка при добавлении конкурента. Попробуйте позже."
      );
      ctx.scene.session.step = undefined; // Сбрасываем шаг на всякий случай
      // await adapter.close(); // Закрытие адаптера в блоке finally
      return; // Явный выход в случае ошибки
    } finally {
      // Гарантированное закрытие адаптера
      if (adapter && typeof adapter.close === "function") {
        await adapter.close();
      }
    }
  } else {
    // Если шаг не ADD_COMPETITOR, то ничего не делаем или переходим в начало
    // Для явности можно добавить return или специфическое поведение
    return; // Явный выход, если шаг не соответствует
  }
});

// Обработка кнопки "Выйти"
competitorScene.action("exit_scene", async (ctx) => {
  await ctx.reply("Вы вышли из режима управления конкурентами.", {
    reply_markup: { remove_keyboard: true },
  });
  await ctx.scene.leave();
  await ctx.answerCbQuery();
});

// Обработка кнопки "Назад к проектам" (возврат к началу текущей сцены для выбора проекта)
competitorScene.action("back_to_projects", async (ctx) => {
  await ctx.scene.reenter();
  await ctx.answerCbQuery();
});

export default competitorScene;
