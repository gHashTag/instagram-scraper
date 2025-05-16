import { ReelContent } from "../schemas";
import { logger } from "../logger";

/**
 * Сервис для расчета маркетинговых данных для Reels
 */
export class MarketingAnalyticsService {
  /**
   * Рассчитывает маркетинговые данные для Reel
   * @param reel Reel для расчета маркетинговых данных
   * @param averageFollowers Среднее количество подписчиков для расчета Engagement Rate (All)
   * @returns Reel с рассчитанными маркетинговыми данными
   */
  public calculateMarketingData(reel: ReelContent, averageFollowers: number = 10000): ReelContent {
    try {
      const updatedReel = { ...reel };
      
      // Рассчитываем количество дней с момента публикации
      updatedReel.days_since_published = this.calculateDaysSincePublished(reel.published_at);
      
      // Рассчитываем коэффициент вовлеченности для видео
      if (reel.views && reel.views > 0 && (reel.likes || reel.comments_count)) {
        updatedReel.engagement_rate_video = this.calculateEngagementRateVideo(
          reel.likes || 0,
          reel.comments_count || 0,
          reel.views
        );
      }
      
      // Рассчитываем коэффициент вовлеченности для всех типов контента
      if (reel.likes || reel.comments_count) {
        updatedReel.engagement_rate_all = this.calculateEngagementRateAll(
          reel.likes || 0,
          reel.comments_count || 0,
          averageFollowers
        );
      }
      
      // Рассчитываем отношение просмотров к лайкам
      if (reel.views && reel.views > 0 && reel.likes && reel.likes > 0) {
        updatedReel.view_to_like_ratio = this.calculateViewToLikeRatio(
          reel.views,
          reel.likes
        );
      }
      
      // Рассчитываем отношение комментариев к лайкам
      if (reel.comments_count && reel.comments_count > 0 && reel.likes && reel.likes > 0) {
        updatedReel.comments_to_likes_ratio = this.calculateCommentsToLikesRatio(
          reel.comments_count,
          reel.likes
        );
      }
      
      // Рассчитываем свежесть поста
      if (updatedReel.days_since_published !== undefined && updatedReel.days_since_published > 0) {
        updatedReel.recency = this.calculateRecency(updatedReel.days_since_published);
      }
      
      // Рассчитываем общий балл поста
      updatedReel.marketing_score = this.calculateMarketingScore(updatedReel);
      
      return updatedReel;
    } catch (error) {
      logger.error("[MarketingAnalyticsService] Error calculating marketing data:", error);
      return reel;
    }
  }
  
  /**
   * Рассчитывает количество дней с момента публикации
   * @param publishedAt Дата публикации в формате ISO
   * @returns Количество дней с момента публикации
   */
  private calculateDaysSincePublished(publishedAt: string): number {
    try {
      const publishedDate = new Date(publishedAt);
      const currentDate = new Date();
      
      // Разница в миллисекундах
      const diffTime = Math.abs(currentDate.getTime() - publishedDate.getTime());
      
      // Разница в днях
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays;
    } catch (error) {
      logger.error("[MarketingAnalyticsService] Error calculating days since published:", error);
      return 0;
    }
  }
  
  /**
   * Рассчитывает коэффициент вовлеченности для видео
   * @param likes Количество лайков
   * @param comments Количество комментариев
   * @param views Количество просмотров
   * @returns Коэффициент вовлеченности для видео
   */
  private calculateEngagementRateVideo(likes: number, comments: number, views: number): number {
    if (views === 0) return 0;
    
    // Формула: (лайки + комментарии) / просмотры * 100
    return ((likes + comments) / views) * 100;
  }
  
  /**
   * Рассчитывает коэффициент вовлеченности для всех типов контента
   * @param likes Количество лайков
   * @param comments Количество комментариев
   * @param followers Количество подписчиков
   * @returns Коэффициент вовлеченности для всех типов контента
   */
  private calculateEngagementRateAll(likes: number, comments: number, followers: number): number {
    if (followers === 0) return 0;
    
    // Формула: (лайки + комментарии) / подписчики * 100
    return ((likes + comments) / followers) * 100;
  }
  
  /**
   * Рассчитывает отношение просмотров к лайкам
   * @param views Количество просмотров
   * @param likes Количество лайков
   * @returns Отношение просмотров к лайкам
   */
  private calculateViewToLikeRatio(views: number, likes: number): number {
    if (likes === 0) return 0;
    
    // Формула: просмотры / лайки
    return views / likes;
  }
  
  /**
   * Рассчитывает отношение комментариев к лайкам
   * @param comments Количество комментариев
   * @param likes Количество лайков
   * @returns Отношение комментариев к лайкам
   */
  private calculateCommentsToLikesRatio(comments: number, likes: number): number {
    if (likes === 0) return 0;
    
    // Формула: комментарии / лайки
    return comments / likes;
  }
  
  /**
   * Рассчитывает свежесть поста
   * @param daysSincePublished Количество дней с момента публикации
   * @returns Свежесть поста
   */
  private calculateRecency(daysSincePublished: number): number {
    if (daysSincePublished === 0) return 1;
    
    // Формула: 1 / количество дней с момента публикации
    return 1 / daysSincePublished;
  }
  
  /**
   * Рассчитывает общий балл поста
   * @param reel Reel с рассчитанными маркетинговыми данными
   * @returns Общий балл поста
   */
  private calculateMarketingScore(reel: ReelContent): number {
    // Веса для различных метрик
    const weights = {
      engagementRateVideo: 0.3,
      engagementRateAll: 0.25,
      viewToLikeRatio: 0.05,
      commentsToLikesRatio: 0.2,
      recency: 0.2
    };
    
    // Нормализованные значения метрик
    const normalizedValues = {
      engagementRateVideo: reel.engagement_rate_video !== undefined ? this.normalize(reel.engagement_rate_video, 0, 10) : 0,
      engagementRateAll: reel.engagement_rate_all !== undefined ? this.normalize(reel.engagement_rate_all, 0, 5) : 0,
      viewToLikeRatio: reel.view_to_like_ratio !== undefined ? 1 / this.normalize(reel.view_to_like_ratio, 1, 100) : 0,
      commentsToLikesRatio: reel.comments_to_likes_ratio !== undefined ? this.normalize(reel.comments_to_likes_ratio, 0, 0.2) : 0,
      recency: reel.recency !== undefined ? this.normalize(reel.recency, 0, 1) : 0
    };
    
    // Рассчитываем общий балл
    let score = 0;
    
    // Если есть данные о просмотрах, используем формулу для видео
    if (reel.views && reel.views > 0) {
      score = (
        weights.engagementRateVideo * normalizedValues.engagementRateVideo +
        weights.engagementRateAll * normalizedValues.engagementRateAll +
        weights.viewToLikeRatio * normalizedValues.viewToLikeRatio +
        weights.commentsToLikesRatio * normalizedValues.commentsToLikesRatio +
        weights.recency * normalizedValues.recency
      );
    } else {
      // Если нет данных о просмотрах, используем формулу для других типов контента
      score = (
        weights.engagementRateAll * normalizedValues.engagementRateAll +
        weights.commentsToLikesRatio * normalizedValues.commentsToLikesRatio +
        weights.recency * normalizedValues.recency
      );
    }
    
    // Масштабируем балл от 0 до 10
    return score * 10;
  }
  
  /**
   * Нормализует значение в диапазоне от 0 до 1
   * @param value Значение для нормализации
   * @param min Минимальное значение
   * @param max Максимальное значение
   * @returns Нормализованное значение
   */
  private normalize(value: number, min: number, max: number): number {
    if (max === min) return 0;
    
    // Ограничиваем значение в диапазоне [min, max]
    const clampedValue = Math.max(min, Math.min(max, value));
    
    // Нормализуем значение в диапазоне [0, 1]
    return (clampedValue - min) / (max - min);
  }
}
