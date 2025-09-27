import { invoke } from "@tauri-apps/api/core";
import { logger } from '@/lib/logger';
import type {
  UsageStats,
  UsageEntry,
} from '@/lib/types/usage';

/**
 * Usage analytics API client
 */
export const usageApi = {
  /**
   * Gets usage statistics for the specified time period
   * @param startDate - Start date in ISO format
   * @param endDate - End date in ISO format
   * @returns Promise resolving to usage statistics
   */
  async getUsageStats(startDate?: string, endDate?: string): Promise<UsageStats> {
    try {
      return await invoke<UsageStats>("get_usage_stats", { startDate, endDate });
    } catch (error) {
      logger.error("Failed to get usage stats:", error);
      throw error;
    }
  },

  /**
   * Gets recent usage entries
   * @param limit - Maximum number of entries to return
   * @returns Promise resolving to array of usage entries
   */
  async getRecentUsage(limit?: number): Promise<UsageEntry[]> {
    try {
      return await invoke<UsageEntry[]>("get_recent_usage", { limit });
    } catch (error) {
      logger.error("Failed to get recent usage:", error);
      throw error;
    }
  },
};