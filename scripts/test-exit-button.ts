/**
 * Простой тест для проверки обработчика кнопки "exit_scene"
 */

import { handleExitCompetitorSceneAction } from '../src/scenes/competitor-scene';

// Функция для тестирования обработчика кнопки "exit_scene"
async function testExitButton() {
  console.log("Тестирование обработчика кнопки 'exit_scene'...");

  try {
    // Создаем мок для контекста
    const ctx = {
      session: {
        user: {
          id: 1,
          telegram_id: 144022504,
          username: 'neuro_sage'
        }
      },
      scene: {
        session: {
          currentProjectId: 3
        },
        leave: async () => {
          console.log(`[BOT] Выход из сцены`);
          return true;
        },
        enter: async (sceneName: string, params: any) => {
          console.log(`[BOT] Вход в сцену ${sceneName} с параметрами:`, params);
          return true;
        }
      },
      reply: async (text: string, extra?: any) => {
        console.log(`[BOT] Ответ: ${text}`);
        if (extra) {
          console.log(`[BOT] Дополнительные параметры:`, JSON.stringify(extra, null, 2));
        }
        return {} as any;
      },
      answerCbQuery: async (text?: string) => {
        console.log(`[BOT] Ответ на callback query: ${text || 'без текста'}`);
        return true;
      },
      callbackQuery: {
        data: 'exit_scene',
        message: {
          message_id: 12345,
          chat: {
            id: 144022504
          }
        }
      },
      from: {
        id: 144022504,
        username: 'neuro_sage'
      },
      chat: {
        id: 144022504
      }
    };

    console.log("[DEBUG] Вызов обработчика exit_scene напрямую");

    // Вызываем обработчик напрямую
    await handleExitCompetitorSceneAction(ctx);
    console.log("[DEBUG] Обработчик exit_scene выполнен");

  } catch (error) {
    console.error("[ERROR] Ошибка при тестировании:", error);
  }
}

// Запускаем тест
testExitButton().then(() => {
  console.log("Тестирование завершено");
  process.exit(0);
}).catch(error => {
  console.error("Ошибка при выполнении теста:", error);
  process.exit(1);
});
