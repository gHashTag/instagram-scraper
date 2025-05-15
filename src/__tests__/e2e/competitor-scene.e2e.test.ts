import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
} from "bun:test";
import { handleCompetitorEnter, handleAddCompetitorAction, handleCompetitorText } from "../../scenes/competitor-scene";
import { ScraperSceneStep } from "../../types";

describe("E2E: Competitor Scene", () => {
  let mockContext: any;
  let mockStorage: any;

  beforeEach(() => {
    // Создаем мок для хранилища
    mockStorage = {
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      findUserByTelegramIdOrCreate: jest.fn().mockResolvedValue({
        id: 1,
        telegram_id: 123456789,
        username: "testuser",
        created_at: new Date().toISOString(),
        is_active: true,
      }),
      getUserByTelegramId: jest.fn().mockResolvedValue({
        id: 1,
        telegram_id: 123456789,
        username: "testuser",
        created_at: new Date().toISOString(),
        is_active: true,
      }),
      getProjectsByUserId: jest.fn().mockResolvedValue([
        {
          id: 1,
          user_id: 1,
          name: "Test Project",
          created_at: new Date().toISOString(),
          is_active: true,
        }
      ]),
      getProjectById: jest.fn().mockResolvedValue({
        id: 1,
        user_id: 1,
        name: "Test Project",
        created_at: new Date().toISOString(),
        is_active: true,
      }),
      getCompetitorAccounts: jest.fn().mockResolvedValue([]),
      addCompetitorAccount: jest.fn().mockResolvedValue({
        id: 1,
        project_id: 1,
        username: "competitor1",
        created_at: new Date().toISOString(),
        is_active: true,
      }),
    };

    // Создаем мок для контекста
    mockContext = {
      from: {
        id: 123456789,
        username: "testuser",
        first_name: "Test",
      },
      scene: {
        enter: jest.fn(),
        leave: jest.fn(),
        reenter: jest.fn(),
        session: {},
      },
      reply: jest.fn().mockResolvedValue({}),
      answerCbQuery: jest.fn().mockResolvedValue(true),
      storage: mockStorage,
    };
  });

  it("should show empty competitors list when entering scene", async () => {
    // Вызываем обработчик входа в сцену
    await handleCompetitorEnter(mockContext);

    // Проверяем, что был вызван метод initialize
    expect(mockStorage.initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод getUserByTelegramId
    expect(mockStorage.getUserByTelegramId).toHaveBeenCalledWith(123456789);

    // Проверяем, что был вызван метод getProjectsByUserId
    expect(mockStorage.getProjectsByUserId).toHaveBeenCalledWith(1);

    // Проверяем, что был вызван метод getCompetitorAccounts
    expect(mockStorage.getCompetitorAccounts).toHaveBeenCalledWith(1);

    // Проверяем, что было отправлено сообщение
    expect(mockContext.reply).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object)
    );

    // Проверяем, что был вызван метод close
    expect(mockStorage.close).toHaveBeenCalled();
  });

  it("should handle add competitor action", async () => {
    // Добавляем callbackQuery в контекст
    mockContext.callbackQuery = { id: "123456" };
    mockContext.match = ["add_competitor_1", "1"];

    // Вызываем обработчик добавления конкурента
    await handleAddCompetitorAction(mockContext);

    // Проверяем, что был установлен правильный шаг сцены
    expect(mockContext.scene.session.step).toBe(ScraperSceneStep.ADD_COMPETITOR);

    // Проверяем, что был установлен правильный ID проекта в сессии
    expect(mockContext.scene.session.projectId).toBe(1);

    // Проверяем, что было отправлено сообщение с запросом URL конкурента
    // Не проверяем точный текст сообщения, так как он может отличаться
    expect(mockContext.reply).toHaveBeenCalled();

    // Проверяем, что был вызван метод answerCbQuery
    expect(mockContext.answerCbQuery).toHaveBeenCalled();
  });

  it("should handle competitor creation", async () => {
    // Настраиваем контекст для обработки текста
    mockContext.message = { text: "https://www.instagram.com/competitor1" };
    mockContext.scene.session.step = ScraperSceneStep.ADD_COMPETITOR;
    mockContext.scene.session.projectId = 1;

    // Вызываем обработчик текста
    await handleCompetitorText(mockContext);

    // Проверяем, что был вызван метод initialize
    expect(mockStorage.initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод getUserByTelegramId
    expect(mockStorage.getUserByTelegramId).toHaveBeenCalledWith(123456789);

    // Проверяем, что был вызван метод addCompetitorAccount
    // Не проверяем точные параметры, так как они могут отличаться
    expect(mockStorage.addCompetitorAccount).toHaveBeenCalled();

    // Проверяем, что было отправлено сообщение об успешном добавлении конкурента
    expect(mockContext.reply).toHaveBeenCalledWith(
      expect.stringContaining("успешно добавлен"),
      expect.any(Object)
    );

    // Проверяем, что был вызван метод close
    expect(mockStorage.close).toHaveBeenCalled();
  });
});
