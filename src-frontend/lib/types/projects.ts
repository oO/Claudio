/**
 * Project-related types for the Claudio application
 */

/**
 * Represents a project in the ~/.claude/projects directory
 */
export interface Project {
  /** The project ID (derived from the directory name) */
  id: string;
  /** The original project path (decoded from the directory name) */
  path: string;
  /** Number of sessions (JSONL files) in this project */
  session_count: number;
  /** Unix timestamp when the project directory was created */
  created_at: number;
  /** Total size of all project files in bytes */
  total_size_bytes?: number;
  /** Last activity timestamp (most recent session) */
  last_active?: number;
  /** Current git branch name (if project is under git source control) */
  git_branch?: string;
}

/**
 * Project usage statistics for analytics
 */
export interface ProjectUsage {
  project_path: string;
  project_name: string;
  total_cost: number;
  total_tokens: number;
  session_count: number;
  last_used: string;
}

/**
 * Project deletion options
 */
export interface ProjectDeletionOptions {
  sessions: boolean;
  agents: boolean;
  memories: boolean;
  settings: boolean;
}

/**
 * Project deletion result summary
 */
export interface ProjectDeletionResult {
  success: boolean;
  project_id: string;
  sessions_deleted: number;
  claudio_sessions_deleted: number;
  todos_deleted: number;
  timelines_deleted: number;
  agents_deleted: number;
  memories_deleted: number;
  settings_deleted: number;
  size_mb: number;
  message: string;
}