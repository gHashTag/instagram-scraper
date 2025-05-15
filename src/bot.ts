import * as dotenv from "dotenv";
import { Telegraf, session, Markup /*, MemorySessionStore*/ } from "telegraf";
// import { Scenes } from "telegraf"; // Удаляем неиспользуемый импорт Scenes
import { NeonAdapter } from "./adapters/neon-adapter";
import { setupInstagramScraperBot } from "../index"; // Импортируем функцию настройки из корневого index.ts
import type {
  ScraperBotContext,
  InstagramScraperBotConfig,
  StorageAdapter,
} from "./types";

// <<< Создаем middleware для проверки/создания пользователя >>>
async function ensureUserMiddleware(
  ctx: ScraperBotContext,
  next: () => Promise<void>
) {
  // +++ Добавляем лог начала работы middleware +++
  console.log("[DEBUG] ensureUserMiddleware: Запуск...");

  if (!ctx.from?.id) {
    console.warn("[DEBUG] ensureUserMiddleware: Обновление без ctx.from.id.");
    return; // Не можем обработать без ID
  }
  const telegramId = ctx.from.id; // Сохраним для логов
  console.log(
    `[DEBUG] ensureUserMiddleware: Обработка пользователя ${telegramId}.`
  );

  if (!ctx.storage) {
    console.error(
      "[ERROR] ensureUserMiddleware: Middleware вызвано до инициализации ctx.storage"
    );
    return;
  }

  try {
    console.log(
      `[DEBUG] ensureUserMiddleware: Поиск пользователя ${telegramId}...`
    );
    let user = await ctx.storage.getUserByTelegramId(telegramId);

    if (!user) {
      console.log(
        `[INFO] ensureUserMiddleware: Пользователь ${telegramId} не найден, попытка создания...`
      );
      const username =
        ctx.from.username || ctx.from.first_name || `User_${telegramId}`;
      // +++ Добавляем лог перед вызовом createUser +++
      console.log(
        `[DEBUG] ensureUserMiddleware: Вызов createUser для ${telegramId} с username "${username}"...`
      );
      user = await ctx.storage.createUser(telegramId, username);
      // +++ Добавляем лог после вызова createUser +++
      if (user) {
        console.log(
          `[INFO] ensureUserMiddleware: Пользователь ${telegramId} (${username}) успешно создан. ID в базе: ${user.id}`
        );
      } else {
        // !!! Важный лог, если createUser вернул null/undefined
        console.error(
          `[ERROR] ensureUserMiddleware: createUser для ${telegramId} вернул ${user}. Пользователь НЕ создан.`
        );
        // Решаем, что делать - прервать или нет? Пока прервем.
        await ctx
          .reply(
            "Не удалось создать вашу учетную запись в системе. Попробуйте позже."
          )
          .catch(() => {});
        return;
      }
    } else {
      console.log(
        `[INFO] ensureUserMiddleware: Пользователь ${telegramId} (${user.username || "без username"}) найден. ID в базе: ${user.id}.`
      );
    }

    // +++ Добавляем лог перед присвоением ctx.user +++
    console.log(
      `[DEBUG] ensureUserMiddleware: Присвоение ctx.scene.session.user для ${telegramId}. Пользователь:`,
      JSON.stringify(user)
    );
    ctx.scene.session.user = user; // <<< ИЗМЕНЕНО ctx.session НА ctx.scene.session >>>
    // +++ Добавляем лог после присвоения ctx.user +++
    console.log(
      `[DEBUG] ensureUserMiddleware: ctx.scene.session.user успешно присвоено для ${telegramId}.`
    );
  } catch (error) {
    console.error(
      `[ERROR] ensureUserMiddleware: Ошибка при поиске/создании пользователя ${telegramId}:`,
      error
    );
    await ctx
      .reply(
        "Произошла ошибка при проверке вашей учетной записи. Попробуйте позже."
      )
      .catch(() => {});
    return; // Прерываем выполнение
  }

  // +++ Добавляем лог перед вызовом next() +++
  console.log(
    `[DEBUG] ensureUserMiddleware: Вызов next() для пользователя ${telegramId}.`
  );
  return next();
}

async function startBot() {
  dotenv.config(); // Убрали явный path, используем стандартный поиск .env

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const DATABASE_URL = process.env.DATABASE_URL; // Проверяем наличие, т.к. адаптер использует его внутри

  if (!BOT_TOKEN) {
    console.error("Ошибка: BOT_TOKEN не найден в .env файле.");
    process.exit(1);
  }

  if (!DATABASE_URL) {
    // Даже если адаптер читает его сам, нам нужно убедиться, что он есть
    console.error("Ошибка: DATABASE_URL не найден в .env файле.");
    process.exit(1);
  }

  let storageAdapter: NeonAdapter | undefined;

  try {
    console.log("Запуск бота из src/bot.ts...");
    const bot = new Telegraf<ScraperBotContext>(BOT_TOKEN);

    // <<< Используем ЯВНОЕ хранилище в памяти >>>
    // bot.use(session({ store: new MemorySessionStore() })); // Явно указываем хранилище
    bot.use(session()); // <<< Используем store по умолчанию (MemorySessionStore) >>>

    // +++ Добавляем лог СРАЗУ ПОСЛЕ session() +++
    bot.use((ctx, next) => {
      console.log(
        "[DEBUG] После bot.use(session()): ctx.session существует?",
        !!ctx.scene.session
      );
      // <<< Раскомментируем лог контекста >>>
      if (!ctx.scene.session) {
        console.log(
          "[DEBUG] ctx object (если session нет):",
          JSON.stringify(ctx, null, 2)
        );
      }
      return next();
    });

    // Добавляем адаптер в контекст
    storageAdapter = new NeonAdapter();
    bot.use((ctx, next) => {
      ctx.storage = storageAdapter as StorageAdapter;
      return next();
    });

    // <<< СНАЧАЛА НАСТРАИВАЕМ СЦЕНЫ (включая stage.middleware()) >>>
    const config: InstagramScraperBotConfig = {
      telegramBotToken: BOT_TOKEN,
      // здесь можно добавить конфигурацию, если она нужна, например, apifyClientToken, если он есть
      // apifyClientToken: process.env.APIFY_CLIENT_TOKEN,
    };

    console.log("Инициализация адаптера хранилища...");
    await storageAdapter.initialize();
    console.log("Адаптер хранилища инициализирован.");

    // Передаем созданные экземпляры в функцию настройки (которая добавит stage)
    setupInstagramScraperBot(bot, storageAdapter, config);
    console.log("Модуль бота настроен (включая сцены).");

    // <<< ПОТОМ РЕГИСТРИРУЕМ MIDDLEWARE ПРОВЕРКИ ПОЛЬЗОВАТЕЛЯ >>>
    bot.use(ensureUserMiddleware);

    // <<< Добавляем обработчик команды /start >>>
    bot.start(async (ctx) => {
      const username =
        ctx.scene.session.user?.username ||
        ctx.from?.first_name ||
        "пользователь";
      const welcomeMessage = `Привет, ${username}! Чем могу помочь?`;
      // Основная клавиатура
      const mainMenuKeyboard = Markup.keyboard([
        ["📊 Проекты", "🔍 Конкуренты"],
        ["#️⃣ Хэштеги", "🎬 Запустить скрапинг"],
        ["📱 Результаты", "ℹ️ Помощь"],
      ]).resize(); // Делаем клавиатуру компактнее

      await ctx.reply(welcomeMessage, mainMenuKeyboard);
    });

    // Обработчик ошибок Telegraf (можно раскомментировать и настроить logger)
    // bot.catch((err: any, ctx: ScraperBotContext) => {
    //   console.error(`Ошибка Telegraf для ${ctx.updateType}`, err);
    //   ctx.reply("Упс, что-то пошло не так. Попробуйте еще раз позже.").catch(e => console.error("Ошибка отправки сообщения об ошибке", e));
    // });

    // Глобальный middleware для логирования всех входящих обновлений
    bot.use(async (ctx, next) => {
      // Добавляем ctx.scene.session если его нет (важно для команд вне сцен)
      // console.log("[DEBUG] Global middleware: Начало обработки ctx.update", JSON.stringify(ctx.update, null, 2));
      // console.log("[DEBUG] Global middleware: Текущий ctx.scene", JSON.stringify(ctx.scene, null, 2));
      // console.log("[DEBUG] Global middleware: Наличие ctx.session", !!ctx.scene.session); // Изменено
      // console.log("[DEBUG] Global middleware: Наличие ctx.scene.session", !!ctx.scene.session);

      // Проверяем наличие ctx.scene.session и инициализируем, если отсутствует
      // Это нужно, чтобы ctx.scene.session всегда было доступно,
      // даже для команд, которые не входят в сцены (например /start, /help)
      if (!ctx.scene) {
        // console.log("[DEBUG] Global middleware: ctx.scene отсутствует, инициализируем пустым объектом (это не должно происходить с telegraf-session-local)");
        // (ctx as any).scene = { session: {} }; // Временное решение, если sessionMiddleware не отработал
      } else if (!ctx.scene.session) {
        // Изменено
        // console.log("[DEBUG] Global middleware: ctx.scene.session отсутствует, инициализируем пустым объектом");
        // ctx.scene.session = {} as ScraperSceneSessionData; // Инициализация значением по умолчанию
      }

      // Явное создание сессии, если ее нет. Это может быть необходимо для команд, не входящих в сцены.
      // Telegraf-session-local должен делать это автоматически, но на всякий случай.
      // if (!ctx.scene.session) { // Оставляем как есть или уточняем логику, если нужно
      // console.log(
      //   "[DEBUG] Global middleware: ctx.scene.session все еще отсутствует после проверок, принудительно создаем."
      // );
      // (ctx.scene as any).session = {};
      // }

      // Логирование информации о пользователе и чате
      // ... existing code ...

      return next();
    });

    console.log("Запуск Telegraf...");
    await bot.launch();
    console.log("Бот успешно запущен!");

    // Обеспечиваем graceful stop
    const stopBot = async (signal: string) => {
      console.log(`Получен ${signal}. Остановка бота...`);
      bot.stop(signal);
      if (storageAdapter) {
        try {
          await storageAdapter.close();
          console.log("Соединение с БД закрыто.");
        } catch (closeError) {
          console.error("Ошибка при закрытии соединения с БД:", closeError);
        }
      }
      console.log("Бот остановлен.");
      process.exit(0);
    };

    process.once("SIGINT", () => stopBot("SIGINT"));
    process.once("SIGTERM", () => stopBot("SIGTERM"));
  } catch (error) {
    console.error("Критическая ошибка при запуске или работе бота:", error);
    if (storageAdapter) {
      try {
        await storageAdapter.close();
        console.log("Соединение с БД закрыто из-за ошибки.");
      } catch (closeError) {
        console.error(
          "Ошибка при закрытии соединения с БД после основной ошибки:",
          closeError
        );
      }
    }
    process.exit(1);
  }
}

// Запускаем асинхронную функцию
startBot();
