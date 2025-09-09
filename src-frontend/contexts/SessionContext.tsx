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

export interface AssistantMessageItem {
  index: number;
  messageId: string;
  messageNumber: number;
  isLastInTurn: boolean;
  isSubAgentTask: boolean;
  isSubAgentResponse: boolean;
}

interface SessionContextValue {
  projectId?: string;
  sessionId?: string;
  sessionFilePath?: string;
  projectPath?: string;
  sessionData?: Session;
  liveSessionType?: SessionTypeValue | null;
  isStreaming?: boolean;
  userMessages?: UserMessageItem[];
  toolMessages?: ToolMessageItem[];
  assistantMessages?: AssistantMessageItem[];
  lastInTurnCount?: number;
  isToolsVisible?: boolean;
  isAssistantFilterLast?: boolean;
  toggleToolsVisibility?: () => void;
  toggleAssistantFilter?: () => void;
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
  userMessages?: UserMessageItem[];
  toolMessages?: ToolMessageItem[];
  assistantMessages?: AssistantMessageItem[];
  lastInTurnCount?: number;
  isToolsVisible?: boolean;
  isAssistantFilterLast?: boolean;
  toggleToolsVisibility?: () => void;
  toggleAssistantFilter?: () => void;
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
  userMessages = [],
  toolMessages = [],
  assistantMessages = [],
  lastInTurnCount = 0,
  isToolsVisible = true,
  isAssistantFilterLast = false,
  toggleToolsVisibility,
  toggleAssistantFilter,
}) => {
  const value: SessionContextValue = {
    projectId,
    sessionId,
    sessionFilePath,
    projectPath,
    sessionData,
    liveSessionType,
    isStreaming,
    userMessages,
    toolMessages,
    assistantMessages,
    lastInTurnCount,
    isToolsVisible,
    isAssistantFilterLast,
    toggleToolsVisibility: toggleToolsVisibility || (() => {}),
    toggleAssistantFilter: toggleAssistantFilter || (() => {}),
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