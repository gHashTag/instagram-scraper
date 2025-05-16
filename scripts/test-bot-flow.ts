/**
 * Скрипт для тестирования пользовательского взаимодействия с Telegram ботом
 * 
 * Этот скрипт симулирует взаимодействие пользователя с ботом через Telegram API,
 * проверяя работу кнопок и обработчиков.
 */

import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as dotenv from 'dotenv';
import { NewMessage } from 'telegram/events';
import { NewMessageEvent } from 'telegram/events/NewMessage';
import input from 'input';

dotenv.config();

// Конфигурация
const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0');
const API_HASH = process.env.TELEGRAM_API_HASH || '';
const BOT_USERNAME = process.env.BOT_USERNAME || 'dao999nft_dev_bot';
const SESSION_STRING = process.env.TELEGRAM_SESSION_STRING || '';

// Проверка конфигурации
if (!API_ID || !API_HASH) {
  console.error('Ошибка: Необходимо указать TELEGRAM_API_ID и TELEGRAM_API_HASH в .env файле');
  process.exit(1);
}

// Создаем сессию
const stringSession = new StringSession(SESSION_STRING);

// Тестовые сценарии
const testScenarios = [
  {
    name: 'Тест кнопки "Конкуренты"',
    steps: [
      { action: 'send', message: '/start', waitForResponse: true },
      { action: 'send', message: '🔍 Конкуренты', waitForResponse: true },
      { action: 'checkButton', button: '➕ Добавить конкурента' },
      { action: 'checkButton', button: '❌ Выйти' },
      { action: 'clickButton', button: '❌ Выйти', waitForResponse: true }
    ]
  },
  {
    name: 'Тест добавления конкурента',
    steps: [
      { action: 'send', message: '🔍 Конкуренты', waitForResponse: true },
      { action: 'clickButton', button: '➕ Добавить конкурента', waitForResponse: true },
      { action: 'send', message: 'https://www.instagram.com/example', waitForResponse: true },
      { action: 'checkButton', button: 'Добавить еще' },
      { action: 'checkButton', button: 'Посмотреть всех конкурентов' },
      { action: 'clickButton', button: 'Вернуться к проектам', waitForResponse: true }
    ]
  }
];

// Основная функция
async function main() {
  console.log('Запуск тестирования бота...');
  
  // Создаем клиент Telegram
  const client = new TelegramClient(stringSession, API_ID, API_HASH, {
    connectionRetries: 5,
  });
  
  // Подключаемся к Telegram
  await client.start({
    phoneNumber: async () => await input.text('Введите номер телефона: '),
    password: async () => await input.text('Введите пароль: '),
    phoneCode: async () => await input.text('Введите код из SMS: '),
    onError: (err) => console.log(err),
  });
  
  // Сохраняем строку сессии для последующего использования
  console.log('Сохраните эту строку сессии в .env файл как TELEGRAM_SESSION_STRING:');
  console.log(client.session.save());
  
  // Получаем информацию о боте
  const botEntity = await client.getEntity(BOT_USERNAME);
  console.log(`Бот найден: ${botEntity.username}`);
  
  // Обработчик сообщений от бота
  let lastBotMessage: any = null;
  let messagePromiseResolve: ((value: any) => void) | null = null;
  
  client.addEventHandler(async (event: NewMessageEvent) => {
    const message = event.message;
    
    // Проверяем, что сообщение от бота
    if (message.peerId.userId === botEntity.id) {
      console.log(`Получено сообщение от бота: ${message.text}`);
      lastBotMessage = message;
      
      // Если есть ожидающий промис, разрешаем его
      if (messagePromiseResolve) {
        messagePromiseResolve(message);
        messagePromiseResolve = null;
      }
    }
  }, new NewMessage({}));
  
  // Функция для ожидания ответа от бота
  function waitForBotResponse(): Promise<any> {
    return new Promise((resolve) => {
      messagePromiseResolve = resolve;
      
      // Таймаут на случай, если бот не ответит
      setTimeout(() => {
        if (messagePromiseResolve) {
          console.log('Таймаут ожидания ответа от бота');
          messagePromiseResolve(null);
          messagePromiseResolve = null;
        }
      }, 10000);
    });
  }
  
  // Функция для отправки сообщения боту
  async function sendMessage(text: string, waitForResponse: boolean = false): Promise<any> {
    console.log(`Отправка сообщения боту: ${text}`);
    await client.sendMessage(botEntity, { message: text });
    
    if (waitForResponse) {
      console.log('Ожидание ответа от бота...');
      return await waitForBotResponse();
    }
    
    return null;
  }
  
  // Функция для проверки наличия кнопки в последнем сообщении от бота
  function checkButton(buttonText: string): boolean {
    if (!lastBotMessage || !lastBotMessage.replyMarkup) {
      console.log(`Кнопка "${buttonText}" не найдена: нет разметки кнопок`);
      return false;
    }
    
    const rows = lastBotMessage.replyMarkup.rows;
    for (const row of rows) {
      for (const button of row.buttons) {
        if (button.text === buttonText) {
          console.log(`Кнопка "${buttonText}" найдена`);
          return true;
        }
      }
    }
    
    console.log(`Кнопка "${buttonText}" не найдена`);
    return false;
  }
  
  // Функция для нажатия на кнопку
  async function clickButton(buttonText: string, waitForResponse: boolean = false): Promise<any> {
    if (!lastBotMessage || !lastBotMessage.replyMarkup) {
      console.log(`Не удалось нажать на кнопку "${buttonText}": нет разметки кнопок`);
      return null;
    }
    
    const rows = lastBotMessage.replyMarkup.rows;
    for (const row of rows) {
      for (const button of row.buttons) {
        if (button.text === buttonText) {
          console.log(`Нажатие на кнопку "${buttonText}"`);
          await client.invoke({
            _: 'messages.getBotCallbackAnswer',
            peer: botEntity,
            msgId: lastBotMessage.id,
            data: button.data,
          });
          
          if (waitForResponse) {
            console.log('Ожидание ответа от бота после нажатия на кнопку...');
            return await waitForBotResponse();
          }
          
          return null;
        }
      }
    }
    
    console.log(`Не удалось нажать на кнопку "${buttonText}": кнопка не найдена`);
    return null;
  }
  
  // Запуск тестовых сценариев
  for (const scenario of testScenarios) {
    console.log(`\n=== Запуск сценария: ${scenario.name} ===`);
    
    for (const step of scenario.steps) {
      switch (step.action) {
        case 'send':
          await sendMessage(step.message, step.waitForResponse);
          break;
        case 'checkButton':
          checkButton(step.button);
          break;
        case 'clickButton':
          await clickButton(step.button, step.waitForResponse);
          break;
        default:
          console.log(`Неизвестное действие: ${step.action}`);
      }
      
      // Пауза между шагами
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`=== Сценарий завершен: ${scenario.name} ===`);
  }
  
  console.log('\nТестирование завершено');
  
  // Отключаемся от Telegram
  await client.disconnect();
  process.exit(0);
}

// Запускаем основную функцию
main().catch(console.error);
