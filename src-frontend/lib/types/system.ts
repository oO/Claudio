/**
 * System-related types
 */

/**
 * Window state for persistence
 */
export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

/**
 * System memory information from backend
 */
export interface SystemMemoryInfo {
  process_memory_mb: number;
  system_total_mb: number;
  system_available_mb: number;
  process_cpu_percent: number;
}

/**
 * File or directory entry
 */
export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
  extension?: string;
}

/**
 * Process information
 */
export interface ProcessInfo {
  run_id: number;
  process_type: ProcessType;
  pid: number;
  started_at: string;
  project_path: string;
  task: string;
  model: string;
}

/**
 * Process type for tracking
 */
export type ProcessType =
  | { ClaudeSession: { session_id: string } };