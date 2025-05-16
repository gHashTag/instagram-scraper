import { describe, it, expect, jest, mock, beforeEach, afterEach } from "bun:test";
import { handleReelsEnter } from "../../../scenes/reels-scene";
import { ScraperSceneStep } from "../../../types";
import { createMockReelContent } from "../../helpers/mocks";

// Мокируем зависимости
mock.module("../../../logger", () => {
  return {
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    },
  };
});

describe("ReelsScene - Enter Handler", () => {
  // Создаем моки для контекста Telegraf
  let ctx;
  let mockStorage;

  beforeEach(() => {
    // Сбрасываем все моки перед каждым тестом
    jest.clearAllMocks();

    // Создаем мок для хранилища
    mockStorage = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getProjectById: jest.fn(),
      getReels: jest.fn(),
      getReelsCount: jest.fn(),
      getCompetitorAccounts: jest.fn(),
      getHashtagsByProjectId: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Создаем мок контекста
    ctx = {
      scene: {
        enter: jest.fn(),
        reenter: jest.fn(),
        leave: jest.fn(),
        state: {},
        session: {
          currentProjectId: 123,
          reelsPage: 1,
          reelsPerPage: 5,
        },
      },
      reply: jest.fn().mockResolvedValue({}),
      from: { id: 123456789 },
      storage: mockStorage,
    };
  });

  afterEach(() => {
    // Очищаем все моки после каждого теста
    jest.clearAllMocks();
  });

  it("should leave scene if ctx.from is undefined", async () => {
    // Устанавливаем ctx.from в undefined
    ctx.from = undefined;

    // Вызываем обработчик входа в сцену напрямую
    await handleReelsEnter(ctx);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Не удалось определить пользователя. Попробуйте перезапустить бота командой /start."
    );

    // Проверяем, что был вызван метод leave
    expect(ctx.scene.leave).toHaveBeenCalled();

    // Проверяем, что не было вызовов к storage
    expect(mockStorage.initialize).not.toHaveBeenCalled();
  });

  it("should enter projects scene if projectId is undefined", async () => {
    // Устанавливаем projectId в undefined
    ctx.scene.session.currentProjectId = undefined;

    // Вызываем обработчик входа в сцену напрямую
    await handleReelsEnter(ctx);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Не удалось определить проект. Пожалуйста, выберите проект из списка."
    );

    // Проверяем, что был вызван метод enter с правильным параметром
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");

    // Проверяем, что не было вызовов к storage
    expect(mockStorage.initialize).not.toHaveBeenCalled();
  });

  it("should enter projects scene if project is not found", async () => {
    // Мокируем результат запроса getProjectById
    mockStorage.getProjectById.mockResolvedValue(null);

    // Вызываем обработчик входа в сцену напрямую
    await handleReelsEnter(ctx);

    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
    expect(mockStorage.close).toHaveBeenCalled();

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Проект не найден. Возможно, он был удален."
    );

    // Проверяем, что был вызван метод enter с правильным параметром
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");
  });

  it("should show message when no reels are available", async () => {
    // Мокируем результаты запросов
    const mockProject = { id: 123, user_id: 1, name: "Test Project" };
    mockStorage.getProjectById.mockResolvedValue(mockProject);
    mockStorage.getReels.mockResolvedValue([]);
    mockStorage.getReelsCount.mockResolvedValue(0);

    // Вызываем обработчик входа в сцену напрямую
    await handleReelsEnter(ctx);

    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
    expect(mockStorage.getReels).toHaveBeenCalled();
    expect(mockStorage.close).toHaveBeenCalled();

    // Проверяем, что был вызван метод reply с сообщением о пустом списке Reels
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Нет доступных Reels"),
      expect.anything()
    );
  });

  it("should show reels list when reels are available", async () => {
    // Мокируем результаты запросов
    const mockProject = { id: 123, user_id: 1, name: "Test Project" };
    const mockReels = [
      createMockReelContent({ id: 1, project_id: 123, instagram_id: "reel1" }),
      createMockReelContent({ id: 2, project_id: 123, instagram_id: "reel2" })
    ];
    mockStorage.getProjectById.mockResolvedValue(mockProject);
    mockStorage.getReels.mockResolvedValue(mockReels);
    mockStorage.getReelsCount.mockResolvedValue(2);

    // Вызываем обработчик входа в сцену напрямую
    await handleReelsEnter(ctx);

    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
    expect(mockStorage.getReels).toHaveBeenCalled();
    expect(mockStorage.getReelsCount).toHaveBeenCalled();
    expect(mockStorage.close).toHaveBeenCalled();

    // Проверяем, что был вызван метод reply с сообщением со списком Reels
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Reels для проекта"),
      expect.anything()
    );

    // Проверяем, что был установлен правильный шаг в сессии
    expect(ctx.scene.session.step).toBe(ScraperSceneStep.REELS_LIST);
  });

  it("should handle source type and id from state", async () => {
    // Устанавливаем sourceType и sourceId в state
    ctx.scene.state = { sourceType: "competitor", sourceId: "456" };

    // Мокируем результаты запросов
    const mockProject = { id: 123, user_id: 1, name: "Test Project" };
    const mockReels = [
      createMockReelContent({ id: 1, project_id: 123, instagram_id: "reel1" }),
      createMockReelContent({ id: 2, project_id: 123, instagram_id: "reel2" })
    ];
    const mockCompetitors = [
      { id: 456, project_id: 123, username: "competitor1" }
    ];
    mockStorage.getProjectById.mockResolvedValue(mockProject);
    mockStorage.getReels.mockResolvedValue(mockReels);
    mockStorage.getReelsCount.mockResolvedValue(2);
    mockStorage.getCompetitorAccounts.mockResolvedValue(mockCompetitors);

    // Вызываем обработчик входа в сцену напрямую
    await handleReelsEnter(ctx);

    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
    expect(mockStorage.getReels).toHaveBeenCalled();
    expect(mockStorage.getCompetitorAccounts).toHaveBeenCalledWith(123);
    expect(mockStorage.close).toHaveBeenCalled();

    // Проверяем, что параметры были сохранены в сессии
    expect(ctx.scene.session.currentSourceType).toBe("competitor");
    expect(ctx.scene.session.currentSourceId).toBe("456");

    // Проверяем, что был вызван метод reply с сообщением со списком Reels
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Конкурент:"),
      expect.anything()
    );
  });

  it("should handle error during reels fetching", async () => {
    // Мокируем ошибку при запросе getReels
    mockStorage.getProjectById.mockResolvedValue({ id: 123, user_id: 1, name: "Test Project" });
    mockStorage.getReels.mockRejectedValue(new Error("Test error"));

    // Вызываем обработчик входа в сцену напрямую
    await handleReelsEnter(ctx);

    // Проверяем, что были вызваны методы storage
    expect(mockStorage.initialize).toHaveBeenCalled();
    expect(mockStorage.getProjectById).toHaveBeenCalledWith(123);
    expect(mockStorage.getReels).toHaveBeenCalled();
    expect(mockStorage.close).toHaveBeenCalled();

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Произошла ошибка при загрузке данных. Попробуйте еще раз."
    );

    // Проверяем, что был вызван метод leave
    expect(ctx.scene.leave).toHaveBeenCalled();
  });
});
