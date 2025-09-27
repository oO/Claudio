/**
 * Usage analytics types
 */

import type { ProjectUsage } from './projects';

/**
 * Individual usage entry
 */
export interface UsageEntry {
  project: string;
  timestamp: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
  cost_usd: number;
}

/**
 * Usage statistics summary
 */
export interface UsageStats {
  total_cost: number;
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_creation_tokens: number;
  total_cache_read_tokens: number;
  session_count: number;
  total_sessions?: number;
  start_date: string;
  end_date: string;
  by_project: ProjectUsage[];
  by_model?: Array<{
    model: string;
    total_cost: number;
    session_count: number;
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_tokens?: number;
    cache_read_tokens?: number;
  }>;
  by_date?: Array<{
    date: string;
    total_cost: number;
    session_count: number;
  }>;
  recent_entries: UsageEntry[];
}