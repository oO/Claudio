import React, { createContext, useContext } from 'react';
import type { Session } from '@/lib/api';
import type { SessionTypeValue } from '@/lib/sessionHandleApi';

interface SessionContextValue {
  projectId?: string;
  sessionId?: string;
  sessionFilePath?: string;
  projectPath?: string;
  sessionData?: Session;
  displayableMessageCount?: number;
  totalTokens?: number;
  liveSessionType?: SessionTypeValue | null;
  isCompactMode?: boolean;
  setIsCompactMode?: (mode: boolean) => void;
  toggleCompactMode?: () => void;
}

interface SessionProviderProps {
  children: React.ReactNode;
  projectId?: string;
  sessionId?: string;
  sessionFilePath?: string;
  projectPath?: string;
  sessionData?: Session;
  displayableMessageCount?: number;
  totalTokens?: number;
  liveSessionType?: SessionTypeValue | null;
  isCompactMode?: boolean;
  setIsCompactMode?: (mode: boolean) => void;
  toggleCompactMode?: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Provider for session-related data that needs to be accessible
 * throughout the message component tree without prop drilling
 */
export const SessionProvider: React.FC<SessionProviderProps> = ({
  children,
  projectId,
  sessionId,
  sessionFilePath,
  projectPath,
  sessionData,
  displayableMessageCount,
  totalTokens,
  liveSessionType,
  isCompactMode = false,
  setIsCompactMode,
  toggleCompactMode,
}) => {
  const value: SessionContextValue = {
    projectId,
    sessionId,
    sessionFilePath,
    projectPath,
    sessionData,
    displayableMessageCount,
    totalTokens,
    liveSessionType,
    isCompactMode,
    setIsCompactMode: setIsCompactMode || (() => {}),
    toggleCompactMode: toggleCompactMode || (() => {}),
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

/**
 * Hook to access session context data
 * Used primarily by MessageFooter for clipboard functionality
 */
export const useSessionContext = (): SessionContextValue => {
  const context = useContext(SessionContext);
  if (context === null) {
    // Return empty object if no provider (graceful degradation)
    return {};
  }
  return context;
};