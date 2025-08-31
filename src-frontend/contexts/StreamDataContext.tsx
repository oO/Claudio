import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ClaudeStreamMessage } from "@/lib/outputCache";

interface StreamDataContextValue {
  streamMessages: ClaudeStreamMessage[];
  toolResults: Map<string, any>;
  getToolResult: (toolId: string | undefined) => any;
}

interface StreamDataProviderProps {
  children: React.ReactNode;
  streamMessages: ClaudeStreamMessage[];
}

const StreamDataContext = createContext<StreamDataContextValue | null>(null);

/**
 * Provider for stream-related data like tool results that need to be
 * accessible throughout the message component tree
 */
export const StreamDataProvider: React.FC<StreamDataProviderProps> = ({
  children,
  streamMessages,
}) => {
  // State to track tool results mapped by tool call ID
  const [toolResults, setToolResults] = useState<Map<string, any>>(new Map());

  // Extract all tool results from stream messages
  useEffect(() => {
    const results = new Map<string, any>();

    // Iterate through all messages to find tool results
    streamMessages.forEach((msg) => {
      if (
        msg.type === "user" &&
        msg.message?.content &&
        Array.isArray(msg.message.content)
      ) {
        msg.message.content.forEach((content: any) => {
          if (content.type === "tool_result" && content.tool_use_id) {
            results.set(content.tool_use_id, content);
          }
        });
      }
    });

    setToolResults(results);
  }, [streamMessages]);

  // Helper to get tool result for a specific tool call ID
  const getToolResult = (toolId: string | undefined): any => {
    if (!toolId) return null;
    return toolResults.get(toolId) || null;
  };

  const value: StreamDataContextValue = {
    streamMessages,
    toolResults,
    getToolResult,
  };

  return (
    <StreamDataContext.Provider value={value}>
      {children}
    </StreamDataContext.Provider>
  );
};

/**
 * Hook to access stream data context
 * Used by components that need tool results or stream message data
 */
export const useStreamData = (): StreamDataContextValue => {
  const context = useContext(StreamDataContext);
  if (context === null) {
    throw new Error('useStreamData must be used within a StreamDataProvider');
  }
  return context;
};