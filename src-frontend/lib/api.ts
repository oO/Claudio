/**
 * Unified API exports - this file serves as the new main API entry point
 * Re-exports all modular APIs and types for clean imports
 */

// Export all modular APIs
export { agentsApi } from './api/agents';
export { projectsApi } from './api/projects';
export { sessionsApi } from './api/sessions';
export { claudeApi } from './api/claude';
export { mcpApi } from './api/mcp';
export { usageApi } from './api/usage';
export { storageApi } from './api/storage';
export { systemApi } from './api/system';

// Export all types from the organized type modules
export type * from './types/agents';
export type * from './types/projects';
export type * from './types/sessions';
export type * from './types/claude';
export type * from './types/mcp';
export type * from './types/usage';
export type * from './types/storage';
export type * from './types/system';

// Import required dependencies for remaining methods
import { invoke } from "@tauri-apps/api/core";
import { logger } from './logger';
import type { HooksConfiguration } from '@/types/hooks';

// Legacy compatibility API object containing methods not yet modularized
export const api = {
  // === LEGACY METHODS - These should be moved to appropriate modules ===

  async getSessionOutput(sessionId: number): Promise<any> {
    try {
      return await invoke("get_session_output", { sessionId });
    } catch (error) {
      logger.error("Failed to get session output:", error);
      throw error;
    }
  },

  async getSessionTodos(sessionId: string): Promise<any> {
    try {
      return await invoke("get_session_todos", { sessionId });
    } catch (error) {
      logger.error("Failed to get session todos:", error);
      throw error;
    }
  },

  async getHooksConfig(scope: string, projectPath?: string): Promise<HooksConfiguration> {
    try {
      return await invoke("get_hooks_config", { scope, projectPath });
    } catch (error) {
      logger.error("Failed to get hooks config:", error);
      throw error;
    }
  },

  async updateHooksConfig(scope: string, config: HooksConfiguration, projectPath?: string): Promise<void> {
    try {
      return await invoke("update_hooks_config", { scope, config, projectPath });
    } catch (error) {
      logger.error("Failed to update hooks config:", error);
      throw error;
    }
  },

  async slashCommandsList(): Promise<any[]> {
    try {
      return await invoke("slash_commands_list");
    } catch (error) {
      logger.error("Failed to get slash commands list:", error);
      throw error;
    }
  },

  async saveClaudeSettings(settings: any): Promise<void> {
    try {
      return await invoke("save_claude_settings", { settings });
    } catch (error) {
      logger.error("Failed to save Claude settings:", error);
      throw error;
    }
  },

  async getClaudeSettings(): Promise<any> {
    try {
      return await invoke("get_claude_settings");
    } catch (error) {
      logger.error("Failed to get Claude settings:", error);
      throw error;
    }
  },

  async readClaudeMdFile(filePath: string): Promise<string> {
    try {
      return await invoke<string>("read_text_file", { filePath });
    } catch (error) {
      logger.error("Failed to read CLAUDE.md file:", error);
      throw error;
    }
  },

  async saveClaudeMdFile(filePath: string, content: string): Promise<void> {
    try {
      return await invoke("write_text_file", { filePath, content });
    } catch (error) {
      logger.error("Failed to save CLAUDE.md file:", error);
      throw error;
    }
  },

  async slashCommandSave(command: any): Promise<void> {
    try {
      return await invoke("slash_command_save", { command });
    } catch (error) {
      logger.error("Failed to save slash command:", error);
      throw error;
    }
  },

  async slashCommandDelete(commandName: string): Promise<void> {
    try {
      return await invoke("slash_command_delete", { commandName });
    } catch (error) {
      logger.error("Failed to delete slash command:", error);
      throw error;
    }
  },

  async getClaudeBinaryPath(): Promise<string> {
    try {
      return await invoke<string>("get_claude_binary_path");
    } catch (error) {
      logger.error("Failed to get Claude binary path:", error);
      throw error;
    }
  },

  async setClaudeBinaryPath(path: string): Promise<void> {
    try {
      return await invoke("set_claude_binary_path", { path });
    } catch (error) {
      logger.error("Failed to set Claude binary path:", error);
      throw error;
    }
  },

  async storageListTables(): Promise<string[]> {
    try {
      return await invoke<string[]>("storage_list_tables");
    } catch (error) {
      logger.error("Failed to list tables:", error);
      throw error;
    }
  },

  async storageReadTable(tableName: string): Promise<any[]> {
    try {
      return await invoke<any[]>("storage_read_table", { tableName });
    } catch (error) {
      logger.error("Failed to read table:", error);
      throw error;
    }
  },

  async storageUpdateRow(tableName: string, rowId: number, data: Record<string, any>): Promise<any> {
    try {
      return await invoke("storage_update_row", { tableName, rowId, data });
    } catch (error) {
      logger.error("Failed to update row:", error);
      throw error;
    }
  },

  async storageDeleteRow(tableName: string, rowId: number): Promise<any> {
    try {
      return await invoke("storage_delete_row", { tableName, rowId });
    } catch (error) {
      logger.error("Failed to delete row:", error);
      throw error;
    }
  },

  async storageInsertRow(tableName: string, data: Record<string, any>): Promise<any> {
    try {
      return await invoke("storage_insert_row", { tableName, data });
    } catch (error) {
      logger.error("Failed to insert row:", error);
      throw error;
    }
  },

  async storageExecuteSql(sql: string): Promise<any> {
    try {
      return await invoke("storage_execute_sql", { sql });
    } catch (error) {
      logger.error("Failed to execute SQL:", error);
      throw error;
    }
  },

  async storageResetDatabase(): Promise<any> {
    try {
      return await invoke("storage_reset_database");
    } catch (error) {
      logger.error("Failed to reset database:", error);
      throw error;
    }
  },

  async checkClaudeVersion(): Promise<any> {
    try {
      return await invoke("check_claude_version");
    } catch (error) {
      logger.error("Failed to check Claude version:", error);
      throw error;
    }
  },

  async getUsageStats(): Promise<any> {
    try {
      return await invoke("get_usage_stats");
    } catch (error) {
      logger.error("Failed to get usage stats:", error);
      throw error;
    }
  },

  async getSessionStats(): Promise<any> {
    try {
      return await invoke("get_session_stats");
    } catch (error) {
      logger.error("Failed to get session stats:", error);
      throw error;
    }
  },

  async getUsageByDateRange(startDate: string, endDate: string): Promise<any> {
    try {
      return await invoke("get_usage_by_date_range", { startDate, endDate });
    } catch (error) {
      logger.error("Failed to get usage by date range:", error);
      throw error;
    }
  },

  // MCP methods
  async mcpAdd(serverName: string, connectionType: string, command: string, args: string[], env: Record<string, string>, projectPath?: string, scope?: string): Promise<any> {
    try {
      return await invoke("mcp_add", { serverName, connectionType, command, args, env, projectPath, scope });
    } catch (error) {
      logger.error("Failed to add MCP server:", error);
      throw error;
    }
  },

  async mcpAddFromClaudeDesktop(scope?: string): Promise<any> {
    try {
      return await invoke("mcp_add_from_claude_desktop", { scope });
    } catch (error) {
      logger.error("Failed to add MCP from Claude Desktop:", error);
      throw error;
    }
  },

  async mcpAddJson(serverName: string, jsonConfig: any, scope?: string): Promise<any> {
    try {
      return await invoke("mcp_add_json", { serverName, jsonConfig, scope });
    } catch (error) {
      logger.error("Failed to add MCP server from JSON:", error);
      throw error;
    }
  },

  async mcpServe(): Promise<any> {
    try {
      return await invoke("mcp_serve");
    } catch (error) {
      logger.error("Failed to start MCP server:", error);
      throw error;
    }
  },

  async mcpStopServe(): Promise<any> {
    try {
      return await invoke("mcp_stop_serve");
    } catch (error) {
      logger.error("Failed to stop MCP server:", error);
      throw error;
    }
  },

  async mcpInspect(): Promise<any> {
    try {
      return await invoke("mcp_inspect");
    } catch (error) {
      logger.error("Failed to inspect MCP:", error);
      throw error;
    }
  },

  async mcpListServers(): Promise<any> {
    try {
      return await invoke("mcp_list_servers");
    } catch (error) {
      logger.error("Failed to list MCP servers:", error);
      throw error;
    }
  },

  async mcpRemove(serverName: string): Promise<any> {
    try {
      return await invoke("mcp_remove", { serverName });
    } catch (error) {
      logger.error("Failed to remove MCP server:", error);
      throw error;
    }
  },

  // Session methods
  async getClaudioSession(sessionId: string, projectPath?: string): Promise<any> {
    try {
      return await invoke("get_claudio_session", { sessionId, projectPath });
    } catch (error) {
      logger.error("Failed to get Claudio session:", error);
      throw error;
    }
  },

  async createSessionMetadata(sessionId: string, projectPath: string, metadata: any): Promise<any> {
    try {
      return await invoke("create_session_metadata", { sessionId, projectPath, metadata });
    } catch (error) {
      logger.error("Failed to create session metadata:", error);
      throw error;
    }
  },

  async updateSessionMetadata(sessionId: string, projectPath: string, metadata: any): Promise<any> {
    try {
      return await invoke("update_session_metadata", { sessionId, projectPath, metadata });
    } catch (error) {
      logger.error("Failed to update session metadata:", error);
      throw error;
    }
  },

  async listRunningClaudeSessions(): Promise<any> {
    try {
      return await invoke("list_running_claude_sessions");
    } catch (error) {
      logger.error("Failed to list running Claude sessions:", error);
      throw error;
    }
  },

  async deleteClaudioSession(sessionId: string, projectPath?: string): Promise<any> {
    try {
      return await invoke("delete_claudio_session", { sessionId, projectPath });
    } catch (error) {
      logger.error("Failed to delete Claudio session:", error);
      throw error;
    }
  },

  async resumeClaudioSession(sessionId: string, projectPath?: string): Promise<any> {
    try {
      return await invoke("resume_claudio_session", { sessionId, projectPath });
    } catch (error) {
      logger.error("Failed to resume Claudio session:", error);
      throw error;
    }
  },

  // Additional MCP methods
  async mcpList(): Promise<any> {
    try {
      return await invoke("mcp_list");
    } catch (error) {
      logger.error("Failed to list MCP servers:", error);
      throw error;
    }
  },

  async mcpTestConnection(serverName: string): Promise<any> {
    try {
      return await invoke("mcp_test_connection", { serverName });
    } catch (error) {
      logger.error("Failed to test MCP connection:", error);
      throw error;
    }
  },

  // Agent methods
  async listAgents(projectPath?: string): Promise<any> {
    try {
      return await invoke("list_agents", { projectPath: projectPath || "" });
    } catch (error) {
      logger.error("Failed to list agents:", error);
      throw error;
    }
  },

  // Session methods
  async deleteSession(sessionId: string): Promise<any> {
    try {
      return await invoke("delete_session", { sessionId });
    } catch (error) {
      logger.error("Failed to delete session:", error);
      throw error;
    }
  },

  async getProjectSessions(projectPath: string): Promise<any> {
    try {
      return await invoke("get_project_sessions", { projectId: projectPath });
    } catch (error) {
      logger.error("Failed to get project sessions:", error);
      throw error;
    }
  },

  async getSessionAgeRange(projectPath: string): Promise<any> {
    try {
      return await invoke("get_session_age_range", { projectPath });
    } catch (error) {
      logger.error("Failed to get session age range:", error);
      throw error;
    }
  },

  async previewSessionDeletionByAge(projectPath: string, cutoffHours: number): Promise<any> {
    try {
      return await invoke("preview_session_deletion_by_age", { projectPath, cutoffHours });
    } catch (error) {
      logger.error("Failed to preview session deletion:", error);
      throw error;
    }
  },

  async deleteSessionsByAge(projectPath: string, cutoffHours: number): Promise<any> {
    try {
      return await invoke("delete_sessions_by_age", { projectPath, cutoffHours });
    } catch (error) {
      logger.error("Failed to delete sessions by age:", error);
      throw error;
    }
  },

  // Claude file methods
  async findClaudeMdFiles(projectPath: string): Promise<any> {
    try {
      return await invoke("find_claude_md_files", { projectPath });
    } catch (error) {
      logger.error("Failed to find Claude MD files:", error);
      throw error;
    }
  },

  // Project methods
  async checkProjectSettings(projectPath: string): Promise<any> {
    try {
      return await invoke("check_project_settings", { projectPath });
    } catch (error) {
      logger.error("Failed to check project settings:", error);
      throw error;
    }
  },

  async deleteClaudeProject(projectPath: string): Promise<any> {
    try {
      return await invoke("delete_claude_project", { projectPath });
    } catch (error) {
      logger.error("Failed to delete Claude project:", error);
      throw error;
    }
  },

  async listProjects(): Promise<any> {
    try {
      return await invoke("list_projects");
    } catch (error) {
      logger.error("Failed to list projects:", error);
      throw error;
    }
  },

  // TODO: Add other legacy methods here as needed
  // These should eventually be moved to their appropriate domain modules
};