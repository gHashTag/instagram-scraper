import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { handleHashtagTextInput } from "../../../scenes/hashtag-scene";
import { ScraperSceneStep } from "../../../types";

// Мокируем NeonAdapter
mock.module("../../../adapters/neon-adapter", () => {
  return {
    NeonAdapter: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      addHashtag: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe("hashtagScene - Text Input Handler", () => {
  let ctx: any;
  let mockAdapter: any;

  beforeEach(() => {
    // Создаем мок для контекста
    ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
      scene: {
        session: {
          projectId: 1,
          step: ScraperSceneStep.ADD_HASHTAG,
        },
        leave: jest.fn(),
        reenter: jest.fn(),
      },
      message: {
        text: "test",
      },
      storage: {
        initialize: jest.fn().mockResolvedValue(undefined),
        addHashtag: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
      },
    };
    
    mockAdapter = ctx.storage;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should do nothing if step is not ADD_HASHTAG", async () => {
    // Устанавливаем step в undefined
    ctx.scene.session.step = undefined;
    
    // Вызываем обработчик
    await handleHashtagTextInput(ctx);
    
    // Проверяем, что не было вызовов методов
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(mockAdapter.initialize).not.toHaveBeenCalled();
    expect(ctx.scene.leave).not.toHaveBeenCalled();
    expect(ctx.scene.reenter).not.toHaveBeenCalled();
  });

  it("should leave scene if projectId is not defined", async () => {
    // Устанавливаем projectId в undefined
    ctx.scene.session.projectId = undefined;
    
    // Вызываем обработчик
    await handleHashtagTextInput(ctx);
    
    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Ошибка: проект не определен. Начните сначала."
    );
    
    // Проверяем, что step был очищен
    expect(ctx.scene.session.step).toBeUndefined();
    
    // Проверяем, что был вызван метод leave
    expect(ctx.scene.leave).toHaveBeenCalled();
    
    // Проверяем, что не было вызовов к адаптеру
    expect(mockAdapter.initialize).not.toHaveBeenCalled();
  });

  it("should remove # from hashtag if present", async () => {
    // Устанавливаем текст сообщения с #
    ctx.message.text = "#test";
    
    // Мокируем успешное добавление хештега
    mockAdapter.addHashtag.mockResolvedValue({ hashtag: "test" });
    
    // Вызываем обработчик
    await handleHashtagTextInput(ctx);
    
    // Проверяем, что был вызван метод addHashtag с правильным хештегом (без #)
    expect(mockAdapter.addHashtag).toHaveBeenCalledWith(1, "test");
  });

  it("should validate hashtag format", async () => {
    // Тест для пустого хештега
    ctx.message.text = "";
    await handleHashtagTextInput(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(
      "Некорректный хештег. Введите одно слово без пробелов (минимум 2 символа), # ставить не нужно."
    );
    expect(mockAdapter.initialize).not.toHaveBeenCalled();
    
    // Сбрасываем моки
    jest.clearAllMocks();
    
    // Тест для хештега с пробелами
    ctx.message.text = "test hashtag";
    await handleHashtagTextInput(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(
      "Некорректный хештег. Введите одно слово без пробелов (минимум 2 символа), # ставить не нужно."
    );
    expect(mockAdapter.initialize).not.toHaveBeenCalled();
    
    // Сбрасываем моки
    jest.clearAllMocks();
    
    // Тест для слишком короткого хештега
    ctx.message.text = "a";
    await handleHashtagTextInput(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(
      "Некорректный хештег. Введите одно слово без пробелов (минимум 2 символа), # ставить не нужно."
    );
    expect(mockAdapter.initialize).not.toHaveBeenCalled();
  });

  it("should add hashtag and show success message", async () => {
    // Мокируем успешное добавление хештега
    mockAdapter.addHashtag.mockResolvedValue({ hashtag: "test" });
    
    // Вызываем обработчик
    await handleHashtagTextInput(ctx);
    
    // Проверяем, что были вызваны методы адаптера
    expect(mockAdapter.initialize).toHaveBeenCalled();
    expect(mockAdapter.addHashtag).toHaveBeenCalledWith(1, "test");
    expect(mockAdapter.close).toHaveBeenCalled();
    
    // Проверяем, что был вызван метод reply с сообщением об успешном добавлении
    expect(ctx.reply).toHaveBeenCalledWith("Хештег #test успешно добавлен.");
    
    // Проверяем, что step был очищен
    expect(ctx.scene.session.step).toBeUndefined();
    
    // Проверяем, что был вызван метод reenter
    expect(ctx.scene.reenter).toHaveBeenCalled();
  });

  it("should show error message if hashtag could not be added", async () => {
    // Мокируем неудачное добавление хештега
    mockAdapter.addHashtag.mockResolvedValue(null);
    
    // Вызываем обработчик
    await handleHashtagTextInput(ctx);
    
    // Проверяем, что были вызваны методы адаптера
    expect(mockAdapter.initialize).toHaveBeenCalled();
    expect(mockAdapter.addHashtag).toHaveBeenCalledWith(1, "test");
    expect(mockAdapter.close).toHaveBeenCalled();
    
    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Не удалось добавить хештег #test. Возможно, он уже существует или произошла ошибка."
    );
    
    // Проверяем, что step был очищен
    expect(ctx.scene.session.step).toBeUndefined();
    
    // Проверяем, что был вызван метод reenter
    expect(ctx.scene.reenter).toHaveBeenCalled();
  });

  it("should handle error when addHashtag fails", async () => {
    // Мокируем ошибку в запросе
    mockAdapter.addHashtag.mockRejectedValue(new Error("Database error"));
    
    // Вызываем обработчик
    await handleHashtagTextInput(ctx);
    
    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Произошла техническая ошибка при добавлении хештега."
    );
    
    // Проверяем, что были вызваны методы адаптера
    expect(mockAdapter.initialize).toHaveBeenCalled();
    expect(mockAdapter.addHashtag).toHaveBeenCalledWith(1, "test");
    expect(mockAdapter.close).toHaveBeenCalled();
    
    // Проверяем, что step был очищен
    expect(ctx.scene.session.step).toBeUndefined();
    
    // Проверяем, что был вызван метод reenter
    expect(ctx.scene.reenter).toHaveBeenCalled();
  });
});
