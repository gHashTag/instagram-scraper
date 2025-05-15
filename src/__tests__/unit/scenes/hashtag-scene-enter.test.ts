import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { handleHashtagEnter } from "../../../scenes/hashtag-scene";
// Импорт ScraperSceneStep не используется

// Мокируем NeonAdapter
mock.module("../../../adapters/neon-adapter", () => {
  return {
    NeonAdapter: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      getHashtagsByProjectId: jest.fn(),
      getProjectById: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe("hashtagScene - Enter Handler", () => {
  let ctx: any;
  let mockAdapter: any;

  beforeEach(() => {
    // Создаем мок для контекста
    ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
      scene: {
        session: {
          projectId: 1,
        },
        leave: jest.fn(),
      },
      storage: {
        initialize: jest.fn().mockResolvedValue(undefined),
        getHashtagsByProjectId: jest.fn(),
        getProjectById: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
      },
    };

    mockAdapter = ctx.storage;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should leave scene if projectId is not defined", async () => {
    // Устанавливаем projectId в undefined
    ctx.scene.session.projectId = undefined;

    // Вызываем обработчик
    await handleHashtagEnter(ctx);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Ошибка: проект не определен. Пожалуйста, вернитесь и выберите проект."
    );

    // Проверяем, что был вызван метод leave
    expect(ctx.scene.leave).toHaveBeenCalled();

    // Проверяем, что не было вызовов к адаптеру
    expect(mockAdapter.initialize).not.toHaveBeenCalled();
  });

  it("should show message when there are no hashtags", async () => {
    // Мокируем результаты запросов
    mockAdapter.getHashtagsByProjectId.mockResolvedValue([]);
    mockAdapter.getProjectById.mockResolvedValue({ name: "Test Project" });

    // Вызываем обработчик
    await handleHashtagEnter(ctx);

    // Проверяем, что был вызван метод reply с сообщением о пустом списке хештегов
    expect(ctx.reply).toHaveBeenCalledWith(
      'В проекте "Test Project" нет отслеживаемых хештегов. Хотите добавить первый?',
      expect.anything()
    );

    // Проверяем, что были вызваны методы адаптера
    expect(mockAdapter.initialize).toHaveBeenCalled();
    expect(mockAdapter.getHashtagsByProjectId).toHaveBeenCalledWith(1);
    expect(mockAdapter.getProjectById).toHaveBeenCalledWith(1);
    expect(mockAdapter.close).toHaveBeenCalled();
  });

  it("should show hashtags list when there are hashtags", async () => {
    // Мокируем результаты запросов
    const mockHashtags = [
      { id: 1, project_id: 1, hashtag: "test1" },
      { id: 2, project_id: 1, hashtag: "test2" }
    ];
    mockAdapter.getHashtagsByProjectId.mockResolvedValue(mockHashtags);
    mockAdapter.getProjectById.mockResolvedValue({ name: "Test Project" });

    // Вызываем обработчик
    await handleHashtagEnter(ctx);

    // Проверяем, что был вызван метод reply с сообщением со списком хештегов
    expect(ctx.reply).toHaveBeenCalledWith(
      'Хештеги в проекте "Test Project":\n\n1. #test1\n2. #test2\n\nЧто вы хотите сделать дальше?',
      expect.anything()
    );

    // Проверяем, что были вызваны методы адаптера
    expect(mockAdapter.initialize).toHaveBeenCalled();
    expect(mockAdapter.getHashtagsByProjectId).toHaveBeenCalledWith(1);
    expect(mockAdapter.getProjectById).toHaveBeenCalledWith(1);
    expect(mockAdapter.close).toHaveBeenCalled();
  });

  it("should handle error when getHashtagsByProjectId fails", async () => {
    // Мокируем ошибку в запросе
    mockAdapter.getHashtagsByProjectId.mockRejectedValue(new Error("Database error"));

    // Вызываем обработчик
    await handleHashtagEnter(ctx);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Не удалось загрузить список хештегов. Попробуйте позже."
    );

    // Проверяем, что были вызваны методы адаптера
    expect(mockAdapter.initialize).toHaveBeenCalled();
    expect(mockAdapter.getHashtagsByProjectId).toHaveBeenCalledWith(1);
    expect(mockAdapter.close).toHaveBeenCalled();
  });

  it("should use project ID if project name is not available", async () => {
    // Мокируем результаты запросов
    mockAdapter.getHashtagsByProjectId.mockResolvedValue([]);
    mockAdapter.getProjectById.mockResolvedValue(null);

    // Вызываем обработчик
    await handleHashtagEnter(ctx);

    // Проверяем, что был вызван метод reply с сообщением, использующим ID проекта
    expect(ctx.reply).toHaveBeenCalledWith(
      'В проекте "Проект ID 1" нет отслеживаемых хештегов. Хотите добавить первый?',
      expect.anything()
    );

    // Проверяем, что были вызваны методы адаптера
    expect(mockAdapter.initialize).toHaveBeenCalled();
    expect(mockAdapter.getHashtagsByProjectId).toHaveBeenCalledWith(1);
    expect(mockAdapter.getProjectById).toHaveBeenCalledWith(1);
    expect(mockAdapter.close).toHaveBeenCalled();
  });
});
