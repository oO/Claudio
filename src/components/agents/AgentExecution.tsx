import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, AlertCircle, Maximize2, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Agent } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ExecutionControlBar } from "@/components/sessions";
import { ICON_MAP as AGENT_ICONS } from "@/components/common";
import { useComponentMetrics } from "@/hooks";
import { useAgentExecution } from "@/hooks/useAgentExecution";
import { useExecutionOutput } from "@/hooks/useExecutionOutput";
import { ExecutionConfig } from "./ExecutionConfig";
import { ExecutionControls } from "./ExecutionControls";
import { ExecutionOutput } from "./ExecutionOutput";
import { FullscreenModal } from "./FullscreenModal";
import { HooksDialog } from "./HooksDialog";

interface AgentExecutionProps {
  /**
   * The agent to execute
   */
  agent: Agent;
  /**
   * Callback to go back to the agents list
   */
  onBack: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * AgentExecution component for running CC agents
 * 
 * @example
 * <AgentExecution agent={agent} onBack={() => setView('list')} />
 */
export const AgentExecution: React.FC<AgentExecutionProps> = ({
  agent,
  onBack,
  className,
}) => {
  // UI State
  const [isHooksDialogOpen, setIsHooksDialogOpen] = useState(false);
  const [activeHooksTab, setActiveHooksTab] = useState("project");
  const [isFullscreenModalOpen, setIsFullscreenModalOpen] = useState(false);
  
  // Analytics tracking
  useComponentMetrics('AgentExecution');
  
  // Agent execution hook
  const {
    isRunning,
    messages,
    displayableMessages,
    rawJsonlOutput,
    error,
    projectPath,
    setProjectPath,
    task,
    setTask,
    model,
    setModel,
    totalTokens,
    elapsedTime,
    handleExecute,
    handleStop,
    cleanupExecution,
    setError,
  } = useAgentExecution({ agent });
  
  // Execution output hook
  const {
    copyPopoverOpen,
    setCopyPopoverOpen,
    scrollContainerRef,
    fullscreenScrollRef,
    messagesEndRef,
    fullscreenMessagesEndRef,
    rowVirtualizer,
    fullscreenRowVirtualizer,
    handleScroll,
    handleCopyAsJsonl,
    handleCopyAsMarkdown,
  } = useExecutionOutput({
    messages: displayableMessages,
    rawJsonlOutput,
    isFullscreenModalOpen,
  });

  const handleBackWithConfirmation = () => {
    if (isRunning) {
      // Show confirmation dialog before navigating away during execution
      const shouldLeave = window.confirm(
        "An agent is currently running. If you navigate away, the agent will continue running in the background. You can view running sessions in the 'Running Sessions' tab within CC Agents.\n\nDo you want to continue?"
      );
      if (!shouldLeave) {
        return;
      }
    }
    
    // Clean up listeners but don't stop the actual agent process
    cleanupExecution();
    
    // Navigate back
    onBack();
  };

  const handleOpenHooksDialog = () => {
    setIsHooksDialogOpen(true);
  };

  const renderIcon = () => {
    const Icon = agent.icon in AGENT_ICONS ? AGENT_ICONS[agent.icon as keyof typeof AGENT_ICONS] : Terminal;
    return <Icon className="h-5 w-5" />;
  };

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Fixed container that takes full height */}
      <div className="h-full flex flex-col">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-background border-b border-border">
          <div className="w-full max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBackWithConfirmation}
                    className="h-8 w-8"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10 text-primary">
                      {renderIcon()}
                    </div>
                    <div>
                      <h1 className="text-xl font-bold">Execute: {agent.name}</h1>
                      <p className="text-sm text-muted-foreground">
                        {model === 'opus' ? 'Claude 4 Opus' : 'Claude 4 Sonnet'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFullscreenModalOpen(true)}
                    disabled={messages.length === 0}
                  >
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Fullscreen
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
        
        {/* Sticky Configuration */}
        <div className="sticky top-[73px] z-10 bg-background border-b border-border">
          <div className="w-full max-w-5xl mx-auto p-4 space-y-4">
            {/* Error display */}
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <ExecutionConfig
              projectPath={projectPath}
              setProjectPath={(path) => {
                setProjectPath(path);
                setError(null); // Clear any previous errors
              }}
              task={task}
              setTask={setTask}
              model={model}
              setModel={setModel}
              isRunning={isRunning}
              onExecute={handleExecute}
              onOpenHooksDialog={handleOpenHooksDialog}
            />

            <div className="flex justify-end">
              <ExecutionControls
                isRunning={isRunning}
                isExecuteDisabled={!projectPath || !task.trim()}
                onExecute={handleExecute}
                onStop={handleStop}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Output Display */}
        <ExecutionOutput
          isRunning={isRunning}
          messages={messages}
          displayableMessages={displayableMessages}
          scrollContainerRef={scrollContainerRef}
          messagesEndRef={messagesEndRef}
          rowVirtualizer={rowVirtualizer}
          onScroll={handleScroll}
        />
      </div>

      {/* Floating Execution Control Bar */}
      <ExecutionControlBar
        isExecuting={isRunning}
        onStop={handleStop}
        totalTokens={totalTokens}
        elapsedTime={elapsedTime}
      />

      {/* Fullscreen Modal */}
      <FullscreenModal
        isOpen={isFullscreenModalOpen}
        onClose={() => setIsFullscreenModalOpen(false)}
        agent={agent}
        isRunning={isRunning}
        messages={messages}
        displayableMessages={displayableMessages}
        fullscreenScrollRef={fullscreenScrollRef}
        fullscreenMessagesEndRef={fullscreenMessagesEndRef}
        fullscreenRowVirtualizer={fullscreenRowVirtualizer}
        copyPopoverOpen={copyPopoverOpen}
        setCopyPopoverOpen={setCopyPopoverOpen}
        onScroll={handleScroll}
        onCopyAsJsonl={handleCopyAsJsonl}
        onCopyAsMarkdown={() => handleCopyAsMarkdown(agent)}
      />

      {/* Hooks Configuration Dialog */}
      <HooksDialog
        isOpen={isHooksDialogOpen}
        onOpenChange={setIsHooksDialogOpen}
        projectPath={projectPath}
        activeTab={activeHooksTab}
        onTabChange={setActiveHooksTab}
      />
    </div>
  );
};