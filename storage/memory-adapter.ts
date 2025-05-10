import {
  StorageAdapter,
  User,
  Project,
  Competitor,
  Hashtag,
  Reel,
} from "@/types"

/**
 * Адаптер для хранения данных в памяти (для тестирования)
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private users: User[] = []
  private projects: Project[] = []
  private competitors: Competitor[] = []
  private hashtags: Hashtag[] = []
  private reels: Reel[] = []
  private lastIds = {
    users: 0,
    projects: 0,
    competitors: 0,
    hashtags: 0,
    reels: 0,
  }

  /**
   * Инициализирует хранилище
   */
  async initialize(): Promise<void> {
    // В памяти инициализация не требуется
  }

  /**
   * Закрывает хранилище
   */
  async close(): Promise<void> {
    // В памяти закрытие не требуется
  }

  /**
   * Получает пользователя по идентификатору Telegram
   * @param telegramId Идентификатор пользователя в Telegram
   */
  async getUserByTelegramId(telegramId: number): Promise<User | null> {
    const user = this.users.find(u => u.telegram_id === telegramId)
    return user || null
  }

  /**
   * Создает нового пользователя
   * @param telegramId Идентификатор пользователя в Telegram
   * @param username Имя пользователя (опционально)
   * @param firstName Имя (опционально)
   * @param lastName Фамилия (опционально)
   */
  async createUser(
    telegramId: number,
    username?: string,
    firstName?: string,
    lastName?: string
  ): Promise<User> {
    const id = ++this.lastIds.users
    const now = new Date()

    const user: User = {
      id,
      telegram_id: telegramId,
      username,
      first_name: firstName,
      last_name: lastName,
      created_at: now,
      updated_at: now,
    }

    this.users.push(user)
    return user
  }

  /**
   * Получает проекты пользователя
   * @param userId Идентификатор пользователя
   */
  async getProjectsByUserId(userId: number): Promise<Project[]> {
    return this.projects.filter(p => p.user_id === userId)
  }

  /**
   * Получает проект по идентификатору
   * @param projectId Идентификатор проекта
   */
  async getProjectById(projectId: number): Promise<Project | null> {
    const project = this.projects.find(p => p.id === projectId)
    return project || null
  }

  /**
   * Создает новый проект
   * @param userId Идентификатор пользователя
   * @param name Название проекта
   */
  async createProject(userId: number, name: string): Promise<Project> {
    const id = ++this.lastIds.projects
    const now = new Date()

    const project: Project = {
      id,
      user_id: userId,
      name,
      is_active: true,
      created_at: now,
      updated_at: now,
    }

    this.projects.push(project)
    return project
  }

  /**
   * Обновляет проект
   * @param projectId Идентификатор проекта
   * @param updates Данные для обновления
   */
  async updateProject(
    projectId: number,
    updates: Partial<
      Omit<Project, "id" | "user_id" | "created_at" | "updated_at">
    >
  ): Promise<Project> {
    const project = this.projects.find(p => p.id === projectId)

    if (!project) {
      throw new Error(`Проект с ID ${projectId} не найден`)
    }

    if (updates.name !== undefined) {
      project.name = updates.name
    }

    if (updates.is_active !== undefined) {
      project.is_active = updates.is_active
    }

    project.updated_at = new Date()

    return project
  }

  /**
   * Получает конкурентов проекта
   * @param projectId Идентификатор проекта
   */
  async getCompetitorAccounts(projectId: number): Promise<Competitor[]> {
    return this.competitors.filter(c => c.project_id === projectId)
  }

  /**
   * Получает конкурента по идентификатору
   * @param competitorId Идентификатор конкурента
   */
  async getCompetitorById(competitorId: number): Promise<Competitor | null> {
    const competitor = this.competitors.find(c => c.id === competitorId)
    return competitor || null
  }

  /**
   * Создает нового конкурента
   * @param projectId Идентификатор проекта
   * @param username Имя пользователя
   * @param instagramUrl URL аккаунта Instagram
   * @param notes Примечания (опционально)
   */
  async createCompetitor(
    projectId: number,
    username: string,
    instagramUrl: string,
    notes?: string
  ): Promise<Competitor> {
    const id = ++this.lastIds.competitors
    const now = new Date()

    const competitor: Competitor = {
      id,
      project_id: projectId,
      username,
      instagram_url: instagramUrl,
      notes,
      created_at: now,
      updated_at: now,
    }

    this.competitors.push(competitor)
    return competitor
  }

  /**
   * Обновляет конкурента
   * @param competitorId Идентификатор конкурента
   * @param updates Данные для обновления
   */
  async updateCompetitor(
    competitorId: number,
    updates: Partial<
      Omit<Competitor, "id" | "project_id" | "created_at" | "updated_at">
    >
  ): Promise<Competitor> {
    const competitor = this.competitors.find(c => c.id === competitorId)

    if (!competitor) {
      throw new Error(`Конкурент с ID ${competitorId} не найден`)
    }

    if (updates.username !== undefined) {
      competitor.username = updates.username
    }

    if (updates.instagram_url !== undefined) {
      competitor.instagram_url = updates.instagram_url
    }

    if (updates.notes !== undefined) {
      competitor.notes = updates.notes
    }

    competitor.updated_at = new Date()

    return competitor
  }

  /**
   * Удаляет конкурента
   * @param competitorId Идентификатор конкурента
   */
  async deleteCompetitor(competitorId: number): Promise<boolean> {
    const index = this.competitors.findIndex(c => c.id === competitorId)

    if (index === -1) {
      return false
    }

    this.competitors.splice(index, 1)
    return true
  }

  /**
   * Получает хэштеги проекта
   * @param projectId Идентификатор проекта
   */
  async getTrackingHashtags(projectId: number): Promise<Hashtag[]> {
    return this.hashtags.filter(h => h.project_id === projectId)
  }

  /**
   * Получает хэштег по идентификатору
   * @param hashtagId Идентификатор хэштега
   */
  async getHashtagById(hashtagId: number): Promise<Hashtag | null> {
    const hashtag = this.hashtags.find(h => h.id === hashtagId)
    return hashtag || null
  }

  /**
   * Создает новый хэштег
   * @param projectId Идентификатор проекта
   * @param name Название хэштега
   * @param notes Примечания (опционально)
   */
  async createHashtag(
    projectId: number,
    name: string,
    notes?: string
  ): Promise<Hashtag> {
    const id = ++this.lastIds.hashtags
    const now = new Date()

    // Удаляем символ # в начале, если он есть
    const cleanName = name.startsWith("#") ? name.substring(1) : name

    const hashtag: Hashtag = {
      id,
      project_id: projectId,
      name: cleanName,
      notes,
      created_at: now,
      updated_at: now,
    }

    this.hashtags.push(hashtag)
    return hashtag
  }

  /**
   * Обновляет хэштег
   * @param hashtagId Идентификатор хэштега
   * @param updates Данные для обновления
   */
  async updateHashtag(
    hashtagId: number,
    updates: Partial<
      Omit<Hashtag, "id" | "project_id" | "created_at" | "updated_at">
    >
  ): Promise<Hashtag> {
    const hashtag = this.hashtags.find(h => h.id === hashtagId)

    if (!hashtag) {
      throw new Error(`Хэштег с ID ${hashtagId} не найден`)
    }

    if (updates.name !== undefined) {
      // Удаляем символ # в начале, если он есть
      const cleanName = updates.name.startsWith("#")
        ? updates.name.substring(1)
        : updates.name
      hashtag.name = cleanName
    }

    if (updates.notes !== undefined) {
      hashtag.notes = updates.notes
    }

    hashtag.updated_at = new Date()

    return hashtag
  }

  /**
   * Удаляет хэштег
   * @param hashtagId Идентификатор хэштега
   */
  async deleteHashtag(hashtagId: number): Promise<boolean> {
    const index = this.hashtags.findIndex(h => h.id === hashtagId)

    if (index === -1) {
      return false
    }

    this.hashtags.splice(index, 1)
    return true
  }

  /**
   * Получает Reels проекта
   * @param projectId Идентификатор проекта
   * @param options Параметры запроса
   */
  async getReels(
    projectId: number,
    options?: { limit?: number; offset?: number }
  ): Promise<{ reels: Reel[]; total: number }> {
    const filteredReels = this.reels.filter(r => r.project_id === projectId)
    const total = filteredReels.length

    // Сортируем по дате публикации (новые сверху)
    const sortedReels = [...filteredReels].sort(
      (a, b) => b.publication_date.getTime() - a.publication_date.getTime()
    )

    const limit = options?.limit || 10
    const offset = options?.offset || 0

    // Применяем пагинацию
    const paginatedReels = sortedReels.slice(offset, offset + limit)

    return {
      reels: paginatedReels,
      total,
    }
  }

  /**
   * Сохраняет Reels в базу данных
   * @param reels Массив Reels для сохранения
   */
  async saveReels(
    reels: Omit<Reel, "id" | "created_at" | "updated_at">[]
  ): Promise<number> {
    let savedCount = 0
    const now = new Date()

    for (const reelData of reels) {
      // Проверяем, существует ли уже такой Reel
      const existingReel = this.reels.find(
        r => r.reels_url === reelData.reels_url
      )

      if (!existingReel) {
        const id = ++this.lastIds.reels

        const reel: Reel = {
          id,
          ...reelData,
          parsed_at: now,
          updated_at: now,
        }

        this.reels.push(reel)
        savedCount++
      }
    }

    return savedCount
  }
}

/**
 * Фабричная функция для создания адаптера хранения в памяти
 */
export function createMemoryStorageAdapter(): StorageAdapter {
  return new MemoryStorageAdapter()
}
