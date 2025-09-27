/**
 * Agent-related types for the Claudio application
 */

/**
 * Agent customization settings for message display
 */
export interface AgentSettings {
  /** Name for the primary agent (default: "CloCo") */
  primaryAgentName?: string;
  /** Icon/emoji for the primary agent (default: "🤖") */
  primaryAgentIcon?: string;
  /** Color for the primary agent messages (hex color) */
  primaryAgentColor?: string;
  /** Whether to show agent names in messages */
  showAgentNames?: boolean;
  /** Whether to color-code messages by agent */
  colorCodeAgents?: boolean;
}

/**
 * Agent metadata from .md files
 */
export interface AgentMetadata {
  name: string;
  description?: string;
  subagent_type: string;
  icon?: string;
  color?: string;
  tools?: string[];
}

/**
 * Agent entity representing a Claude Code agent
 */
export interface Agent {
  id?: number;
  name: string;
  icon: string;
  system_prompt: string;
  default_task?: string;
  model: string;
  enable_file_read: boolean;
  enable_file_write: boolean;
  enable_network: boolean;
  hooks?: string; // JSON string of HooksConfiguration
  created_at: string;
  updated_at: string;
  description?: string;
  tools?: string;
  color?: string;
}

/**
 * Agent export format for sharing agents
 */
export interface AgentExport {
  version: number;
  exported_at: string;
  agent: {
    name: string;
    icon: string;
    system_prompt: string;
    default_task?: string;
    model: string;
    hooks?: string;
  };
}

/**
 * GitHub agent file metadata
 */
export interface GitHubAgentFile {
  name: string;
  path: string;
  download_url: string;
  size: number;
  sha: string;
}

/**
 * Todo item structure for agent execution tracking
 */
export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

/**
 * Todo counts aggregation
 */
export interface TodoCounts {
  pending: number;
  in_progress: number;
  completed: number;
  total: number;
  open: number;
}

/**
 * Agent todos collection
 */
export interface AgentTodos {
  agent_id: string;
  file_path: string;
  todos: TodoItem[];
  counts: TodoCounts;
}