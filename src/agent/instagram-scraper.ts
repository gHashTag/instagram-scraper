import { ApifyClient } from "apify-client";
import { NeonDB, ReelInsert, saveReel, checkReelExists } from "../db/neonDB";

// Интерфейс для опций скрапинга
export interface ScrapeOptions {
  apifyToken: string;
  limit?: number;
  minViews?: number;
  maxAgeDays?: number;
}

// Интерфейс для элемента, возвращаемого Apify
interface ApifyReelItemMusicInfo {
  artist_name: string | null;
  song_name: string | null;
  uses_original_audio: boolean | null;
  should_mute_audio: boolean | null;
  should_mute_audio_reason: string | null;
  audio_id: string | null;
}

interface ApifyReelItem {
  inputUrl?: string;
  id?: string;
  type?: string;
  shortCode?: string;
  caption?: string;
  hashtags?: string[];
  mentions?: string[];
  url?: string;
  commentsCount?: number;
  firstComment?: string;
  latestComments?: any[];
  dimensionsHeight?: number;
  dimensionsWidth?: number;
  displayUrl?: string;
  images?: any[];
  videoUrl?: string;
  alt?: string | null;
  likesCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  timestamp?: string;
  childPosts?: any[];
  ownerFullName?: string;
  ownerUsername?: string;
  ownerId?: string;
  productType?: string;
  videoDuration?: number;
  isSponsored?: boolean;
  musicInfo?: ApifyReelItemMusicInfo | null;
  isCommentsDisabled?: boolean;
  taggedUsers?: any[];
}

/**
 * Основная функция для скрапинга Instagram Reels.
 */
export async function scrapeInstagramReels(
  db: NeonDB,
  projectId: number,
  sourceType: "competitor" | "hashtag",
  sourceDbId: number,
  sourceValue: string,
  options: ScrapeOptions
): Promise<number> {
  const { limit = 1000, minViews, maxAgeDays, apifyToken } = options;
  let reelsAddedToDb = 0;

  const apifyClient = new ApifyClient({
    token: apifyToken,
  });

  console.log(`Запуск скрапинга Reels для ${sourceValue}...`);

  let sourceForApify: string;
  if (sourceValue.startsWith("#")) {
    sourceForApify = sourceValue.substring(1).trim();
  } else if (sourceValue.includes("instagram.com/explore/tags/")) {
    try {
      const url = new URL(sourceValue);
      const pathParts = url.pathname.split("/").filter(Boolean);
      if (pathParts.length >= 3 && pathParts[1] === "tags") {
        sourceForApify = pathParts[2];
      } else {
        console.warn(
          `Не удалось извлечь тег из URL: ${sourceValue}, используется как есть.`
        );
        sourceForApify = sourceValue;
      }
    } catch (e) {
      console.warn(
        `Ошибка парсинга URL тега ${sourceValue}, используется как есть. Ошибка: ${e}`
      );
      sourceForApify = sourceValue;
    }
  } else {
    sourceForApify = sourceValue.trim();
  }

  const input = {
    username: [sourceForApify],
    resultsLimit: limit,
  };

  console.log(
    "Запуск актора Instagram Reel Scraper на Apify с параметрами:",
    input
  );

  const run = await apifyClient
    .actor("apify/instagram-reel-scraper")
    .call(input);

  console.log("Загрузка результатов из датасета...");
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  console.log(`ПОЛУЧЕНО ОТ APIFY (${items.length} элементов).`);

  console.log("Применяем фильтры...");

  let maxAgeDate: Date | null = null;
  if (maxAgeDays !== undefined) {
    maxAgeDate = new Date();
    maxAgeDate.setDate(maxAgeDate.getDate() - maxAgeDays);
    console.log(`Фильтр по дате: Reels не старше ${maxAgeDate.toISOString()}`);
  }
  if (minViews !== undefined) {
    console.log(`Фильтр по просмотрам: Reels с просмотрами >= ${minViews}`);
  }

  const filteredReels = items
    .filter((item: ApifyReelItem) => {
      const isPotentialReel = item.type === "Video";
      if (!isPotentialReel) return false;

      let passesDateFilter = true;
      if (maxAgeDate && item.timestamp) {
        const pubDate = new Date(item.timestamp);
        passesDateFilter = pubDate >= maxAgeDate;
      } else if (maxAgeDate && !item.timestamp) {
        passesDateFilter = false;
      }

      let passesViewsFilter = true;
      const currentViews =
        typeof item.videoPlayCount === "number" ? item.videoPlayCount : null;
      if (minViews !== undefined && currentViews !== null) {
        passesViewsFilter = currentViews >= minViews;
      } else if (minViews !== undefined && currentViews === null) {
        passesViewsFilter = false;
      }

      return passesDateFilter && passesViewsFilter;
    })
    .map((item: ApifyReelItem) => {
      const currentReelUrl = item.url;
      if (typeof currentReelUrl !== "string" || !currentReelUrl) {
        console.warn(
          `Пропуск Reel без URL или с некорректным URL. ShortCode: ${item.shortCode}`
        );
        return null;
      }

      const views =
        typeof item.videoPlayCount === "number" ? item.videoPlayCount : 0;

      let songTitle: string | null = null;
      let artistName: string | null = null;
      if (item.musicInfo && typeof item.musicInfo === "object") {
        const musicInfo = item.musicInfo as ApifyReelItemMusicInfo;
        songTitle = musicInfo.song_name;
        artistName = musicInfo.artist_name;
      }

      const reelToSave: ReelInsert = {
        reel_url: currentReelUrl,
        project_id: projectId,
        source_type: sourceType,
        source_identifier: String(sourceDbId),
        profile_url: item.inputUrl || null,
        author_username: item.ownerUsername || null,
        description: item.caption || null,
        views_count: views,
        likes_count: typeof item.likesCount === "number" ? item.likesCount : 0,
        comments_count:
          typeof item.commentsCount === "number" ? item.commentsCount : 0,
        published_at: item.timestamp ? new Date(item.timestamp) : null,
        audio_title: songTitle,
        audio_artist: artistName,
        thumbnail_url: item.displayUrl || null,
        video_download_url: item.videoUrl || null,
        raw_data: item,
      };
      return reelToSave;
    })
    .filter((reel): reel is ReelInsert => reel !== null);

  console.log(`После фильтрации осталось ${filteredReels.length} Reels.`);

  if (filteredReels.length > 0) {
    console.log("ДАННЫЕ ПЕРЕД СОХРАНЕНИЕМ В БД:");
    filteredReels.forEach((item, index) => {
      console.log(
        `  Item ${index + 1} for DB: URL: ${item.reel_url}, Views: ${item.views_count}, Date: ${item.published_at}`
      );
    });
  }

  for (const reelToSave of filteredReels) {
    const reelExists = await checkReelExists(db, reelToSave.reel_url!);
    if (reelExists) {
      console.log(
        `Reel с URL ${reelToSave.reel_url} уже существует, пропуск вставки.`
      );
      continue;
    }

    try {
      const result = await saveReel(db, reelToSave);
      if (result && result.length > 0 && result[0].id) {
        console.log(
          `УСПЕШНО СОХРАНЕН REEL: ${result[0].reel_url} (ID: ${result[0].id})`
        );
        reelsAddedToDb++;
      } else {
        console.warn(
          `Не удалось сохранить Reel ${reelToSave.reel_url} или получить ID после вставки.`
        );
      }
    } catch (dbError: any) {
      console.error(
        `Ошибка при сохранении Reel ${reelToSave.reel_url} в БД: ${dbError.message}`,
        dbError
      );
    }
  }
  return reelsAddedToDb;
}
