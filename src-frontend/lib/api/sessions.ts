import { invoke } from "@tauri-apps/api/core";
import { logger } from '@/lib/logger';
import type {
  DecoratedSession,
  SessionWithContent,
  SessionDeletionResult,
} from '@/lib/types/sessions';

/**
 * Sessions API client for session management operations
 */
export const sessionsApi = {
  /**
   * Retrieves sessions for a specific project
   * @param projectId - The ID of the project to retrieve sessions for
   * @returns Promise resolving to an array of sessions
   */
  async getProjectSessions(projectId: string): Promise<DecoratedSession[]> {
    try {
      return await invoke<DecoratedSession[]>('get_project_sessions', { projectId });
    } catch (error) {
      logger.error("Failed to get project sessions:", error);
      throw error;
    }
  },

  /**
   * Loads session history with full content
   * @param sessionId - The session ID
   * @param projectId - The project ID
   * @returns Promise resolving to session with content
   */
  async loadSessionHistory(sessionId: string, projectId: string): Promise<SessionWithContent> {
    try {
      return await invoke<SessionWithContent>('load_session_history', { sessionId, projectId });
    } catch (error) {
      logger.error("Failed to load session history:", error);
      throw error;
    }
  },

  /**
   * Loads agent session history (searches across all projects)
   * @param sessionId - The session ID
   * @returns Promise resolving to session messages and file path
   */
  async loadAgentSessionHistory(sessionId: string): Promise<{messages: any[], session_file_path: string}> {
    try {
      return await invoke('load_agent_session_history', { sessionId });
    } catch (error) {
      logger.error("Failed to load agent session history:", error);
      throw error;
    }
  },

  /**
   * Deletes a specific session from a project and all associated data
   * @param projectId - The project ID (encoded directory name)
   * @param sessionId - The session ID (UUID)
   * @returns Promise resolving to deletion summary
   */
  async deleteSession(projectId: string, sessionId: string): Promise<SessionDeletionResult> {
    try {
      return await invoke("delete_session", { projectId, sessionId });
    } catch (error) {
      logger.error("Failed to delete session:", error);
      throw error;
    }
  },

  /**
   * Deletes sessions older than specified days
   * @param projectId - The project ID
   * @param daysOld - Delete sessions older than this many days
   * @returns Promise resolving to deletion summary
   */
  async deleteSessionsByAge(projectId: string, daysOld: number): Promise<{
    success: boolean;
    project_id: string;
    sessions_deleted: number;
    claudio_sessions_deleted: number;
    todos_deleted: number;
    timelines_deleted: number;
    size_mb: number;
    message: string;
  }> {
    try {
      return await invoke("delete_sessions_by_age", { projectId, daysOld });
    } catch (error) {
      logger.error("Failed to delete sessions by age:", error);
      throw error;
    }
  },

  /**
   * Deletes session metadata
   * @param sessionId - The session ID
   * @param projectPath - The project path
   * @returns Promise resolving to success status
   */
  async deleteSessionMetadata(sessionId: string, projectPath: string): Promise<boolean> {
    try {
      return await invoke("delete_session_metadata", { sessionId, projectPath });
    } catch (error) {
      logger.error("Failed to delete session metadata:", error);
      throw error;
    }
  },
};