import { invoke } from "@tauri-apps/api/core";
import { logger } from '@/lib/logger';
import type {
  SlashCommand,
  StorageResult,
} from '@/lib/types/storage';
import type { HooksConfiguration } from '@/types/hooks';

/**
 * Storage API client for data persistence operations
 */
export const storageApi = {
  /**
   * Lists available slash commands
   * @returns Promise resolving to array of slash commands
   */
  async listSlashCommands(): Promise<SlashCommand[]> {
    try {
      return await invoke<SlashCommand[]>("list_slash_commands");
    } catch (error) {
      logger.error("Failed to list slash commands:", error);
      throw error;
    }
  },

  /**
   * Saves a slash command
   * @param command - Command configuration
   * @returns Promise resolving to save result
   */
  async saveSlashCommand(command: SlashCommand): Promise<StorageResult> {
    try {
      return await invoke<StorageResult>("save_slash_command", { command });
    } catch (error) {
      logger.error("Failed to save slash command:", error);
      throw error;
    }
  },

  /**
   * Deletes a slash command
   * @param commandName - Command name to delete
   * @returns Promise resolving to delete result
   */
  async deleteSlashCommand(commandName: string): Promise<StorageResult> {
    try {
      return await invoke<StorageResult>("delete_slash_command", { commandName });
    } catch (error) {
      logger.error("Failed to delete slash command:", error);
      throw error;
    }
  },

  /**
   * Loads hooks configuration
   * @param projectPath - Optional project path for project-specific hooks
   * @returns Promise resolving to hooks configuration
   */
  async loadHooksConfiguration(projectPath?: string): Promise<HooksConfiguration> {
    try {
      return await invoke<HooksConfiguration>("load_hooks_configuration", { projectPath });
    } catch (error) {
      logger.error("Failed to load hooks configuration:", error);
      throw error;
    }
  },

  /**
   * Saves hooks configuration
   * @param config - Hooks configuration
   * @param projectPath - Optional project path for project-specific hooks
   * @returns Promise resolving to save result
   */
  async saveHooksConfiguration(config: HooksConfiguration, projectPath?: string): Promise<StorageResult> {
    try {
      return await invoke<StorageResult>("save_hooks_configuration", { config, projectPath });
    } catch (error) {
      logger.error("Failed to save hooks configuration:", error);
      throw error;
    }
  },

  /**
   * Lists all tables in the database
   * @returns Promise resolving to array of table names
   */
  async listTables(): Promise<string[]> {
    try {
      return await invoke<string[]>("storage_list_tables");
    } catch (error) {
      logger.error("Failed to list tables:", error);
      throw error;
    }
  },

  /**
   * Reads data from a specific table
   * @param tableName - Name of the table to read
   * @returns Promise resolving to table data
   */
  async readTable(tableName: string): Promise<any[]> {
    try {
      return await invoke<any[]>("storage_read_table", { tableName });
    } catch (error) {
      logger.error("Failed to read table:", error);
      throw error;
    }
  },

  /**
   * Updates a row in the database
   * @param tableName - Table name
   * @param rowId - Row ID to update
   * @param data - New row data
   * @returns Promise resolving to update result
   */
  async updateRow(tableName: string, rowId: number, data: Record<string, any>): Promise<StorageResult> {
    try {
      return await invoke<StorageResult>("storage_update_row", { tableName, rowId, data });
    } catch (error) {
      logger.error("Failed to update row:", error);
      throw error;
    }
  },

  /**
   * Deletes a row from the database
   * @param tableName - Table name
   * @param rowId - Row ID to delete
   * @returns Promise resolving to delete result
   */
  async deleteRow(tableName: string, rowId: number): Promise<StorageResult> {
    try {
      return await invoke<StorageResult>("storage_delete_row", { tableName, rowId });
    } catch (error) {
      logger.error("Failed to delete row:", error);
      throw error;
    }
  },

  /**
   * Inserts a new row into the database
   * @param tableName - Table name
   * @param data - Row data to insert
   * @returns Promise resolving to insert result
   */
  async insertRow(tableName: string, data: Record<string, any>): Promise<StorageResult> {
    try {
      return await invoke<StorageResult>("storage_insert_row", { tableName, data });
    } catch (error) {
      logger.error("Failed to insert row:", error);
      throw error;
    }
  },

  /**
   * Executes raw SQL query
   * @param sql - SQL query to execute
   * @returns Promise resolving to query result
   */
  async executeSql(sql: string): Promise<any> {
    try {
      return await invoke<any>("storage_execute_sql", { sql });
    } catch (error) {
      logger.error("Failed to execute SQL:", error);
      throw error;
    }
  },

  /**
   * Resets the entire database
   * @returns Promise resolving to reset result
   */
  async resetDatabase(): Promise<StorageResult> {
    try {
      return await invoke<StorageResult>("storage_reset_database");
    } catch (error) {
      logger.error("Failed to reset database:", error);
      throw error;
    }
  },
};