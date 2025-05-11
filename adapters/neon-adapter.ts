import { Pool } from "pg";
import {
  StorageAdapter,
  User,
  Project,
  Competitor,
  Hashtag,
  ReelContent,
  ReelsFilter,
  ParsingRunLog,
} from "@/types";

/**
 * Адаптер для работы с базой данных Neon (PostgreSQL)
 * Реализует интерфейс StorageAdapter
 */
export class NeonAdapter implements StorageAdapter {
  private pool: Pool;

  constructor() {
    // Инициализация пула подключений к Neon
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || "",
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
    });
    console.log("Neon адаптер инициализирован");
  }

  async initialize(): Promise<void> {
    if (!this.pool) {
      throw new Error("Пул подключений к Neon не инициализирован");
    }
    try {
      await this.pool.connect();
      console.log("Подключение к Neon успешно");
    } catch (error) {
      console.error("Ошибка при подключении к Neon:", error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      console.log("Neon адаптер закрыт");
    }
  }

  private ensureConnection(): Pool {
    if (!this.pool) {
      throw new Error(
        "Нет подключения к Neon базе данных. Вызовите initialize() перед использованием адаптера."
      );
    }
    return this.pool;
  }

  async getProjectsByUserId(userId: number): Promise<Project[]> {
    const res = await this.pool.query(
      "SELECT * FROM projects WHERE user_id = $1",
      [userId]
    );
    return res.rows;
  }

  async getProjectById(projectId: number): Promise<Project | null> {
    const pool = this.ensureConnection();
    try {
      const res = await pool.query("SELECT * FROM Projects WHERE id = $1", [
        projectId,
      ]);
      return res.rows[0] as Project | null;
    } catch (error) {
      console.error("Ошибка при получении проекта из Neon:", error);
      throw new Error(
        `Ошибка при получении проекта: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async createProject(userId: number, name: string): Promise<Project> {
    const res = await this.pool.query(
      "INSERT INTO projects (user_id, name) VALUES ($1, $2) RETURNING *",
      [userId, name]
    );
    return res.rows[0];
  }

  async getCompetitorAccounts(
    projectId: number,
    activeOnly: boolean = true
  ): Promise<Competitor[]> {
    const pool = this.ensureConnection();
    try {
      const query = activeOnly
        ? "SELECT * FROM Competitors WHERE project_id = $1 AND is_active = true"
        : "SELECT * FROM Competitors WHERE project_id = $1";
      const res = await pool.query(query, [projectId]);
      return res.rows as Competitor[];
    } catch (error) {
      console.error("Ошибка при получении конкурентов из Neon:", error);
      throw new Error(
        `Ошибка при получении конкурентов: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async addCompetitorAccount(
    projectId: number,
    username: string,
    instagramUrl: string
  ): Promise<Competitor> {
    const res = await this.pool.query(
      "INSERT INTO competitors (project_id, username, instagram_url) VALUES ($1, $2, $3) RETURNING *",
      [projectId, username, instagramUrl]
    );
    return res.rows[0];
  }

  async getCompetitorsByProjectId(projectId: number): Promise<Competitor[]> {
    const res = await this.pool.query(
      "SELECT * FROM competitors WHERE project_id = $1",
      [projectId]
    );
    return res.rows;
  }

  async removeCompetitor(projectId: number, username: string): Promise<void> {
    await this.pool.query(
      "DELETE FROM competitors WHERE project_id = $1 AND username = $2",
      [projectId, username]
    );
  }

  async getUserByTelegramId(telegramId: number): Promise<User | null> {
    const res = await this.pool.query(
      "SELECT * FROM users WHERE telegram_id = $1",
      [telegramId]
    );
    return res.rows[0] || null;
  }

  async createUser(telegramId: number, username?: string): Promise<User> {
    const res = await this.pool.query(
      "INSERT INTO users (telegram_id, username) VALUES ($1, $2) RETURNING *",
      [telegramId, username || null]
    );
    return res.rows[0];
  }

  async addHashtag(projectId: number, name: string): Promise<Hashtag> {
    const res = await this.pool.query(
      "INSERT INTO hashtags (project_id, hashtag) VALUES ($1, $2) RETURNING *",
      [projectId, name]
    );
    return res.rows[0];
  }

  async getTrackingHashtags(
    projectId: number,
    activeOnly?: boolean
  ): Promise<Hashtag[]> {
    let query = "SELECT * FROM hashtags WHERE project_id = $1";
    const params: any[] = [projectId];
    if (activeOnly) {
      query += " AND is_active = true";
    }
    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async removeHashtag(projectId: number, hashtag: string): Promise<void> {
    await this.pool.query(
      "DELETE FROM hashtags WHERE project_id = $1 AND hashtag = $2",
      [projectId, hashtag]
    );
  }

  async saveReelsContent(content: any): Promise<void> {
    await this.pool.query(
      "INSERT INTO reels_content (competitor_id, reel_id, content_url, description, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING",
      [
        content.competitorId,
        content.reelId,
        content.contentUrl,
        content.description || null,
        content.createdAt,
      ]
    );
  }

  async getReelsByCompetitorId(
    competitorId: number,
    filter: any
  ): Promise<any[]> {
    let query = "SELECT * FROM reels_content WHERE competitor_id = $1";
    const params: any[] = [competitorId];
    if (filter.from) {
      query += " AND created_at >= $2";
      params.push(filter.from);
    }
    if (filter.to) {
      query += " AND created_at <= $3";
      params.push(filter.to);
    }
    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async saveReels(
    reels: Partial<ReelContent>[],
    projectId: number,
    sourceType: string,
    sourceId: string | number
  ): Promise<number> {
    // Подавляем ошибку TS6133 для неиспользуемых параметров
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    projectId;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sourceType;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sourceId;
    let savedCount = 0;
    for (const reel of reels) {
      await this.saveReelsContent(reel);
      savedCount++;
    }
    return savedCount;
  }

  async getReels(filter?: ReelsFilter): Promise<ReelContent[]> {
    let query = "SELECT * FROM reels_content";
    const params: any[] = [];
    if (filter) {
      if (filter.sourceId) {
        query += " WHERE source_id = $1";
        params.push(filter.sourceId);
      }
      if (filter.afterDate) {
        query += params.length ? " AND" : " WHERE";
        query += " created_at >= $" + (params.length + 1);
        params.push(filter.afterDate);
      }
      if (filter.beforeDate) {
        query += params.length ? " AND" : " WHERE";
        query += " created_at <= $" + (params.length + 1);
        params.push(filter.beforeDate);
      }
    }
    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async logParsingRun(log: Partial<ParsingRunLog>): Promise<ParsingRunLog> {
    const res = await this.pool.query(
      "INSERT INTO parsing_run_logs (run_id, target_type, target_id, status, message, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [
        log.run_id || this.generateUUID(),
        log.source_type || "unknown",
        log.source_id || "unknown",
        log.status || "unknown",
        log.error_message || null,
        log.started_at || new Date().toISOString(),
      ]
    );
    return res.rows[0];
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  async getParsingRunLogs(
    targetType: "competitor" | "hashtag",
    targetId: string
  ): Promise<ParsingRunLog[]> {
    const res = await this.pool.query(
      "SELECT * FROM parsing_run_logs WHERE target_type = $1 AND target_id = $2 ORDER BY created_at DESC",
      [targetType, targetId]
    );
    return res.rows;
  }
}
