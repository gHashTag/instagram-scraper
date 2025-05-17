import { Scenes, Markup } from "telegraf";
import type { ScraperBotContext } from "../types";
import { ScraperSceneStep } from "../types";
import { logger } from "../logger";
import { EmbeddingsService } from "../services/embeddings-service";
import { ChatbotService } from "../services/chatbot-service";
import { StorageAdapter } from "../types";

/**
 * Очищает состояние сессии перед выходом из сцены
 * @param ctx Контекст Telegraf
 * @param reason Причина очистки состояния (для логирования)
 */
function clearSessionState(ctx: ScraperBotContext, reason: string = "general"): void {
  if (ctx.scene.session) {
    logger.info(`[ChatbotWizard] Clearing session state before leaving (reason: ${reason})`);
    // Очистка всех необходимых полей состояния
    ctx.scene.session.step = undefined;
    ctx.scene.session.currentReelId = undefined;
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
  targetScene: string = "reels_wizard",
  reason: string = "general"
): Promise<void> {
  try {
    logger.info(`[ChatbotWizard] Transitioning to ${targetScene} scene (reason: ${reason})`);
    await ctx.scene.enter(targetScene);
  } catch (error) {
    logger.error(`[ChatbotWizard] Error entering ${targetScene} scene:`, error);
    await ctx.scene.leave();
  }
}

/**
 * Wizard-сцена для чат-бота, работающего с расшифровками видео
 */
export class ChatbotWizardScene extends Scenes.WizardScene<ScraperBotContext> {
  private embeddingsService: EmbeddingsService;
  private chatbotService: ChatbotService;

  /**
   * Конструктор сцены
   * @param storage Адаптер хранилища
   * @param apiKey API ключ OpenAI (опционально)
   */
  constructor(storage: StorageAdapter, apiKey?: string) {
    super(
      "chatbot_wizard",
      
      // Шаг 1: Отображение списка Reels с расшифровками
      async (ctx) => {
        logger.info(`[ChatbotWizard] Шаг 1: Отображение списка Reels с расшифровками`);
        logger.debug(`[ChatbotWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);
        
        if (!ctx.from) {
          logger.error("[ChatbotWizard] ctx.from is undefined");
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
          logger.error("[ChatbotWizard] Project ID is undefined");
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

        // Получаем reelId из сессии или из wizard.state
        let reelId = ctx.scene.session.currentReelId;
        if (!reelId && ctx.wizard.state.reelId) {
          reelId = ctx.wizard.state.reelId;
        }

        // Если есть ID Reel, начинаем чат с этим Reel
        if (reelId) {
          ctx.wizard.state.reelId = reelId;
          ctx.scene.session.currentReelId = reelId;
          return ctx.wizard.selectStep(1);
        }

        // Устанавливаем шаг сцены
        ctx.scene.session.step = ScraperSceneStep.CHATBOT_REELS_LIST;
        
        try {
          await ctx.storage.initialize();

          // Получаем список Reels с расшифровками
          const reels = await ctx.storage.executeQuery(
            `SELECT r.id, r.instagram_id, r.caption, r.url, r.transcript
             FROM reels r
             WHERE r.project_id = $1 AND r.transcript IS NOT NULL
             ORDER BY r.published_at DESC
             LIMIT 10`,
            [projectId]
          );

          if (!reels || reels.rows.length === 0) {
            await ctx.reply(
              "У вас пока нет Reels с расшифровками. Сначала расшифруйте видео в разделе просмотра Reels.",
              Markup.inlineKeyboard([
                [Markup.button.callback("🔙 К просмотру Reels", "back_to_reels")],
              ])
            );
            return;
          }

          // Формируем сообщение
          let message = "📝 *Reels с расшифровками*\n\n";
          message += "Выберите Reel для общения с чат-ботом:\n\n";

          // Формируем клавиатуру
          const buttons = [];

          for (const reel of reels.rows) {
            const caption = reel.caption
              ? (reel.caption.length > 30 ? reel.caption.substring(0, 30) + "..." : reel.caption)
              : "Без описания";

            buttons.push([
              Markup.button.callback(
                `💬 ${caption}`,
                `chat_with_reel_${reel.instagram_id}`
              ),
            ]);
          }

          // Кнопка возврата
          buttons.push([
            Markup.button.callback("🔙 К просмотру Reels", "back_to_reels"),
          ]);

          const keyboard = Markup.inlineKeyboard(buttons);

          await ctx.reply(message, {
            parse_mode: "Markdown",
            ...keyboard,
          });
        } catch (error) {
          logger.error("[ChatbotWizard] Error showing reels with transcripts:", error);
          await ctx.reply("Произошла ошибка при получении списка Reels с расшифровками.");
          clearSessionState(ctx, "error_loading_reels");
          await safeSceneTransition(ctx, "reels_wizard", "error_loading_reels");
        } finally {
          await ctx.storage.close();
        }
        
        // Остаемся на текущем шаге
        return;
      },
      
      // Шаг 2: Чат с выбранным Reel
      async (ctx) => {
        logger.info(`[ChatbotWizard] Шаг 2: Чат с выбранным Reel`);
        logger.debug(`[ChatbotWizard] Содержимое ctx.wizard.state:`, ctx.wizard.state);
        
        const reelId = ctx.wizard.state.reelId;
        
        if (!reelId) {
          logger.error("[ChatbotWizard] Reel ID is undefined in step 2");
          await ctx.reply("Ошибка: не удалось определить Reel. Вернитесь к списку Reels.");
          return ctx.wizard.selectStep(0);
        }
        
        try {
          await ctx.storage.initialize();

          // Получаем информацию о Reel
          const reel = await ctx.storage.getReelById(reelId);

          if (!reel) {
            await ctx.reply("Reel не найден. Возможно, он был удален.");
            return ctx.wizard.selectStep(0);
          }

          if (!reel.transcript) {
            await ctx.reply(
              "У этого Reel нет расшифровки. Сначала расшифруйте видео в разделе просмотра Reels.",
              Markup.inlineKeyboard([
                [Markup.button.callback("🔙 К просмотру Reels", "back_to_reels")],
              ])
            );
            return ctx.wizard.selectStep(0);
          }

          // Проверяем, есть ли эмбеддинг для этого Reel
          const embedding = await this.embeddingsService.getEmbeddingByReelId(reelId);

          if (!embedding) {
            // Если эмбеддинга нет, создаем его
            await ctx.reply("Подготовка чат-бота для этого видео...");

            const embeddingId = await this.embeddingsService.createAndSaveEmbedding(
              reelId,
              reel.transcript
            );

            if (!embeddingId) {
              await ctx.reply(
                "Не удалось подготовить чат-бот для этого видео. Пожалуйста, попробуйте позже.",
                Markup.inlineKeyboard([
                  [Markup.button.callback("🔙 К списку Reels", "back_to_reels")],
                ])
              );
              return ctx.wizard.selectStep(0);
            }
          }

          // Формируем сообщение
          let message = `💬 *Чат с видео*\n\n`;
          message += `Вы можете задать вопросы о содержании этого видео, и я постараюсь ответить на основе его расшифровки.\n\n`;
          message += `*Описание видео:*\n${reel.caption || "Без описания"}\n\n`;
          message += `Просто отправьте ваш вопрос в чат.`;

          // Формируем клавиатуру
          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback("🗑️ Очистить историю чата", "clear_chat_history")],
            [Markup.button.callback("🔙 К списку Reels", "back_to_reels")],
          ]);

          await ctx.reply(message, {
            parse_mode: "Markdown",
            ...keyboard,
          });
          
          // Устанавливаем шаг сцены
          ctx.scene.session.step = ScraperSceneStep.CHATBOT_CHAT;
        } catch (error) {
          logger.error("[ChatbotWizard] Error starting chat with reel:", error);
          await ctx.reply("Произошла ошибка при подготовке чата с видео.");
          return ctx.wizard.selectStep(0);
        } finally {
          await ctx.storage.close();
        }
        
        // Остаемся на текущем шаге для обработки сообщений пользователя
        return;
      }
    );
    
    // Инициализируем сервисы
    this.embeddingsService = new EmbeddingsService(storage, apiKey);
    this.chatbotService = new ChatbotService(storage, this.embeddingsService, apiKey);
    
    // Регистрируем обработчики кнопок
    this.registerButtonHandlers();
    
    // Обработчик для ввода текста
    this.on("text", this.onText.bind(this));
  }

  /**
   * Регистрирует обработчики кнопок
   */
  private registerButtonHandlers(): void {
    // Обработчик для выбора Reel для чата
    this.action(/chat_with_reel_(.+)/, async (ctx) => {
      logger.info(`[ChatbotWizard] Обработчик кнопки 'chat_with_reel' вызван`);
      await ctx.answerCbQuery();
      
      const match = ctx.match as RegExpMatchArray;
      const reelId = match[1];
      
      // Сохраняем ID Reel в wizard.state и в сессии
      ctx.wizard.state.reelId = reelId;
      ctx.scene.session.currentReelId = reelId;
      
      // Переходим к шагу чата с Reel
      return ctx.wizard.selectStep(1);
    });
    
    // Обработчик для очистки истории чата
    this.action("clear_chat_history", async (ctx) => {
      logger.info(`[ChatbotWizard] Обработчик кнопки 'clear_chat_history' вызван`);
      await ctx.answerCbQuery();
      
      const reelId = ctx.wizard.state.reelId;
      
      if (!reelId) {
        await ctx.answerCbQuery("Нет активного чата для очистки.");
        return;
      }
      
      try {
        const userId = ctx.from?.id.toString() || "";
        const success = await this.chatbotService.clearChatHistory(userId, reelId);
        
        if (success) {
          await ctx.answerCbQuery("История чата очищена.");
          await ctx.reply("История чата очищена. Можете начать новый разговор.");
        } else {
          await ctx.answerCbQuery("Не удалось очистить историю чата.");
        }
      } catch (error) {
        logger.error("[ChatbotWizard] Error clearing chat history:", error);
        await ctx.answerCbQuery("Произошла ошибка при очистке истории чата.");
      }
    });
    
    // Обработчик для возврата к списку Reels
    this.action("back_to_reels", async (ctx) => {
      logger.info(`[ChatbotWizard] Обработчик кнопки 'back_to_reels' вызван`);
      await ctx.answerCbQuery();
      
      const projectId = ctx.wizard.state.projectId;
      
      // Очистка состояния и безопасный переход в другую сцену
      clearSessionState(ctx, "back_to_reels_clicked");
      ctx.scene.session.currentProjectId = projectId;
      await safeSceneTransition(ctx, "reels_wizard", "back_to_reels_clicked");
    });
  }

  /**
   * Обработчик ввода текста
   * @param ctx Контекст сцены
   */
  private async onText(ctx: ScraperBotContext) {
    const text = ctx.message.text;
    const reelId = ctx.wizard.state.reelId || ctx.scene.session.currentReelId;
    
    if (!reelId) {
      await ctx.reply(
        "Пожалуйста, сначала выберите Reel для чата.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 К списку Reels", "back_to_reels")],
        ])
      );
      return ctx.wizard.selectStep(0);
    }
    
    try {
      // Отправляем индикатор набора текста
      await ctx.sendChatAction("typing");
      
      // Генерируем ответ
      const userId = ctx.from?.id.toString() || "";
      const response = await this.chatbotService.generateResponse(
        userId,
        reelId,
        text
      );
      
      if (response) {
        await ctx.reply(response, {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🗑️ Очистить историю чата", "clear_chat_history")],
            [Markup.button.callback("🔙 К списку Reels", "back_to_reels")],
          ]),
        });
      } else {
        await ctx.reply(
          "Извините, не удалось сгенерировать ответ. Пожалуйста, попробуйте еще раз или выберите другой Reel.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 К списку Reels", "back_to_reels")],
          ])
        );
      }
    } catch (error) {
      logger.error("[ChatbotWizard] Error generating response:", error);
      await ctx.reply("Произошла ошибка при генерации ответа. Пожалуйста, попробуйте еще раз.");
    }
  }
}

// Добавляем обработчик для команды /chatbot
export function setupChatbotWizard(bot: any) {
  bot.command('chatbot', async (ctx: any) => {
    logger.info("[ChatbotWizard] Command /chatbot triggered");
    await ctx.scene.enter('chatbot_wizard');
  });

  // Добавляем обработчик для кнопки "Чат-бот" в главном меню
  bot.hears('🤖 Чат-бот', async (ctx: any) => {
    logger.info("[ChatbotWizard] Button '🤖 Чат-бот' clicked");
    await ctx.scene.enter('chatbot_wizard');
  });
}

export default ChatbotWizardScene;
