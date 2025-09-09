import React, { createContext, useContext } from 'react';
import type { Session } from '@/lib/api';
import type { SessionTypeValue } from '@/lib/sessionHandleApi';

export interface UserMessageItem {
  index: number;
  content: string;
  messageNumber: number;
}

export interface ToolMessageItem {
  index: number;
  toolName: string;
  messageNumber: number;
}

interface SessionContextValue {
  projectId?: string;
  sessionId?: string;
  sessionFilePath?: string;
  projectPath?: string;
  sessionData?: Session;
  liveSessionType?: SessionTypeValue | null;
  isStreaming?: boolean;
  isCompactMode?: boolean;
  setIsCompactMode?: (mode: boolean) => void;
  toggleCompactMode?: () => void;
  userMessages?: UserMessageItem[];
  toolMessages?: ToolMessageItem[];
  isToolsVisible?: boolean;
  toggleToolsVisibility?: () => void;
}

interface SessionProviderProps {
  children: React.ReactNode;
  projectId?: string;
  sessionId?: string;
  sessionFilePath?: string;
  projectPath?: string;
  sessionData?: Session;
  liveSessionType?: SessionTypeValue | null;
  isStreaming?: boolean;
  isCompactMode?: boolean;
  setIsCompactMode?: (mode: boolean) => void;
  toggleCompactMode?: () => void;
  userMessages?: UserMessageItem[];
  toolMessages?: ToolMessageItem[];
  isToolsVisible?: boolean;
  toggleToolsVisibility?: () => void;
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
  liveSessionType,
  isStreaming = false,
  isCompactMode = false,
  setIsCompactMode,
  toggleCompactMode,
  userMessages = [],
  toolMessages = [],
  isToolsVisible = true,
  toggleToolsVisibility,
}) => {
  const value: SessionContextValue = {
    projectId,
    sessionId,
    sessionFilePath,
    projectPath,
    sessionData,
    liveSessionType,
    isStreaming,
    isCompactMode,
    setIsCompactMode: setIsCompactMode || (() => {}),
    toggleCompactMode: toggleCompactMode || (() => {}),
    userMessages,
    toolMessages,
    isToolsVisible,
    toggleToolsVisibility: toggleToolsVisibility || (() => {}),
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
 * Throws error if used outside of SessionProvider
 */
export const useSessionContext = (): SessionContextValue => {
  const context = useContext(SessionContext);
  if (context === null) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
};