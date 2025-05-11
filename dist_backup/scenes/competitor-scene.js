import { Scenes, Markup } from "telegraf";
import { ScraperSceneStep, } from "@/types";
/**
 * Сцена для управления конкурентами
 */
export const competitorScene = new Scenes.BaseScene("instagram_scraper_competitors");
// Вход в сцену - выбор проекта или показ конкурентов если проект один
competitorScene.enter(async (ctx) => {
    try {
        await ctx.storage?.initialize();
        const user = await ctx.storage?.getUserByTelegramId(ctx.from?.id || 0);
        if (!user) {
            await ctx.reply("Вы не зарегистрированы. Пожалуйста, используйте /start для начала работы.");
            await ctx.storage?.close();
            return await ctx.scene.leave();
        }
        const projects = await ctx.storage?.getProjectsByUserId(user.id);
        if (!projects || projects.length === 0) {
            await ctx.reply("У вас нет проектов. Создайте проект с помощью команды /projects");
            await ctx.storage?.close();
            return await ctx.scene.leave();
        }
        // Если есть только один проект, сразу показываем конкурентов
        if (projects.length === 1) {
            const competitors = await ctx.storage?.getCompetitorAccounts(projects[0].id);
            if (!competitors || competitors.length === 0) {
                await ctx.reply(`В проекте "${projects[0].name}" нет добавленных конкурентов. Хотите добавить?`, {
                    reply_markup: Markup.inlineKeyboard([
                        [
                            Markup.button.callback("Добавить конкурента", `add_competitor_${projects[0].id}`),
                        ],
                        [Markup.button.callback("Выйти", "exit_scene")],
                    ]).reply_markup,
                });
            }
            else {
                const competitorList = competitors
                    .map((c, i) => `${i + 1}. [${c.username}](${c.instagram_url})`)
                    .join("\n");
                await ctx.reply(`Конкуренты в проекте "${projects[0].name}":\n\n${competitorList}`, {
                    parse_mode: "Markdown",
                    reply_markup: Markup.inlineKeyboard([
                        [
                            Markup.button.callback("Добавить конкурента", `add_competitor_${projects[0].id}`),
                        ],
                        [Markup.button.callback("Выйти", "exit_scene")],
                    ]).reply_markup,
                });
            }
        }
        else {
            // Если несколько проектов, просим выбрать
            const projectButtons = projects.map(project => [
                Markup.button.callback(project.name, `competitors_project_${project.id}`),
            ]);
            projectButtons.push([Markup.button.callback("Выйти", "exit_scene")]);
            await ctx.reply("Выберите проект для просмотра конкурентов:", {
                reply_markup: Markup.inlineKeyboard(projectButtons).reply_markup,
            });
        }
        await ctx.storage?.close();
    }
    catch (error) {
        console.error("Ошибка при получении конкурентов:", error);
        await ctx.reply("Произошла ошибка при получении конкурентов. Пожалуйста, попробуйте позже.");
        await ctx.storage?.close();
        await ctx.scene.leave();
    }
});
// Обработка выбора проекта для просмотра конкурентов
competitorScene.action(/competitors_project_(\d+)/, async (ctx) => {
    const projectId = parseInt(ctx.match[1]);
    try {
        await ctx.storage?.initialize();
        const competitors = await ctx.storage?.getCompetitorAccounts(projectId);
        if (!competitors || competitors.length === 0) {
            await ctx.reply("В выбранном проекте нет добавленных конкурентов. Хотите добавить?", {
                reply_markup: Markup.inlineKeyboard([
                    [
                        Markup.button.callback("Добавить конкурента", `add_competitor_${projectId}`),
                    ],
                    [Markup.button.callback("Назад к проектам", "back_to_projects")],
                    [Markup.button.callback("Выйти", "exit_scene")],
                ]).reply_markup,
            });
        }
        else {
            const competitorList = competitors
                .map((c, i) => `${i + 1}. [${c.username}](${c.instagram_url})`)
                .join("\n");
            await ctx.reply(`Конкуренты в выбранном проекте:\n\n${competitorList}`, {
                parse_mode: "Markdown",
                reply_markup: Markup.inlineKeyboard([
                    [
                        Markup.button.callback("Добавить конкурента", `add_competitor_${projectId}`),
                    ],
                    [Markup.button.callback("Назад к проектам", "back_to_projects")],
                    [Markup.button.callback("Выйти", "exit_scene")],
                ]).reply_markup,
            });
        }
        await ctx.storage?.close();
    }
    catch (error) {
        console.error(`Ошибка при получении конкурентов проекта ${projectId}:`, error);
        await ctx.reply("Произошла ошибка при получении конкурентов. Пожалуйста, попробуйте позже.");
        await ctx.storage?.close();
    }
    await ctx.answerCbQuery();
});
// Инициирование добавления нового конкурента
competitorScene.action(/add_competitor_(\d+)/, async (ctx) => {
    const projectId = parseInt(ctx.match[1]);
    ctx.scene.session.projectId = projectId;
    await ctx.reply("Введите Instagram URL конкурента (например, https://www.instagram.com/example):");
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
            return await ctx.scene.reenter();
        }
        if (!instagramUrl.includes("instagram.com/")) {
            await ctx.reply("Пожалуйста, введите корректный URL Instagram-аккаунта (например, https://www.instagram.com/example):");
            return;
        }
        try {
            await ctx.storage?.initialize();
            // Извлекаем имя пользователя из URL
            const urlParts = instagramUrl.split("/");
            const username = urlParts[urlParts.length - 1].split("?")[0];
            const competitor = await ctx.storage?.createCompetitor(projectId, username, instagramUrl);
            if (competitor) {
                await ctx.reply(`Конкурент @${username} успешно добавлен!`, {
                    reply_markup: Markup.inlineKeyboard([
                        [
                            Markup.button.callback("Посмотреть всех конкурентов", `competitors_project_${projectId}`),
                        ],
                        [
                            Markup.button.callback("Добавить еще конкурента", `add_competitor_${projectId}`),
                        ],
                        [Markup.button.callback("Выйти", "exit_scene")],
                    ]).reply_markup,
                });
            }
            else {
                await ctx.reply("Ошибка при добавлении конкурента. Попробуйте позже.");
            }
            // Сбрасываем шаг
            ctx.scene.session.step = undefined;
            await ctx.storage?.close();
            return;
        }
        catch (error) {
            console.error("Ошибка при добавлении конкурента:", error);
            await ctx.reply("Произошла ошибка при добавлении конкурента. Пожалуйста, попробуйте позже.");
            await ctx.storage?.close();
            return;
        }
    }
    else {
        await ctx.reply("Я не понимаю эту команду. Используйте кнопки для управления конкурентами.");
        return;
    }
});
// Обработка кнопки "Назад к проектам"
competitorScene.action("back_to_projects", async (ctx) => {
    await ctx.answerCbQuery();
    return await ctx.scene.reenter();
});
// Обработка выхода из сцены
competitorScene.action("exit_scene", async (ctx) => {
    await ctx.answerCbQuery("Выход из режима управления конкурентами");
    await ctx.reply("Вы вышли из режима управления конкурентами", {
        reply_markup: { remove_keyboard: true },
    });
    return await ctx.scene.leave();
});
export default competitorScene;
