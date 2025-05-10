// Настройка глобальных переменных окружения для тестов
process.env.NODE_ENV = "test"
process.env.BOT_TOKEN = "test_bot_token"
process.env.NEON_CONNECTION_STRING =
  "postgresql://fake:fake@fake.neon.tech/fake"

// Глобальное определение Vitest
// Это необходимо, чтобы тесты могли работать с конструкциями describe/it/expect без импортов
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Определяем глобальные функции для тестов
globalThis.describe = describe
globalThis.it = it
globalThis.expect = expect
globalThis.beforeEach = beforeEach
globalThis.afterEach = afterEach
globalThis.vi = vi
