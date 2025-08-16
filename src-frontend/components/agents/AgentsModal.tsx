import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toast } from '@/components/ui/toast';
import { api, type Agent, type AgentRunWithMetrics } from '@/lib/api';
import { useTabState } from '@/hooks/useTabState';
import { formatISOTimestamp } from '@/lib/date-utils';
import { AgentsContent } from '@/components/agents';
import { DebugLabel } from '@/components/ui/atoms';
import { logger } from '@/lib/logger';


interface AgentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AgentsModal: React.FC<AgentsModalProps> = ({ open, onOpenChange }) => {
  const [activeTab, setActiveTab] = useState('agents');
  const [runningAgents, setRunningAgents] = useState<AgentRunWithMetrics[]>([]);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const { createAgentTab, createCreateAgentTab } = useTabState();

  // Load running agents when modal opens
  useEffect(() => {
    if (open) {
      loadRunningAgents();
    }
  }, [open]);

  // Refresh running agents periodically
  useEffect(() => {
    if (!open) return;
    
    const interval = setInterval(() => {
      loadRunningAgents();
    }, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, [open]);


  const loadRunningAgents = async () => {
    try {
      const runs = await api.listRunningAgentSessions();
      const agentRuns = runs.map(run => ({
        id: run.id,
        agent_id: run.agent_id,
        agent_name: run.agent_name,
        task: run.task,
        model: run.model,
        status: 'running' as const,
        created_at: run.created_at,
        project_path: run.project_path,
      } as AgentRunWithMetrics));
      
      setRunningAgents(agentRuns);
    } catch (error) {
      logger.error('Failed to load running agents:', error);
    }
  };

  const handleRunAgent = async (agent: Agent) => {
    // Create a new agent execution tab
    const tabId = `agent-exec-${agent.id}-${Date.now()}`;
    
    // Close modal
    onOpenChange(false);
    
    // Dispatch event to open agent execution in the new tab
    window.dispatchEvent(new CustomEvent('open-agent-execution', { 
      detail: { agent, tabId } 
    }));
  };

  const handleEditAgent = (agent: Agent) => {
    // Close modal and open edit tab with agent data
    onOpenChange(false);
    
    // Create create-agent tab but with agent data for editing
    const tabId = `edit-agent-${agent.name}-${Date.now()}`;
    window.dispatchEvent(new CustomEvent('create-edit-agent-tab', { 
      detail: { agent, tabId } 
    }));
  };

  const handleDeleteAgent = async (agent: Agent) => {
    setAgentToDelete(agent);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!agentToDelete?.id) return;
    try {
      await api.deleteAgent(agentToDelete.id);
      // AgentsContent will refresh automatically when modal reopens
      setShowDeleteDialog(false);
      setAgentToDelete(null);
      setToast({ message: "Agent deleted successfully", type: "success" });
    } catch (error) {
      logger.error('Failed to delete agent:', error);
      setToast({ message: "Failed to delete agent", type: "error" });
    }
  };

  const handleOpenAgentRun = (run: AgentRunWithMetrics) => {
    // Create new tab for this agent run
    createAgentTab(run.id!.toString(), run.agent_name);
    onOpenChange(false);
  };

  const handleCreateAgent = () => {
    // Close modal and create new tab
    onOpenChange(false);
    createCreateAgentTab();
  };

  const handleImportFromFile = async () => {
    // Close modal to allow file dialog to open properly
    onOpenChange(false);
  };

  const handleExportAgent = async (agent: Agent) => {
    // Export functionality is handled by AgentsContent
    setToast({ message: `Agent "${agent.name}" exported successfully`, type: "success" });
  };


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <>
      {open && <DebugLabel label="AgentsModal" />}
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[600px] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Agent Management
          </DialogTitle>
          <DialogDescription>
            Create new agents or manage running agent executions
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="mx-6">
            <TabsTrigger value="agents">Available Agents</TabsTrigger>
            <TabsTrigger value="running" className="relative">
              Running Agents
              {runningAgents.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {runningAgents.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="agents" className="h-full m-0">
              <ScrollArea className="h-full px-6 pb-6">
                <div className="pt-4">
                  <AgentsContent
                    onExecuteAgent={handleRunAgent}
                    onEditAgent={handleEditAgent}
                    onExportAgent={handleExportAgent}
                    onDeleteAgent={handleDeleteAgent}
                    onCreateAgent={handleCreateAgent}
                    onImportAgent={handleImportFromFile}
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="running" className="h-full m-0">
              <ScrollArea className="h-full px-6 pb-6">
                {runningAgents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Clock className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">No running agents</p>
                    <p className="text-sm text-muted-foreground">
                      Agent executions will appear here when started
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 py-4">
                    <AnimatePresence mode="popLayout">
                      {runningAgents.map((run) => (
                        <motion.div
                          key={run.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleOpenAgentRun(run)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium flex items-center gap-2">
                                {getStatusIcon(run.status)}
                                {run.agent_name}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {run.task}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span>Started: {formatISOTimestamp(run.created_at)}</span>
                                <Badge variant="outline" className="text-xs">
                                  {run.model === 'opus' ? 'Claude 4 Opus' : 'Claude 4 Sonnet'}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAgentRun(run);
                              }}
                            >
                              View
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Agent</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{agentToDelete?.name}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => {
              setShowDeleteDialog(false);
              setAgentToDelete(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDelete}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>


    {/* Toast notifications */}
    {toast && (
      <Toast
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast(null)}
      />
    )}
    </>
  );
};

export default AgentsModal;