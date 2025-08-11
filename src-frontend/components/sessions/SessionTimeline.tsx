import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { TimelineNavigator } from './TimelineNavigator';
import { DebugLabel } from '@/components/ui/atoms';
import type { Session } from '@/lib/api';

interface SessionTimelineProps {
  showTimeline: boolean;
  onToggleTimeline: (show: boolean) => void;
  effectiveSession: Session | null;
  projectPath: string;
  currentMessageIndex: number;
  timelineVersion: number;
  onCheckpointSelect: () => Promise<void>;
  onFork: (checkpointId: string) => void;
  onCheckpointCreated: () => void;
}

export const SessionTimeline: React.FC<SessionTimelineProps> = ({
  showTimeline,
  onToggleTimeline,
  effectiveSession,
  projectPath,
  currentMessageIndex,
  timelineVersion,
  onCheckpointSelect,
  onFork,
  onCheckpointCreated,
}) => {
  return (
    <>
      <DebugLabel label="SessionTimeline" />
      <AnimatePresence>
        {showTimeline && effectiveSession && (
          <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="relative fixed right-0 top-0 h-full w-full sm:w-96 bg-background border-l border-border shadow-xl z-30 overflow-hidden"
        >
          <div className="h-full flex flex-col">
            {/* Timeline Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold">Session Timeline</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onToggleTimeline(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Timeline Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <TimelineNavigator
                sessionId={effectiveSession.id}
                projectId={effectiveSession.project_id}
                projectPath={projectPath}
                currentMessageIndex={currentMessageIndex}
                onCheckpointSelect={onCheckpointSelect}
                onFork={onFork}
                onCheckpointCreated={onCheckpointCreated}
                refreshVersion={timelineVersion}
              />
            </div>
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SessionTimeline;