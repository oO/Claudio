import { invoke } from "@tauri-apps/api/core";
import { logger } from '@/lib/logger';
import type {
  Project,
  ProjectDeletionOptions,
  ProjectDeletionResult,
} from '@/lib/types/projects';

/**
 * Projects API client for project management operations
 */
export const projectsApi = {
  /**
   * Lists all projects in the ~/.claude/projects directory
   * @returns Promise resolving to an array of projects
   */
  async listProjects(): Promise<Project[]> {
    try {
      return await invoke<Project[]>("list_projects");
    } catch (error) {
      logger.error("Failed to list projects:", error);
      throw error;
    }
  },

  /**
   * Deletes a Claude project and all associated data
   * @param projectId - The project ID (encoded directory name)
   * @param options - Deletion options for different data types
   * @returns Promise resolving to deletion summary
   */
  async deleteClaudeProject(projectId: string, options?: ProjectDeletionOptions): Promise<ProjectDeletionResult> {
    try {
      return await invoke("delete_claude_project", { projectId, options });
    } catch (error) {
      logger.error("Failed to delete Claude project:", error);
      throw error;
    }
  },

  /**
   * Checks project settings validation
   * @param projectPath - The project path
   * @returns Promise resolving to validation status code
   */
  async checkProjectSettings(projectPath: string): Promise<number> {
    try {
      return await invoke("check_project_settings", { projectPath });
    } catch (error) {
      logger.error("Failed to check project settings:", error);
      throw error;
    }
  },
};