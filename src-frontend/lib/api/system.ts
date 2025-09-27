import { invoke } from "@tauri-apps/api/core";
import { logger } from '@/lib/logger';
import type {
  WindowState,
  SystemMemoryInfo,
  FileEntry,
  ProcessInfo,
} from '@/lib/types/system';

/**
 * System API client for system operations
 */
export const systemApi = {
  /**
   * Gets system memory information
   * @returns Promise resolving to memory info
   */
  async getSystemMemoryInfo(): Promise<SystemMemoryInfo> {
    try {
      return await invoke<SystemMemoryInfo>("get_system_memory_info");
    } catch (error) {
      logger.error("Failed to get system memory info:", error);
      throw error;
    }
  },

  /**
   * Lists directory contents
   * @param dirPath - Directory path to list
   * @returns Promise resolving to array of file entries
   */
  async listDirectory(dirPath: string): Promise<FileEntry[]> {
    try {
      return await invoke<FileEntry[]>("list_directory", { dirPath });
    } catch (error) {
      logger.error("Failed to list directory:", error);
      throw error;
    }
  },

  /**
   * Gets current running processes
   * @returns Promise resolving to array of process info
   */
  async getRunningProcesses(): Promise<ProcessInfo[]> {
    try {
      return await invoke<ProcessInfo[]>("get_running_processes");
    } catch (error) {
      logger.error("Failed to get running processes:", error);
      throw error;
    }
  },

  /**
   * Saves window state
   * @param state - Window state to save
   * @returns Promise resolving when saved
   */
  async saveWindowState(state: WindowState): Promise<void> {
    try {
      return await invoke("save_window_state", { state });
    } catch (error) {
      logger.error("Failed to save window state:", error);
      throw error;
    }
  },

  /**
   * Loads window state
   * @returns Promise resolving to window state
   */
  async loadWindowState(): Promise<WindowState> {
    try {
      return await invoke<WindowState>("load_window_state");
    } catch (error) {
      logger.error("Failed to load window state:", error);
      throw error;
    }
  },

  /**
   * Restores window state from saved settings
   * @returns Promise resolving when window state is restored
   */
  async restoreWindowState(): Promise<void> {
    try {
      return await invoke("restore_window_state");
    } catch (error) {
      logger.error("Failed to restore window state:", error);
      throw error;
    }
  },

  /**
   * Gets current window state
   * @returns Promise resolving to current window state
   */
  async getCurrentWindowState(): Promise<WindowState> {
    try {
      return await invoke<WindowState>("get_current_window_state");
    } catch (error) {
      logger.error("Failed to get current window state:", error);
      throw error;
    }
  },

  /**
   * Loads a Claudio app setting
   * @param key - Setting key
   * @returns Promise resolving to setting value
   */
  async loadClaudioAppSetting<T>(key: string): Promise<T | null> {
    try {
      return await invoke<T | null>("load_claudio_app_setting", { key });
    } catch (error) {
      logger.error("Failed to load Claudio app setting:", error);
      throw error;
    }
  },

  /**
   * Saves a Claudio app setting
   * @param key - Setting key
   * @param value - Setting value
   * @returns Promise resolving when saved
   */
  async saveClaudioAppSetting<T>(key: string, value: T): Promise<void> {
    try {
      return await invoke("save_claudio_app_setting", { key, value });
    } catch (error) {
      logger.error("Failed to save Claudio app setting:", error);
      throw error;
    }
  },

  /**
   * Creates a Claudio session
   * @param projectPath - Project path
   * @param settings - Session settings
   * @returns Promise resolving to session ID
   */
  async createClaudioSession(projectPath: string, settings: any): Promise<string> {
    try {
      return await invoke<string>("create_claudio_session", { projectPath, settings });
    } catch (error) {
      logger.error("Failed to create Claudio session:", error);
      throw error;
    }
  },

  /**
   * Lists directory contents
   * @param dirPath - Directory path
   * @returns Promise resolving to file entries
   */
  async listDirectoryContents(dirPath: string): Promise<FileEntry[]> {
    try {
      return await invoke<FileEntry[]>("list_directory_contents", { dirPath });
    } catch (error) {
      logger.error("Failed to list directory contents:", error);
      throw error;
    }
  },

  /**
   * Searches files
   * @param query - Search query
   * @param path - Path to search in
   * @returns Promise resolving to file entries
   */
  async searchFiles(query: string, path?: string): Promise<FileEntry[]> {
    try {
      return await invoke<FileEntry[]>("search_files", { query, path });
    } catch (error) {
      logger.error("Failed to search files:", error);
      throw error;
    }
  },
};