import React from 'react';
import { PromptInput, type PromptInputRef } from '../sessions/PromptInput';
import { SessionQueuedPrompts } from './SessionQueuedPrompts';
import type { QueuedPrompt } from '@/hooks/useSessionState';
import { DebugLabel } from '@/components/ui/atoms';

interface SessionPromptControlsProps {
  // Prompt input props
  promptRef: React.RefObject<PromptInputRef>;
  onSend: (prompt: string, model: "sonnet" | "opus") => void;
  onCancel: () => void;
  isLoading: boolean;
  projectPath: string;
  
  // Queued prompts props
  queuedPrompts: QueuedPrompt[];
  queuedPromptsCollapsed: boolean;
  onToggleQueuedPromptsCollapsed: () => void;
  onRemovePrompt: (id: string) => void;
  
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
  showTimeline
}) => {
  return (
    <div className="relative">
      <DebugLabel label="SessionPromptControls" />
      {/* Queued Prompts Display */}
      <SessionQueuedPrompts
        queuedPrompts={queuedPrompts}
        queuedPromptsCollapsed={queuedPromptsCollapsed}
        onToggleCollapsed={onToggleQueuedPromptsCollapsed}
        onRemovePrompt={onRemovePrompt}
      />


      {/* Main Prompt Input */}
      <PromptInput
        ref={promptRef}
        onSend={onSend}
        onCancel={onCancel}
        isLoading={isLoading}
        disabled={!projectPath}
        projectPath={projectPath}
      />
    </div>
  );
};