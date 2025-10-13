/**
 * Output Styles API module
 * Handles all operations related to Claude Code output styles
 */

import { invoke } from "@tauri-apps/api/core";
import { logger } from '../logger';
import type { OutputStyle, OutputStyleCreate, OutputStyleUpdate } from '../types/output_styles';

export const outputStylesApi = {
  /**
   * List all output styles (user + project level)
   * @param projectPath Optional project path. Empty string for user-level styles.
   */
  async listOutputStyles(projectPath?: string): Promise<OutputStyle[]> {
    try {
      return await invoke<OutputStyle[]>("list_output_styles", {
        projectPath: projectPath || ""
      });
    } catch (error) {
      logger.error("Failed to list output styles:", error);
      throw error;
    }
  },

  /**
   * Create a new output style
   * @param data Output style data
   * @param projectPath Optional project path for project-level styles
   */
  async createOutputStyle(data: OutputStyleCreate, projectPath?: string): Promise<OutputStyle> {
    try {
      return await invoke<OutputStyle>("create_output_style", {
        projectPath: projectPath || null,
        name: data.name,
        description: data.description || null,
        content: data.content,
      });
    } catch (error) {
      logger.error("Failed to create output style:", error);
      throw error;
    }
  },

  /**
   * Update an existing output style
   * @param data Updated output style data
   * @param projectPath Optional project path
   */
  async updateOutputStyle(data: OutputStyleUpdate, projectPath?: string): Promise<OutputStyle> {
    try {
      return await invoke<OutputStyle>("update_output_style", {
        projectPath: projectPath || null,
        name: data.name,
        description: data.description || null,
        content: data.content,
      });
    } catch (error) {
      logger.error("Failed to update output style:", error);
      throw error;
    }
  },

  /**
   * Delete an output style
   * @param name Output style name
   * @param projectPath Optional project path
   */
  async deleteOutputStyle(name: string, projectPath?: string): Promise<void> {
    try {
      await invoke("delete_output_style", {
        projectPath: projectPath || null,
        name,
      });
    } catch (error) {
      logger.error("Failed to delete output style:", error);
      throw error;
    }
  },

  /**
   * Get a single output style by name
   * @param name Output style name
   * @param projectPath Optional project path
   */
  async getOutputStyle(name: string, projectPath?: string): Promise<OutputStyle> {
    try {
      return await invoke<OutputStyle>("get_output_style", {
        projectPath: projectPath || null,
        name,
      });
    } catch (error) {
      logger.error("Failed to get output style:", error);
      throw error;
    }
  },

  /**
   * Move an output style from project level to user level
   * @param name Output style name
   * @param projectPath Project path where the style currently exists
   * @param overwrite Whether to overwrite if style already exists at user level
   */
  async moveOutputStyleToUserLevel(name: string, projectPath: string, overwrite: boolean = false): Promise<void> {
    try {
      await invoke("move_output_style_to_user_level", {
        styleName: name,
        projectPath,
        overwrite,
      });
    } catch (error) {
      logger.error("Failed to move output style to user level:", error);
      throw error;
    }
  },

  /**
   * Export an output style to a file
   * @param name Output style name
   * @param filePath Destination file path
   * @param projectPath Optional project path
   */
  async exportOutputStyleToFile(name: string, filePath: string, projectPath?: string): Promise<void> {
    try {
      await invoke("export_output_style_to_file", {
        projectPath: projectPath || null,
        name,
        filePath,
      });
    } catch (error) {
      logger.error("Failed to export output style:", error);
      throw error;
    }
  },
};
