import { mock, jest } from "bun:test";

// Создаем мок для Pool с использованием jest.fn() для лучшей совместимости с тестами
const mockPool = {
  connect: jest.fn().mockResolvedValue(undefined),
  end: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
};

// Функция для сброса всех моков
export function resetMocks() {
  mockPool.connect.mockClear();
  mockPool.end.mockClear();
  mockPool.query.mockClear();
}

// Мокируем модуль pg
mock.module("pg", () => {
  return {
    Pool: function() {
      return mockPool;
    }
  };
});

// Экспортируем mockPool для использования в тестах
export { mockPool };
