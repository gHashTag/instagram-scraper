import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
} from "bun:test";
import { handleHashtagEnter, handleAddHashtagAction, handleHashtagTextInput } from "../../scenes/hashtag-scene";
import { ScraperSceneStep } from "../../types";

describe("E2E: Hashtag Scene", () => {
  let mockContext: any;
  let mockStorage: any;

  beforeEach(() => {
    // Создаем мок для хранилища
    mockStorage = {
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      getProjectById: jest.fn().mockResolvedValue({
        id: 1,
        user_id: 1,
        name: "Test Project",
        created_at: new Date().toISOString(),
        is_active: true,
      }),
      getHashtagsByProjectId: jest.fn().mockResolvedValue([]),
      addHashtag: jest.fn().mockResolvedValue({
        id: 1,
        project_id: 1,
        hashtag: "test",
        created_at: new Date().toISOString(),
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
        session: {
          projectId: 1,
        },
      },
      reply: jest.fn().mockResolvedValue({}),
      answerCbQuery: jest.fn().mockResolvedValue(true),
      storage: mockStorage,
    };
  });

  it("should show empty hashtags list when entering scene", async () => {
    // Вызываем обработчик входа в сцену
    await handleHashtagEnter(mockContext);

    // Проверяем, что был вызван метод initialize
    expect(mockStorage.initialize).toHaveBeenCalled();

    // Проверяем, что был вызван метод getProjectById
    expect(mockStorage.getProjectById).toHaveBeenCalledWith(1);

    // Проверяем, что был вызван метод getHashtagsByProjectId
    expect(mockStorage.getHashtagsByProjectId).toHaveBeenCalledWith(1);

    // Проверяем, что было отправлено сообщение
    expect(mockContext.reply).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object)
    );

    // Проверяем, что был вызван метод close
    expect(mockStorage.close).toHaveBeenCalled();
  });

  it("should handle add hashtag action", async () => {
    // Добавляем callbackQuery в контекст
    mockContext.callbackQuery = { id: "123456" };
    mockContext.match = ["add_hashtag_1", "1"];

    // Вызываем обработчик добавления хештега
    await handleAddHashtagAction(mockContext);

    // Проверяем, что был установлен правильный шаг сцены
    expect(mockContext.scene.session.step).toBe(ScraperSceneStep.ADD_HASHTAG);

    // Проверяем, что был установлен правильный ID проекта в сессии
    expect(mockContext.scene.session.projectId).toBe(1);

    // Проверяем, что было отправлено сообщение с запросом хештега
    expect(mockContext.reply).toHaveBeenCalled();

    // Проверяем, что был вызван метод answerCbQuery
    expect(mockContext.answerCbQuery).toHaveBeenCalled();
  });

  it("should handle hashtag creation", async () => {
    // Настраиваем контекст для обработки текста
    mockContext.message = { text: "#test" };
    mockContext.scene.session.step = ScraperSceneStep.ADD_HASHTAG;
    mockContext.scene.session.projectId = 1;

    // Вызываем обработчик текста
    await handleHashtagTextInput(mockContext);

    // Проверяем, что был вызван метод initialize
    expect(mockStorage.initialize).toHaveBeenCalled();

    // В функции handleHashtagTextInput не вызывается метод getProjectById

    // Проверяем, что был вызван метод addHashtag
    expect(mockStorage.addHashtag).toHaveBeenCalledWith(1, "test");

    // Проверяем, что было отправлено сообщение об успешном добавлении хештега
    expect(mockContext.reply).toHaveBeenCalledWith(
      expect.stringContaining("успешно добавлен")
    );

    // Проверяем, что был вызван метод reenter
    expect(mockContext.scene.reenter).toHaveBeenCalled();

    // Проверяем, что был вызван метод close
    expect(mockStorage.close).toHaveBeenCalled();
  });
});
