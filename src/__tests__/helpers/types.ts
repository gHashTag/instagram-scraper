import { jest } from "bun:test";
import { StorageAdapter } from "../../types";

/**
 * Тип для мокированного адаптера Neon
 */
export type MockedNeonAdapterType = {
  [K in keyof StorageAdapter]: jest.Mock;
} & StorageAdapter;

/**
 * Тип для мокированного StorageAdapter
 */
export type MockedStorageAdapterType = {
  [K in keyof StorageAdapter]: jest.Mock;
} & StorageAdapter;

/**
 * Создает мокированный StorageAdapter
 */
export function createMockStorageAdapter(): MockedStorageAdapterType {
  return {
    initialize: jest.fn().mockImplementation(() => Promise.resolve()),
    close: jest.fn().mockImplementation(() => Promise.resolve()),
    getUserByTelegramId: jest.fn().mockImplementation(() => Promise.resolve(null)),
    createUser: jest.fn().mockImplementation(() => Promise.resolve(null)),
    findUserByTelegramIdOrCreate: jest.fn().mockImplementation(() => Promise.resolve(null)),
    getProjectsByUserId: jest.fn().mockImplementation(() => Promise.resolve([])),
    getProjectById: jest.fn().mockImplementation(() => Promise.resolve(null)),
    createProject: jest.fn().mockImplementation(() => Promise.resolve(null)),
    getCompetitorAccounts: jest.fn().mockImplementation(() => Promise.resolve([])),
    getCompetitorsByProjectId: jest.fn().mockImplementation(() => Promise.resolve([])),
    addCompetitorAccount: jest.fn().mockImplementation(() => Promise.resolve(null)),
    deleteCompetitorAccount: jest.fn().mockImplementation(() => Promise.resolve(false)),
    getTrackingHashtags: jest.fn().mockImplementation(() => Promise.resolve([])),
    getHashtagsByProjectId: jest.fn().mockImplementation(() => Promise.resolve([])),
    addHashtag: jest.fn().mockImplementation(() => Promise.resolve(null)),
    removeHashtag: jest.fn().mockImplementation(() => Promise.resolve()),
    getReels: jest.fn().mockImplementation(() => Promise.resolve([])),
    getReelsByCompetitorId: jest.fn().mockImplementation(() => Promise.resolve([])),
    getReelsByProjectId: jest.fn().mockImplementation(() => Promise.resolve([])),
    saveReels: jest.fn().mockImplementation(() => Promise.resolve(0)),
    logParsingRun: jest.fn().mockImplementation(() => Promise.resolve(null)),
    createParsingLog: jest.fn().mockImplementation(() => Promise.resolve(null)),
    updateParsingLog: jest.fn().mockImplementation(() => Promise.resolve(null)),
    getParsingRunLogs: jest.fn().mockImplementation(() => Promise.resolve([])),
    getParsingLogsByProjectId: jest.fn().mockImplementation(() => Promise.resolve([]))
  };
}

/**
 * Создает мокированный NeonAdapter
 */
export function createMockNeonAdapter(): MockedNeonAdapterType {
  return createMockStorageAdapter() as MockedNeonAdapterType;
}
