import { useCallback } from 'react';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';

export interface SessionCreationOptions {
  projectPath: string;
  settings?: Record<string, any>;
}

/**
 * Hook for creating new Claudio sessions with consistent logic
 * Centralized to avoid duplication between App.tsx and ProjectsTab.tsx
 */
export const useSessionCreation = () => {
  const createClaudioSession = useCallback(async (options: SessionCreationOptions): Promise<string> => {
    try {
      const claudioId = await api.createClaudioSession(options.projectPath, options.settings || {});
      return claudioId;
    } catch (error) {
      logger.error("Failed to create Claudio session:", error);
      throw error;
    }
  }, []);

  return {
    createClaudioSession,
  };
};