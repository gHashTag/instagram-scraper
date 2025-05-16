/**
 * Мок-сервис для Apify API
 *
 * Позволяет тестировать функциональность, зависящую от Apify,
 * без реальных API-запросов.
 */

import { InstagramReel } from "../../types";

// Моковые данные для тестирования
const MOCK_REELS: Record<string, any[]> = {
  // Моковые данные для конкурентов
  competitor: [
    {
      type: "Video",
      url: "https://www.instagram.com/reel/ABC123/",
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      viewCount: 75000,
      likesCount: 1200,
      commentsCount: 45,
      caption: "Тестовый Reel от конкурента #beauty",
      ownerUsername: "competitor1",
      ownerId: "123456789",
      audioTitle: "Популярная мелодия",
      audioAuthor: "Famous Artist",
      previewUrl: "https://example.com/thumbnail1.jpg",
      videoDuration: 30,
    },
    {
      type: "Video",
      url: "https://www.instagram.com/reel/DEF456/",
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      viewCount: 120000,
      likesCount: 3500,
      commentsCount: 78,
      caption: "Еще один тестовый Reel #skincare",
      ownerUsername: "competitor1",
      ownerId: "123456789",
      audioTitle: "Другая мелодия",
      audioAuthor: "Another Artist",
      previewUrl: "https://example.com/thumbnail2.jpg",
      videoDuration: 45,
    },
  ],

  // Моковые данные для хэштегов
  hashtag_beauty: [
    {
      type: "Video",
      url: "https://www.instagram.com/reel/GHI789/",
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      viewCount: 250000,
      likesCount: 10500,
      commentsCount: 320,
      caption: "Тренды красоты 2023 #beauty #trends",
      ownerUsername: "beautyguru",
      ownerId: "987654321",
      audioTitle: "Трендовая мелодия",
      audioAuthor: "Trending Artist",
      previewUrl: "https://example.com/thumbnail3.jpg",
      videoDuration: 60,
    },
  ],

  hashtag_skincare: [
    {
      type: "Video",
      url: "https://www.instagram.com/reel/JKL012/",
      timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      viewCount: 85000,
      likesCount: 2300,
      commentsCount: 56,
      caption: "Уход за кожей в зимний период #skincare #winter",
      ownerUsername: "skincareexpert",
      ownerId: "456789123",
      audioTitle: "Зимняя мелодия",
      audioAuthor: "Winter Artist",
      previewUrl: "https://example.com/thumbnail4.jpg",
      videoDuration: 90,
    },
  ],
};

/**
 * Мок ApifyClient для тестирования
 */
export class MockApifyClient {
  constructor() {
    // Конструктор теперь пуст
  }

  actor(actorId: string) {
    if (actorId !== "apify/instagram-scraper") {
      throw new Error(`Неизвестный актор: ${actorId}`);
    }

    return {
      call: async (options: any) => {
        const input = options.input || {};

        // Определяем тип данных для возврата на основе входных параметров
        let dataKey = "competitor";

        if (input.hashtags && input.hashtags.length > 0) {
          dataKey = `hashtag_${input.hashtags[0]}`;
        }

        // Симулируем задержку для реалистичности
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Возвращаем уникальный ID для датасета
        return {
          defaultDatasetId: `mock_dataset_${dataKey}`,
        };
      },
    };
  }

  dataset(datasetId: string) {
    return {
      listItems: async () => {
        // Извлекаем ключ из ID датасета
        const dataKey = datasetId.replace("mock_dataset_", "");

        // Симулируем задержку для реалистичности
        await new Promise((resolve) => setTimeout(resolve, 300));

        return {
          items: MOCK_REELS[dataKey] || [],
        };
      },
    };
  }
}

/**
 * Мок-функция для scrapeInstagramReels, которая возвращает подготовленные данные
 */
export async function mockScrapeInstagramReels(
  instagramUrl: string,
  options: {
    apifyToken: string;
    minViews?: number;
    maxAgeDays?: number;
    limit?: number;
  }
): Promise<InstagramReel[]> {
  // Определяем, запрашиваем ли мы данные хэштега или аккаунта
  const isHashtag = instagramUrl.includes("#");

  // Определяем ключ для получения данных
  let dataKey = "competitor";

  if (isHashtag) {
    const hashtag = instagramUrl.replace("#", "").trim().toLowerCase();
    dataKey = `hashtag_${hashtag}`;
  }

  // Получаем необработанные данные
  const rawData = MOCK_REELS[dataKey] || [];

  // Применяем фильтры
  const minViews = options.minViews || 50000;
  const maxAgeDays = options.maxAgeDays || 14;
  const limit = options.limit || 10;

  const maxAgeDate = new Date();
  maxAgeDate.setDate(maxAgeDate.getDate() - maxAgeDays);

  // Фильтруем и преобразуем данные
  const filteredReels = rawData
    .filter((item) => {
      // Проверяем, что это Reels
      const isReel = item.type === "Video" && item.url.includes("/reel/");

      // Проверяем дату
      let passesDateFilter = true;
      if (item.timestamp) {
        const pubDate = new Date(item.timestamp);
        passesDateFilter = pubDate >= maxAgeDate;
      }

      // Проверяем просмотры
      let passesViewsFilter = true;
      if (minViews && item.viewCount) {
        passesViewsFilter = item.viewCount >= minViews;
      }

      return isReel && passesDateFilter && passesViewsFilter;
    })
    .slice(0, limit)
    .map((item) => ({
      id:
        item.url.split("/reel/")[1]?.replace("/", "") ||
        `mock_id_${Math.random()}`,
      url: item.url,
      publication_date: item.timestamp ? new Date(item.timestamp) : undefined,
      views_count: item.viewCount || undefined,
      likes_count: item.likesCount || undefined,
      comments_count: item.commentsCount || undefined,
      description: item.caption || undefined,
      author_username: item.ownerUsername || undefined,
      author_id: item.ownerId || undefined,
      audio_title: item.audioTitle || undefined,
      audio_artist: item.audioAuthor || undefined,
      thumbnail_url: item.previewUrl || undefined,
      duration_seconds: item.videoDuration || undefined,
      raw_data: item,
    }));

  // Симулируем задержку для реалистичности
  await new Promise((resolve) => setTimeout(resolve, 800));

  return filteredReels;
}
