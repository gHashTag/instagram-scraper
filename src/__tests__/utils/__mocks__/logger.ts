/**
 * Мок для логгера
 */

import { vi } from 'vitest';

export const logger = {
  userAction: vi.fn(),
  botAction: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  error: vi.fn()
};

export const LogType = {
  SYSTEM: 'SYSTEM',
  USER_ACTION: 'USER_ACTION',
  BOT_ACTION: 'BOT_ACTION',
  ERROR: 'ERROR'
};
