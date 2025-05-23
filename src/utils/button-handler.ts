/**
 * Утилита для централизованной обработки кнопок в Telegram-боте
 *
 * Предоставляет единый интерфейс для регистрации и обработки кнопок,
 * с автоматической обработкой ошибок и логированием.
 */

import { Scenes } from 'telegraf';
import { ScraperBotContext } from '../types';
import { logger, LogType } from './logger';

/**
 * Тип обработчика кнопки
 */
export type ButtonHandler = (ctx: ScraperBotContext) => Promise<any>;

/**
 * Тип для данных callback query
 */
interface DataQuery {
  data: string;
  [key: string]: any;
}

/**
 * Проверка наличия data в callback query
 */
function isDataQuery(query: any): query is DataQuery {
  return query && typeof query.data === 'string';
}

/**
 * Генерирует уникальный идентификатор ошибки
 *
 * @returns Уникальный идентификатор ошибки в формате "ERR-XXXX-XXXX"
 */
function generateErrorId(): string {
  const randomPart1 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const randomPart2 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ERR-${randomPart1}-${randomPart2}`;
}

/**
 * Опции для обработки ошибок
 */
export interface ErrorHandlingOptions {
  /** Сообщение об ошибке, которое будет отправлено пользователю в случае ошибки */
  errorMessage?: string;
  /** Нужно ли выходить из сцены в случае ошибки */
  leaveSceneOnError?: boolean;
  /** Нужно ли отвечать на callback query в случае ошибки */
  answerCallbackOnError?: boolean;
  /** Текст для ответа на callback query в случае ошибки */
  errorCallbackText?: string;
  /** Показывать ли кнопку для повторного выполнения действия */
  showRetryButton?: boolean;
  /** Текст для кнопки повторного выполнения действия */
  retryButtonText?: string;
  /** Показывать ли кнопку для отмены действия */
  showCancelButton?: boolean;
  /** Текст для кнопки отмены действия */
  cancelButtonText?: string;
  /** Функция для обработки отмены действия */
  onCancel?: (ctx: ScraperBotContext) => Promise<void>;
  /** Отправлять ли отчет об ошибке администратору */
  sendErrorReport?: boolean;
  /** ID администратора для отправки отчетов об ошибках */
  adminUserId?: number;
}

/**
 * Интерфейс для описания пункта вложенного меню
 */
export interface NestedMenuItem {
  /** Текст кнопки */
  text: string;
  /** Идентификатор кнопки */
  id: string;
  /** Обработчик нажатия на кнопку */
  handler?: ButtonHandler;
  /** Подменю (если есть) */
  submenu?: NestedMenuItem[];
  /** Опции для обработки ошибок */
  errorHandling?: Partial<ErrorHandlingOptions>;
}

/**
 * Интерфейс для описания вложенного меню
 */
export interface NestedMenuOptions {
  /** Заголовок меню */
  title: string;
  /** Пункты меню */
  items: NestedMenuItem[];
  /** Показывать ли кнопку "Назад" */
  showBackButton?: boolean;
  /** Текст для кнопки "Назад" */
  backButtonText?: string;
  /** Показывать ли кнопку "Главное меню" */
  showHomeButton?: boolean;
  /** Текст для кнопки "Главное меню" */
  homeButtonText?: string;
  /** Количество колонок в меню */
  columns?: number;
  /** Опции для обработки ошибок */
  errorHandling?: Partial<ErrorHandlingOptions>;
}

/**
 * Опции для регистрации кнопки
 */
export interface ButtonOptions {
  /** Идентификатор кнопки (data) */
  id: string | RegExp;
  /** Функция-обработчик */
  handler: ButtonHandler;
  /** Сообщение об ошибке, которое будет отправлено пользователю в случае ошибки */
  errorMessage?: string;
  /** Нужно ли выходить из сцены в случае ошибки */
  leaveSceneOnError?: boolean;
  /** Нужно ли отвечать на callback query в случае ошибки */
  answerCallbackOnError?: boolean;
  /** Текст для ответа на callback query в случае ошибки */
  errorCallbackText?: string;
  /** Дополнительное логирование */
  verbose?: boolean;
  /** Расширенные опции для обработки ошибок */
  errorHandling?: Partial<ErrorHandlingOptions>;
}

/**
 * Создает обработчик кнопки с обработкой ошибок и логированием
 *
 * @param options Опции для регистрации кнопки
 * @returns Функция-обработчик для регистрации в сцене
 */
export function createButtonHandler(options: ButtonOptions) {
  const {
    id,
    handler,
    errorMessage = "Произошла ошибка при обработке действия. Попробуйте еще раз.",
    leaveSceneOnError = true,
    answerCallbackOnError = true,
    errorCallbackText = "Ошибка",
    verbose = false,
    errorHandling = {}
  } = options;

  // Объединяем базовые опции с расширенными опциями обработки ошибок
  const errorOptions: ErrorHandlingOptions = {
    errorMessage,
    leaveSceneOnError,
    answerCallbackOnError,
    errorCallbackText,
    showRetryButton: errorHandling.showRetryButton ?? false,
    retryButtonText: errorHandling.retryButtonText ?? "Повторить",
    showCancelButton: errorHandling.showCancelButton ?? false,
    cancelButtonText: errorHandling.cancelButtonText ?? "Отмена",
    onCancel: errorHandling.onCancel,
    sendErrorReport: errorHandling.sendErrorReport ?? false,
    adminUserId: errorHandling.adminUserId
  };

  // Возвращаем функцию-обработчик для регистрации в сцене
  return async (ctx: ScraperBotContext) => {
    const buttonId = typeof id === 'string' ? id : id.toString();
    const userId = ctx.from?.id;
    const username = ctx.from?.username;

    // Логируем нажатие кнопки
    const callbackData = ctx.callbackQuery && isDataQuery(ctx.callbackQuery)
      ? ctx.callbackQuery.data
      : undefined;

    console.log(`[BUTTON_HANDLER_DEBUG] Нажата кнопка: ${buttonId}, данные: ${callbackData}, пользователь: ${userId}`);
    console.log(`[BUTTON_HANDLER_DEBUG] Сессия: ${!!ctx.session}, сессия сцены: ${!!ctx.scene?.session}`);

    logger.userAction(`Нажата кнопка: ${buttonId}`, {
      userId,
      username,
      data: {
        buttonId,
        callbackData,
        hasSession: !!ctx.session,
        hasSceneSession: !!ctx.scene?.session
      }
    });

    if (verbose) {
      logger.debug(`Детали обработчика для ${buttonId}`, {
        type: LogType.USER_ACTION,
        userId,
        username,
        data: {
          session: !!ctx.session,
          sceneSession: !!ctx.scene?.session,
          callbackQuery: ctx.callbackQuery
        }
      });
    }

    try {
      // Вызываем оригинальный обработчик
      const result = await handler(ctx);

      // Логируем успешное выполнение
      logger.botAction(`Успешно обработана кнопка: ${buttonId}`, {
        userId,
        username
      });

      return result;
    } catch (error) {
      // Генерируем уникальный идентификатор ошибки
      const errorId = generateErrorId();

      // Получаем информацию о сцене
      const sceneName = ctx.scene?.current?.id || 'unknown_scene';

      // Получаем данные callback query
      const errorCallbackData = ctx.callbackQuery && isDataQuery(ctx.callbackQuery)
        ? ctx.callbackQuery.data
        : undefined;

      // Получаем стек вызовов ошибки
      const errorStack = (error as Error).stack || 'No stack trace available';

      // Логируем ошибку с расширенной информацией
      logger.error(`Ошибка при обработке кнопки ${buttonId} [${errorId}]`, {
        userId,
        username,
        error: error as Error,
        type: LogType.ERROR,
        data: {
          errorId,
          buttonId,
          callbackData: errorCallbackData,
          sceneName,
          errorStack,
          timestamp: new Date().toISOString()
        }
      });

      try {
        // Создаем клавиатуру с кнопками для восстановления
        const keyboard = [];

        // Добавляем кнопку повторного выполнения, если нужно
        if (errorOptions.showRetryButton) {
          keyboard.push([{
            text: errorOptions.retryButtonText || 'Повторить',
            callback_data: errorCallbackData || buttonId
          }]);
        }

        // Добавляем кнопку отмены, если нужно
        if (errorOptions.showCancelButton) {
          keyboard.push([{
            text: errorOptions.cancelButtonText || 'Отмена',
            callback_data: `cancel_${buttonId}`
          }]);
        }

        // Формируем сообщение об ошибке с идентификатором
        const errorMessageWithId = `${errorOptions.errorMessage}\n\nКод ошибки: ${errorId}`;

        // Отправляем сообщение об ошибке пользователю с клавиатурой
        if (keyboard.length > 0) {
          await ctx.reply(errorMessageWithId, {
            reply_markup: {
              inline_keyboard: keyboard
            }
          });
        } else {
          await ctx.reply(errorMessageWithId);
        }

        // Выходим из сцены, если нужно
        if (errorOptions.leaveSceneOnError) {
          await ctx.scene.leave();
          logger.botAction(`Выход из сцены после ошибки в кнопке ${buttonId} [${errorId}]`, {
            userId,
            username
          });
        }

        // Отвечаем на callback query, если нужно
        if (errorOptions.answerCallbackOnError) {
          await ctx.answerCbQuery(errorOptions.errorCallbackText);
        }

        // Отправляем отчет об ошибке администратору, если нужно
        if (errorOptions.sendErrorReport && errorOptions.adminUserId) {
          try {
            const adminMessage = `🚨 Ошибка в боте!\n\n` +
              `Код ошибки: ${errorId}\n` +
              `Пользователь: ${username || userId}\n` +
              `Сцена: ${sceneName}\n` +
              `Кнопка: ${buttonId}\n` +
              `Ошибка: ${(error as Error).message}\n\n` +
              `Стек вызовов:\n\`\`\`\n${errorStack.slice(0, 500)}${errorStack.length > 500 ? '...' : ''}\n\`\`\``;

            // Отправляем сообщение администратору через бота
            // Примечание: ctx.telegram.sendMessage доступен через контекст
            await ctx.telegram.sendMessage(errorOptions.adminUserId, adminMessage, {
              parse_mode: 'Markdown'
            });

            logger.info(`Отчет об ошибке ${errorId} отправлен администратору`, {
              userId,
              username,
              type: LogType.SYSTEM,
              data: {
                errorId,
                adminUserId: errorOptions.adminUserId
              }
            });
          } catch (adminError) {
            logger.error(`Не удалось отправить отчет об ошибке администратору`, {
              userId,
              username,
              error: adminError as Error,
              type: LogType.ERROR,
              data: {
                errorId,
                originalError: error
              }
            });
          }
        }
      } catch (replyError) {
        logger.error(`Не удалось отправить сообщение об ошибке [${errorId}]`, {
          userId,
          username,
          error: replyError as Error,
          type: LogType.ERROR,
          data: {
            errorId,
            originalError: error,
            buttonId
          }
        });
      }

      return;
    }
  };
}

/**
 * Регистрирует обработчик кнопки в сцене
 *
 * @param scene Сцена, в которой нужно зарегистрировать обработчик
 * @param options Опции для регистрации кнопки
 */
export function registerButton(
  scene: Scenes.BaseScene<ScraperBotContext>,
  options: ButtonOptions
) {
  const handler = createButtonHandler(options);
  scene.action(options.id, handler);

  const buttonId = typeof options.id === 'string'
    ? options.id
    : options.id.toString();

  console.log(`[BUTTON_HANDLER_DEBUG] Зарегистрирован обработчик для ${buttonId} в сцене ${scene.id}`);

  logger.debug(`Зарегистрирован обработчик для ${buttonId}`, {
    type: LogType.SYSTEM,
    data: {
      sceneName: scene.id,
      buttonId
    }
  });
}

/**
 * Регистрирует обработчик для кнопки отмены
 *
 * @param scene Сцена, в которой нужно зарегистрировать обработчик
 * @param buttonId Идентификатор кнопки
 * @param onCancel Функция для обработки отмены действия
 */
function registerCancelHandler(
  scene: Scenes.BaseScene<ScraperBotContext>,
  buttonId: string,
  onCancel?: (ctx: ScraperBotContext) => Promise<void>
) {
  const cancelButtonId = `cancel_${buttonId}`;

  scene.action(cancelButtonId, async (ctx) => {
    const userId = ctx.from?.id;
    const username = ctx.from?.username;

    logger.userAction(`Нажата кнопка отмены: ${cancelButtonId}`, {
      userId,
      username,
      data: {
        buttonId: cancelButtonId
      }
    });

    try {
      // Отвечаем на callback query
      await ctx.answerCbQuery();

      // Если есть обработчик отмены, вызываем его
      if (onCancel) {
        await onCancel(ctx);
      } else {
        // По умолчанию просто отправляем сообщение
        await ctx.reply("Действие отменено.");
      }

      logger.botAction(`Успешно обработана отмена действия: ${buttonId}`, {
        userId,
        username
      });
    } catch (error) {
      logger.error(`Ошибка при обработке отмены действия: ${buttonId}`, {
        userId,
        username,
        error: error as Error,
        type: LogType.ERROR
      });

      // Отправляем сообщение об ошибке
      await ctx.reply("Произошла ошибка при отмене действия. Попробуйте еще раз.");
    }
  });

  logger.debug(`Зарегистрирован обработчик для отмены: ${cancelButtonId}`, {
    type: LogType.SYSTEM,
    data: {
      sceneName: scene.id,
      buttonId: cancelButtonId
    }
  });
}

/**
 * Регистрирует несколько обработчиков кнопок в сцене
 *
 * @param scene Сцена, в которой нужно зарегистрировать обработчики
 * @param optionsArray Массив опций для регистрации кнопок
 */
export function registerButtons(
  scene: Scenes.BaseScene<ScraperBotContext>,
  optionsArray: ButtonOptions[]
) {
  console.log(`[BUTTON_HANDLER_DEBUG] Начало регистрации ${optionsArray.length} обработчиков кнопок в сцене ${scene.id}`);

  // Выводим список всех кнопок для отладки
  optionsArray.forEach((option, index) => {
    const buttonId = typeof option.id === 'string' ? option.id : option.id.toString();
    console.log(`[BUTTON_HANDLER_DEBUG] Кнопка #${index + 1}: ID=${buttonId}, вербозный=${option.verbose || false}`);
  });

  logger.info(`Регистрация ${optionsArray.length} обработчиков кнопок в сцене ${scene.id}`, {
    type: LogType.SYSTEM,
    data: {
      sceneName: scene.id,
      buttonCount: optionsArray.length
    }
  });

  for (const options of optionsArray) {
    const buttonId = typeof options.id === 'string' ? options.id : options.id.toString();
    console.log(`[BUTTON_HANDLER_DEBUG] Регистрируем кнопку: ${buttonId}`);
    registerButton(scene, options);

    // Если включена опция отмены действия, регистрируем обработчик для кнопки отмены
    if (options.errorHandling?.showCancelButton) {
      registerCancelHandler(scene, buttonId, options.errorHandling?.onCancel);
      console.log(`[BUTTON_HANDLER_DEBUG] Зарегистрирован обработчик отмены для кнопки: ${buttonId}`);
    }
  }

  console.log(`[BUTTON_HANDLER_DEBUG] Завершена регистрация ${optionsArray.length} обработчиков кнопок в сцене ${scene.id}`);
  logger.info(`Зарегистрировано ${optionsArray.length} обработчиков кнопок в сцене ${scene.id}`, {
    type: LogType.SYSTEM
  });
}

/**
 * Создает клавиатуру для вложенного меню
 *
 * @param menuOptions Опции для вложенного меню
 * @param currentPath Текущий путь в меню (для вложенных подменю)
 * @returns Объект с клавиатурой и обработчиками
 */
export function createNestedMenu(
  menuOptions: NestedMenuOptions,
  currentPath: string = ''
): {
  keyboard: any[][],
  handlers: ButtonOptions[]
} {
  const {
    items,
    showBackButton = true,
    backButtonText = '« Назад',
    showHomeButton = true,
    homeButtonText = '🏠 Главное меню',
    columns = 1
  } = menuOptions;

  const keyboard: any[][] = [];
  const handlers: ButtonOptions[] = [];

  // Добавляем пункты меню
  const row: any[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemId = currentPath ? `${currentPath}_${item.id}` : item.id;

    // Добавляем кнопку в клавиатуру
    row.push({
      text: item.text,
      callback_data: itemId
    });

    // Если достигли нужного количества колонок или это последний элемент, добавляем строку в клавиатуру
    if (row.length === columns || i === items.length - 1) {
      keyboard.push([...row]);
      row.length = 0;
    }

    // Если у пункта есть обработчик, регистрируем его
    if (item.handler) {
      handlers.push({
        id: itemId,
        handler: item.handler,
        errorHandling: item.errorHandling
      });
    }

    // Если у пункта есть подменю, создаем обработчик для него
    if (item.submenu && item.submenu.length > 0) {
      // Если нет обработчика, создаем обработчик для открытия подменю
      if (!item.handler) {
        handlers.push({
          id: itemId,
          handler: async (ctx) => {
            const submenuOptions: NestedMenuOptions = {
              title: item.text,
              items: item.submenu || [],
              showBackButton: true,
              backButtonText,
              showHomeButton,
              homeButtonText,
              columns,
              errorHandling: menuOptions.errorHandling
            };

            const { keyboard: submenuKeyboard } = createNestedMenu(submenuOptions, itemId);

            // Добавляем кнопки навигации
            const navigationRow = [];

            if (showBackButton) {
              navigationRow.push({
                text: backButtonText,
                callback_data: `back_${itemId}`
              });
            }

            if (showHomeButton) {
              navigationRow.push({
                text: homeButtonText,
                callback_data: 'home'
              });
            }

            if (navigationRow.length > 0) {
              submenuKeyboard.push(navigationRow);
            }

            // Отправляем сообщение с подменю
            await ctx.reply(item.text, {
              reply_markup: {
                inline_keyboard: submenuKeyboard
              }
            });
          },
          errorHandling: item.errorHandling
        });
      }

      // Рекурсивно создаем обработчики для подменю
      const { handlers: submenuHandlers } = createNestedMenu(
        {
          title: item.text,
          items: item.submenu,
          showBackButton,
          backButtonText,
          showHomeButton,
          homeButtonText,
          columns,
          errorHandling: menuOptions.errorHandling
        },
        itemId
      );

      // Добавляем обработчики подменю
      handlers.push(...submenuHandlers);
    }
  }

  // Добавляем кнопки навигации
  const navigationRow = [];

  if (showBackButton && currentPath) {
    navigationRow.push({
      text: backButtonText,
      callback_data: `back_${currentPath}`
    });

    // Добавляем обработчик для кнопки "Назад"
    handlers.push({
      id: `back_${currentPath}`,
      handler: async (ctx) => {
        // Получаем родительский путь
        const parentPath = currentPath.split('_').slice(0, -1).join('_');

        // Если это корневое меню, просто отправляем его
        if (!parentPath) {
          await ctx.reply(menuOptions.title, {
            reply_markup: {
              inline_keyboard: keyboard
            }
          });
          return;
        }

        // Иначе находим родительский пункт и отправляем его подменю
        const parentItem = findItemByPath(items, parentPath);

        if (parentItem) {
          const parentMenuOptions: NestedMenuOptions = {
            title: parentItem.text,
            items: parentItem.submenu || [],
            showBackButton,
            backButtonText,
            showHomeButton,
            homeButtonText,
            columns,
            errorHandling: menuOptions.errorHandling
          };

          const { keyboard: parentKeyboard } = createNestedMenu(parentMenuOptions, parentPath);

          await ctx.reply(parentItem.text, {
            reply_markup: {
              inline_keyboard: parentKeyboard
            }
          });
        }
      },
      errorHandling: menuOptions.errorHandling
    });
  }

  if (showHomeButton) {
    navigationRow.push({
      text: homeButtonText,
      callback_data: 'home'
    });

    // Добавляем обработчик для кнопки "Главное меню"
    if (currentPath) {
      handlers.push({
        id: 'home',
        handler: async (ctx) => {
          // Отправляем корневое меню
          const rootMenuOptions: NestedMenuOptions = {
            title: menuOptions.title,
            items,
            showBackButton: false,
            showHomeButton: false,
            columns,
            errorHandling: menuOptions.errorHandling
          };

          const { keyboard: rootKeyboard } = createNestedMenu(rootMenuOptions);

          await ctx.reply(menuOptions.title, {
            reply_markup: {
              inline_keyboard: rootKeyboard
            }
          });
        },
        errorHandling: menuOptions.errorHandling
      });
    }
  }

  if (navigationRow.length > 0) {
    keyboard.push(navigationRow);
  }

  return { keyboard, handlers };
}

/**
 * Находит пункт меню по пути
 *
 * @param items Пункты меню
 * @param path Путь к пункту
 * @returns Найденный пункт меню или undefined
 */
function findItemByPath(items: NestedMenuItem[], path: string): NestedMenuItem | undefined {
  const pathParts = path.split('_');

  if (pathParts.length === 0) {
    return undefined;
  }

  let currentItems = items;
  let currentItem: NestedMenuItem | undefined;

  for (const part of pathParts) {
    currentItem = currentItems.find(item => item.id === part);

    if (!currentItem) {
      return undefined;
    }

    if (currentItem.submenu) {
      currentItems = currentItem.submenu;
    }
  }

  return currentItem;
}

/**
 * Регистрирует вложенное меню в сцене
 *
 * @param scene Сцена, в которой нужно зарегистрировать меню
 * @param menuOptions Опции для вложенного меню
 */
export function registerNestedMenu(
  scene: Scenes.BaseScene<ScraperBotContext>,
  menuOptions: NestedMenuOptions
) {
  logger.info(`Регистрация вложенного меню в сцене ${scene.id}`, {
    type: LogType.SYSTEM,
    data: {
      sceneName: scene.id,
      menuTitle: menuOptions.title
    }
  });

  const { handlers } = createNestedMenu(menuOptions);

  // Регистрируем обработчики
  registerButtons(scene, handlers);

  logger.info(`Зарегистрировано вложенное меню в сцене ${scene.id}`, {
    type: LogType.SYSTEM,
    data: {
      sceneName: scene.id,
      menuTitle: menuOptions.title,
      handlersCount: handlers.length
    }
  });

  // Возвращаем функцию для отправки меню
  return async (ctx: ScraperBotContext) => {
    const { keyboard } = createNestedMenu(menuOptions);

    await ctx.reply(menuOptions.title, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  };
}
