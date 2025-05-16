import { describe, it, expect, jest, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { handleScrapingEnter } from "../../../scenes/scraping-scene";
import { createMockCompetitor, createMockHashtag, createMockProject } from "../../helpers/mocks";

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

describe("scrapingScene - Enter Handler", () => {
  // Определяем тип для тестового контекста
  type TestContext = {
    scene: any;
    storage: any;
    reply: jest.Mock;
    from: any;
  };
  
  let ctx: TestContext;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    // Создаем мок для контекста
    ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
      scene: {
        session: {
          currentProjectId: 1,
        },
        leave: jest.fn(),
        enter: jest.fn(),
      },
      storage: {
        initialize: jest.fn().mockResolvedValue(undefined),
        getProjectById: jest.fn(),
        getCompetitorAccounts: jest.fn(),
        getHashtagsByProjectId: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
      },
      from: {
        id: 123456789,
        username: "testuser",
        first_name: "Test",
        last_name: "User",
        is_bot: false,
      },
    } as unknown as TestContext;

    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should show error message if ctx.from is undefined", async () => {
    // Устанавливаем ctx.from в undefined
    ctx.from = undefined;

    // Вызываем обработчик
    await handleScrapingEnter(ctx as any);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Не удалось определить пользователя. Попробуйте перезапустить бота командой /start."
    );

    // Проверяем, что был вызван метод leave
    expect(ctx.scene.leave).toHaveBeenCalled();
  });

  it("should show error message if projectId is undefined", async () => {
    // Устанавливаем projectId в undefined
    ctx.scene.session.currentProjectId = undefined;

    // Вызываем обработчик
    await handleScrapingEnter(ctx as any);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Не удалось определить проект. Пожалуйста, выберите проект из списка."
    );

    // Проверяем, что был вызван метод enter с правильным параметром
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");
  });

  it("should show error message if project not found", async () => {
    // Мокируем результат запроса getProjectById
    ctx.storage.getProjectById.mockResolvedValue(null);

    // Вызываем обработчик
    await handleScrapingEnter(ctx as any);

    // Проверяем, что был вызван метод initialize
    expect(ctx.storage.initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод getProjectById с правильным параметром
    expect(ctx.storage.getProjectById).toHaveBeenCalledWith(1);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Проект не найден. Возможно, он был удален."
    );

    // Проверяем, что был вызван метод enter с правильным параметром
    expect(ctx.scene.enter).toHaveBeenCalledWith("instagram_scraper_projects");

    // Проверяем, что был вызван метод close
    expect(ctx.storage.close).toHaveBeenCalled();
  });

  it("should show message if no competitors and hashtags", async () => {
    // Мокируем результаты запросов
    const mockProject = createMockProject({ id: 1, user_id: 1, name: "Test Project" });
    ctx.storage.getProjectById.mockResolvedValue(mockProject);
    ctx.storage.getCompetitorAccounts.mockResolvedValue([]);
    ctx.storage.getHashtagsByProjectId.mockResolvedValue([]);

    // Вызываем обработчик
    await handleScrapingEnter(ctx as any);

    // Проверяем, что был вызван метод initialize
    expect(ctx.storage.initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод getProjectById с правильным параметром
    expect(ctx.storage.getProjectById).toHaveBeenCalledWith(1);

    // Проверяем, что был вызван метод getCompetitorAccounts с правильным параметром
    expect(ctx.storage.getCompetitorAccounts).toHaveBeenCalledWith(1, true);

    // Проверяем, что был вызван метод getHashtagsByProjectId с правильным параметром
    expect(ctx.storage.getHashtagsByProjectId).toHaveBeenCalledWith(1);

    // Проверяем, что был вызван метод reply с сообщением о добавлении конкурентов или хештегов
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("У вас нет добавленных конкурентов или хештегов для скрапинга"),
      expect.anything()
    );

    // Проверяем, что был вызван метод close
    expect(ctx.storage.close).toHaveBeenCalled();
  });

  it("should show scraping menu if competitors and hashtags exist", async () => {
    // Мокируем результаты запросов
    const mockProject = createMockProject({ id: 1, user_id: 1, name: "Test Project" });
    const mockCompetitors = [
      createMockCompetitor({ id: 1, project_id: 1, username: "competitor1", instagram_url: "https://instagram.com/competitor1" }),
      createMockCompetitor({ id: 2, project_id: 1, username: "competitor2", instagram_url: "https://instagram.com/competitor2" })
    ];
    const mockHashtags = [
      createMockHashtag({ id: 1, project_id: 1, hashtag: "hashtag1" }),
      createMockHashtag({ id: 2, project_id: 1, hashtag: "hashtag2" })
    ];
    
    ctx.storage.getProjectById.mockResolvedValue(mockProject);
    ctx.storage.getCompetitorAccounts.mockResolvedValue(mockCompetitors);
    ctx.storage.getHashtagsByProjectId.mockResolvedValue(mockHashtags);

    // Вызываем обработчик
    await handleScrapingEnter(ctx as any);

    // Проверяем, что был вызван метод initialize
    expect(ctx.storage.initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод getProjectById с правильным параметром
    expect(ctx.storage.getProjectById).toHaveBeenCalledWith(1);

    // Проверяем, что был вызван метод getCompetitorAccounts с правильным параметром
    expect(ctx.storage.getCompetitorAccounts).toHaveBeenCalledWith(1, true);

    // Проверяем, что был вызван метод getHashtagsByProjectId с правильным параметром
    expect(ctx.storage.getHashtagsByProjectId).toHaveBeenCalledWith(1);

    // Проверяем, что был вызван метод reply с сообщением о выборе источника скрапинга
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Выберите источник для скрапинга"),
      expect.anything()
    );

    // Проверяем, что был вызван метод close
    expect(ctx.storage.close).toHaveBeenCalled();
  });
});
