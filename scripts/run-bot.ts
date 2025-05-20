/**
 * Скрипт для запуска бота Instagram Scraper Bot
 *
 * Этот скрипт запускает бота и показывает логи его работы.
 */

import { Telegraf, session } from 'telegraf';
import dotenv from 'dotenv';
import { NeonAdapter } from '../src/adapters/neon-adapter';
import { setupInstagramScraperBot } from '../index';

// Загружаем переменные окружения
dotenv.config();

// Проверяем наличие токена бота
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('❌ Ошибка: Не найден токен бота (BOT_TOKEN) в переменных окружения.');
  console.error('Пожалуйста, добавьте BOT_TOKEN в файл .env');
  process.exit(1);
}

// Создаем экземпляр бота
console.log('🤖 Создание экземпляра бота...');
const bot = new Telegraf(token);

// Добавляем middleware для сессий
console.log('⚙️ Добавление middleware для сессий...');
bot.use(session());

// Создаем адаптер хранилища
console.log('💾 Инициализация хранилища данных...');
const storageAdapter = new NeonAdapter();

// Настраиваем модуль Instagram Scraper Bot
console.log('⚙️ Настройка модуля Instagram Scraper Bot...');
const scraperBot = setupInstagramScraperBot(bot, storageAdapter, {
  // Конфигурация модуля
  apifyToken: process.env.APIFY_TOKEN || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  adminUserId: parseInt(process.env.ADMIN_USER_ID || '0'),
});

// Настраиваем обработчики для визард-сцены конкурентов
import { setupCompetitorWizard } from '../src/scenes/competitor-wizard-scene';
setupCompetitorWizard(bot);

// Обработчик команды /start
bot.start(async (ctx) => {
  console.log(`👤 Пользователь ${ctx.from.username || ctx.from.id} запустил бота`);

  try {
    await storageAdapter.initialize();

    // Проверяем, зарегистрирован ли пользователь
    const user = await storageAdapter.getUserByTelegramId(ctx.from.id);

    if (!user) {
      // Регистрируем нового пользователя
      console.log(`📝 Регистрация нового пользователя: ${ctx.from.username || ctx.from.id}`);

      await storageAdapter.saveUser({
        telegramId: ctx.from.id,
        username: ctx.from.username || '',
        firstName: ctx.from.first_name || '',
        lastName: ctx.from.last_name || '',
      });

      await ctx.reply(
        `Привет, ${ctx.from.first_name || 'пользователь'}! 👋\n\nДобро пожаловать в Instagram Scraper Bot. Я помогу вам собирать и анализировать данные из Instagram Reels.\n\nИспользуйте команду /help, чтобы узнать больше о моих возможностях.`
      );
    } else {
      // Приветствуем существующего пользователя
      await ctx.reply(
        `С возвращением, ${user.firstName || 'пользователь'}! 👋\n\nЧем я могу помочь вам сегодня?`
      );
    }

    // Отправляем меню
    await ctx.reply('Выберите действие:', {
      reply_markup: {
        keyboard: scraperBot.getMenuButtons(),
        resize_keyboard: true,
      },
    });
  } catch (error) {
    console.error('❌ Ошибка при обработке команды /start:', error);
    await ctx.reply('Произошла ошибка при запуске бота. Пожалуйста, попробуйте позже.');
  }
  // Не закрываем соединение с базой данных, так как оно будет использоваться в других обработчиках
});

// Обработчик команды /help
bot.help(async (ctx) => {
  await ctx.reply(
    'Я Instagram Scraper Bot. Вот что я умею:\n\n' +
    '📊 /projects - Управление проектами\n' +
    '🔍 /competitors - Управление конкурентами\n' +
    '#️⃣ /hashtags - Управление хэштегами\n' +
    '🎬 /scrape - Запустить скрапинг\n' +
    '👀 /reels - Просмотр Reels\n' +
    '📈 /analytics - Аналитика данных\n' +
    '🔔 /notifications - Настройка уведомлений\n' +
    '📋 /collections - Коллекции Reels\n' +
    '🤖 /chatbot - Чат-бот для общения с видео'
  );
});

// Глобальный обработчик для кнопки "Добавить конкурента"
bot.action("add_competitor_3", async (ctx) => {
  console.log("[DEBUG] Глобальный обработчик кнопки 'add_competitor_3' вызван");
  try {
    // Проверяем, находится ли пользователь в сцене конкурентов
    if (ctx.scene && ctx.scene.current && ctx.scene.current.id === "instagram_scraper_competitors") {
      console.log("[DEBUG] Пользователь находится в сцене конкурентов");

      // Создаем модифицированный контекст без answerCbQuery
      const modifiedCtx = {
        ...ctx,
        answerCbQuery: async () => {
          console.log("[DEBUG] Пропускаем answerCbQuery, так как запрос может быть устаревшим");
          return Promise.resolve();
        }
      };

      // Устанавливаем projectId в сессии
      if (!modifiedCtx.scene.session) {
        modifiedCtx.scene.session = {};
      }
      modifiedCtx.scene.session.projectId = 3;
      modifiedCtx.scene.session.step = "ADD_COMPETITOR";

      // Отправляем сообщение пользователю
      await modifiedCtx.reply("Введите Instagram URL конкурента (например, https://www.instagram.com/example):");

      console.log("[DEBUG] Успешно установлен режим добавления конкурента");
    } else {
      console.log("[DEBUG] Пользователь не находится в сцене конкурентов");
      await ctx.reply("Пожалуйста, сначала перейдите в раздел управления конкурентами.");
    }
  } catch (error) {
    console.error("[ERROR] Ошибка в глобальном обработчике кнопки 'add_competitor_3':", error);
    try {
      await ctx.reply("Произошла ошибка при добавлении конкурента. Пожалуйста, попробуйте снова.");
    } catch (e) {
      console.error("[ERROR] Не удалось отправить сообщение об ошибке:", e);
    }
  }
});

// Обработчик ошибок
bot.catch((err, ctx) => {
  console.error(`❌ Ошибка при обработке ${ctx.updateType}:`, err);
  ctx.reply('Упс, что-то пошло не так. Попробуйте еще раз позже.');
});

// Устанавливаем команды в меню бота
console.log('📋 Установка команд в меню бота...');
bot.telegram.setMyCommands(scraperBot.getCommands())
  .then(() => {
    console.log('✅ Команды успешно установлены в меню бота!');
  })
  .catch((err) => {
    console.error('❌ Ошибка при установке команд в меню бота:', err);
  });

// Устанавливаем команды в меню бота
console.log('📋 Установка команд в меню бота...');
const commands = [
  { command: 'start', description: 'Запустить бота' },
  { command: 'help', description: 'Показать справку' },
  { command: 'projects', description: 'Управление проектами' },
  { command: 'competitors', description: 'Управление конкурентами' },
  { command: 'hashtags', description: 'Управление хэштегами' },
  { command: 'scrape', description: 'Запустить скрапинг' },
  { command: 'reels', description: 'Просмотр Reels' },
  { command: 'analytics', description: 'Аналитика данных' },
  { command: 'notifications', description: 'Настройка уведомлений' },
  { command: 'collections', description: 'Коллекции Reels' },
  { command: 'chatbot', description: 'Чат-бот для общения с видео' }
];

bot.telegram.setMyCommands(commands)
  .then(() => {
    console.log('✅ Команды успешно установлены в меню бота!');
  })
  .catch((err) => {
    console.error('❌ Ошибка при установке команд в меню бота:', err);
  });

// Запускаем бота
console.log('🚀 Запуск бота...');
bot.launch()
  .then(() => {
    console.log('✅ Бот успешно запущен!');
    console.log('📝 Логи работы бота:');
  })
  .catch((err) => {
    console.error('❌ Ошибка при запуске бота:', err);
    process.exit(1);
  });

// Обработка завершения работы
process.once('SIGINT', async () => {
  console.log('👋 Завершение работы бота...');
  try {
    await storageAdapter.close();
    console.log('💾 Соединение с базой данных закрыто');
  } catch (error) {
    console.error('❌ Ошибка при закрытии соединения с базой данных:', error);
  }
  bot.stop('SIGINT');
});

process.once('SIGTERM', async () => {
  console.log('👋 Завершение работы бота...');
  try {
    await storageAdapter.close();
    console.log('💾 Соединение с базой данных закрыто');
  } catch (error) {
    console.error('❌ Ошибка при закрытии соединения с базой данных:', error);
  }
  bot.stop('SIGTERM');
});
