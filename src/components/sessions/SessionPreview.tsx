import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SplitPane } from '@/components/ui/split-pane';
import { WebviewPreview } from '@/components/common';
import { DebugLabel } from '@/components/ui/atoms';

interface SessionPreviewProps {
  showPreview: boolean;
  previewUrl: string;
  showPreviewPrompt: boolean;
  splitPosition: number;
  isPreviewMaximized: boolean;
  onClose: () => void;
  onToggleMaximize: () => void;
  onUrlChange: (url: string) => void;
  onSplitChange: (position: number) => void;
  onShowPreviewPrompt: (show: boolean) => void;
  children: React.ReactNode; // The main session content
}

export const SessionPreview: React.FC<SessionPreviewProps> = ({
  showPreview,
  previewUrl,
  showPreviewPrompt,
  splitPosition,
  isPreviewMaximized,
  onClose,
  onToggleMaximize,
  onUrlChange,
  onSplitChange,
  onShowPreviewPrompt,
  children,
}) => {
  // Handle URL detection from terminal output
  const handleLinkDetected = (url: string) => {
    if (!showPreview && !showPreviewPrompt) {
      onUrlChange(url);
      onShowPreviewPrompt(true);
    }
  };

  // If preview is maximized, render only the WebviewPreview in full screen
  if (showPreview && isPreviewMaximized) {
    return (
      <>
        <DebugLabel label="SessionPreview" />
        <AnimatePresence>
        <motion.div 
          className="relative fixed inset-0 z-50 bg-background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <WebviewPreview
            initialUrl={previewUrl}
            onClose={onClose}
            isMaximized={isPreviewMaximized}
            onToggleMaximize={onToggleMaximize}
            onUrlChange={onUrlChange}
            className="h-full"
          />
        </motion.div>
      </AnimatePresence>
      </>
    );
  }

  // Render with split pane when preview is active but not maximized
  if (showPreview) {
    return (
      <>
        <DebugLabel label="SessionPreview" />
        <SplitPane
        className="relative"
        left={
          <div className="h-full">
            {/* Pass link detection handler to children */}
            {React.cloneElement(children as React.ReactElement, {
              onLinkDetected: handleLinkDetected
            })}
          </div>
        }
        right={
          <WebviewPreview
            initialUrl={previewUrl}
            onClose={onClose}
            isMaximized={isPreviewMaximized}
            onToggleMaximize={onToggleMaximize}
            onUrlChange={onUrlChange}
          />
        }
        initialSplit={splitPosition}
        onSplitChange={onSplitChange}
        minLeftWidth={400}
        minRightWidth={400}
        className="h-full"
      />
      </>
    );
  }

  // Render without preview (normal layout)
  return (
    <>
      <DebugLabel label="SessionPreview" />
      <div className="relative h-full">
      {/* Pass link detection handler to children */}
      {React.cloneElement(children as React.ReactElement, {
        onLinkDetected: handleLinkDetected
      })}
    </div>
    </>
  );
};

export default SessionPreview;