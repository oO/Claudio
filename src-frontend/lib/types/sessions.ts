/**
 * Session-related types for the Claudio application
 */

/**
 * Represents a session with its metadata
 */
export interface Session {
  /** The session ID (UUID) */
  id: string;
  /** The project ID this session belongs to */
  project_id: string;
  /** The project path */
  project_path: string;
  /** Optional todo data associated with this session */
  todo_data?: any;
  /** Aggregated todo counts from all agent executions in this session */
  todo_counts?: {
    /** Number of open todos (pending + in_progress) */
    open: number;
    /** Number of completed todos */
    completed: number;
    /** Total number of todos */
    total: number;
  };
  /** Unix timestamp when the session file was created */
  created_at: number;
  /** Unix timestamp when the session file was last modified */
  modified_at: number;
  /** First user message content (if available) */
  first_message?: string;
  /** Timestamp of the first user message (if available) */
  message_timestamp?: string;
  /** Session file size in bytes */
  size_bytes?: number;
  /** Token count for this session */
  token_count?: number;
  /** Estimated cost for this session in USD */
  cost_usd?: number;
  /** Message count in this session */
  message_count?: number;
  /** Live session type if this is an active session */
  live_session_type?: "NATIVE" | "CLAUDIO";
}

/**
 * Session with full content loaded
 */
export interface SessionWithContent {
  /** Session metadata */
  session: Session;
  /** Full path to the session file */
  file_path: string;
  /** Parsed JSONL content */
  content: any[];
}

/**
 * Session status for Claudio-managed sessions
 */
export type ClaudioSessionStatus = 'Active' | 'Idle' | 'Completed' | 'Notification' | 'Compact';

/**
 * Session info structure
 */
export interface SessionInfo {
  session_id: string;
  created_at: number;
  updated_at: number;
  prompt?: string;
}

/**
 * Claudio session metadata
 */
export interface ClaudioSession {
  session_id: string;
  claudio_id?: string;
  project_path: string;
  created_at: number;
  updated_at: number;
  current_session?: SessionInfo;
  /** Session status */
  status: ClaudioSessionStatus;
  last_message_uuid?: string;
  session_history: SessionInfo[];
}

/**
 * Decorated session with Claudio metadata
 */
export interface DecoratedSession extends Session {
  /** Claudio-specific metadata */
  claudio?: ClaudioSession;
}

/**
 * Session todo data structure
 */
export interface SessionTodoData {
  session_id: string;
  agent_todos: import('./agents').AgentTodos[];
  total_counts: import('./agents').TodoCounts;
  agent_count: number;
}

/**
 * Session deletion result
 */
export interface SessionDeletionResult {
  success: boolean;
  session_id: string;
  project_id: string;
  claudio_sessions_deleted: number;
  todos_deleted: number;
  timelines_deleted: number;
  size_kb: number;
  message: string;
}