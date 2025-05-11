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

// СОЗДАЕМ ЭКЗЕМПЛЯР АДАПТЕРА
const neonAdapter = new NeonAdapter();

// Вход в сцену - выбор проекта или показ конкурентов если проект один
competitorScene.enter(async (ctx) => {
  try {
    // Используем neonAdapter вместо ctx.storage
    await neonAdapter.initialize();

    const user = await neonAdapter.getUserByTelegramId(ctx.from?.id || 0);

    if (!user) {
      await ctx.reply(
        "Вы не зарегистрированы. Пожалуйста, используйте /start для начала работы."
      );
      await neonAdapter.close();
      return ctx.scene.leave(); // Явный return
    }

    const projects = await neonAdapter.getProjectsByUserId(user.id as number); // Приведение типа user.id

    if (!projects || projects.length === 0) {
      await ctx.reply(
        "У вас нет проектов. Создайте проект с помощью команды /projects"
      );
      await neonAdapter.close();
      return ctx.scene.leave(); // Явный return
    }

    // Если есть только один проект, сразу показываем конкурентов
    if (projects.length === 1) {
      const competitors = await neonAdapter.getCompetitorAccounts(
        projects[0].id
      );

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

    await neonAdapter.close();
  } catch (error) {
    console.error("Ошибка при получении конкурентов:", error);
    await ctx.reply(
      "Произошла ошибка при получении конкурентов. Пожалуйста, попробуйте позже."
    );
    // await neonAdapter.close(); // Закрываем в finally или если ошибка не связана с адаптером
    await ctx.scene.leave();
  }
});

// Обработка выбора проекта для просмотра конкурентов
competitorScene.action(/competitors_project_(\d+)/, async (ctx) => {
  const projectId = parseInt(ctx.match[1]);

  try {
    await neonAdapter.initialize();

    const competitors = await neonAdapter.getCompetitorAccounts(projectId);

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

    await neonAdapter.close();
  } catch (error) {
    console.error(
      `Ошибка при получении конкурентов проекта ${projectId}:`,
      error
    );
    await ctx.reply(
      "Произошла ошибка при получении конкурентов. Пожалуйста, попробуйте позже."
    );
    // await neonAdapter.close();
  }

  await ctx.answerCbQuery();
});

// Инициирование добавления нового конкурента
competitorScene.action(/add_competitor_(\d+)/, async (ctx) => {
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
  if (ctx.scene.session.step === ScraperSceneStep.ADD_COMPETITOR) {
    const instagramUrl = ctx.message.text.trim();
    const projectId = ctx.scene.session.projectId;

    if (!projectId) {
      await ctx.reply("Ошибка: не указан проект. Начните сначала.");
      return ctx.scene.reenter(); // Явный return
    }

    // Простая проверка URL, можно улучшить
    if (!instagramUrl.toLowerCase().includes("instagram.com/")) {
      await ctx.reply(
        "Пожалуйста, введите корректный URL Instagram-аккаунта (например, https://www.instagram.com/example):"
      );
      return; // Явный return
    }

    try {
      await neonAdapter.initialize();

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
        await neonAdapter.close();
        return; // Явный return
      }

      const competitor = await neonAdapter.addCompetitorAccount(
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

      // Сбрасываем шаг
      ctx.scene.session.step = undefined;
      await neonAdapter.close();
      return; // Явный return
    } catch (error) {
      console.error("Ошибка при добавлении конкурента:", error);
      await ctx.reply(
        "Произошла ошибка при добавлении конкурента. Пожалуйста, попробуйте позже."
      );
      // await neonAdapter.close(); // Закрываем в finally или при реальной ошибке, не дающей продолжить
      return; // Явный return в catch
    }
  } else {
    // Если шаг не определен, или это не шаг добавления конкурента
    // Можно добавить обработку других команд или просто игнорировать
    // Для примера, просто напоминаем использовать кнопки или известные команды
    await ctx.reply("Используйте кнопки для навигации или известные команды.");
    return; // Явный return
  }
});

// Обработка возврата к списку проектов
competitorScene.action("back_to_projects", async (ctx) => {
  await ctx.answerCbQuery();
  // Здесь нужно перейти к сцене проектов. Предполагаем, что она называется 'instagram_scraper_projects'
  return ctx.scene.enter("instagram_scraper_projects"); // Явный return
});

// Обработка выхода из сцены
competitorScene.action("exit_scene", async (ctx) => {
  await ctx.answerCbQuery("Выход из режима управления конкурентами");
  await ctx.reply("Вы вышли из режима управления конкурентами", {
    reply_markup: { remove_keyboard: true },
  });
  return ctx.scene.leave(); // Явный return
});

export default competitorScene;
