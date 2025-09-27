/**
 * Storage and settings related types
 */

/**
 * Custom slash command
 */
export interface SlashCommand {
  id?: string;
  command: string;
  prompt: string;
  description?: string;
  has_bash_commands?: boolean;
  has_file_references?: boolean;
  accepts_arguments?: boolean;
  scope?: string;
  name?: string;
  full_command?: string;
  namespace?: string;
  content?: string;
  allowed_tools?: string[];
}

/**
 * Hooks configuration
 */
export interface HooksConfiguration {
  commands: Record<string, string>;
}

/**
 * Storage operation result
 */
export interface StorageResult {
  success: boolean;
  message?: string;
}