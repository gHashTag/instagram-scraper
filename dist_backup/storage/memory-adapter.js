/**
 * Адаптер для хранения данных в памяти (для тестирования)
 */
export class MemoryStorageAdapter {
    constructor() {
        this.users = [];
        this.projects = [];
        this.competitors = [];
        this.hashtags = [];
        this.reels = [];
        this.lastIds = {
            users: 0,
            projects: 0,
            competitors: 0,
            hashtags: 0,
            reels: 0,
        };
    }
    /**
     * Инициализирует хранилище
     */
    async initialize() {
        // В памяти инициализация не требуется
    }
    /**
     * Закрывает хранилище
     */
    async close() {
        // В памяти закрытие не требуется
    }
    /**
     * Получает пользователя по идентификатору Telegram
     * @param telegramId Идентификатор пользователя в Telegram
     */
    async getUserByTelegramId(telegramId) {
        const user = this.users.find(u => u.telegram_id === telegramId);
        return user || null;
    }
    /**
     * Создает нового пользователя
     * @param telegramId Идентификатор пользователя в Telegram
     * @param username Имя пользователя (опционально)
     * @param firstName Имя (опционально)
     * @param lastName Фамилия (опционально)
     */
    async createUser(telegramId, username, firstName, lastName) {
        const id = ++this.lastIds.users;
        const now = new Date();
        const user = {
            id,
            telegram_id: telegramId,
            username,
            first_name: firstName,
            last_name: lastName,
            created_at: now,
            updated_at: now,
        };
        this.users.push(user);
        return user;
    }
    /**
     * Получает проекты пользователя
     * @param userId Идентификатор пользователя
     */
    async getProjectsByUserId(userId) {
        return this.projects.filter(p => p.user_id === userId);
    }
    /**
     * Получает проект по идентификатору
     * @param projectId Идентификатор проекта
     */
    async getProjectById(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        return project || null;
    }
    /**
     * Создает новый проект
     * @param userId Идентификатор пользователя
     * @param name Название проекта
     */
    async createProject(userId, name) {
        const id = ++this.lastIds.projects;
        const now = new Date();
        const project = {
            id,
            user_id: userId,
            name,
            is_active: true,
            created_at: now,
            updated_at: now,
        };
        this.projects.push(project);
        return project;
    }
    /**
     * Обновляет проект
     * @param projectId Идентификатор проекта
     * @param updates Данные для обновления
     */
    async updateProject(projectId, updates) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) {
            throw new Error(`Проект с ID ${projectId} не найден`);
        }
        if (updates.name !== undefined) {
            project.name = updates.name;
        }
        if (updates.is_active !== undefined) {
            project.is_active = updates.is_active;
        }
        project.updated_at = new Date();
        return project;
    }
    /**
     * Получает конкурентов проекта
     * @param projectId Идентификатор проекта
     */
    async getCompetitorAccounts(projectId) {
        return this.competitors.filter(c => c.project_id === projectId);
    }
    /**
     * Получает конкурента по идентификатору
     * @param competitorId Идентификатор конкурента
     */
    async getCompetitorById(competitorId) {
        const competitor = this.competitors.find(c => c.id === competitorId);
        return competitor || null;
    }
    /**
     * Создает нового конкурента
     * @param projectId Идентификатор проекта
     * @param username Имя пользователя
     * @param instagramUrl URL аккаунта Instagram
     * @param notes Примечания (опционально)
     */
    async createCompetitor(projectId, username, instagramUrl, notes) {
        const id = ++this.lastIds.competitors;
        const now = new Date();
        const competitor = {
            id,
            project_id: projectId,
            username,
            instagram_url: instagramUrl,
            notes,
            created_at: now,
            updated_at: now,
        };
        this.competitors.push(competitor);
        return competitor;
    }
    /**
     * Обновляет конкурента
     * @param competitorId Идентификатор конкурента
     * @param updates Данные для обновления
     */
    async updateCompetitor(competitorId, updates) {
        const competitor = this.competitors.find(c => c.id === competitorId);
        if (!competitor) {
            throw new Error(`Конкурент с ID ${competitorId} не найден`);
        }
        if (updates.username !== undefined) {
            competitor.username = updates.username;
        }
        if (updates.instagram_url !== undefined) {
            competitor.instagram_url = updates.instagram_url;
        }
        if (updates.notes !== undefined) {
            competitor.notes = updates.notes;
        }
        competitor.updated_at = new Date();
        return competitor;
    }
    /**
     * Удаляет конкурента
     * @param competitorId Идентификатор конкурента
     */
    async deleteCompetitor(competitorId) {
        const index = this.competitors.findIndex(c => c.id === competitorId);
        if (index === -1) {
            return false;
        }
        this.competitors.splice(index, 1);
        return true;
    }
    /**
     * Получает хэштеги проекта
     * @param projectId Идентификатор проекта
     */
    async getTrackingHashtags(projectId) {
        return this.hashtags.filter(h => h.project_id === projectId);
    }
    /**
     * Получает хэштег по идентификатору
     * @param hashtagId Идентификатор хэштега
     */
    async getHashtagById(hashtagId) {
        const hashtag = this.hashtags.find(h => h.id === hashtagId);
        return hashtag || null;
    }
    /**
     * Создает новый хэштег
     * @param projectId Идентификатор проекта
     * @param name Название хэштега
     * @param notes Примечания (опционально)
     */
    async createHashtag(projectId, name, notes) {
        const id = ++this.lastIds.hashtags;
        const now = new Date();
        // Удаляем символ # в начале, если он есть
        const cleanName = name.startsWith("#") ? name.substring(1) : name;
        const hashtag = {
            id,
            project_id: projectId,
            name: cleanName,
            notes,
            created_at: now,
            updated_at: now,
        };
        this.hashtags.push(hashtag);
        return hashtag;
    }
    /**
     * Обновляет хэштег
     * @param hashtagId Идентификатор хэштега
     * @param updates Данные для обновления
     */
    async updateHashtag(hashtagId, updates) {
        const hashtag = this.hashtags.find(h => h.id === hashtagId);
        if (!hashtag) {
            throw new Error(`Хэштег с ID ${hashtagId} не найден`);
        }
        if (updates.name !== undefined) {
            // Удаляем символ # в начале, если он есть
            const cleanName = updates.name.startsWith("#")
                ? updates.name.substring(1)
                : updates.name;
            hashtag.name = cleanName;
        }
        if (updates.notes !== undefined) {
            hashtag.notes = updates.notes;
        }
        hashtag.updated_at = new Date();
        return hashtag;
    }
    /**
     * Удаляет хэштег
     * @param hashtagId Идентификатор хэштега
     */
    async deleteHashtag(hashtagId) {
        const index = this.hashtags.findIndex(h => h.id === hashtagId);
        if (index === -1) {
            return false;
        }
        this.hashtags.splice(index, 1);
        return true;
    }
    /**
     * Получает Reels проекта
     * @param projectId Идентификатор проекта
     * @param options Параметры запроса
     */
    async getReels(projectId, options) {
        const filteredReels = this.reels.filter(r => r.project_id === projectId);
        const total = filteredReels.length;
        // Сортируем по дате публикации (новые сверху)
        const sortedReels = [...filteredReels].sort((a, b) => b.publication_date.getTime() - a.publication_date.getTime());
        const limit = options?.limit || 10;
        const offset = options?.offset || 0;
        // Применяем пагинацию
        const paginatedReels = sortedReels.slice(offset, offset + limit);
        return {
            reels: paginatedReels,
            total,
        };
    }
    /**
     * Сохраняет Reels в базу данных
     * @param reels Массив Reels для сохранения
     */
    async saveReels(reels) {
        let savedCount = 0;
        const now = new Date();
        for (const reelData of reels) {
            // Проверяем, существует ли уже такой Reel
            const existingReel = this.reels.find(r => r.reels_url === reelData.reels_url);
            if (!existingReel) {
                const id = ++this.lastIds.reels;
                const reel = {
                    id,
                    ...reelData,
                    parsed_at: now,
                    updated_at: now,
                };
                this.reels.push(reel);
                savedCount++;
            }
        }
        return savedCount;
    }
}
/**
 * Фабричная функция для создания адаптера хранения в памяти
 */
export function createMemoryStorageAdapter() {
    return new MemoryStorageAdapter();
}
