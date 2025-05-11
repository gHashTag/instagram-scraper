import { ApifyClient } from "apify-client";
/**
 * Скрапит Instagram Reels из указанного аккаунта с применением фильтров
 * @param instagramUrl URL Instagram аккаунта или хэштега
 * @param options Параметры скрапинга
 * @returns Массив найденных Reels
 */
export async function scrapeInstagramReels(instagramUrl, options) {
    try {
        const { apifyToken, minViews = 50000, maxAgeDays = 14, limit = 10, } = options;
        // Инициализируем клиент Apify
        const client = new ApifyClient({
            token: apifyToken,
        });
        console.log(`Запуск скрапинга для ${instagramUrl}...`);
        // Определяем, является ли источник аккаунтом или хэштегом
        const isHashtag = instagramUrl.includes("#");
        const sourceValue = isHashtag
            ? instagramUrl.replace("#", "").trim()
            : instagramUrl
                .replace("https://www.instagram.com/", "")
                .replace("/", "")
                .split("?")[0]
                .trim();
        // Параметры запуска актора
        const input = {
            directUrls: [instagramUrl],
            resultsLimit: limit * 3, // Получаем больше, чтобы после фильтрации осталось хотя бы limit
            ...(isHashtag
                ? { hashtags: [sourceValue] }
                : { usernames: [sourceValue] }),
            reelLimit: limit * 3,
            download: "reels",
            expandOwners: true,
            proxy: {
                useApifyProxy: true,
            },
        };
        // Запускаем актор Instagram Scraper и ждем завершения
        console.log("Запуск актора Instagram Scraper на Apify...");
        const run = await client.actor("apify/instagram-scraper").call({
            input,
        });
        // Получаем результаты
        console.log("Загрузка результатов из датасета...");
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        // Фильтруем только Reels и применяем дополнительные фильтры
        console.log(`Получено ${items.length} результатов, применяем фильтры...`);
        const maxAgeDate = new Date();
        maxAgeDate.setDate(maxAgeDate.getDate() - maxAgeDays);
        const filteredReels = items
            .filter((item) => {
            // Проверяем, что это Reels (не фото, не карусель)
            const isReel = item.type === "Video" && item.url.includes("/reel/");
            // Проверяем дату публикации, если указана
            let passesDateFilter = true;
            if (item.timestamp) {
                const pubDate = new Date(item.timestamp);
                passesDateFilter = pubDate >= maxAgeDate;
            }
            // Проверяем количество просмотров, если указано
            let passesViewsFilter = true;
            if (minViews && item.viewCount) {
                passesViewsFilter = item.viewCount >= minViews;
            }
            return isReel && passesDateFilter && passesViewsFilter;
        })
            .slice(0, limit); // Ограничиваем количество после фильтрации
        console.log(`После фильтрации осталось ${filteredReels.length} Reels.`);
        // Преобразуем данные в формат для сохранения
        return filteredReels.map((item) => ({
            reels_url: item.url,
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
    }
    catch (error) {
        console.error("Ошибка при скрапинге Instagram:", error);
        return [];
    }
}
