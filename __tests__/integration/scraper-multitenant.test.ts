/*
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
// import {
//   initializeNeonStorage,
//   closeNeonStorage,
//   createUser,
//   createProject,
//   addCompetitorAccount,
//   addTrackingHashtag,
//   saveReels,
//   mockGetUserByTelegramId,
//   mockGetProjectsByUserId,
//   mockCreateProject,
//   mockGetHashtagsByProjectId,
//   mockGetCompetitorAccounts,
//   mockCreateCompetitor,
//   mockCreateHashtag,
//   mockSaveReels,
//   mockGetReelsByProjectId,
// } from "../../agent/index"
import dotenv from "dotenv"
import path from "path"
// import type { NeonStorageAdapter } from "../../storage/neonStorage-multitenant"
import { scrapeInstagramReels } from "../../agent/instagram-scraper"

// Загружаем переменные окружения для тестов
dotenv.config({ path: path.join(__dirname, "../.env") })

// Мокируем ApifyClient
vi.mock("apify-client", () => {
  return {
    ApifyClient: vi.fn().mockImplementation(() => ({
      actor: vi.fn().mockImplementation(() => ({
        call: vi.fn().mockResolvedValue({
          defaultDatasetId: "mock-dataset-id",
        }),
      })),
      dataset: vi.fn().mockImplementation(() => ({
        listItems: vi.fn().mockResolvedValue({
          items: [
            {
              url: "https://www.instagram.com/p/mock-id-1/",
              timestamp: "2023-07-01T12:00:00Z",
              viewCount: 60000,
              likesCount: 1500,
              commentsCount: 200,
              caption: "Mock Reel 1 #aestheticmedicine",
              ownerUsername: "clinicajoelleofficial",
              ownerId: "user-id-1",
              audioTitle: "Original Audio",
              audioAuthor: "Creator",
              thumbnailUrl: "https://mock-thumbnail-1.jpg",
              durationSec: 15,
            },
            {
              url: "https://www.instagram.com/p/mock-id-2/",
              timestamp: "2023-07-02T14:30:00Z",
              viewCount: 45000,
              likesCount: 1200,
              commentsCount: 150,
              caption: "Mock Reel 2 #botox #fillers",
              ownerUsername: "kayaclinicarabia",
              ownerId: "user-id-2",
              audioTitle: "Trending Sound",
              audioAuthor: "Famous Artist",
              thumbnailUrl: "https://mock-thumbnail-2.jpg",
              durationSec: 30,
            },
          ],
        }),
      })),
    })),
  }
})

// Мокируем функции Neon API
vi.mock("../../storage/neonStorage-multitenant", async () => {
  const actual = await vi.importActual<
    typeof import("../../storage/neonStorage-multitenant")
  >("../../storage/neonStorage-multitenant")
  return {
    ...actual,
    initializeNeonStorage: vi.fn().mockResolvedValue(undefined),
    closeNeonStorage: vi.fn().mockResolvedValue(undefined),
    createUser: vi
      .fn()
      .mockImplementation((telegramId, username, firstName, lastName) => {
        return Promise.resolve({
          id: 1,
          telegram_id: telegramId,
          username,
          first_name: firstName,
          last_name: lastName,
          subscription_level: "free",
        })
      }),
    createProject: vi
      .fn()
      .mockImplementation((userId, name, description, industry) => {
        return Promise.resolve({
          id: 1,
          user_id: userId,
          name,
          description,
          industry,
          is_active: true,
        })
      }),
    addCompetitorAccount: vi
      .fn()
      .mockImplementation((projectId, instagramUrl, accountName) => {
        return Promise.resolve({
          id: 1,
          project_id: projectId,
          instagram_url: instagramUrl,
          account_name: accountName,
          is_active: true,
          priority: 0,
        })
      }),
    addTrackingHashtag: vi
      .fn()
      .mockImplementation((projectId, hashtag, displayName) => {
        return Promise.resolve({
          id: 1,
          project_id: projectId,
          hashtag,
          display_name: displayName || `#${hashtag}`,
          is_active: true,
          priority: 0,
        })
      }),
    saveReels: vi.fn().mockResolvedValue(2),
  }
})

// Мокируем функцию scrapeInstagramReels
vi.mock("../../agent/instagram-scraper", () => {
  return {
    scrapeInstagramReels: vi
      .fn()
      .mockImplementation(
        (_instagramUrl: string, options: { minViews?: number }) => {
          return Promise.resolve(
            [
              {
                reels_url: "https://www.instagram.com/p/mock-id-1/",
                publication_date: new Date("2023-07-01T12:00:00Z"),
                views_count: 60000,
                likes_count: 1500,
                comments_count: 200,
                description: "Mock Reel 1 #aestheticmedicine",
                author_username: "clinicajoelleofficial",
                author_id: "user-id-1",
                audio_title: "Original Audio",
                audio_artist: "Creator",
                thumbnail_url: "https://mock-thumbnail-1.jpg",
                duration_seconds: 15,
                raw_data: { demoData: true },
              },
              {
                reels_url: "https://www.instagram.com/p/mock-id-2/",
                publication_date: new Date("2023-07-02T14:30:00Z"),
                views_count: 45000,
                likes_count: 1200,
                comments_count: 150,
                description: "Mock Reel 2 #botox #fillers",
                author_username: "kayaclinicarabia",
                author_id: "user-id-2",
                audio_title: "Trending Sound",
                audio_artist: "Famous Artist",
                thumbnail_url: "https://mock-thumbnail-2.jpg",
                duration_seconds: 30,
                raw_data: { demoData: true },
              },
            ].filter(reel => {
              // Применяем фильтрацию по просмотрам, если указан параметр
              if (options.minViews && reel.views_count < options.minViews) {
                return false
              }
              return true
            })
          )
        }
      ),
  }
})

describe("Мультитенантный скрапер Instagram Reels", () => {
  beforeAll(async () => {
    await initializeNeonStorage()
  })

  afterAll(async () => {
    await closeNeonStorage()
  })

  describe("Управление пользователями и проектами", () => {
    it("Должен создать пользователя", async () => {
      const user = await createUser(123456789, "testuser", "Test", "User")
      expect(user).toBeDefined()
      expect(user.telegram_id).toBe(123456789)
    })

    it("Должен создать проект", async () => {
      const project = await createProject(
        1,
        "Test Project",
        "Тестовый проект",
        "Эстетическая медицина"
      )
      expect(project).toBeDefined()
      expect(project.name).toBe("Test Project")
    })

    it("Должен добавить аккаунт конкурента", async () => {
      const account = await addCompetitorAccount(
        1,
        "https://www.instagram.com/clinicajoelleofficial",
        "Clinica Joelle"
      )
      expect(account).toBeDefined()
      expect(account.instagram_url).toBe(
        "https://www.instagram.com/clinicajoelleofficial"
      )
    })

    it("Должен добавить хэштег", async () => {
      const hashtag = await addTrackingHashtag(1, "aestheticmedicine")
      expect(hashtag).toBeDefined()
      expect(hashtag.hashtag).toBe("aestheticmedicine")
    })
  })

  describe("Скрапинг Instagram Reels", () => {
    it("Должен скрапить Reels по username", async () => {
      const reels = await scrapeInstagramReels("clinicajoelleofficial", {
        apifyToken: "mock-apify-token",
      })

      expect(reels).toHaveLength(2)
      expect(reels[0].reels_url).toBe("https://www.instagram.com/p/mock-id-1/")
      expect(reels[0].views_count).toBe(60000)
    })

    it("Должен скрапить Reels по хэштегу", async () => {
      const reels = await scrapeInstagramReels("#aestheticmedicine", {
        apifyToken: "mock-apify-token",
      })

      expect(reels).toHaveLength(2)
      expect(reels[0].author_username).toBe("clinicajoelleofficial")
    })

    it("Должен применять фильтрацию по просмотрам", async () => {
      const reels = await scrapeInstagramReels("clinicajoelleofficial", {
        apifyToken: "mock-apify-token",
        minViews: 50000,
      })

      expect(reels).toHaveLength(1)
      expect(reels[0].views_count).toBe(60000)
    })

    it("Должен применять фильтрацию по дате", async () => {
      // Создаем моковую дату, которая будет использована для сравнения
      const mockToday = new Date("2023-07-10")
      const realDate = Date

      // Сохраняем оригинальный конструктор Date
      const OriginalDate = global.Date

      // Заменяем глобальный Date на мок
      global.Date = class extends OriginalDate {
        constructor(date?: string | number | Date) {
          if (date) {
            super(date)
          } else {
            super(mockToday)
          }
        }
      } as any

      try {
        const reels = await scrapeInstagramReels("clinicajoelleofficial", {
          apifyToken: "mock-apify-token",
          maxAgeDays: 7,
        })

        expect(reels).toHaveLength(2)
      } finally {
        global.Date = realDate
      }
    })

    it("Должен обрабатывать ошибки Apify", async () => {
      // Переопределяем мок для тестирования ошибки
      const mockApifyImplementation = vi.fn().mockImplementation(() => ({
        actor: vi.fn().mockImplementation(() => ({
          call: vi.fn().mockRejectedValue(new Error("Apify API error")),
        })),
      }))

      // Сохраняем оригинальную имплементацию
      const { ApifyClient } = await import("apify-client")
      const originalApifyClient = ApifyClient

      // Заменяем имплементацию
      vi.mock("apify-client", () => ({
        ApifyClient: mockApifyImplementation,
      }))

      await expect(
        scrapeInstagramReels("clinicajoelleofficial", {
          apifyToken: "mock-apify-token",
        })
      ).rejects.toThrow("Apify API error")

      // Восстанавливаем оригинальную имплементацию
      vi.mock("apify-client", () => ({
        ApifyClient: originalApifyClient,
      }))
    })
  })
})

describe("Scraper Module - Multitenant Storage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("getUserByTelegramId", () => {
    it("should return null when user not found", async () => {
      const mockNeon = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as NeonStorageAdapter

      const result = await mockGetUserByTelegramId(mockNeon, 123456789)

      expect(result).toBeNull()
      expect(mockNeon.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT.*FROM\s+users.*WHERE\s+telegram_id\s*=\s*\$1/i
        ),
        [123456789]
      )
    })

    it("should return user when found", async () => {
      const mockUser = {
        id: 1,
        telegram_id: 123456789,
        username: "testuser",
        first_name: "Test",
        last_name: "User",
        created_at: new Date(),
        updated_at: new Date(),
      }

      const mockNeon = {
        query: vi.fn().mockResolvedValue({ rows: [mockUser] }),
      } as unknown as NeonStorageAdapter

      const result = await mockGetUserByTelegramId(mockNeon, 123456789)

      expect(result).toEqual(mockUser)
      expect(mockNeon.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT.*FROM\s+users.*WHERE\s+telegram_id\s*=\s*\$1/i
        ),
        [123456789]
      )
    })
  })

  describe("getProjectsByUserId", () => {
    it("should return empty array when no projects found", async () => {
      const mockNeon = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as NeonStorageAdapter

      const result = await mockGetProjectsByUserId(mockNeon, 1)

      expect(result).toEqual([])
      expect(mockNeon.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT.*FROM\s+projects.*WHERE\s+user_id\s*=\s*\$1/i
        ),
        [1]
      )
    })

    it("should return projects when found", async () => {
      const mockProjects = [
        {
          id: 1,
          user_id: 1,
          name: "Project 1",
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          user_id: 1,
          name: "Project 2",
          is_active: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]

      const mockNeon = {
        query: vi.fn().mockResolvedValue({ rows: mockProjects }),
      } as unknown as NeonStorageAdapter

      const result = await mockGetProjectsByUserId(mockNeon, 1)

      expect(result).toEqual(mockProjects)
      expect(mockNeon.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT.*FROM\s+projects.*WHERE\s+user_id\s*=\s*\$1/i
        ),
        [1]
      )
    })
  })

  describe("createProject", () => {
    it("should create a new project", async () => {
      const newProject = {
        id: 1,
        user_id: 1,
        name: "New Project",
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const mockNeon = {
        query: vi.fn().mockResolvedValue({ rows: [newProject] }),
      } as unknown as NeonStorageAdapter

      const result = await mockCreateProject(mockNeon, 1, "New Project")

      expect(result).toEqual(newProject)
      expect(mockNeon.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /INSERT\s+INTO\s+projects.*VALUES\s*\(\s*\$1\s*,\s*\$2\s*,\s*\$3\s*\)/i
        ),
        [1, "New Project", true]
      )
    })
  })

  describe("getHashtagsByProjectId", () => {
    it("should return empty array when no hashtags found", async () => {
      const mockNeon = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as NeonStorageAdapter

      const result = await mockGetHashtagsByProjectId(mockNeon, 1)

      expect(result).toEqual([])
      expect(mockNeon.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT.*FROM\s+hashtags.*WHERE\s+project_id\s*=\s*\$1/i
        ),
        [1]
      )
    })

    it("should return hashtags when found", async () => {
      const mockHashtags = [
        {
          id: 1,
          project_id: 1,
          hashtag: "beauty",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          project_id: 1,
          hashtag: "skincare",
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]

      const mockNeon = {
        query: vi.fn().mockResolvedValue({ rows: mockHashtags }),
      } as unknown as NeonStorageAdapter

      const result = await mockGetHashtagsByProjectId(mockNeon, 1)

      expect(result).toEqual(mockHashtags)
      expect(mockNeon.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT.*FROM\s+hashtags.*WHERE\s+project_id\s*=\s*\$1/i
        ),
        [1]
      )
    })
  })

  describe("getCompetitorAccounts", () => {
    it("should return empty array when no competitors found", async () => {
      const mockNeon = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as NeonStorageAdapter

      const result = await mockGetCompetitorAccounts(mockNeon, 1)

      expect(result).toEqual([])
      expect(mockNeon.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT.*FROM\s+competitors.*WHERE\s+project_id\s*=\s*\$1/i
        ),
        [1]
      )
    })

    it("should return competitors when found", async () => {
      const mockCompetitors = [
        {
          id: 1,
          project_id: 1,
          username: "competitor1",
          instagram_url: "https://instagram.com/competitor1",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          project_id: 1,
          username: "competitor2",
          instagram_url: "https://instagram.com/competitor2",
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]

      const mockNeon = {
        query: vi.fn().mockResolvedValue({ rows: mockCompetitors }),
      } as unknown as NeonStorageAdapter

      const result = await mockGetCompetitorAccounts(mockNeon, 1)

      expect(result).toEqual(mockCompetitors)
      expect(mockNeon.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT.*FROM\s+competitors.*WHERE\s+project_id\s*=\s*\$1/i
        ),
        [1]
      )
    })
  })

  describe("createCompetitor", () => {
    it("should create a new competitor account", async () => {
      const newCompetitor = {
        id: 1,
        project_id: 1,
        username: "newcompetitor",
        instagram_url: "https://instagram.com/newcompetitor",
        created_at: new Date(),
        updated_at: new Date(),
      }

      const mockNeon = {
        query: vi.fn().mockResolvedValue({ rows: [newCompetitor] }),
      } as unknown as NeonStorageAdapter

      const result = await mockCreateCompetitor(
        mockNeon,
        1,
        "newcompetitor",
        "https://instagram.com/newcompetitor"
      )

      expect(result).toEqual(newCompetitor)
      expect(mockNeon.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /INSERT\s+INTO\s+competitors.*VALUES\s*\(\s*\$1\s*,\s*\$2\s*,\s*\$3\s*\)/i
        ),
        [1, "newcompetitor", "https://instagram.com/newcompetitor"]
      )
    })
  })

  describe("createHashtag", () => {
    it("should create a new hashtag", async () => {
      const newHashtag = {
        id: 1,
        project_id: 1,
        hashtag: "newtag",
        created_at: new Date(),
        updated_at: new Date(),
      }

      const mockNeon = {
        query: vi.fn().mockResolvedValue({ rows: [newHashtag] }),
      } as unknown as NeonStorageAdapter

      const result = await mockCreateHashtag(mockNeon, 1, "newtag")

      expect(result).toEqual(newHashtag)
      expect(mockNeon.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /INSERT\s+INTO\s+hashtags.*VALUES\s*\(\s*\$1\s*,\s*\$2\s*\)/i
        ),
        [1, "newtag"]
      )
    })
  })

  describe("saveReels", () => {
    it("should save reels in bulk", async () => {
      const reels = [
        {
          project_id: 1,
          username: "user1",
          instagram_url: "https://instagram.com/p/123",
          thumbnail_url: "https://instagram.com/thumbnail1.jpg",
          video_url: "https://instagram.com/video1.mp4",
          caption: "Test caption 1",
          likes: 100,
          views: 1000,
          posted_at: new Date(),
          source_type: "competitor",
          source_id: 1,
        },
        {
          project_id: 1,
          username: "user2",
          instagram_url: "https://instagram.com/p/456",
          thumbnail_url: "https://instagram.com/thumbnail2.jpg",
          video_url: "https://instagram.com/video2.mp4",
          caption: "Test caption 2",
          likes: 200,
          views: 2000,
          posted_at: new Date(),
          source_type: "hashtag",
          source_id: 2,
        },
      ]

      const mockNeon = {
        query: vi.fn().mockResolvedValue({ rows: [{ count: 2 }] }),
      } as unknown as NeonStorageAdapter

      const result = await mockSaveReels(mockNeon, reels)

      expect(result).toBe(2)
      expect(mockNeon.query).toHaveBeenCalledTimes(1)
      expect(mockNeon.query).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT\s+INTO\s+reels/i),
        expect.arrayContaining([])
      )
    })
  })

  describe("getReelsByProjectId", () => {
    it("should return empty array when no reels found", async () => {
      const mockNeon = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as NeonStorageAdapter

      const result = await mockGetReelsByProjectId(mockNeon, 1)

      expect(result).toEqual([])
      expect(mockNeon.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT.*FROM\s+reels.*WHERE\s+project_id\s*=\s*\$1/i
        ),
        [1]
      )
    })

    it("should return reels when found", async () => {
      const mockReels = [
        {
          id: 1,
          project_id: 1,
          username: "user1",
          instagram_url: "https://instagram.com/p/123",
          thumbnail_url: "https://instagram.com/thumbnail1.jpg",
          video_url: "https://instagram.com/video1.mp4",
          caption: "Test caption 1",
          likes: 100,
          views: 1000,
          posted_at: new Date(),
          source_type: "competitor",
          source_id: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          project_id: 1,
          username: "user2",
          instagram_url: "https://instagram.com/p/456",
          thumbnail_url: "https://instagram.com/thumbnail2.jpg",
          video_url: "https://instagram.com/video2.mp4",
          caption: "Test caption 2",
          likes: 200,
          views: 2000,
          posted_at: new Date(),
          source_type: "hashtag",
          source_id: 2,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]

      const mockNeon = {
        query: vi.fn().mockResolvedValue({ rows: mockReels }),
      } as unknown as NeonStorageAdapter

      const result = await mockGetReelsByProjectId(mockNeon, 1)

      expect(result).toEqual(mockReels)
      expect(mockNeon.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT.*FROM\s+reels.*WHERE\s+project_id\s*=\s*\$1/i
        ),
        [1]
      )
    })
  })
})
*/
