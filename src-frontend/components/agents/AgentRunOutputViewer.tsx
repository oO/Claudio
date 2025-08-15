import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Toast, ToastContainer } from '@/components/ui/toast';
import { Popover } from '@/components/ui/popover';
import { api, type AgentRunWithMetrics } from '@/lib/api';
import { useOutputCache } from '@/lib/outputCache';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { MessageRouter } from '@/components/messages';
import { ErrorBoundary, ICON_MAP as AGENT_ICONS } from '@/components/common';
import { formatISOTimestamp } from '@/lib/date-utils';
import type { ClaudeStreamMessage } from '@/hooks/useAgentExecution';
import { useTabState } from '@/hooks/useTabState';

// Atomic Design Components
import { LoadingSpinner } from '@/components/ui/atoms/LoadingSpinner';
import { ExecutionStatusBadge, type ExecutionStatus } from '@/components/ui/atoms/ExecutionStatusBadge';
import { ExecutionControlPanel } from '@/components/ui/organisms/ExecutionControlPanel';
import { OutputViewer } from '@/components/ui/organisms/OutputViewer';
import { FullscreenOutputModal } from '@/components/ui/organisms/FullscreenOutputModal';

interface AgentRunOutputViewerProps {
  /**
   * The agent run ID to display
   */
  agentRunId: string;
  /**
   * Tab ID for this agent run
   */
  tabId: string;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * AgentRunOutputViewer - Modal component for viewing agent execution output
 * 
 * @example
 * <AgentRunOutputViewer
 *   run={agentRun}
 *   onClose={() => setSelectedRun(null)}
 * />
 */
export function AgentRunOutputViewer({ 
  agentRunId, 
  tabId,
  className 
}: AgentRunOutputViewerProps) {
  const { updateTabTitle, updateTabStatus } = useTabState();
  const [run, setRun] = useState<AgentRunWithMetrics | null>(null);
  const [messages, setMessages] = useState<ClaudeStreamMessage[]>([]);
  const [rawJsonlOutput, setRawJsonlOutput] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [copyPopoverOpen, setCopyPopoverOpen] = useState(false);
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  
  // Track whether we're in the initial load phase
  const isInitialLoadRef = useRef(true);
  const hasSetupListenersRef = useRef(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const { getCachedOutput, setCachedOutput } = useOutputCache();
  
  // Derive execution status from run
  const executionStatus: ExecutionStatus = run?.status === 'running' ? 'running' :
    run?.status === 'failed' ? 'failed' :
    run?.status === 'cancelled' ? 'cancelled' :
    run?.status === 'completed' ? 'completed' : 'idle';

  // Auto-scroll logic
  const isAtBottom = () => {
    const container = scrollAreaRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      return distanceFromBottom < 1;
    }
    return true;
  };

  const scrollToBottom = () => {
    if (!hasUserScrolled) {
      const endRef = outputEndRef.current;
      if (endRef) {
        endRef.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // Load agent run on mount
  useEffect(() => {
    const loadAgentRun = async () => {
      try {
        setLoading(true);
        const agentRun = await api.getAgentRun(parseInt(agentRunId));
        setRun(agentRun);
        updateTabTitle(tabId, `Agent: ${agentRun.agent_name || 'Unknown'}`);
        updateTabStatus(tabId, agentRun.status === 'running' ? 'running' : agentRun.status === 'failed' ? 'error' : 'complete');
      } catch (error) {
        updateTabStatus(tabId, 'error');
      } finally {
        setLoading(false);
      }
    };
    
    if (agentRunId) {
      loadAgentRun();
    }
  }, [agentRunId, tabId, updateTabTitle, updateTabStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
      hasSetupListenersRef.current = false;
    };
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    const shouldAutoScroll = !hasUserScrolled || isAtBottom();
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }, [messages, hasUserScrolled, isFullscreen]);

  const loadOutput = async (skipCache = false) => {
    if (!run?.id) return;


    try {
      // Check cache first if not skipping cache
      if (!skipCache) {
        const cached = getCachedOutput(run.id);
        if (cached) {
          const cachedJsonlLines = cached.output.split('\n').filter(line => line.trim());
          setRawJsonlOutput(cachedJsonlLines);
          setMessages(cached.messages);
          // If cache is recent (less than 5 seconds old) and session isn't running, use cache only
          if (Date.now() - cached.lastUpdated < 5000 && run.status !== 'running') {
            return;
          }
        }
      }

      setLoading(true);

      // If we have a session_id, try to load from JSONL file first
      if (run.session_id && run.session_id !== '') {
        try {
          const history = await api.loadAgentSessionHistory(run.session_id);
          
          // Convert history to messages format
          const loadedMessages: ClaudeStreamMessage[] = history.map(entry => ({
            ...entry,
            type: entry.type || "assistant"
          }));
          
          setMessages(loadedMessages);
          setRawJsonlOutput(history.map(h => JSON.stringify(h)));
          
          // Update cache
          setCachedOutput(run.id, {
            output: history.map(h => JSON.stringify(h)).join('\n'),
            messages: loadedMessages,
            lastUpdated: Date.now(),
            status: run.status
          });
          
          // Set up live event listeners for running sessions
          if (run.status === 'running') {
            setupLiveEventListeners();
            
            try {
              await api.streamSessionOutput(run.id);
            } catch (streamError) {
            }
          }
          
          return;
        } catch (err) {
        }
      } else {
      }

      // Fallback to the original method if JSONL loading fails or no session_id
      const rawOutput = await api.getSessionOutput(run.id);
      
      // Parse JSONL output into messages
      const jsonlLines = rawOutput.split('\n').filter(line => line.trim());
      setRawJsonlOutput(jsonlLines);
      
      const parsedMessages: ClaudeStreamMessage[] = [];
      for (const line of jsonlLines) {
        try {
          const message = JSON.parse(line) as ClaudeStreamMessage;
          parsedMessages.push(message);
        } catch (err) {
          console.error("[AgentRunOutputViewer] Failed to parse message:", err, line);
        }
      }
      setMessages(parsedMessages);
      
      // Update cache
      setCachedOutput(run.id, {
        output: rawOutput,
        messages: parsedMessages,
        lastUpdated: Date.now(),
        status: run.status
      });
      
      // Set up live event listeners for running sessions
      if (run.status === 'running') {
        setupLiveEventListeners();
        
        try {
          await api.streamSessionOutput(run.id);
        } catch (streamError) {
        }
      }
    } catch (error) {
      console.error('Failed to load agent output:', error);
      setToast({ message: 'Failed to load agent output', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Set up live event listeners for running sessions
  const setupLiveEventListeners = async () => {
    if (!run?.id || hasSetupListenersRef.current) return;
    
    try {
      // Clean up existing listeners
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];

      // Mark that we've set up listeners
      hasSetupListenersRef.current = true;
      
      // After setup, we're no longer in initial load
      // Small delay to ensure any pending messages are processed
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 100);

      // Set up live event listeners with run ID isolation
      const outputUnlisten = await listen<string>(`agent-output:${run!.id}`, (event) => {
        try {
          // Skip messages during initial load phase
          if (isInitialLoadRef.current) {
            return;
          }
          
          // Store raw JSONL
          setRawJsonlOutput(prev => [...prev, event.payload]);
          
          // Parse and display
          const message = JSON.parse(event.payload) as ClaudeStreamMessage;
          setMessages(prev => [...prev, message]);
        } catch (err) {
          console.error("[AgentRunOutputViewer] Failed to parse message:", err, event.payload);
        }
      });

      const errorUnlisten = await listen<string>(`agent-error:${run!.id}`, (event) => {
        console.error("[AgentRunOutputViewer] Agent error:", event.payload);
        setToast({ message: event.payload, type: 'error' });
      });

      const completeUnlisten = await listen<boolean>(`agent-complete:${run!.id}`, () => {
        setToast({ message: 'Agent execution completed', type: 'success' });
        // Don't set status here as the parent component should handle it
      });

      const cancelUnlisten = await listen<boolean>(`agent-cancelled:${run!.id}`, () => {
        setToast({ message: 'Agent execution was cancelled', type: 'error' });
      });

      unlistenRefs.current = [outputUnlisten, errorUnlisten, completeUnlisten, cancelUnlisten];
    } catch (error) {
    }
  };

  // Copy functionality
  const handleCopyAsJsonl = async () => {
    const jsonl = rawJsonlOutput.join('\n');
    await navigator.clipboard.writeText(jsonl);
    setCopyPopoverOpen(false);
    setToast({ message: 'Output copied as JSONL', type: 'success' });
  };

  const handleCopyAsMarkdown = async () => {
    if (!run) return;
    let markdown = `# Agent Execution: ${run.agent_name}\n\n`;
    markdown += `**Task:** ${run.task}\n`;
    markdown += `**Model:** ${run.model === 'opus' ? 'Claude 4 Opus' : 'Claude 4 Sonnet'}\n`;
    markdown += `**Date:** ${formatISOTimestamp(run.created_at)}\n`;
    if (run.metrics?.duration_ms) markdown += `**Duration:** ${(run.metrics.duration_ms / 1000).toFixed(2)}s\n`;
    if (run.metrics?.total_tokens) markdown += `**Total Tokens:** ${run.metrics.total_tokens}\n`;
    if (run.metrics?.cost_usd) markdown += `**Cost:** $${run.metrics.cost_usd.toFixed(4)} USD\n`;
    markdown += `\n---\n\n`;

    for (const msg of messages) {
      if (msg.type === "system" && msg.subtype === "init") {
        markdown += `## System Initialization\n\n`;
        markdown += `- Session ID: \`${msg.session_id || 'N/A'}\`\n`;
        markdown += `- Model: \`${msg.model || 'default'}\`\n`;
        if (msg.cwd) markdown += `- Working Directory: \`${msg.cwd}\`\n`;
        if (msg.tools?.length) markdown += `- Tools: ${msg.tools.join(', ')}\n`;
        markdown += `\n`;
      } else if (msg.type === "assistant" && msg.message) {
        markdown += `## Assistant\n\n`;
        for (const content of msg.message.content || []) {
          if (content.type === "text") {
            markdown += `${content.text}\n\n`;
          } else if (content.type === "tool_use") {
            markdown += `### Tool: ${content.name}\n\n`;
            markdown += `\`\`\`json\n${JSON.stringify(content.input, null, 2)}\n\`\`\`\n\n`;
          }
        }
        if (msg.message.usage) {
          markdown += `*Tokens: ${msg.message.usage.input_tokens} in, ${msg.message.usage.output_tokens} out*\n\n`;
        }
      } else if (msg.type === "user" && msg.message) {
        markdown += `## User\n\n`;
        for (const content of msg.message.content || []) {
          if (content.type === "text") {
            markdown += `${content.text}\n\n`;
          } else if (content.type === "tool_result") {
            markdown += `### Tool Result\n\n`;
            markdown += `\`\`\`\n${content.content}\n\`\`\`\n\n`;
          }
        }
      } else if (msg.type === "result") {
        markdown += `## Execution Result\n\n`;
        if (msg.result) {
          markdown += `${msg.result}\n\n`;
        }
        if (msg.error) {
          markdown += `**Error:** ${msg.error}\n\n`;
        }
      }
    }

    await navigator.clipboard.writeText(markdown);
    setCopyPopoverOpen(false);
    setToast({ message: 'Output copied as Markdown', type: 'success' });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOutput();
    setRefreshing(false);
  };

  const handleStop = async () => {
    if (!run?.id) {
      return;
    }

    try {
      // Call the API to kill the agent session
      const success = await api.killAgentSession(run.id);
      
      if (success) {
        setToast({ message: 'Agent execution stopped', type: 'success' });
        
        // Clean up listeners
        unlistenRefs.current.forEach(unlisten => unlisten());
        unlistenRefs.current = [];
        hasSetupListenersRef.current = false;
        
        // Add a message indicating execution was stopped
        const stopMessage: ClaudeStreamMessage = {
          type: "result",
          subtype: "error",
          is_error: true,
          result: "Execution stopped by user",
          duration_ms: 0,
          usage: {
            input_tokens: 0,
            output_tokens: 0
          }
        };
        setMessages(prev => [...prev, stopMessage]);
        
        // Update the tab status
        updateTabStatus(tabId, 'idle');
        
        // Refresh the output to get updated status
        await loadOutput(true);
      } else {
        setToast({ message: 'Failed to stop agent - it may have already finished', type: 'error' });
      }
    } catch (err) {
      console.error('[AgentRunOutputViewer] Failed to stop agent:', err);
      setToast({ 
        message: `Failed to stop execution: ${err instanceof Error ? err.message : 'Unknown error'}`, 
        type: 'error' 
      });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    setHasUserScrolled(distanceFromBottom > 50);
    setShowScrollToTop(scrollTop > 100);
    setShowScrollToBottom(distanceFromBottom > 100);
  };
  
  const handleScrollToTop = () => {
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleScrollToBottom = () => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleToggleAutoScroll = () => {
    setHasUserScrolled(!hasUserScrolled);
    if (hasUserScrolled) {
      // Re-enable auto-scroll by scrolling to bottom
      handleScrollToBottom();
    }
  };

  // Load output on mount
  useEffect(() => {
    if (!run?.id) return;
    
    // Check cache immediately for instant display
    const cached = getCachedOutput(run!.id);
    if (cached) {
      const cachedJsonlLines = cached.output.split('\n').filter(line => line.trim());
      setRawJsonlOutput(cachedJsonlLines);
      setMessages(cached.messages);
    }
    
    // Then load fresh data
    loadOutput();
  }, [run?.id]);

  // Export functionality
  const handleExport = async (format: "jsonl" | "markdown") => {
    if (format === "jsonl") {
      await handleCopyAsJsonl();
    } else {
      await handleCopyAsMarkdown();
    }
  };

  if (!run) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" message="Loading agent run..." />
      </div>
    );
  }

  return (
    <>
      <div className={`h-full flex flex-col ${className || ''}`}>
        <Card className="h-full flex flex-col">
          <ExecutionControlPanel
            agentName={run.agent_name || 'Unknown Agent'}
            agentIcon={run.agent_icon}
            task={run.task}
            model={run.model}
            status={executionStatus}
            createdAt={run.created_at}
            duration={run.metrics?.duration_ms}
            totalTokens={run.metrics?.total_tokens}
            cost={run.metrics?.cost_usd}
            isRefreshing={refreshing}
            isFullscreen={isFullscreen}
            isAutoScrolling={!hasUserScrolled}
            showScrollToTop={showScrollToTop}
            showScrollToBottom={showScrollToBottom}
            onRefresh={handleRefresh}
            onStop={handleStop}
            onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
            onCopyJsonl={handleCopyAsJsonl}
            onCopyMarkdown={handleCopyAsMarkdown}
            onExport={handleExport}
            onScrollToTop={handleScrollToTop}
            onScrollToBottom={handleScrollToBottom}
            onToggleAutoScroll={handleToggleAutoScroll}
            copyPopoverOpen={copyPopoverOpen}
            onCopyPopoverChange={setCopyPopoverOpen}
          />
          
          <CardContent className="flex-1 p-0 overflow-hidden">
            <OutputViewer
              messages={messages}
              loading={loading}
              error={null}
              autoScroll={!hasUserScrolled}
              onScroll={handleScroll}
              onScrollToTop={handleScrollToTop}
              onScrollToBottom={handleScrollToBottom}
              containerRef={scrollAreaRef}
              endRef={outputEndRef}
            />
          </CardContent>
        </Card>
      </div>

      {/* Fullscreen Modal */}
      <FullscreenOutputModal
        open={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        agentName={run.agent_name || 'Unknown Agent'}
        agentIcon={run.agent_icon}
        task={run.task}
        model={run.model}
        status={executionStatus}
        createdAt={run.created_at}
        duration={run.metrics?.duration_ms}
        totalTokens={run.metrics?.total_tokens}
        cost={run.metrics?.cost_usd}
        messages={messages}
        loading={loading}
        isRefreshing={refreshing}
        isAutoScrolling={!hasUserScrolled}
        onRefresh={handleRefresh}
        onStop={handleStop}
        onCopyJsonl={handleCopyAsJsonl}
        onCopyMarkdown={handleCopyAsMarkdown}
        onExport={handleExport}
        onScroll={handleScroll}
        copyPopoverOpen={copyPopoverOpen}
        onCopyPopoverChange={setCopyPopoverOpen}
      />

      {/* Toast Notification */}
      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>
    </>
  );
}

export default AgentRunOutputViewer; 