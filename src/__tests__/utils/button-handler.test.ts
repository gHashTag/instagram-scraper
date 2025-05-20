/**
 * Тесты для утилиты обработки кнопок
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createButtonHandler,
  registerButton,
  registerButtons,
  createNestedMenu,
  registerNestedMenu,
  NestedMenuOptions
} from '../../utils/button-handler';

describe('Button Handler Utility', () => {
  // Создаем мок для контекста
  const createMockContext = () => ({
    from: {
      id: 123456789,
      username: 'test_user'
    },
    session: {},
    scene: {
      session: {},
      leave: vi.fn().mockResolvedValue(true)
    },
    reply: vi.fn().mockResolvedValue({}),
    answerCbQuery: vi.fn().mockResolvedValue(true),
    callbackQuery: {
      data: 'test_button'
    }
  });

  // Создаем мок для сцены
  const createMockScene = () => ({
    id: 'test_scene',
    action: vi.fn()
  });

  describe('createButtonHandler', () => {
    it('should create a handler function', () => {
      const handler = createButtonHandler({
        id: 'test_button',
        handler: vi.fn()
      });

      expect(handler).toBeInstanceOf(Function);
    });

    it('should support error handling options', () => {
      const handler = createButtonHandler({
        id: 'test_button',
        handler: vi.fn(),
        errorHandling: {
          showRetryButton: true,
          retryButtonText: 'Try Again',
          showCancelButton: true,
          cancelButtonText: 'Cancel',
          sendErrorReport: true,
          adminUserId: 123456
        }
      });

      expect(handler).toBeInstanceOf(Function);
    });
  });

  describe('registerButton', () => {
    it('should register a button handler with the scene', () => {
      const scene = createMockScene();
      const mockHandler = vi.fn();

      registerButton(scene as any, {
        id: 'test_button',
        handler: mockHandler
      });

      expect(scene.action).toHaveBeenCalledWith('test_button', expect.any(Function));
    });

    it('should handle RegExp button IDs', () => {
      const scene = createMockScene();
      const mockHandler = vi.fn();
      const regex = /test_(\d+)/;

      registerButton(scene as any, {
        id: regex,
        handler: mockHandler
      });

      expect(scene.action).toHaveBeenCalledWith(regex, expect.any(Function));
    });
  });

  describe('registerButtons', () => {
    it('should register multiple button handlers', () => {
      const scene = createMockScene();
      const mockHandler1 = vi.fn();
      const mockHandler2 = vi.fn();

      registerButtons(scene as any, [
        {
          id: 'button1',
          handler: mockHandler1
        },
        {
          id: 'button2',
          handler: mockHandler2
        }
      ]);

      expect(scene.action).toHaveBeenCalledTimes(2);
    });
  });

  describe('createNestedMenu', () => {
    it('should create a nested menu with keyboard and handlers', () => {
      const mockHandler1 = vi.fn();
      const mockHandler2 = vi.fn();

      const menuOptions: NestedMenuOptions = {
        title: 'Test Menu',
        items: [
          {
            text: 'Item 1',
            id: 'item1',
            handler: mockHandler1
          },
          {
            text: 'Item 2',
            id: 'item2',
            handler: mockHandler2
          }
        ]
      };

      const { keyboard, handlers } = createNestedMenu(menuOptions);

      // Проверяем, что клавиатура создана правильно
      expect(keyboard.length).toBeGreaterThanOrEqual(1); // Минимум 1 строка с кнопками

      // Находим кнопки по тексту
      const item1Button = keyboard.flat().find(btn => btn.text === 'Item 1');
      const item2Button = keyboard.flat().find(btn => btn.text === 'Item 2');

      expect(item1Button).toBeDefined();
      expect(item1Button?.callback_data).toBe('item1');
      expect(item2Button).toBeDefined();
      expect(item2Button?.callback_data).toBe('item2');

      // Проверяем, что обработчики созданы правильно
      expect(handlers).toHaveLength(2);
      expect(handlers[0].id).toBe('item1');
      expect(handlers[0].handler).toBe(mockHandler1);
      expect(handlers[1].id).toBe('item2');
      expect(handlers[1].handler).toBe(mockHandler2);
    });

    it('should create a nested menu with submenu', () => {
      const mockHandler1 = vi.fn();
      const mockHandler2 = vi.fn();
      const mockHandler3 = vi.fn();

      const menuOptions: NestedMenuOptions = {
        title: 'Test Menu',
        items: [
          {
            text: 'Item 1',
            id: 'item1',
            handler: mockHandler1
          },
          {
            text: 'Item 2',
            id: 'item2',
            submenu: [
              {
                text: 'Subitem 1',
                id: 'subitem1',
                handler: mockHandler2
              },
              {
                text: 'Subitem 2',
                id: 'subitem2',
                handler: mockHandler3
              }
            ]
          }
        ]
      };

      const { keyboard, handlers } = createNestedMenu(menuOptions);

      // Проверяем, что клавиатура создана правильно
      expect(keyboard.length).toBeGreaterThanOrEqual(1); // Минимум 1 строка с кнопками

      // Находим кнопки по тексту
      const item1Button = keyboard.flat().find(btn => btn.text === 'Item 1');
      const item2Button = keyboard.flat().find(btn => btn.text === 'Item 2');

      expect(item1Button).toBeDefined();
      expect(item1Button?.callback_data).toBe('item1');
      expect(item2Button).toBeDefined();
      expect(item2Button?.callback_data).toBe('item2');

      // Проверяем, что обработчики созданы правильно
      expect(handlers.length).toBeGreaterThan(3); // 1 для item1, 1 для item2, 2 для подменю, 1 для back, 1 для home
      expect(handlers[0].id).toBe('item1');
      expect(handlers[0].handler).toBe(mockHandler1);
      expect(handlers[1].id).toBe('item2');
      expect(handlers[1].handler).toBeInstanceOf(Function);
    });
  });

  describe('registerNestedMenu', () => {
    it('should register a nested menu in a scene', () => {
      const scene = createMockScene();
      const mockHandler = vi.fn();

      const menuOptions: NestedMenuOptions = {
        title: 'Test Menu',
        items: [
          {
            text: 'Item 1',
            id: 'item1',
            handler: mockHandler
          }
        ]
      };

      const sendMenu = registerNestedMenu(scene as any, menuOptions);

      // Проверяем, что обработчики зарегистрированы
      expect(scene.action).toHaveBeenCalled();

      // Проверяем, что функция для отправки меню возвращена
      expect(sendMenu).toBeInstanceOf(Function);
    });
  });
});
