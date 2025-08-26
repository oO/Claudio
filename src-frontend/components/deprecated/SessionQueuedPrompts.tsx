import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { DebugLabel } from '@/components/ui/atoms';

interface QueuedPrompt {
  id: string;
  prompt: string;
  model: "sonnet" | "opus";
}

interface SessionQueuedPromptsProps {
  queuedPrompts: QueuedPrompt[];
  queuedPromptsCollapsed: boolean;
  onToggleCollapsed: () => void;
  onRemovePrompt: (id: string) => void;
}

export const SessionQueuedPrompts: React.FC<SessionQueuedPromptsProps> = ({
  queuedPrompts,
  queuedPromptsCollapsed,
  onToggleCollapsed,
  onRemovePrompt,
}) => {
  if (queuedPrompts.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="relative fixed bottom-24 left-1/2 -translate-x-1/2 z-30 w-full max-w-3xl px-4"
      >
        <DebugLabel label="SessionQueuedPrompts" />
        <div className="bg-background/95 backdrop-blur-md border rounded-lg shadow-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Queued Prompts ({queuedPrompts.length})
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onToggleCollapsed}
              className="h-6 w-6"
            >
              {queuedPromptsCollapsed ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </div>
          
          {!queuedPromptsCollapsed && (
            <div className="space-y-2">
              {queuedPrompts.map((queuedPrompt, index) => (
                <motion.div
                  key={queuedPrompt.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-start gap-2 bg-muted/50 rounded-md p-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                        {queuedPrompt.model === "opus" ? "Opus" : "Sonnet"}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2 break-words">
                      {queuedPrompt.prompt}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => onRemovePrompt(queuedPrompt.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SessionQueuedPrompts;