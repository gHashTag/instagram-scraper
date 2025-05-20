import { Scenes, Markup } from "telegraf";
import type { ScraperBotContext } from "../types";
import { ScraperSceneStep } from "../types";
import { logger } from "../logger";
import { ReelsCollectionService } from "../services/reels-collection-service";
import { StorageAdapter } from "../types";

/**
 * Очищает состояние сессии перед выходом из сцены
 * @param ctx Контекст Telegraf
 * @param reason Причина очистки состояния (для логирования)
 */
function clearSessionState(ctx: ScraperBotContext, reason: string = "general"): void {
  if (ctx.scene.session) {
    logger.info(`[ReelsCollectionWizard] Clearing session state before leaving (reason: ${reason})`);
    // Очистка всех необходимых полей состояния
    ctx.scene.session.step = undefined;
    ctx.scene.session.currentCollectionId = undefined;
    ctx.scene.session.collectionName = undefined;
    ctx.scene.session.collectionDescription = undefined;
    ctx.scene.session.selectedReelsIds = undefined;
    ctx.scene.session.contentFormat = undefined;
    ctx.scene.session.contentData = undefined;
    // Для Wizard-сцен
    if (ctx.wizard && ctx.wizard.state) {
      ctx.wizard.state = {};
    }
  }
}

/**
 * Выполняет безопасный переход в другую сцену с обработкой ошибок
 * @param ctx Контекст Telegraf
 * @param targetScene Целевая сцена
 * @param reason Причина перехода (для логирования)
 */
async function safeSceneTransition(
  ctx: ScraperBotContext,
  targetScene: string = "project_wizard",
  reason: string = "general"
): Promise<void> {
  try {
    logger.info(`[ReelsCollectionWizard] Transitioning to ${targetScene} scene (reason: ${reason})`);
    await ctx.scene.enter(targetScene);
  } catch (error) {
    logger.error(`[ReelsCollectionWizard] Error entering ${targetScene} scene:`, error);
    await ctx.scene.leave();
  }
}

/**
 * Wizard-сцена для работы с коллекциями Reels
 */
export class ReelsCollectionWizardScene extends Scenes.WizardScene<ScraperBotContext> {
  private collectionService: ReelsCollectionService;

  /**
   * Конструктор сцены
   * @param storage Адаптер хранилища
   */
  constructor(storage: StorageAdapter) {
    super(
      "reels_collection_wizard",

      // Шаг 1: Отображение списка коллекций
      async (ctx) => {
        logger.info(`[ReelsCollectionWizard] Шаг 1: Отображение списка коллекций`);
        logger.debug(`[ReelsCollectionWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

        if (!ctx.from) {
          logger.error("[ReelsCollectionWizard] ctx.from is undefined");
          await ctx.reply(
            "Не удалось определить пользователя. Попробуйте перезапустить бота командой /start."
          );
          clearSessionState(ctx, "missing_user");
          return ctx.scene.leave();
        }

        // Получаем projectId из сессии или из wizard.state
        let projectId = ctx.scene.session.currentProjectId;
        if (!projectId && ctx.wizard.state.projectId) {
          projectId = ctx.wizard.state.projectId;
        }

        if (!projectId) {
          logger.error("[ReelsCollectionWizard] Project ID is undefined");
          await ctx.reply(
            "Не удалось определить проект. Пожалуйста, выберите проект из списка."
          );
          clearSessionState(ctx, "missing_project_id");
          await safeSceneTransition(ctx, "project_wizard", "missing_project_id");
          return;
        }

        // Сохраняем projectId в wizard.state и в сессии
        ctx.wizard.state.projectId = projectId;
        ctx.scene.session.currentProjectId = projectId;

        // Устанавливаем шаг сцены
        ctx.scene.session.step = ScraperSceneStep.REELS_COLLECTIONS;

        // Получаем номер страницы из wizard.state или устанавливаем по умолчанию
        const page = ctx.wizard.state.page || 1;

        try {
          // Получаем коллекции для текущего проекта
          const collections = await this.collectionService.getCollectionsByProjectId(projectId);

          // Если коллекций нет, отображаем сообщение
          if (collections.length === 0) {
            const keyboard = Markup.inlineKeyboard([
              [Markup.button.callback("➕ Создать коллекцию", "create_collection")],
              [Markup.button.callback("⬅️ Назад к проекту", "back_to_project")]
            ]);

            await ctx.reply("У вас пока нет коллекций Reels. Создайте первую коллекцию!", keyboard);
            return;
          }

          // Пагинация
          const itemsPerPage = 5;
          const totalPages = Math.ceil(collections.length / itemsPerPage);
          const currentPage = Math.min(Math.max(page, 1), totalPages);
          const startIndex = (currentPage - 1) * itemsPerPage;
          const endIndex = Math.min(startIndex + itemsPerPage, collections.length);
          const pageCollections = collections.slice(startIndex, endIndex);

          // Формируем сообщение
          let message = "📋 *Коллекции Reels*\n\n";

          pageCollections.forEach((collection, index) => {
            message += `*${startIndex + index + 1}. ${collection.name}*\n`;
            if (collection.description) {
              message += `📝 ${collection.description}\n`;
            }
            message += `📅 Создана: ${new Date(collection.created_at || "").toLocaleDateString()}\n`;
            message += `🔄 Статус: ${collection.is_processed ? "Обработана" : "Не обработана"}\n\n`;
          });

          // Формируем клавиатуру
          const buttons = [];

          // Кнопки для коллекций
          pageCollections.forEach(collection => {
            buttons.push([
              Markup.button.callback(
                `👁️ ${collection.name}`,
                `view_collection_${collection.id}`
              )
            ]);
          });

          // Кнопки пагинации
          const paginationButtons = [];

          if (currentPage > 1) {
            paginationButtons.push(
              Markup.button.callback(
                "⬅️ Назад",
                `collection_list_page_${currentPage - 1}`
              )
            );
          }

          if (currentPage < totalPages) {
            paginationButtons.push(
              Markup.button.callback(
                "➡️ Вперед",
                `collection_list_page_${currentPage + 1}`
              )
            );
          }

          if (paginationButtons.length > 0) {
            buttons.push(paginationButtons);
          }

          // Кнопки действий
          buttons.push([Markup.button.callback("➕ Создать коллекцию", "create_collection")]);
          buttons.push([Markup.button.callback("⬅️ Назад к проекту", "back_to_project")]);

          const keyboard = Markup.inlineKeyboard(buttons);

          await ctx.reply(message, {
            parse_mode: "Markdown",
            ...keyboard
          });
        } catch (error) {
          logger.error("[ReelsCollectionWizard] Ошибка при отображении списка коллекций:", error);
          await ctx.reply("Произошла ошибка при получении списка коллекций. Пожалуйста, попробуйте позже.");
          clearSessionState(ctx, "error_loading_collections");
          await safeSceneTransition(ctx, "project_wizard", "error_loading_collections");
        }

        // Остаемся на текущем шаге
        return;
      },

      // Шаг 2: Создание коллекции (ввод названия)
      async (ctx) => {
        logger.info(`[ReelsCollectionWizard] Шаг 2: Создание коллекции (ввод названия)`);
        logger.debug(`[ReelsCollectionWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

        // Проверяем, есть ли текст сообщения
        if (ctx.message && 'text' in ctx.message) {
          const collectionName = ctx.message.text.trim();

          if (collectionName.length < 3 || collectionName.length > 100) {
            await ctx.reply(
              "Название коллекции должно быть от 3 до 100 символов. Пожалуйста, введите корректное название:"
            );
            return;
          }

          // Сохраняем название коллекции в wizard.state
          ctx.wizard.state.collectionName = collectionName;

          // Запрашиваем описание коллекции
          await ctx.reply("Введите описание для коллекции (или отправьте '-' для пропуска):");

          // Переходим к шагу ввода описания
          return ctx.wizard.next();
        } else {
          await ctx.reply("Пожалуйста, введите название для новой коллекции:");
        }

        // Остаемся на текущем шаге
        return;
      },

      // Шаг 3: Создание коллекции (ввод описания)
      async (ctx) => {
        logger.info(`[ReelsCollectionWizard] Шаг 3: Создание коллекции (ввод описания)`);
        logger.debug(`[ReelsCollectionWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

        // Проверяем, есть ли текст сообщения
        if (ctx.message && 'text' in ctx.message) {
          const collectionDescription = ctx.message.text.trim();
          const projectId = ctx.wizard.state.projectId;
          const collectionName = ctx.wizard.state.collectionName;

          if (!projectId || !collectionName) {
            logger.error("[ReelsCollectionWizard] Project ID or Collection Name is undefined in step 3");
            await ctx.reply("Ошибка: не удалось определить проект или название коллекции. Начните сначала.");
            clearSessionState(ctx, "missing_data_step_3");
            return ctx.wizard.selectStep(0);
          }

          // Сохраняем описание коллекции (или undefined, если введен символ '-')
          const description = collectionDescription === "-" ? undefined : collectionDescription;

          try {
            // Создаем коллекцию
            const collection = await this.collectionService.createCollection(
              projectId,
              collectionName,
              description,
              ctx.scene.session.reelsFilter // Используем текущий фильтр Reels, если он есть
            );

            // Отправляем сообщение об успешном создании
            await ctx.reply(`Коллекция "${collection.name}" успешно создана!`);

            // Возвращаемся к списку коллекций
            return ctx.wizard.selectStep(0);
          } catch (error) {
            logger.error("[ReelsCollectionWizard] Ошибка при создании коллекции:", error);
            await ctx.reply("Произошла ошибка при создании коллекции. Пожалуйста, попробуйте позже.");
            return ctx.wizard.selectStep(0);
          }
        } else {
          await ctx.reply("Пожалуйста, введите описание для коллекции (или отправьте '-' для пропуска):");
        }

        // Остаемся на текущем шаге
        return;
      },

      // Шаг 4: Просмотр коллекции
      async (ctx) => {
        logger.info(`[ReelsCollectionWizard] Шаг 4: Просмотр коллекции`);
        logger.debug(`[ReelsCollectionWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);

        const collectionId = ctx.wizard.state.collectionId;

        if (!collectionId) {
          logger.error("[ReelsCollectionWizard] Collection ID is undefined in step 4");
          await ctx.reply("Ошибка: не удалось определить коллекцию. Вернитесь к списку коллекций.");
          return ctx.wizard.selectStep(0);
        }

        try {
          // Получаем коллекцию
          const collection = await this.collectionService.getCollectionById(collectionId);

          if (!collection) {
            await ctx.reply("Коллекция не найдена. Возможно, она была удалена.");
            return ctx.wizard.selectStep(0);
          }

          // Устанавливаем шаг сцены
          ctx.scene.session.step = ScraperSceneStep.COLLECTION_DETAILS;
          ctx.scene.session.currentCollectionId = collectionId;

          // Формируем сообщение
          let message = `📋 *Коллекция: ${collection.name}*\n\n`;

          if (collection.description) {
            message += `📝 *Описание:* ${collection.description}\n\n`;
          }

          message += `📅 *Создана:* ${new Date(collection.created_at || "").toLocaleDateString()}\n`;
          message += `🔄 *Статус:* ${collection.is_processed ? "Обработана" : "Не обработана"}\n`;

          if (collection.processing_status) {
            message += `📊 *Статус обработки:* ${collection.processing_status}\n`;
          }

          if (collection.content_format) {
            message += `📄 *Формат контента:* ${collection.content_format}\n`;
          }

          // Формируем клавиатуру
          const buttons = [];

          // Кнопки для обработки коллекции
          if (!collection.is_processed) {
            buttons.push([
              Markup.button.callback("📝 Обработать как текст", `process_collection_${collectionId}_text`),
              Markup.button.callback("📊 Обработать как CSV", `process_collection_${collectionId}_csv`)
            ]);
            buttons.push([
              Markup.button.callback("📋 Обработать как JSON", `process_collection_${collectionId}_json`)
            ]);
          } else if (collection.content_data) {
            // Если коллекция уже обработана и есть данные, показываем их
            message += "\n\n*Результат обработки:*\n";

            if (collection.content_format === "text") {
              // Для текстового формата показываем первые 500 символов
              message += "```\n" + collection.content_data.substring(0, 500) + (collection.content_data.length > 500 ? "...\n(сокращено)" : "") + "\n```";
            } else {
              message += "Данные доступны в формате " + collection.content_format.toUpperCase();
            }
          }

          // Кнопки действий
          buttons.push([Markup.button.callback("🗑️ Удалить коллекцию", `delete_collection_${collectionId}`)]);
          buttons.push([Markup.button.callback("⬅️ Назад к списку коллекций", "back_to_collections")]);

          const keyboard = Markup.inlineKeyboard(buttons);

          await ctx.reply(message, {
            parse_mode: "Markdown",
            ...keyboard
          });
        } catch (error) {
          logger.error("[ReelsCollectionWizard] Ошибка при просмотре коллекции:", error);
          await ctx.reply("Произошла ошибка при получении информации о коллекции. Пожалуйста, попробуйте позже.");
          return ctx.wizard.selectStep(0);
        }

        // Остаемся на текущем шаге
        return;
      }
    );

    // Инициализируем сервис коллекций
    this.collectionService = new ReelsCollectionService(storage);

    // Регистрируем обработчики кнопок
    this.registerButtonHandlers();
  }

  /**
   * Регистрирует обработчики кнопок
   */
  private registerButtonHandlers(): void {
    // Обработчик для перехода на страницу списка коллекций
    this.action(/collection_list_page_(\d+)/, async (ctx) => {
      logger.info(`[ReelsCollectionWizard] Обработчик кнопки 'collection_list_page' вызван`);
      await ctx.answerCbQuery();

      const match = ctx.match as RegExpMatchArray;
      const page = parseInt(match[1], 10);

      // Сохраняем номер страницы в wizard.state
      ctx.wizard.state.page = page;

      // Возвращаемся к шагу отображения списка коллекций
      return ctx.wizard.selectStep(0);
    });

    // Обработчик для создания коллекции
    this.action("create_collection", async (ctx) => {
      logger.info(`[ReelsCollectionWizard] Обработчик кнопки 'create_collection' вызван`);
      await ctx.answerCbQuery();

      // Устанавливаем шаг сцены
      ctx.scene.session.step = ScraperSceneStep.CREATE_COLLECTION;

      // Переходим к шагу создания коллекции
      return ctx.wizard.selectStep(1);
    });

    // Обработчик для просмотра коллекции
    this.action(/view_collection_(\d+)/, async (ctx) => {
      logger.info(`[ReelsCollectionWizard] Обработчик кнопки 'view_collection' вызван`);
      await ctx.answerCbQuery();

      const match = ctx.match as RegExpMatchArray;
      const collectionId = parseInt(match[1], 10);

      // Сохраняем ID коллекции в wizard.state
      ctx.wizard.state.collectionId = collectionId;

      // Переходим к шагу просмотра коллекции
      return ctx.wizard.selectStep(3);
    });

    // Обработчик для обработки коллекции
    this.action(/process_collection_(\d+)_(.+)/, async (ctx) => {
      logger.info(`[ReelsCollectionWizard] Обработчик кнопки 'process_collection' вызван`);
      await ctx.answerCbQuery();

      const match = ctx.match as RegExpMatchArray;
      const collectionId = parseInt(match[1], 10);
      const format = match[2] as "text" | "csv" | "json";

      try {
        // Устанавливаем шаг сцены
        ctx.scene.session.step = ScraperSceneStep.EXPORT_COLLECTION;

        // Отправляем сообщение о начале обработки
        await ctx.reply(`Начинаем обработку коллекции в формате ${format.toUpperCase()}...`);

        // Обрабатываем коллекцию
        const processedCollection = await this.collectionService.processCollection(collectionId, format);

        if (!processedCollection) {
          await ctx.reply("Не удалось обработать коллекцию. Пожалуйста, попробуйте позже.");
          return ctx.wizard.selectStep(0);
        }

        // Отправляем сообщение об успешной обработке
        await ctx.reply(`Коллекция успешно обработана в формате ${format.toUpperCase()}!`);

        // Сохраняем ID коллекции в wizard.state и показываем детали коллекции
        ctx.wizard.state.collectionId = collectionId;
        return ctx.wizard.selectStep(3);
      } catch (error) {
        logger.error("[ReelsCollectionWizard] Ошибка при обработке коллекции:", error);
        await ctx.reply("Произошла ошибка при обработке коллекции. Пожалуйста, попробуйте позже.");
        return ctx.wizard.selectStep(0);
      }
    });

    // Обработчик для удаления коллекции
    this.action(/delete_collection_(\d+)/, async (ctx) => {
      logger.info(`[ReelsCollectionWizard] Обработчик кнопки 'delete_collection' вызван`);
      await ctx.answerCbQuery();

      const match = ctx.match as RegExpMatchArray;
      const collectionId = parseInt(match[1], 10);

      try {
        // Получаем коллекцию
        const collection = await this.collectionService.getCollectionById(collectionId);

        if (!collection) {
          await ctx.reply("Коллекция не найдена. Возможно, она была удалена.");
          return ctx.wizard.selectStep(0);
        }

        // Сохраняем ID коллекции в wizard.state
        ctx.wizard.state.collectionId = collectionId;
        ctx.wizard.state.collectionName = collection.name;

        // Запрашиваем подтверждение удаления
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback("✅ Да, удалить", "confirm_delete"),
            Markup.button.callback("❌ Нет, отмена", "cancel_delete")
          ]
        ]);

        await ctx.reply(`Вы уверены, что хотите удалить коллекцию "${collection.name}"?`, keyboard);
      } catch (error) {
        logger.error("[ReelsCollectionWizard] Ошибка при удалении коллекции:", error);
        await ctx.reply("Произошла ошибка при удалении коллекции. Пожалуйста, попробуйте позже.");
        return ctx.wizard.selectStep(0);
      }
    });

    // Обработчик для подтверждения удаления коллекции
    this.action("confirm_delete", async (ctx) => {
      logger.info(`[ReelsCollectionWizard] Обработчик кнопки 'confirm_delete' вызван`);
      await ctx.answerCbQuery();

      const collectionId = ctx.wizard.state.collectionId;

      if (!collectionId) {
        logger.error("[ReelsCollectionWizard] Collection ID is undefined in confirm_delete handler");
        await ctx.reply("Ошибка: не удалось определить коллекцию. Вернитесь к списку коллекций.");
        return ctx.wizard.selectStep(0);
      }

      try {
        // Удаляем коллекцию
        const result = await this.collectionService.deleteCollection(collectionId);

        if (result) {
          await ctx.reply("Коллекция успешно удалена!");
        } else {
          await ctx.reply("Не удалось удалить коллекцию. Пожалуйста, попробуйте позже.");
        }

        // Возвращаемся к списку коллекций
        return ctx.wizard.selectStep(0);
      } catch (error) {
        logger.error("[ReelsCollectionWizard] Ошибка при подтверждении удаления коллекции:", error);
        await ctx.reply("Произошла ошибка при удалении коллекции. Пожалуйста, попробуйте позже.");
        return ctx.wizard.selectStep(0);
      }
    });

    // Обработчик для отмены удаления коллекции
    this.action("cancel_delete", async (ctx) => {
      logger.info(`[ReelsCollectionWizard] Обработчик кнопки 'cancel_delete' вызван`);
      await ctx.answerCbQuery();

      // Возвращаемся к просмотру коллекции
      return ctx.wizard.selectStep(3);
    });

    // Обработчик для возврата к проекту
    this.action("back_to_project", async (ctx) => {
      logger.info(`[ReelsCollectionWizard] Обработчик кнопки 'back_to_project' вызван`);
      await ctx.answerCbQuery();

      // Очистка состояния и безопасный переход в другую сцену
      clearSessionState(ctx, "back_to_project_clicked");
      await safeSceneTransition(ctx, "project_wizard", "back_to_project_clicked");
    });

    // Обработчик для возврата к списку коллекций
    this.action("back_to_collections", async (ctx) => {
      logger.info(`[ReelsCollectionWizard] Обработчик кнопки 'back_to_collections' вызван`);
      await ctx.answerCbQuery();

      // Возвращаемся к списку коллекций
      return ctx.wizard.selectStep(0);
    });
  }
}

// Добавляем обработчик для команды /collections
export function setupReelsCollectionWizard(bot: any) {
  bot.command('collections', async (ctx: any) => {
    logger.info("[ReelsCollectionWizard] Command /collections triggered");
    await ctx.scene.enter('reels_collection_wizard');
  });

  // Добавляем обработчик для кнопки "Коллекции Reels" в главном меню
  bot.hears('📋 Коллекции Reels', async (ctx: any) => {
    logger.info("[ReelsCollectionWizard] Button '📋 Коллекции Reels' clicked");
    await ctx.scene.enter('reels_collection_wizard');
  });
}

export default ReelsCollectionWizardScene;
