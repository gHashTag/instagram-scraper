/**
 * Модуль Instagram Scraper Bot для Telegram
 *
 * Предоставляет функциональность для скрапинга Instagram Reels
 * в нише эстетической медицины через интерфейс Telegram бота.
 */

import { Telegraf, Scenes } from "telegraf";
import { competitorScene } from "./src/scenes/competitor-scene";
import { projectScene } from "./src/scenes/project-scene";
import type { Middleware } from "telegraf";
import type {
  StorageAdapter,
  ScraperBotContext,
  InstagramScraperBotConfig,
  // Project, // Закомментировано: не используется напрямую в этом файле, только реэкспортируется
  // Competitor, // Закомментировано: не используется напрямую в этом файле, только реэкспортируется
  // Hashtag, // Закомментировано: не используется напрямую в этом файле, только реэкспортируется
  // ReelContent, // Закомментировано: не используется напрямую в этом файле, только реэкспортируется
} from "@/types";
// import type { MiddlewareFn } from "telegraf/types" // Закомментировано
// import type { ScraperBotContext } from "./types_telegraf" // Закомментировано

// import {
//   type StorageAdapter,
//   type User,
//   type Project,
//   type Competitor,
// } from "@/types" // Закомментировано

// import {
//   createNeonStorageAdapter,
//   initializeNeonStorage,
//   createMultitenantNeonStorageAdapter,
// } from "@/storage" // Закомментировано

// import { logger } from "./logger" // Закомментировано

// Экспортируем типы
export type {
  StorageAdapter,
  ScraperBotContext,
  // Project, // Закомментировано: не используется напрямую в этом файле, только реэкспортируется
  // Competitor, // Закомментировано: не используется напрямую в этом файле, только реэкспортируется
  // Hashtag, // Закомментировано: не используется напрямую в этом файле, только реэкспортируется
  // ReelContent as Reel, // Закомментировано: не используется напрямую в этом файле, только реэкспортируется
  InstagramScraperBotConfig,
} from "@/types";

// Экспорт функций хранилища
// export * from "@/storage" // Закомментировано

// Экспорт функций скрапера
// export * from "@/agent" // Закомментировано временно

/**
 * Настройка модуля Instagram Scraper Bot
 *
 * @param bot Экземпляр Telegraf бота
 * @param storageAdapter Адаптер хранилища данных
 * @param config Конфигурация модуля
 * @returns Объект с API модуля
 */
export function setupInstagramScraperBot(
  bot: Telegraf<ScraperBotContext>, // Используем импортированный ScraperBotContext
  storageAdapter: StorageAdapter,
  config: InstagramScraperBotConfig
) {
  // Инициализируем сцены
  const stage = new Scenes.Stage<ScraperBotContext>([
    projectScene,
    competitorScene,
    // Здесь будут добавляться другие сцены
  ]);

  // Добавляем middleware для доступа к хранилищу и конфигурации
  bot.use((ctx: ScraperBotContext, next) => {
    // Явно типизируем ctx
    ctx.storage = storageAdapter;
    ctx.scraperConfig = config;
    return next();
  });

  // Подключаем Stage middleware
  bot.use(stage.middleware() as Middleware<ScraperBotContext>);

  // Регистрируем обработчики команд
  bot.command("projects", (ctx) =>
    ctx.scene.enter("instagram_scraper_projects")
  );
  bot.command("competitors", (ctx) =>
    ctx.scene.enter("instagram_scraper_competitors")
  );

  // Обработчики текстовых сообщений для меню
  bot.hears("📊 Проекты", (ctx) =>
    ctx.scene.enter("instagram_scraper_projects")
  );
  bot.hears("🔍 Конкуренты", (ctx) =>
    ctx.scene.enter("instagram_scraper_competitors")
  );

  // Возвращаем API модуля
  return {
    // Методы для входа в сцены
    enterProjectScene: () => "instagram_scraper_projects",
    enterCompetitorScene: () => "instagram_scraper_competitors",

    // Получение кнопок для меню
    getMenuButtons: () => [
      ["📊 Проекты", "🔍 Конкуренты"],
      ["#️⃣ Хэштеги", "🎬 Запустить скрапинг"],
      ["📱 Результаты", "ℹ️ Помощь"],
    ],

    // Получение команд для регистрации в Telegram
    getCommands: () => [
      { command: "projects", description: "Управление проектами" },
      { command: "competitors", description: "Управление конкурентами" },
      { command: "hashtags", description: "Управление хэштегами" },
      { command: "scrape", description: "Запустить скрапинг" },
      { command: "reels", description: "Просмотр результатов" },
    ],
  };
}

// Установка обработчика ошибок
// bot.catch((err: any, ctx: ScraperBotContext) => {
//   logger.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
//   ctx.reply("Упс, что-то пошло не так. Попробуйте еще раз позже.");
// });
