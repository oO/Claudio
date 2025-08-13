import React from 'react';
import { motion } from 'framer-motion';
import { Hash, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FloatingPromptInput, type FloatingPromptInputRef } from './FloatingPromptInput';
import { SessionQueuedPrompts } from './SessionQueuedPrompts';
import type { QueuedPrompt } from './useSessionState';

interface SessionPromptControlsProps {
  // Prompt input props
  floatingPromptRef: React.RefObject<FloatingPromptInputRef>;
  onSend: (prompt: string, model: "sonnet" | "opus") => void;
  onCancel: () => void;
  isLoading: boolean;
  projectPath: string;
  
  // Queued prompts props
  queuedPrompts: QueuedPrompt[];
  queuedPromptsCollapsed: boolean;
  onToggleQueuedPromptsCollapsed: () => void;
  onRemovePrompt: (id: string) => void;
  
  // Token counter props
  totalTokens: number;
  
  // Navigation props
  displayableMessagesLength: number;
  onNavigateToTop: () => void;
  onNavigateToBottom: () => void;
  
  // Layout props
  showTimeline: boolean;
}

export const SessionPromptControls: React.FC<SessionPromptControlsProps> = ({
  floatingPromptRef,
  onSend,
  onCancel,
  isLoading,
  projectPath,
  queuedPrompts,
  queuedPromptsCollapsed,
  onToggleQueuedPromptsCollapsed,
  onRemovePrompt,
  totalTokens,
  displayableMessagesLength,
  onNavigateToTop,
  onNavigateToBottom,
  showTimeline
}) => {
  return (
    <>
      {/* Queued Prompts Display */}
      <SessionQueuedPrompts
        queuedPrompts={queuedPrompts}
        queuedPromptsCollapsed={queuedPromptsCollapsed}
        onToggleCollapsed={onToggleQueuedPromptsCollapsed}
        onRemovePrompt={onRemovePrompt}
      />

      {/* Navigation Arrows - positioned above prompt bar with spacing */}
      {displayableMessagesLength > 5 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed bottom-20 right-6 z-40 flex flex-col gap-1"
        >
          <div className="flex flex-col gap-1 bg-background/95 backdrop-blur-md border rounded-lg shadow-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateToTop}
              className="h-8 px-2 hover:bg-accent hover:text-accent-foreground"
              title="Go to top"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateToBottom}
              className="h-8 px-2 hover:bg-accent hover:text-accent-foreground"
              title="Go to bottom"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* Floating Prompt Input */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 transition-all duration-300 z-50",
        showTimeline && "sm:right-96"
      )}>
        <FloatingPromptInput
          ref={floatingPromptRef}
          onSend={onSend}
          onCancel={onCancel}
          isLoading={isLoading}
          disabled={!projectPath}
          projectPath={projectPath}
        />
      </div>

      {/* Token Counter - positioned under the Send button */}
      {totalTokens > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
          <div className="max-w-5xl mx-auto">
            <div className="flex justify-end px-4 pb-2">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="bg-background/95 backdrop-blur-md border rounded-full px-3 py-1 shadow-lg pointer-events-auto"
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono">{totalTokens.toLocaleString()}</span>
                  <span className="text-muted-foreground">tokens</span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};