/**
 * Модуль Instagram Scraper Bot для Telegram
 *
 * Предоставляет функциональность для скрапинга Instagram Reels
 * в нише эстетической медицины через интерфейс Telegram бота.
 */

import { Telegraf, Scenes } from "telegraf";
import { competitorScene } from "./src/scenes/competitor-scene";
import { competitorWizardScene, setupCompetitorWizard } from "./src/scenes/competitor-wizard-scene";
import { projectScene } from "./src/scenes/project-scene";
import { projectWizardScene, setupProjectWizard } from "./src/scenes/project-wizard-scene";
import { hashtagScene } from "./src/scenes/hashtag-scene";
import { hashtagWizardScene, setupHashtagWizard } from "./src/scenes/hashtag-wizard-scene";
import { scrapingScene } from "./src/scenes/scraping-scene";
import { scrapingWizardScene, setupScrapingWizard } from "./src/scenes/scraping-wizard-scene";
import { reelsScene } from "./src/scenes/reels-scene";
import { reelsWizardScene, setupReelsWizard } from "./src/scenes/reels-wizard-scene";
import { analyticsScene } from "./src/scenes/analytics-scene";
import { analyticsWizardScene, setupAnalyticsWizard } from "./src/scenes/analytics-wizard-scene";
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
    projectWizardScene, // Добавляем новую визард-сцену для проектов
    competitorScene,
    competitorWizardScene, // Добавляем новую визард-сцену для конкурентов
    hashtagScene,
    hashtagWizardScene, // Добавляем новую визард-сцену для хештегов
    scrapingScene,
    scrapingWizardScene, // Добавляем новую визард-сцену для скрапинга
    reelsScene,
    reelsWizardScene, // Добавляем новую визард-сцену для просмотра Reels
    analyticsScene,
    analyticsWizardScene, // Добавляем новую визард-сцену для аналитики
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

  // Настраиваем обработчики для wizard-сцен
  setupProjectWizard(bot);
  setupCompetitorWizard(bot);
  setupHashtagWizard(bot);
  setupScrapingWizard(bot);
  setupReelsWizard(bot);
  setupAnalyticsWizard(bot);

  // Регистрируем обработчики команд
  bot.command("projects", (ctx) =>
    ctx.scene.enter("project_wizard")
  );
  bot.command("competitors", (ctx) =>
    ctx.scene.enter("competitor_wizard")
  );
  bot.command("hashtags", (ctx) =>
    ctx.scene.enter("hashtag_wizard")
  );
  bot.command("scrape", (ctx) =>
    ctx.scene.enter("scraping_wizard")
  );
  bot.command("reels", (ctx) =>
    ctx.scene.enter("reels_wizard")
  );
  bot.command("analytics", (ctx) =>
    ctx.scene.enter("analytics_wizard")
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
    ctx.scene.enter("project_wizard")
  );
  bot.hears("🔍 Конкуренты", (ctx) => {
    console.log("[DEBUG] Обработчик кнопки '🔍 Конкуренты' вызван");
    return ctx.scene.enter("competitor_wizard");
  });
  bot.hears("#️⃣ Хэштеги", (ctx) => {
    console.log("[DEBUG] Обработчик кнопки '#️⃣ Хэштеги' вызван");
    return ctx.scene.enter("hashtag_wizard");
  });
  bot.hears("🎬 Запустить скрапинг", (ctx) =>
    ctx.scene.enter("scraping_wizard")
  );
  bot.hears("👀 Просмотр Reels", (ctx) =>
    ctx.scene.enter("reels_wizard")
  );
  bot.hears("📈 Аналитика", (ctx) =>
    ctx.scene.enter("analytics_wizard")
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
    enterProjectScene: () => "project_wizard",
    enterCompetitorScene: () => "competitor_wizard",
    enterHashtagScene: () => "hashtag_wizard",
    enterScrapingScene: () => "scraping_wizard",
    enterReelsScene: () => "reels_wizard",
    enterAnalyticsScene: () => "analytics_wizard",
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
