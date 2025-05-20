/**
 * Тестовый скрипт для проверки работы с конкурентами
 */

import { Telegraf } from 'telegraf';
import { ScraperBotContext } from '../src/types';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Создаем экземпляр бота
const bot = new Telegraf<ScraperBotContext>(process.env.BOT_TOKEN || '');

// Функция для эмуляции сообщения от пользователя
async function sendMessage(text: string) {
  console.log(`[USER] Отправка сообщения: ${text}`);
  
  // Создаем объект обновления
  const update = {
    update_id: 123456789,
    message: {
      message_id: 123456789,
      date: Math.floor(Date.now() / 1000),
      chat: {
        id: parseInt(process.env.TEST_USER_ID || '0'),
        type: 'private',
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser'
      },
      from: {
        id: parseInt(process.env.TEST_USER_ID || '0'),
        is_bot: false,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        language_code: 'ru'
      },
      text: text
    }
  };
  
  // Обрабатываем обновление
  await bot.handleUpdate(update);
  
  // Ждем немного, чтобы бот успел обработать сообщение
  await new Promise(resolve => setTimeout(resolve, 1000));
}

// Функция для эмуляции нажатия на кнопку
async function clickButton(data: string) {
  console.log(`[USER] Нажатие на кнопку: ${data}`);
  
  // Создаем объект обновления
  const update = {
    update_id: 123456789,
    callback_query: {
      id: '123456789',
      from: {
        id: parseInt(process.env.TEST_USER_ID || '0'),
        is_bot: false,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        language_code: 'ru'
      },
      message: {
        message_id: 123456789,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: parseInt(process.env.TEST_USER_ID || '0'),
          type: 'private',
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser'
        },
        text: 'Текст сообщения'
      },
      chat_instance: '123456789',
      data: data
    }
  };
  
  // Обрабатываем обновление
  await bot.handleUpdate(update);
  
  // Ждем немного, чтобы бот успел обработать нажатие на кнопку
  await new Promise(resolve => setTimeout(resolve, 1000));
}

// Основная функция для тестирования
async function testCompetitorFlow() {
  try {
    console.log('Начинаем тестирование работы с конкурентами...');
    
    // Запускаем бота
    await bot.launch();
    console.log('Бот запущен');
    
    // Отправляем команду /competitors
    await sendMessage('/competitors');
    
    // Ждем немного, чтобы бот успел обработать команду
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Нажимаем на кнопку "Добавить конкурента"
    await clickButton('add_competitor_1');
    
    // Отправляем URL конкурента
    await sendMessage('https://www.instagram.com/example');
    
    // Нажимаем на кнопку "Посмотреть всех конкурентов"
    await clickButton('competitors_project_1');
    
    // Нажимаем на кнопку "Выйти"
    await clickButton('exit_scene');
    
    console.log('Тестирование завершено успешно');
    
    // Останавливаем бота
    bot.stop();
  } catch (error) {
    console.error('Ошибка при тестировании:', error);
    bot.stop();
  }
}

// Запускаем тестирование
testCompetitorFlow();
