import React, { createContext, useContext } from 'react';
import type { Session } from '@/lib/types/sessions';
import type { SessionTypeValue } from '@/lib/sessionHandleApi';

export interface UserMessageItem {
  index: number;
  content: string;
  ui_index: number;
}

export interface ToolMessageItem {
  index: number;
  toolName: string;
  ui_index: number;
}

export interface AssistantMessageItem {
  index: number;
  messageId: string;
  ui_index: number;
  isLastInTurn: boolean;
  isSubAgentTask: boolean;
  isSubAgentResponse: boolean;
}

export interface SystemMessageItem {
  index: number;
  content: string;
  ui_index: number;
  subtype?: string;
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
  systemMessages?: SystemMessageItem[];
  lastInTurnCount?: number;
  isToolsVisible?: boolean;
  isSystemVisible?: boolean;
  isAssistantFilterLast?: boolean;
  toggleToolsVisibility?: () => void;
  toggleSystemVisibility?: () => void;
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
  systemMessages?: SystemMessageItem[];
  lastInTurnCount?: number;
  isToolsVisible?: boolean;
  isSystemVisible?: boolean;
  isAssistantFilterLast?: boolean;
  toggleToolsVisibility?: () => void;
  toggleSystemVisibility?: () => void;
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
  systemMessages = [],
  lastInTurnCount = 0,
  isToolsVisible = true,
  isSystemVisible = false,
  isAssistantFilterLast = false,
  toggleToolsVisibility,
  toggleSystemVisibility,
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
    systemMessages,
    lastInTurnCount,
    isToolsVisible,
    isSystemVisible,
    isAssistantFilterLast,
    toggleToolsVisibility: toggleToolsVisibility || (() => {}),
    toggleSystemVisibility: toggleSystemVisibility || (() => {}),
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