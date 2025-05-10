/**
 * Модуль Instagram Scraper Bot для Telegram
 *
 * Предоставляет функциональность для скрапинга Instagram Reels
 * в нише эстетической медицины через интерфейс Telegram бота.
 */

import { Telegraf, Scenes } from "telegraf"
import type { MiddlewareFn } from "telegraf/types"
import {
  ScraperBotContext,
  StorageAdapter,
  InstagramScraperBotConfig,
} from "@/types"
import projectScene from "@/scenes/project-scene"
import competitorScene from "@/scenes/competitor-scene"

// Публичные экспорты
import {
  createNeonStorageAdapter,
  createMemoryStorageAdapter,
  createMultitenantNeonStorageAdapter,
} from "@/storage"

// Экспортируем типы
export type {
  StorageAdapter,
  ScraperBotContext,
  Project,
  Competitor,
  Hashtag,
  Reel,
  InstagramScraperBotConfig,
} from "@/types"

// Экспорт функций хранилища
export * from "@/storage"

// Экспорт функций скрапера
export * from "@/agent"

/**
 * Настройка модуля Instagram Scraper Bot
 *
 * @param bot Экземпляр Telegraf бота
 * @param storageAdapter Адаптер хранилища данных
 * @param config Конфигурация модуля
 * @returns Объект с API модуля
 */
export function setupInstagramScraperBot(
  bot: Telegraf<ScraperBotContext>,
  storageAdapter: StorageAdapter,
  config: InstagramScraperBotConfig
) {
  // Инициализируем сцены
  const stage = new Scenes.Stage<ScraperBotContext>([
    projectScene,
    competitorScene,
    // Здесь будут добавляться другие сцены
  ])

  // Добавляем middleware для доступа к хранилищу и конфигурации
  bot.use((ctx, next) => {
    ctx.storage = storageAdapter
    // @ts-expect-error - scraperConfig не определен в типе Context
    ctx.scraperConfig = config
    return next()
  })

  // Подключаем Stage middleware
  bot.use(stage.middleware() as MiddlewareFn<ScraperBotContext>)

  // Регистрируем обработчики команд
  bot.command("projects", ctx => ctx.scene.enter("instagram_scraper_projects"))
  bot.command("competitors", ctx =>
    ctx.scene.enter("instagram_scraper_competitors")
  )

  // Обработчики текстовых сообщений для меню
  bot.hears("📊 Проекты", ctx => ctx.scene.enter("instagram_scraper_projects"))
  bot.hears("🔍 Конкуренты", ctx =>
    ctx.scene.enter("instagram_scraper_competitors")
  )

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
  }
}
