import React, { createContext, useContext } from 'react';

interface SessionContextValue {
  projectId?: string;
  sessionId?: string;
  sessionFilePath?: string;
  isCompactMode?: boolean;
  setIsCompactMode?: (mode: boolean) => void;
  toggleCompactMode?: () => void;
}

interface SessionProviderProps {
  children: React.ReactNode;
  projectId?: string;
  sessionId?: string;
  sessionFilePath?: string;
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
  isCompactMode = false,
  setIsCompactMode,
  toggleCompactMode,
}) => {
  const value: SessionContextValue = {
    projectId,
    sessionId,
    sessionFilePath,
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