/**
 * Скрипт для проверки регистрации обработчиков кнопок
 */

import { competitorScene } from '../src/scenes/competitor-scene';
import { registerButtons } from '../src/utils/button-handler';
import { Scenes } from 'telegraf';
import { ScraperBotContext } from '../src/types';

// Функция для проверки регистрации обработчиков кнопок
function checkButtonHandlers() {
  console.log('Проверка регистрации обработчиков кнопок в сцене конкурентов...');

  // Получаем все обработчики действий из сцены
  const actionHandlers = (competitorScene as any)._handlers?.action || [];

  console.log(`Найдено ${actionHandlers.length} обработчиков действий в сцене конкурентов`);

  // Выводим информацию о каждом обработчике
  actionHandlers.forEach((handler: any, index: number) => {
    console.log(`Обработчик #${index + 1}:`);
    console.log(`  Тип: ${typeof handler.predicate === 'function' ? 'Функция' : typeof handler.predicate}`);

    // Если предикат - регулярное выражение, выводим его
    if (handler.predicate instanceof RegExp) {
      console.log(`  Регулярное выражение: ${handler.predicate}`);
    }

    // Если предикат - строка, выводим её
    if (typeof handler.predicate === 'string') {
      console.log(`  Строка: ${handler.predicate}`);
    }

    // Выводим информацию о middleware
    console.log(`  Middleware: ${handler.middleware ? 'Есть' : 'Нет'}`);
  });

  console.log('Проверка завершена');
}

// Создаем тестовую сцену для проверки регистрации обработчиков кнопок
function testButtonRegistration() {
  console.log('Тестирование регистрации обработчиков кнопок...');

  // Создаем тестовую сцену
  const testScene = new Scenes.BaseScene<ScraperBotContext>('test_scene');

  // Регистрируем обработчики кнопок
  registerButtons(testScene, [
    {
      id: 'test_button_1',
      handler: async (ctx) => {
        console.log('Обработчик кнопки test_button_1 вызван');
      },
      errorMessage: 'Ошибка при обработке кнопки test_button_1'
    },
    {
      id: /test_button_(\d+)/,
      handler: async (ctx) => {
        console.log('Обработчик кнопки test_button_\\d+ вызван');
      },
      errorMessage: 'Ошибка при обработке кнопки test_button_\\d+'
    }
  ]);

  // Получаем все обработчики действий из сцены
  const actionHandlers = (testScene as any)._handlers?.action || [];

  console.log(`Найдено ${actionHandlers.length} обработчиков действий в тестовой сцене`);

  // Выводим информацию о каждом обработчике
  actionHandlers.forEach((handler: any, index: number) => {
    console.log(`Обработчик #${index + 1}:`);
    console.log(`  Тип: ${typeof handler.predicate === 'function' ? 'Функция' : typeof handler.predicate}`);

    // Если предикат - регулярное выражение, выводим его
    if (handler.predicate instanceof RegExp) {
      console.log(`  Регулярное выражение: ${handler.predicate}`);
    }

    // Если предикат - строка, выводим её
    if (typeof handler.predicate === 'string') {
      console.log(`  Строка: ${handler.predicate}`);
    }

    // Выводим информацию о middleware
    console.log(`  Middleware: ${handler.middleware ? 'Есть' : 'Нет'}`);
  });

  console.log('Тестирование завершено');
}

// Запускаем проверку
checkButtonHandlers();

// Запускаем тестирование
testButtonRegistration();
