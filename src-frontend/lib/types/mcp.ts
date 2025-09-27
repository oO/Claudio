/**
 * MCP (Model Context Protocol) related types
 */

/**
 * Individual server configuration in .mcp.json
 */
export interface MCPServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/**
 * Project MCP configuration
 */
export interface MCPProjectConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

/**
 * MCP server information
 */
export interface MCPServerInfo {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  status: 'running' | 'stopped' | 'error';
  pid?: number;
  error?: string;
  scope?: string;
  transport?: string;
  url?: string;
}

/**
 * Result of adding a server
 */
export interface MCPServerAddResult {
  success: boolean;
  message: string;
  server_name?: string;
}

/**
 * Result of removing a server
 */
export interface MCPServerRemoveResult {
  success: boolean;
  message: string;
  servers_removed: number;
}

/**
 * MCP Server entity (alias for MCPServerInfo)
 */
export type MCPServer = MCPServerInfo;