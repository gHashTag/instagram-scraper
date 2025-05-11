/// <reference types="vitest/globals" />
import { beforeEach, afterEach, vi } from "vitest";
// Создаем базовые моки
export const telegrafMocks = {
    use: vi.fn(),
    launch: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    command: vi.fn(),
    hears: vi.fn(),
    action: vi.fn(),
    on: vi.fn(),
    telegram: {
        sendMessage: vi.fn(),
        setMyCommands: vi.fn(),
    },
};
export const scenesMocks = {
    enter: vi.fn(),
    leave: vi.fn(),
    command: vi.fn(),
    action: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
};
// Создаем моки для Telegraf
export const MockTelegraf = vi.fn().mockImplementation(() => telegrafMocks);
export const MockMarkup = {
    inlineKeyboard: vi.fn().mockImplementation(buttons => ({
        reply_markup: { inline_keyboard: buttons },
    })),
    button: {
        callback: vi.fn().mockImplementation((text, data) => ({
            text,
            callback_data: data,
        })),
    },
};
export const MockScenes = {
    BaseScene: vi.fn().mockImplementation(() => scenesMocks),
    Stage: vi.fn().mockImplementation(() => ({
        middleware: vi.fn(),
    })),
};
// Мокируем функции скрапера
export const scraperMocks = {
    scrapeInstagramReels: vi
        .fn()
        .mockResolvedValue([
        { reels_url: "https://instagram.com/p/123", views_count: 100000 },
    ]),
    convertToStorageReel: vi
        .fn()
        .mockImplementation((reel, projectId, sourceType, sourceId) => ({
        project_id: projectId,
        source_type: sourceType,
        source_id: sourceId,
        reels_url: reel.url,
        views_count: reel.viewCount,
        parsed_at: new Date(),
    })),
};
// Настройка перед каждым тестом
beforeEach(() => {
    vi.clearAllMocks();
});
// Очистка после каждого теста
afterEach(() => {
    vi.resetAllMocks();
});
// Автоматически мокируем необходимые модули
vi.mock("telegraf", async () => {
    return {
        Telegraf: MockTelegraf,
        Scenes: MockScenes,
        Markup: MockMarkup,
        session: vi.fn(),
    };
});
vi.mock("../agent", async () => {
    return {
        scrapeInstagramReels: scraperMocks.scrapeInstagramReels,
        convertToStorageReel: scraperMocks.convertToStorageReel,
    };
});
// Мокируем чтение .env файла
vi.mock("dotenv", () => ({
    config: vi.fn(),
}));
// Мокируем telegraf
vi.mock("telegraf", () => {
    return {
        Telegraf: vi.fn().mockImplementation(() => ({
            use: vi.fn(),
            launch: vi.fn(),
            telegram: {
                setMyCommands: vi.fn(),
            },
            catch: vi.fn(),
        })),
        Scenes: {
            Stage: vi.fn().mockImplementation(() => ({
                register: vi.fn(),
            })),
            BaseScene: vi.fn().mockImplementation(name => ({
                name,
                enter: vi.fn(),
                leave: vi.fn(),
                command: vi.fn(),
                action: vi.fn(),
                on: vi.fn(),
                use: vi.fn(),
                hears: vi.fn(),
            })),
        },
        session: vi.fn(),
        Markup: {
            inlineKeyboard: buttons => ({
                reply_markup: { inline_keyboard: buttons },
            }),
            keyboard: buttons => ({
                reply_markup: { keyboard: buttons, resize_keyboard: true },
            }),
            removeKeyboard: () => ({
                reply_markup: { remove_keyboard: true },
            }),
            button: {
                callback: (text, data) => ({
                    text,
                    callback_data: data,
                }),
                url: (text, url) => ({
                    text,
                    url,
                }),
            },
        },
    };
});
// Мокируем подключение к Neon DB
vi.mock("pg", () => {
    return {
        Pool: vi.fn().mockImplementation(() => ({
            query: vi.fn(),
            connect: vi.fn().mockResolvedValue({
                query: vi.fn(),
                release: vi.fn(),
            }),
            end: vi.fn(),
        })),
    };
});
// Мокируем axios
vi.mock("axios", () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));
// Устанавливаем глобальную переменную для Neon
global.__NEON_CONNECTION_STRING__ = "postgresql://fake:fake@fake.neon.tech/fake";
