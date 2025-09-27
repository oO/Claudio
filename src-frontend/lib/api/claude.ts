import { invoke } from "@tauri-apps/api/core";
import { logger } from '@/lib/logger';
import type {
  ClaudeSettings,
  ClaudeVersionStatus,
  ClaudeInstallation,
  ClaudeMdFile,
} from '@/lib/types/claude';

/**
 * Claude Code API client for Claude binary operations
 */
export const claudeApi = {
  /**
   * Reads the Claude settings file
   * @returns Promise resolving to the settings object
   */
  async getClaudeSettings(): Promise<ClaudeSettings> {
    try {
      const result = await invoke<{ data: ClaudeSettings }>("get_claude_settings");

      // The Rust backend returns ClaudeSettings { data: ... }
      // We need to extract the data field
      if (result && typeof result === 'object' && 'data' in result) {
        return result.data;
      }

      // If the result is already the settings object, return it
      return result as ClaudeSettings;
    } catch (error) {
      logger.error("Failed to get Claude settings:", error);
      throw error;
    }
  },

  /**
   * Opens a new Claude Code session
   * @param path - Optional path to open the session in
   * @returns Promise resolving when the session is opened
   */
  async openNewSession(path?: string): Promise<string> {
    try {
      return await invoke<string>("open_new_claude_session", { path });
    } catch (error) {
      logger.error("Failed to open new Claude session:", error);
      throw error;
    }
  },

  /**
   * Runs Claude Code with the specified task
   * @param task - The task to run
   * @param projectPath - Optional project path
   * @param model - Optional model to use
   * @returns Promise resolving when the task is complete
   */
  async runClaudeTask(task: string, projectPath?: string, model?: string): Promise<string> {
    try {
      return await invoke<string>("run_claude_task", { task, projectPath, model });
    } catch (error) {
      logger.error("Failed to run Claude task:", error);
      throw error;
    }
  },

  /**
   * Gets the Claude Code version status
   * @returns Promise resolving to version information
   */
  async getClaudeVersion(): Promise<ClaudeVersionStatus> {
    try {
      return await invoke<ClaudeVersionStatus>("get_claude_version");
    } catch (error) {
      logger.error("Failed to get Claude version:", error);
      throw error;
    }
  },

  /**
   * Finds Claude installations on the system
   * @returns Promise resolving to array of installations
   */
  async findClaudeInstallations(): Promise<ClaudeInstallation[]> {
    try {
      return await invoke<ClaudeInstallation[]>("list_claude_installations");
    } catch (error) {
      logger.error("Failed to find Claude installations:", error);
      throw error;
    }
  },

  /**
   * Reads a CLAUDE.md file
   * @param filePath - Path to the CLAUDE.md file
   * @returns Promise resolving to file content
   */
  async readClaudeMdFile(filePath: string): Promise<string> {
    try {
      return await invoke<string>("read_claude_md_file", { filePath });
    } catch (error) {
      logger.error("Failed to read CLAUDE.md file:", error);
      throw error;
    }
  },

  /**
   * Lists CLAUDE.md files in a project
   * @param projectPath - The project path
   * @returns Promise resolving to array of CLAUDE.md files
   */
  async listClaudeMdFiles(projectPath: string): Promise<ClaudeMdFile[]> {
    try {
      return await invoke<ClaudeMdFile[]>("list_claude_md_files", { projectPath });
    } catch (error) {
      logger.error("Failed to list CLAUDE.md files:", error);
      throw error;
    }
  },

  /**
   * Sets the Claude binary path
   * @param path - Path to Claude binary
   * @returns Promise resolving when path is set
   */
  async setClaudeBinaryPath(path: string): Promise<void> {
    try {
      return await invoke("set_claude_binary_path", { path });
    } catch (error) {
      logger.error("Failed to set Claude binary path:", error);
      throw error;
    }
  },

  /**
   * Saves a CLAUDE.md file
   * @param filePath - File path
   * @param content - File content
   * @returns Promise resolving when saved
   */
  async saveClaudeMdFile(filePath: string, content: string): Promise<void> {
    try {
      return await invoke("save_claude_md_file", { filePath, content });
    } catch (error) {
      logger.error("Failed to save CLAUDE.md file:", error);
      throw error;
    }
  },

  /**
   * Deletes a file
   * @param filePath - File path to delete
   * @returns Promise resolving when deleted
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      return await invoke("delete_file", { filePath });
    } catch (error) {
      logger.error("Failed to delete file:", error);
      throw error;
    }
  },

  /**
   * Gets system prompt
   * @param projectPath - Project path
   * @returns Promise resolving to system prompt
   */
  async getSystemPrompt(projectPath?: string): Promise<string> {
    try {
      return await invoke<string>("get_system_prompt", { projectPath });
    } catch (error) {
      logger.error("Failed to get system prompt:", error);
      throw error;
    }
  },

  /**
   * Saves system prompt
   * @param content - Prompt content
   * @param projectPath - Project path
   * @returns Promise resolving when saved
   */
  async saveSystemPrompt(content: string, projectPath?: string): Promise<void> {
    try {
      return await invoke("save_system_prompt", { content, projectPath });
    } catch (error) {
      logger.error("Failed to save system prompt:", error);
      throw error;
    }
  },

  /**
   * Finds CLAUDE.md files in project
   * @param projectPath - Project path
   * @returns Promise resolving to array of files
   */
  async findClaudeMdFiles(projectPath: string): Promise<ClaudeMdFile[]> {
    try {
      return await invoke<ClaudeMdFile[]>("find_claude_md_files", { projectPath });
    } catch (error) {
      logger.error("Failed to find CLAUDE.md files:", error);
      throw error;
    }
  },
};