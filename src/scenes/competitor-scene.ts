import { NeonAdapter } from "../../adapters/neon-adapter";
import { Scenes } from "telegraf";
import { ScraperBotContext } from "../types";

async function addCompetitor(ctx: ScraperBotContext) {
  const projectId = (ctx as any).session?.projectId;
  const username = (ctx.message as any)?.text?.split(" ")[1];
  if (username && projectId) {
    await neonAdapter.addCompetitorAccount(
      projectId,
      username,
      `https://instagram.com/${username}`
    );
    await ctx.reply(`Competitor ${username} added to project ${projectId}`);
  } else {
    await ctx.reply(
      "Please provide a username for the competitor or ensure a project is selected"
    );
  }
}

// Создаем экземпляр адаптера
const neonAdapter = new NeonAdapter();
// Определяем сцену
const competitorScene = new Scenes.BaseScene<ScraperBotContext>("competitor");

// Регистрируем обработчик для добавления конкурента
competitorScene.command("addcompetitor", async (ctx) => {
  await addCompetitor(ctx);
});
