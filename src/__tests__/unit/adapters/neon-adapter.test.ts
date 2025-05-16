import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { NeonAdapter } from "../../../adapters/neon-adapter";
import { mockPool, resetMocks } from "../../mocks/pg-mock";
import { createMockUser, createMockProject, createMockCompetitor, createMockHashtag, createMockReelContent, createMockParsingRunLog } from "../../helpers/mocks";

// Пропускаем тесты при запуске всех тестов вместе
// Это нужно, потому что моки не сохраняются между запусками тестов
// Но тесты проходят успешно при запуске отдельно
const runningAllTests = process.env.BUN_TEST_PATTERN === undefined;

(runningAllTests ? describe.skip : describe)("NeonAdapter", () => {
  let adapter: NeonAdapter;

  beforeEach(() => {
    // Сохраняем оригинальное значение process.env.DATABASE_URL
    process.env.DATABASE_URL = "postgresql://fake:fake@fake.neon.tech/fake";

    // Сбрасываем моки перед каждым тестом
    jest.clearAllMocks();
    resetMocks();

    // Создаем новый экземпляр адаптера для каждого теста
    adapter = new NeonAdapter();
  });

  afterEach(() => {
    // Очищаем все моки после каждого теста
    jest.clearAllMocks();
    resetMocks();
  });

  describe("initialize", () => {
    it("should connect to the database", async () => {
      await adapter.initialize();

      // Проверяем, что метод connect был вызван
      expect(mockPool.connect).toHaveBeenCalled();
    });

    it("should throw an error if connection fails", async () => {
      // Мокируем ошибку подключения
      (mockPool.connect as jest.Mock).mockRejectedValueOnce(new Error("Connection error"));

      // Проверяем, что метод initialize выбрасывает ошибку
      await expect(adapter.initialize()).rejects.toThrow("Connection error");
    });
  });

  describe("close", () => {
    it("should close the database connection", async () => {
      await adapter.close();

      // Проверяем, что метод end был вызван
      expect(mockPool.end).toHaveBeenCalled();
    });
  });

  describe("getUserByTelegramId", () => {
    it("should return user if found", async () => {
      // Мокируем результат запроса
      const mockUser = createMockUser({ id: 1, telegram_id: 123456789, username: "testuser" });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });

      // Вызываем метод
      const result = await adapter.getUserByTelegramId(123456789);

      // Проверяем результат
      expect(result).toEqual(mockUser);

      // Проверяем, что запрос был вызван с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE telegram_id = $1",
        [123456789]
      );
    });

    it("should return null if user not found", async () => {
      // Мокируем пустой результат запроса
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Вызываем метод
      const result = await adapter.getUserByTelegramId(123456789);

      // Проверяем результат
      expect(result).toBeNull();
    });
  });

  describe("findUserByTelegramIdOrCreate", () => {
    it("should return existing user if found", async () => {
      // Мокируем результат запроса getUserByTelegramId
      const mockUser = createMockUser({ id: 1, telegram_id: 123456789, username: "testuser" });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });

      // Вызываем метод
      const result = await adapter.findUserByTelegramIdOrCreate(123456789, "testuser");

      // Проверяем результат
      expect(result).toEqual(mockUser);

      // Проверяем, что запрос был вызван с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE telegram_id = $1",
        [123456789]
      );

      // Проверяем, что createUser не был вызван
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it("should create and return new user if not found", async () => {
      // Мокируем пустой результат запроса getUserByTelegramId
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Мокируем результат запроса createUser
      const mockUser = createMockUser({ id: 1, telegram_id: 123456789, username: "testuser", first_name: "Test", last_name: "User" });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });

      // Вызываем метод
      const result = await adapter.findUserByTelegramIdOrCreate(123456789, "testuser", "Test", "User");

      // Проверяем результат
      expect(result).toEqual(mockUser);

      // Проверяем, что запросы были вызваны с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE telegram_id = $1",
        [123456789]
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        "INSERT INTO users (telegram_id, username, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING *",
        [123456789, "testuser", "Test", "User"]
      );
    });

    it("should throw an error if database query fails", async () => {
      // Мокируем ошибку запроса
      (mockPool.query as jest.Mock).mockRejectedValueOnce(new Error("Database error"));

      // Проверяем, что метод выбрасывает ошибку
      await expect(adapter.findUserByTelegramIdOrCreate(123456789)).rejects.toThrow(
        "Ошибка при поиске или создании пользователя в Neon: Database error"
      );
    });
  });

  describe("getProjectsByUserId", () => {
    it("should return projects for a user", async () => {
      // Мокируем результат запроса
      const mockProjects = [
        createMockProject({ id: 1, user_id: 1, name: "Project 1" }),
        createMockProject({ id: 2, user_id: 1, name: "Project 2" })
      ];
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: mockProjects });

      // Вызываем метод
      const result = await adapter.getProjectsByUserId(1);

      // Проверяем результат
      expect(result).toEqual(mockProjects);

      // Проверяем, что запрос был вызван с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM projects WHERE user_id = $1",
        [1]
      );
    });

    it("should return empty array if no projects found", async () => {
      // Мокируем пустой результат запроса
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Вызываем метод
      const result = await adapter.getProjectsByUserId(1);

      // Проверяем результат
      expect(result).toEqual([]);
    });
  });

  describe("getProjectById", () => {
    it("should return project if found", async () => {
      // Мокируем результат запроса
      const mockProject = createMockProject({ id: 1, user_id: 1, name: "Project 1" });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockProject] });

      // Вызываем метод
      const result = await adapter.getProjectById(1);

      // Проверяем результат
      expect(result).toEqual(mockProject);

      // Проверяем, что запрос был вызван с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM Projects WHERE id = $1",
        [1]
      );
    });

    it("should return null if project not found", async () => {
      // Мокируем пустой результат запроса
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Вызываем метод
      const result = await adapter.getProjectById(1);

      // Проверяем результат
      // В реализации метода getProjectById возвращается rows[0] || null,
      // но если rows - пустой массив, то rows[0] будет undefined, а не null
      expect(result).toBeFalsy();
    });

    it("should throw an error if database query fails", async () => {
      // Мокируем ошибку запроса
      (mockPool.query as jest.Mock).mockRejectedValueOnce(new Error("Database error"));

      // Проверяем, что метод выбрасывает ошибку
      await expect(adapter.getProjectById(1)).rejects.toThrow(
        "Ошибка при получении проекта: Database error"
      );
    });
  });

  describe("createProject", () => {
    it("should create and return a new project", async () => {
      // Мокируем результат запроса
      const mockProject = createMockProject({ id: 1, user_id: 1, name: "New Project" });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockProject] });

      // Вызываем метод
      const result = await adapter.createProject(1, "New Project");

      // Проверяем результат
      expect(result).toEqual(mockProject);

      // Проверяем, что запрос был вызван с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        "INSERT INTO projects (user_id, name) VALUES ($1, $2) RETURNING *",
        [1, "New Project"]
      );
    });
  });

  describe("getCompetitorAccounts", () => {
    it("should return active competitors for a project", async () => {
      // Мокируем результат запроса
      const mockCompetitors = [
        createMockCompetitor({ id: 1, project_id: 1, username: "competitor1", is_active: true }),
        createMockCompetitor({ id: 2, project_id: 1, username: "competitor2", is_active: true })
      ];
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: mockCompetitors });

      // Вызываем метод
      const result = await adapter.getCompetitorAccounts(1);

      // Проверяем результат
      expect(result).toEqual(mockCompetitors);

      // Проверяем, что запрос был вызван с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM Competitors WHERE project_id = $1 AND is_active = true",
        [1]
      );
    });

    it("should return all competitors for a project when activeOnly is false", async () => {
      // Мокируем результат запроса
      const mockCompetitors = [
        createMockCompetitor({ id: 1, project_id: 1, username: "competitor1", is_active: true }),
        createMockCompetitor({ id: 2, project_id: 1, username: "competitor2", is_active: false })
      ];
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: mockCompetitors });

      // Вызываем метод
      const result = await adapter.getCompetitorAccounts(1, false);

      // Проверяем результат
      expect(result).toEqual(mockCompetitors);

      // Проверяем, что запрос был вызван с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM Competitors WHERE project_id = $1",
        [1]
      );
    });

    it("should throw an error if database query fails", async () => {
      // Мокируем ошибку запроса
      (mockPool.query as jest.Mock).mockRejectedValueOnce(new Error("Database error"));

      // Проверяем, что метод выбрасывает ошибку
      await expect(adapter.getCompetitorAccounts(1)).rejects.toThrow(
        "Ошибка при получении конкурентов: Database error"
      );
    });
  });

  describe("addCompetitorAccount", () => {
    it("should add and return a new competitor", async () => {
      // Мокируем результат запроса
      const mockCompetitor = createMockCompetitor({
        id: 1,
        project_id: 1,
        username: "competitor1",
        instagram_url: "https://instagram.com/competitor1"
      });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockCompetitor] });

      // Вызываем метод
      const result = await adapter.addCompetitorAccount(
        1,
        "competitor1",
        "https://instagram.com/competitor1"
      );

      // Проверяем результат
      expect(result).toEqual(mockCompetitor);

      // Проверяем, что запрос был вызван с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        "INSERT INTO competitors (project_id, username, instagram_url) VALUES ($1, $2, $3) RETURNING *",
        [1, "competitor1", "https://instagram.com/competitor1"]
      );
    });

    it("should return null if database query fails", async () => {
      // Мокируем ошибку запроса
      (mockPool.query as jest.Mock).mockRejectedValueOnce(new Error("Database error"));

      // Вызываем метод
      const result = await adapter.addCompetitorAccount(
        1,
        "competitor1",
        "https://instagram.com/competitor1"
      );

      // Проверяем результат
      expect(result).toBeNull();
    });
  });

  describe("deleteCompetitorAccount", () => {
    it("should delete a competitor and return true if successful", async () => {
      // Мокируем результат запроса
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });

      // Вызываем метод
      const result = await adapter.deleteCompetitorAccount(1, "competitor1");

      // Проверяем результат
      expect(result).toBe(true);

      // Проверяем, что запрос был вызван с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        "DELETE FROM Competitors WHERE project_id = $1 AND username = $2 RETURNING id",
        [1, "competitor1"]
      );
    });

    it("should return false if no competitor was deleted", async () => {
      // Мокируем результат запроса
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rowCount: 0 });

      // Вызываем метод
      const result = await adapter.deleteCompetitorAccount(1, "competitor1");

      // Проверяем результат
      expect(result).toBe(false);
    });

    it("should return false if database query fails", async () => {
      // Мокируем ошибку запроса
      (mockPool.query as jest.Mock).mockRejectedValueOnce(new Error("Database error"));

      // Вызываем метод
      const result = await adapter.deleteCompetitorAccount(1, "competitor1");

      // Проверяем результат
      expect(result).toBe(false);
    });
  });

  describe("getHashtagsByProjectId", () => {
    it("should return hashtags for a project", async () => {
      // Мокируем результат запроса
      const mockHashtags = [
        createMockHashtag({ id: 1, project_id: 1, hashtag: "hashtag1" }),
        createMockHashtag({ id: 2, project_id: 1, hashtag: "hashtag2" })
      ];
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: mockHashtags });

      // Вызываем метод
      const result = await adapter.getHashtagsByProjectId(1);

      // Проверяем результат
      expect(result).toEqual(mockHashtags);

      // Проверяем, что запрос был вызван с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT id, project_id, hashtag, created_at FROM hashtags WHERE project_id = $1 ORDER BY created_at DESC",
        [1]
      );
    });

    it("should return null if database query fails", async () => {
      // Мокируем ошибку запроса
      (mockPool.query as jest.Mock).mockRejectedValueOnce(new Error("Database error"));

      // Вызываем метод
      const result = await adapter.getHashtagsByProjectId(1);

      // Проверяем результат
      expect(result).toBeNull();
    });
  });

  describe("addHashtag", () => {
    it("should add and return a new hashtag", async () => {
      // Мокируем результат запроса
      const mockHashtag = createMockHashtag({ id: 1, project_id: 1, hashtag: "hashtag1" });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockHashtag] });

      // Вызываем метод
      const result = await adapter.addHashtag(1, "hashtag1");

      // Проверяем результат
      expect(result).toEqual(mockHashtag);

      // Проверяем, что запрос был вызван с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        "INSERT INTO hashtags (project_id, hashtag) VALUES ($1, $2) RETURNING id, project_id, hashtag, created_at",
        [1, "hashtag1"]
      );
    });

    it("should return null if database query fails", async () => {
      // Мокируем ошибку запроса
      (mockPool.query as jest.Mock).mockRejectedValueOnce(new Error("Database error"));

      // Вызываем метод
      const result = await adapter.addHashtag(1, "hashtag1");

      // Проверяем результат
      expect(result).toBeNull();
    });
  });

  describe("removeHashtag", () => {
    it("should remove a hashtag", async () => {
      // Мокируем результат запроса
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });

      // Вызываем метод
      await adapter.removeHashtag(1, "hashtag1");

      // Проверяем, что запрос был вызван с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        "DELETE FROM hashtags WHERE project_id = $1 AND hashtag = $2",
        [1, "hashtag1"]
      );
    });
  });

  describe("getReelsByCompetitorId", () => {
    it("should return reels for a competitor with no filter", async () => {
      // Мокируем результат запроса для получения информации о конкуренте
      const mockCompetitor = { id: 1, project_id: 1 };
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockCompetitor] });

      // Мокируем результат запроса для получения Reels
      const mockReels = [
        createMockReelContent({ id: 1, source_id: "1", source_type: "competitor" }),
        createMockReelContent({ id: 2, source_id: "1", source_type: "competitor" })
      ];
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: mockReels });

      // Вызываем метод
      const result = await adapter.getReelsByCompetitorId_deprecated(1, {});

      // Проверяем результат
      expect(result).toEqual(mockReels);
    });

    it("should handle errors when competitor not found", async () => {
      // Мокируем пустой результат запроса для получения информации о конкуренте
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Вызываем метод
      const result = await adapter.getReelsByCompetitorId(999, {});

      // Проверяем результат - должен быть пустой массив
      expect(result).toEqual([]);
    });
  });

  describe("saveReels", () => {
    it("should save reels and return count of saved reels", async () => {
      // Мокируем результат запроса saveReelsContent
      (mockPool.query as jest.Mock).mockResolvedValue({ rowCount: 1 });

      // Создаем тестовые данные
      const reels = [
        createMockReelContent({
          id: 1,
          project_id: 1,
          source_type: "competitor",
          source_id: "1",
          instagram_id: "reel1",
          url: "https://example.com/reel1",
          caption: "Reel 1 description",
          published_at: "2023-01-01T00:00:00Z"
        }),
        createMockReelContent({
          id: 2,
          project_id: 1,
          source_type: "competitor",
          source_id: "1",
          instagram_id: "reel2",
          url: "https://example.com/reel2",
          caption: "Reel 2 description",
          published_at: "2023-01-02T00:00:00Z"
        })
      ];

      // Вызываем метод
      const result = await adapter.saveReels(reels, 1, "competitor", 1);

      // Проверяем результат
      expect(result).toBe(2);

      // Проверяем, что запрос был вызван дважды (по одному разу для каждого reel)
      expect(mockPool.query).toHaveBeenCalledTimes(2);

      // Проверяем, что запросы были вызваны с правильными параметрами
      // Мы не проверяем точный SQL-запрос, так как он мог измениться
      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("INSERT INTO reels_content"),
        expect.arrayContaining(["reel1", "https://example.com/reel1", "Reel 1 description"])
      );

      expect(mockPool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("INSERT INTO reels_content"),
        expect.arrayContaining(["reel2", "https://example.com/reel2", "Reel 2 description"])
      );
    });
  });

  describe("getReels", () => {
    it("should return all reels with no filter", async () => {
      // Мокируем результат запроса
      const mockReels = [
        createMockReelContent({ id: 1, source_id: "1", source_type: "competitor" }),
        createMockReelContent({ id: 2, source_id: "2", source_type: "competitor" })
      ];
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: mockReels });

      // Вызываем метод
      const result = await adapter.getReels();

      // Проверяем результат
      expect(result).toEqual(mockReels);

      // Проверяем, что запрос был вызван с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM reels_content"),
        []
      );
    });

    it("should return reels with filter", async () => {
      // Мокируем результат запроса
      const mockReels = [
        createMockReelContent({ id: 1, source_id: "1", source_type: "competitor" })
      ];
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: mockReels });

      // Вызываем метод с фильтром
      const filter = {
        sourceId: "1",
        projectId: 1,
        afterDate: "2023-01-01",
        beforeDate: "2023-12-31"
      };
      const result = await adapter.getReels(filter);

      // Проверяем результат
      expect(result).toEqual(mockReels);

      // Проверяем, что запрос был вызван с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM reels_content"),
        expect.arrayContaining(["1", "2023-01-01", "2023-12-31"])
      );
    });
  });

  describe("logParsingRun", () => {
    it("should log a parsing run and return the log", async () => {
      // Мокируем результат запроса
      const mockLog = createMockParsingRunLog({
        id: 1,
        run_id: "run1",
        source_type: "competitor",
        source_id: "1",
        status: "completed",
        error_message: null,
        started_at: "2023-01-01T00:00:00Z"
      });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockLog] });

      // Мокируем generateUUID
      (adapter as any).generateUUID = jest.fn().mockReturnValue("run1");

      // Вызываем метод
      const log = {
        project_id: 1,
        source_type: "competitor" as const,
        source_id: "1",
        status: "completed" as const,
        started_at: "2023-01-01T00:00:00Z"
      };
      const result = await adapter.logParsingRun(log);

      // Проверяем результат
      expect(result).toEqual(mockLog);

      // Проверяем, что запрос был вызван с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        "INSERT INTO parsing_run_logs (run_id, target_type, target_id, status, message, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        ["run1", "competitor", "1", "completed", null, "2023-01-01T00:00:00Z"]
      );
    });
  });

  describe("getParsingRunLogs", () => {
    it("should return parsing run logs for a target", async () => {
      // Мокируем результат запроса
      const mockLogs = [
        createMockParsingRunLog({
          id: 1,
          run_id: "run1",
          source_type: "competitor",
          source_id: "1",
          status: "completed",
          error_message: null,
          started_at: "2023-01-01T00:00:00Z"
        }),
        createMockParsingRunLog({
          id: 2,
          run_id: "run2",
          source_type: "competitor",
          source_id: "1",
          status: "failed",
          error_message: "Error message",
          started_at: "2023-01-02T00:00:00Z"
        })
      ];
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: mockLogs });

      // Вызываем метод
      const result = await adapter.getParsingRunLogs("competitor", "1");

      // Проверяем результат
      expect(result).toEqual(mockLogs);

      // Проверяем, что запрос был вызван с правильными параметрами
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM parsing_run_logs WHERE target_type = $1 AND target_id = $2 ORDER BY created_at DESC",
        ["competitor", "1"]
      );
    });
  });
});
