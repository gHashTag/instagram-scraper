/**
 * Модуль Instagram Scraper Bot для Telegram
 *
 * Предоставляет функциональность для скрапинга Instagram Reels
 * в нише эстетической медицины через интерфейс Telegram бота.
 */

import { Telegraf, Scenes } from "telegraf";
import { competitorScene } from "./src/scenes/competitor-scene";
import { projectScene } from "./src/scenes/project-scene";
import { hashtagScene } from "./src/scenes/hashtag-scene";
import { scrapingScene } from "./src/scenes/scraping-scene";
import { reelsScene } from "./src/scenes/reels-scene";
import { analyticsScene } from "./src/scenes/analytics-scene";
import { notificationScene } from "./src/scenes/notification-scene";
import { ReelsCollectionScene } from "./src/scenes/reels-collection-scene";
import { ChatbotScene } from "./src/scenes/chatbot-scene";
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
    hashtagScene,
    scrapingScene,
    reelsScene,
    analyticsScene,
    notificationScene,
    new ReelsCollectionScene(storageAdapter),
    new ChatbotScene(storageAdapter, process.env.OPENAI_API_KEY),
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
  bot.command("scrape", (ctx) =>
    ctx.scene.enter("instagram_scraper_scraping")
  );
  bot.command("reels", (ctx) =>
    ctx.scene.enter("instagram_scraper_reels")
  );
  bot.command("analytics", (ctx) =>
    ctx.scene.enter("instagram_scraper_analytics")
  );
  bot.command("notifications", (ctx) =>
    ctx.scene.enter("instagram_scraper_notifications")
  );
  bot.command("collections", (ctx) =>
    ctx.scene.enter("reels_collection_scene")
  );
  bot.command("chatbot", (ctx) =>
    ctx.scene.enter("chatbot_scene")
  );

  // Обработчики текстовых сообщений для меню
  bot.hears("📊 Проекты", (ctx) =>
    ctx.scene.enter("instagram_scraper_projects")
  );
  bot.hears("🔍 Конкуренты", async (ctx) => {
    console.log("[DEBUG] Обработчик кнопки '🔍 Конкуренты' вызван");
    try {
      // Проверяем наличие ctx.session и инициализируем, если отсутствует
      if (!ctx.session) {
        console.log("[DEBUG] Инициализируем ctx.session в обработчике кнопки 'Конкуренты'");
        ctx.session = {};
      }

      // Проверяем наличие ctx.scene.session и инициализируем, если отсутствует
      if (!ctx.scene.session) {
        console.log("[DEBUG] Инициализируем ctx.scene.session в обработчике кнопки 'Конкуренты'");
        (ctx.scene as any).session = {};
      }

      await ctx.scene.enter("instagram_scraper_competitors");
      console.log("[DEBUG] Успешно вошли в сцену конкурентов");
    } catch (error) {
      console.error("[ERROR] Ошибка при входе в сцену конкурентов:", error);
      await ctx.reply("Произошла ошибка при входе в режим управления конкурентами. Попробуйте еще раз.");
    }
  });
  bot.hears("🎬 Запустить скрапинг", (ctx) =>
    ctx.scene.enter("instagram_scraper_scraping")
  );
  bot.hears("👀 Просмотр Reels", (ctx) =>
    ctx.scene.enter("instagram_scraper_reels")
  );
  bot.hears("📈 Аналитика", (ctx) =>
    ctx.scene.enter("instagram_scraper_analytics")
  );
  bot.hears("🔔 Уведомления", (ctx) =>
    ctx.scene.enter("instagram_scraper_notifications")
  );
  bot.hears("📋 Коллекции Reels", (ctx) =>
    ctx.scene.enter("reels_collection_scene")
  );
  bot.hears("🤖 Чат-бот", (ctx) =>
    ctx.scene.enter("chatbot_scene")
  );

  // Возвращаем API модуля
  return {
    // Методы для входа в сцены
    enterProjectScene: () => "instagram_scraper_projects",
    enterCompetitorScene: () => "instagram_scraper_competitors",
    enterScrapingScene: () => "instagram_scraper_scraping",
    enterReelsScene: () => "instagram_scraper_reels",
    enterAnalyticsScene: () => "instagram_scraper_analytics",
    enterNotificationScene: () => "instagram_scraper_notifications",
    enterReelsCollectionScene: () => "reels_collection_scene",
    enterChatbotScene: () => "chatbot_scene",

    // Получение кнопок для меню
    getMenuButtons: () => [
      ["📊 Проекты", "🔍 Конкуренты"],
      ["#️⃣ Хэштеги", "🎬 Запустить скрапинг"],
      ["👀 Просмотр Reels", "📈 Аналитика"],
      ["🔔 Уведомления", "📋 Коллекции Reels"],
      ["🤖 Чат-бот", "ℹ️ Помощь"],
    ],

    // Получение команд для регистрации в Telegram
    getCommands: () => [
      { command: "projects", description: "Управление проектами" },
      { command: "competitors", description: "Управление конкурентами" },
      { command: "hashtags", description: "Управление хэштегами" },
      { command: "scrape", description: "Запустить скрапинг" },
      { command: "reels", description: "Просмотр Reels" },
      { command: "analytics", description: "Аналитика данных" },
      { command: "notifications", description: "Настройка уведомлений" },
      { command: "collections", description: "Коллекции Reels" },
      { command: "chatbot", description: "Чат-бот для общения с видео" },
    ],
  };
}

// Установка обработчика ошибок
// bot.catch((err: any, ctx: ScraperBotContext) => {
//   logger.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
//   ctx.reply("Упс, что-то пошло не так. Попробуйте еще раз позже.");
// });
