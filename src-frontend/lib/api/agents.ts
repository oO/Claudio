import { invoke } from "@tauri-apps/api/core";
import { logger } from '@/lib/logger';
import type {
  Agent,
  AgentExport,
  GitHubAgentFile,
} from '@/lib/types/agents';

/**
 * Agent API client for CRUD operations and GitHub integration
 */
export const agentsApi = {
  /**
   * Lists all agents from ~/.claude/agents/ or project-specific agents
   * @param projectPath - Optional project path for project-specific agents
   * @returns Promise resolving to an array of agents
   */
  async listAgents(projectPath?: string): Promise<Agent[]> {
    try {
      // Pass projectPath to get project-specific agents, or empty string for global agents
      return await invoke<Agent[]>('list_agents', {
        projectPath: projectPath || ""
      });
    } catch (error) {
      logger.error("Failed to list agents:", error);
      throw error;
    }
  },

  /**
   * Creates a new agent
   * @param name - The agent name
   * @param system_prompt - The system prompt for the agent
   * @param default_task - Optional default task
   * @param model - Optional model (defaults to 'inherit')
   * @param description - Optional description
   * @param tools - Optional tools list
   * @param color - Optional color
   * @param hooks - Optional hooks configuration as JSON string
   * @returns Promise resolving to the created agent
   */
  async createAgent(
    name: string,
    system_prompt: string,
    default_task?: string,
    model?: string,
    description?: string,
    tools?: string,
    color?: string,
    hooks?: string
  ): Promise<Agent> {
    try {
      return await invoke<Agent>('create_agent', {
        name,
        icon: "🤖", // Temporary default for backend compatibility
        systemPrompt: system_prompt,
        defaultTask: default_task,
        model: model || 'inherit',
        enableFileRead: true,
        enableFileWrite: true,
        enableNetwork: false,
        hooks,
        description: description || null,
        tools: tools || null,
        color: color || null
      });
    } catch (error) {
      logger.error("Failed to create agent:", error);
      throw error;
    }
  },

  /**
   * Updates an existing agent
   * @param id - The agent ID (unused in current implementation)
   * @param name - The updated name
   * @param system_prompt - The updated system prompt
   * @param default_task - Optional default task
   * @param model - Optional model
   * @param description - Optional description
   * @param tools - Optional tools list
   * @param color - Optional color
   * @param hooks - Optional hooks configuration as JSON string
   * @returns Promise resolving to the updated agent
   */
  async updateAgent(
    _id: number,
    name: string,
    system_prompt: string,
    default_task?: string,
    model?: string,
    description?: string,
    tools?: string,
    color?: string,
    hooks?: string
  ): Promise<Agent> {
    try {
      return await invoke<Agent>('update_agent', {
        name,
        icon: "🤖", // Temporary default for backend compatibility
        systemPrompt: system_prompt,
        defaultTask: default_task,
        model: model || 'inherit',
        enableFileRead: true,
        enableFileWrite: true,
        enableNetwork: false,
        hooks,
        description: description || null,
        tools: tools || null,
        color: color || null
      });
    } catch (error) {
      logger.error("Failed to update agent:", error);
      throw error;
    }
  },

  /**
   * Deletes an agent
   * @param id - The agent ID to delete
   * @returns Promise resolving when the agent is deleted
   */
  async deleteAgent(id: number): Promise<void> {
    try {
      // For file-based agents, we need to get the agent name first
      const agents = await this.listAgents();
      const agent = agents.find(a => a.id === id);
      if (!agent) {
        throw new Error('Agent not found');
      }
      return await invoke('delete_agent', { name: agent.name });
    } catch (error) {
      logger.error("Failed to delete agent:", error);
      throw error;
    }
  },

  /**
   * Gets a single agent by ID
   * @param id - The agent ID
   * @returns Promise resolving to the agent
   */
  async getAgent(id: number): Promise<Agent> {
    try {
      // For file-based agents, we need to get the agent by name
      const agents = await this.listAgents();
      const agent = agents.find(a => a.id === id);
      if (!agent) {
        throw new Error('Agent not found');
      }
      return await invoke<Agent>('get_agent', { name: agent.name });
    } catch (error) {
      logger.error("Failed to get agent:", error);
      throw error;
    }
  },

  /**
   * Exports a single agent to JSON format
   * @param id - The agent ID to export
   * @returns Promise resolving to the JSON string
   */
  async exportAgent(id: number): Promise<string> {
    try {
      // For file-based agents, we need to export by name
      const agents = await this.listAgents();
      const agent = agents.find(a => a.id === id);
      if (!agent) {
        throw new Error('Agent not found');
      }
      return await invoke<string>('export_agent', { name: agent.name });
    } catch (error) {
      logger.error("Failed to export agent:", error);
      throw error;
    }
  },

  /**
   * Imports an agent from JSON data
   * @param jsonData - The JSON string containing the agent export
   * @returns Promise resolving to the imported agent
   */
  async importAgent(jsonData: string): Promise<Agent> {
    try {
      return await invoke<Agent>('import_agent', { jsonData });
    } catch (error) {
      logger.error("Failed to import agent:", error);
      throw error;
    }
  },

  /**
   * Imports an agent from a file
   * @param filePath - The path to the JSON file
   * @returns Promise resolving to the imported agent
   */
  async importAgentFromFile(filePath: string): Promise<Agent> {
    try {
      return await invoke<Agent>('import_agent_from_file', { filePath });
    } catch (error) {
      logger.error("Failed to import agent from file:", error);
      throw error;
    }
  },

  /**
   * Fetch list of agents from GitHub repository
   * @returns Promise resolving to list of available agents on GitHub
   */
  async fetchGitHubAgents(): Promise<GitHubAgentFile[]> {
    try {
      return await invoke<GitHubAgentFile[]>('fetch_github_agents');
    } catch (error) {
      logger.error("Failed to fetch GitHub agents:", error);
      throw error;
    }
  },

  /**
   * Fetch and preview a specific agent from GitHub
   * @param downloadUrl - The download URL for the agent file
   * @returns Promise resolving to the agent export data
   */
  async fetchGitHubAgentContent(downloadUrl: string): Promise<AgentExport> {
    try {
      return await invoke<AgentExport>('fetch_github_agent_content', { downloadUrl });
    } catch (error) {
      logger.error("Failed to fetch GitHub agent content:", error);
      throw error;
    }
  },

  /**
   * Import an agent directly from GitHub
   * @param downloadUrl - The download URL for the agent file
   * @returns Promise resolving to the imported agent
   */
  async importAgentFromGitHub(downloadUrl: string): Promise<Agent> {
    try {
      return await invoke<Agent>('import_agent_from_github', { downloadUrl });
    } catch (error) {
      logger.error("Failed to import agent from GitHub:", error);
      throw error;
    }
  },
};