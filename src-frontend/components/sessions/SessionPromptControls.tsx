import React from 'react';
import { motion } from 'framer-motion';
import { Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SimplePromptInput, type SimplePromptInputRef } from './SimplePromptInput';
import { SessionQueuedPrompts } from './SessionQueuedPrompts';
import type { QueuedPrompt } from '@/hooks/useSessionState';

interface SessionPromptControlsProps {
  // Prompt input props
  promptRef: React.RefObject<SimplePromptInputRef>;
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
  
  
  // Layout props
  showTimeline: boolean;
}

export const SessionPromptControls: React.FC<SessionPromptControlsProps> = ({
  promptRef,
  onSend,
  onCancel,
  isLoading,
  projectPath,
  queuedPrompts,
  queuedPromptsCollapsed,
  onToggleQueuedPromptsCollapsed,
  onRemovePrompt,
  totalTokens,
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


      {/* Simple Prompt Input */}
      <SimplePromptInput
        ref={promptRef}
        onSend={onSend}
        onCancel={onCancel}
        isLoading={isLoading}
        disabled={!projectPath}
        projectPath={projectPath}
      />
      
      {/* Token Counter */}
      {totalTokens > 0 && (
        <div className="border-t bg-muted/20 px-4 py-2">
          <div className="max-w-5xl mx-auto flex justify-end">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-background border rounded-full px-3 py-1 text-xs text-muted-foreground"
            >
              <div className="flex items-center gap-1.5">
                <Hash className="h-3 w-3" />
                <span className="font-mono">{totalTokens.toLocaleString()}</span>
                <span>tokens</span>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </>
  );
};