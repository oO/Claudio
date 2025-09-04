import React from "react";
import { Brain } from "lucide-react";
import { DebugLabel } from "@/components/ui/atoms";
import { useSessionContext } from "@/contexts/SessionContext";
import { SESSION_TYPES } from "@/lib/sessionHandleApi";

interface ThinkingIndicatorProps {
  content: {
    title: string;
    message: string;
  };
}

/**
 * Thinking indicator component for native Claude sessions
 * Uses SessionContext to determine when to show and what session type we're in
 * Displays animated brain icon with random thinking haiku content
 */
export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  content,
}) => {
  const { isStreaming, liveSessionType } = useSessionContext();

  // Only show for native sessions that are currently streaming
  if (!isStreaming || liveSessionType !== SESSION_TYPES.NATIVE) {
    return null;
  }

  return (
    <div className="px-4 pb-4 relative">
      <DebugLabel label="ThinkingIndicator" />
      <div className="relative bg-accent border rounded-lg">
        <div className="p-3">
          <div className="flex items-start gap-3">
            {/* Icon with consistent MessageTemplate styling - matches SessionHeader brain */}
            <div className="rounded-full p-2 flex items-center justify-center -mt-1 -ml-1 bg-background text-foreground">
              <Brain className="h-4 w-4 animate-pulse" />
            </div>

            {/* Content wrapper matching MessageTemplate */}
            <div className="flex-1 min-w-0">
              {/* Title */}
              <span className="font-semibold text-foreground">
                {content.title}
              </span>

              {/* Haiku content */}
              <h1 className="text-accent animate-pulse text-lg italic font-serif text-center">
                {content.message}
              </h1>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
