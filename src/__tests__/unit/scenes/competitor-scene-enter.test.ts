import { describe, it, expect, jest, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { handleCompetitorEnter } from "../../../scenes/competitor-scene";
import { ScraperBotContext } from "@/types";
import { MockedNeonAdapterType, createMockNeonAdapter } from "../../helpers/types";
import { createMockUser, createMockProject, createMockCompetitor } from "../../helpers/mocks";

// Определяем тип для тестового контекста (удаляем, так как он определен ниже)

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

// Мокируем NeonAdapter
mock.module("../../../adapters/neon-adapter", () => {
  return {
    NeonAdapter: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      getUserByTelegramId: jest.fn(),
      getProjectsByUserId: jest.fn(),
      getCompetitorAccounts: jest.fn(),
    })),
  };
});

// Используем импортированный тип MockedNeonAdapterType

// Создаем тип для контекста
type TestContext = ScraperBotContext;

// Функция для создания мок-контекста
const createMockContext = (fromId: number = 123456789): TestContext => {
  // Создаем базовый контекст
  const ctx = {
    storage: createMockNeonAdapter(),
    from: {
      id: fromId,
      is_bot: false,
      first_name: "Test",
      last_name: "User",
      username: "testuser",
    },
    scene: {
      session: {},
      enter: jest.fn(),
      leave: jest.fn(),
      reenter: jest.fn(),
      // Добавляем необходимые свойства для соответствия типу SceneContextScene
      ctx: {} as any,
      scenes: {} as any,
      options: {} as any,
      state: {} as any,
      current: "competitor",
      reset: jest.fn(),
      leaving: false,
    },
    reply: jest.fn().mockImplementation(() => Promise.resolve()),
    editMessageReplyMarkup: jest.fn().mockImplementation(() => Promise.resolve()),
    deleteMessage: jest.fn().mockImplementation(() => Promise.resolve()),
    answerCbQuery: jest.fn().mockImplementation(() => Promise.resolve()),
  } as unknown as TestContext;

  // Создаем и устанавливаем мок адаптера
  ctx.storage = createMockNeonAdapter();

  return ctx;
};

describe("competitorScene - Enter Handler", () => {
  let ctx: TestContext;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    ctx = createMockContext();
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should leave scene if user is not found", async () => {
    // Мокируем результат запроса getUserByTelegramId
    (ctx.storage as MockedNeonAdapterType).getUserByTelegramId.mockResolvedValue(null);

    // Вызываем обработчик входа в сцену напрямую
    await handleCompetitorEnter(ctx);

    // Проверяем, что был вызван метод initialize
    expect((ctx.storage as MockedNeonAdapterType).initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод getUserByTelegramId с правильным параметром
    expect((ctx.storage as MockedNeonAdapterType).getUserByTelegramId).toHaveBeenCalledWith(123456789);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Вы не зарегистрированы. Пожалуйста, используйте /start для начала работы."
    );

    // Проверяем, что был вызван метод close
    expect((ctx.storage as MockedNeonAdapterType).close).toHaveBeenCalled();

    // Проверяем, что был вызван метод leave
    expect(ctx.scene?.leave).toHaveBeenCalled();
  });

  it("should leave scene if user has no projects", async () => {
    // Мокируем результаты запросов
    const mockUser = createMockUser({ id: 1, telegram_id: 123456789, username: "testuser" });
    (ctx.storage as MockedNeonAdapterType).getUserByTelegramId.mockResolvedValue(mockUser);
    (ctx.storage as MockedNeonAdapterType).getProjectsByUserId.mockResolvedValue([]);

    // Вызываем обработчик входа в сцену напрямую
    await handleCompetitorEnter(ctx);

    // Проверяем, что был вызван метод initialize
    expect((ctx.storage as MockedNeonAdapterType).initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод getUserByTelegramId с правильным параметром
    expect((ctx.storage as MockedNeonAdapterType).getUserByTelegramId).toHaveBeenCalledWith(123456789);

    // Проверяем, что был вызван метод getProjectsByUserId с правильным параметром
    expect((ctx.storage as MockedNeonAdapterType).getProjectsByUserId).toHaveBeenCalledWith(1);

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "У вас нет проектов. Создайте проект с помощью команды /projects"
    );

    // Проверяем, что был вызван метод close
    expect((ctx.storage as MockedNeonAdapterType).close).toHaveBeenCalled();

    // Проверяем, что был вызван метод leave
    expect(ctx.scene?.leave).toHaveBeenCalled();
  });

  it("should show competitors list when user has one project with competitors", async () => {
    // Мокируем результаты запросов
    const mockUser = createMockUser({ id: 1, telegram_id: 123456789, username: "testuser" });
    const mockProjects = [
      createMockProject({ id: 1, user_id: 1, name: "Test Project" })
    ];
    const mockCompetitors = [
      createMockCompetitor({ id: 1, project_id: 1, username: "competitor1", instagram_url: "https://instagram.com/competitor1" }),
      createMockCompetitor({ id: 2, project_id: 1, username: "competitor2", instagram_url: "https://instagram.com/competitor2" })
    ];

    (ctx.storage as MockedNeonAdapterType).getUserByTelegramId.mockResolvedValue(mockUser);
    (ctx.storage as MockedNeonAdapterType).getProjectsByUserId.mockResolvedValue(mockProjects);
    (ctx.storage as MockedNeonAdapterType).getCompetitorAccounts.mockResolvedValue(mockCompetitors);

    // Вызываем обработчик входа в сцену напрямую
    await handleCompetitorEnter(ctx);

    // Проверяем, что был вызван метод initialize
    expect((ctx.storage as MockedNeonAdapterType).initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод getUserByTelegramId с правильным параметром
    expect((ctx.storage as MockedNeonAdapterType).getUserByTelegramId).toHaveBeenCalledWith(123456789);

    // Проверяем, что был вызван метод getProjectsByUserId с правильным параметром
    expect((ctx.storage as MockedNeonAdapterType).getProjectsByUserId).toHaveBeenCalledWith(1);

    // Проверяем, что был вызван метод getCompetitorAccounts с правильным параметром
    expect((ctx.storage as MockedNeonAdapterType).getCompetitorAccounts).toHaveBeenCalledWith(1);

    // Проверяем, что был вызван метод reply с сообщением со списком конкурентов
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Конкуренты в проекте \"Test Project\":"),
      expect.anything()
    );

    // Проверяем, что был вызван метод close
    expect((ctx.storage as MockedNeonAdapterType).close).toHaveBeenCalled();
  });

  it("should show add competitor message when user has one project without competitors", async () => {
    // Мокируем результаты запросов
    const mockUser = createMockUser({ id: 1, telegram_id: 123456789, username: "testuser" });
    const mockProjects = [
      createMockProject({ id: 1, user_id: 1, name: "Test Project" })
    ];

    (ctx.storage as MockedNeonAdapterType).getUserByTelegramId.mockResolvedValue(mockUser);
    (ctx.storage as MockedNeonAdapterType).getProjectsByUserId.mockResolvedValue(mockProjects);
    (ctx.storage as MockedNeonAdapterType).getCompetitorAccounts.mockResolvedValue([]);

    // Вызываем обработчик входа в сцену напрямую
    await handleCompetitorEnter(ctx);

    // Проверяем, что был вызван метод initialize
    expect((ctx.storage as MockedNeonAdapterType).initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод getUserByTelegramId с правильным параметром
    expect((ctx.storage as MockedNeonAdapterType).getUserByTelegramId).toHaveBeenCalledWith(123456789);

    // Проверяем, что был вызван метод getProjectsByUserId с правильным параметром
    expect((ctx.storage as MockedNeonAdapterType).getProjectsByUserId).toHaveBeenCalledWith(1);

    // Проверяем, что был вызван метод getCompetitorAccounts с правильным параметром
    expect((ctx.storage as MockedNeonAdapterType).getCompetitorAccounts).toHaveBeenCalledWith(1);

    // Проверяем, что был вызван метод reply с сообщением о добавлении конкурента
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("В проекте \"Test Project\" нет добавленных конкурентов. Хотите добавить?"),
      expect.anything()
    );

    // Проверяем, что был вызван метод close
    expect((ctx.storage as MockedNeonAdapterType).close).toHaveBeenCalled();
  });

  it("should show project selection when user has multiple projects", async () => {
    // Мокируем результаты запросов
    const mockUser = createMockUser({ id: 1, telegram_id: 123456789, username: "testuser" });
    const mockProjects = [
      createMockProject({ id: 1, user_id: 1, name: "Project 1" }),
      createMockProject({ id: 2, user_id: 1, name: "Project 2" })
    ];

    (ctx.storage as MockedNeonAdapterType).getUserByTelegramId.mockResolvedValue(mockUser);
    (ctx.storage as MockedNeonAdapterType).getProjectsByUserId.mockResolvedValue(mockProjects);

    // Вызываем обработчик входа в сцену напрямую
    await handleCompetitorEnter(ctx);

    // Проверяем, что был вызван метод initialize
    expect((ctx.storage as MockedNeonAdapterType).initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод getUserByTelegramId с правильным параметром
    expect((ctx.storage as MockedNeonAdapterType).getUserByTelegramId).toHaveBeenCalledWith(123456789);

    // Проверяем, что был вызван метод getProjectsByUserId с правильным параметром
    expect((ctx.storage as MockedNeonAdapterType).getProjectsByUserId).toHaveBeenCalledWith(1);

    // Проверяем, что не был вызван метод getCompetitorAccounts
    expect((ctx.storage as MockedNeonAdapterType).getCompetitorAccounts).not.toHaveBeenCalled();

    // Проверяем, что был вызван метод reply с сообщением о выборе проекта
    expect(ctx.reply).toHaveBeenCalledWith(
      "Выберите проект для просмотра конкурентов:",
      expect.anything()
    );

    // Проверяем, что был вызван метод close
    expect((ctx.storage as MockedNeonAdapterType).close).toHaveBeenCalled();
  });

  it("should handle error and leave scene", async () => {
    // Мокируем ошибку в запросе
    (ctx.storage as MockedNeonAdapterType).initialize.mockRejectedValue(new Error("Database error"));

    // Вызываем обработчик входа в сцену напрямую
    await handleCompetitorEnter(ctx);

    // Проверяем, что был вызван console.error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Ошибка при получении конкурентов:",
      expect.any(Error)
    );

    // Проверяем, что был вызван метод reply с сообщением об ошибке
    expect(ctx.reply).toHaveBeenCalledWith(
      "Не удалось загрузить данные для управления конкурентами. Попробуйте позже или обратитесь в поддержку."
    );

    // Проверяем, что был вызван метод leave
    expect(ctx.scene?.leave).toHaveBeenCalled();
  });
});
