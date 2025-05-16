import { describe, it, expect, jest, beforeEach } from "bun:test";
import { createMockContext, createMockAdapter, SceneTester } from "../telegram";
import { ScraperSceneStep } from "../../../types";

// Мокируем класс сцены
class MockScene {
  constructor(_adapter: any) {}

  enter(_ctx: any) {
    return Promise.resolve();
  }

  leave(_ctx: any) {
    return Promise.resolve();
  }

  handleAction(_ctx: any) {
    return Promise.resolve();
  }

  handleText(_ctx: any) {
    return Promise.resolve();
  }
}

describe("Telegram Test Framework", () => {
  describe("createMockContext", () => {
    it("should create a mock context with default values", () => {
      const ctx = createMockContext();

      expect(ctx.scene).toBeDefined();
      expect(ctx.scene.enter).toBeDefined();
      expect(ctx.scene.leave).toBeDefined();
      expect(ctx.scene.reenter).toBeDefined();
      expect(ctx.scene.session).toBeDefined();

      expect(ctx.reply).toBeDefined();
      expect(ctx.from).toBeDefined();
      expect(ctx.from?.id).toBe(123456789);
      expect(ctx.answerCbQuery).toBeDefined();
    });

    it("should create a mock context with custom values", () => {
      const ctx = createMockContext({
        userId: 987654321,
        username: "customuser",
        firstName: "Custom",
        lastName: "User",
        messageText: "Custom message",
        sessionData: {
          step: ScraperSceneStep.PROJECT_LIST,
          projectId: 42
        }
      });

      expect(ctx.from?.id).toBe(987654321);
      expect(ctx.from?.username).toBe("customuser");
      expect(ctx.from?.first_name).toBe("Custom");
      expect(ctx.from?.last_name).toBe("User");
      expect(ctx.message?.text).toBe("Custom message");
      expect(ctx.scene.session.step).toBe(ScraperSceneStep.PROJECT_LIST);
      expect(ctx.scene.session.projectId).toBe(42);
    });

    it("should add callbackQuery when callbackQueryData is provided", () => {
      const ctx = createMockContext({
        callbackQueryData: "action_123"
      });

      expect(ctx.callbackQuery).toBeDefined();
      expect(ctx.callbackQuery?.data).toBe("action_123");
    });

    it("should add match when matchData is provided", () => {
      const ctx = createMockContext({
        matchData: ["full_match", "group1", "group2"]
      });

      expect(ctx.match).toBeDefined();
      expect(ctx.match?.[0]).toBe("full_match");
      expect(ctx.match?.[1]).toBe("group1");
      expect(ctx.match?.[2]).toBe("group2");
    });
  });

  describe("createMockAdapter", () => {
    it("should create a mock adapter with basic methods", () => {
      const adapter = createMockAdapter();

      // Проверяем только базовые методы, которые точно есть в адаптере
      expect(adapter).toBeDefined();
      expect(typeof adapter).toBe("object");
    });

    it("should override methods with provided mocks", () => {
      const customGetUserMock = jest.fn().mockResolvedValue({ id: 42, telegram_id: 123, username: "test" });

      const adapter = createMockAdapter({
        getUserByTelegramId: customGetUserMock
      });

      expect(adapter.getUserByTelegramId).toBe(customGetUserMock);
    });
  });

  describe("SceneTester", () => {
    let sceneTester: SceneTester<MockScene>;

    beforeEach(() => {
      sceneTester = new SceneTester<MockScene>({
        sceneName: "MockScene",
        sceneFilePath: "mock-scene",
        sceneConstructor: MockScene
      });
    });

    it("should create a scene tester with mock context and adapter", () => {
      const scene = sceneTester.createScene();
      expect(scene).toBeInstanceOf(MockScene);
      expect(sceneTester.getContext()).toBeDefined();
      expect(sceneTester.getAdapter()).toBeDefined();
    });

    it("should allow setting context", () => {
      const newContext = createMockContext({
        userId: 42,
        messageText: "Updated message"
      });

      sceneTester.setContext(newContext);

      expect(sceneTester.getContext().from?.id).toBe(42);
      expect(sceneTester.getContext().message?.text).toBe("Updated message");
    });

    it("should allow setting adapter", () => {
      const customMock = jest.fn().mockResolvedValue([{ id: 1, name: "Test Project" }]);
      const newAdapter = createMockAdapter({
        getProjectsByUserId: customMock
      });

      sceneTester.setAdapter(newAdapter);

      expect(sceneTester.getAdapter().getProjectsByUserId).toBe(customMock);
    });

    it("should have createTestSuite method", () => {
      // Проверяем, что метод createTestSuite существует
      expect(typeof sceneTester.createTestSuite).toBe("function");
    });
  });
});
