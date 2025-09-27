import { invoke } from "@tauri-apps/api/core";
import { logger } from '@/lib/logger';
import type {
  MCPServerInfo,
  MCPServerAddResult,
  MCPServerRemoveResult,
  MCPProjectConfig,
} from '@/lib/types/mcp';

/**
 * MCP (Model Context Protocol) API client
 */
export const mcpApi = {
  /**
   * Lists available MCP servers
   * @returns Promise resolving to array of server info
   */
  async listMCPServers(): Promise<MCPServerInfo[]> {
    try {
      return await invoke<MCPServerInfo[]>("list_mcp_servers");
    } catch (error) {
      logger.error("Failed to list MCP servers:", error);
      throw error;
    }
  },

  /**
   * Adds a new MCP server
   * @param name - Server name
   * @param command - Command to run
   * @param args - Command arguments
   * @param env - Environment variables
   * @returns Promise resolving to add result
   */
  async addMCPServer(name: string, command: string, args: string[], env: Record<string, string>): Promise<MCPServerAddResult> {
    try {
      return await invoke<MCPServerAddResult>("add_mcp_server", { name, command, args, env });
    } catch (error) {
      logger.error("Failed to add MCP server:", error);
      throw error;
    }
  },

  /**
   * Removes an MCP server
   * @param name - Server name to remove
   * @returns Promise resolving to remove result
   */
  async removeMCPServer(name: string): Promise<MCPServerRemoveResult> {
    try {
      return await invoke<MCPServerRemoveResult>("remove_mcp_server", { name });
    } catch (error) {
      logger.error("Failed to remove MCP server:", error);
      throw error;
    }
  },

  /**
   * Resets project choices for MCP
   * @returns Promise resolving to reset status
   */
  async mcpResetProjectChoices(): Promise<string> {
    try {
      return await invoke<string>("mcp_reset_project_choices");
    } catch (error) {
      logger.error("Failed to reset MCP project choices:", error);
      throw error;
    }
  },

  /**
   * Reads project MCP configuration
   * @param projectPath - Project path
   * @returns Promise resolving to project config
   */
  async mcpReadProjectConfig(projectPath: string): Promise<MCPProjectConfig> {
    try {
      return await invoke<MCPProjectConfig>("mcp_read_project_config", { projectPath });
    } catch (error) {
      logger.error("Failed to read project MCP config:", error);
      throw error;
    }
  },

  /**
   * Saves project MCP configuration
   * @param projectPath - Project path
   * @param config - MCP configuration
   * @returns Promise resolving to save status
   */
  async mcpSaveProjectConfig(projectPath: string, config: MCPProjectConfig): Promise<string> {
    try {
      return await invoke<string>("mcp_save_project_config", { projectPath, config });
    } catch (error) {
      logger.error("Failed to save project MCP config:", error);
      throw error;
    }
  },
};