import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Bot, Loader2, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api, type Agent } from "@/lib/api";
import { AgentCard } from "@/components/agents";
import { DebugLabel } from "@/components/ui/atoms";
import { logger } from '@/lib/logger';

interface ProjectAgentsDropdownProps {
  /**
   * The project path to search for agents
   */
  projectPath: string;
  /**
   * Callback when an agent is executed
   */
  onExecuteAgent?: (agent: Agent) => void;
  /**
   * Callback when an agent is edited
   */
  onEditAgent?: (agent: Agent) => void;
  /**
   * Callback when an agent is exported
   */
  onExportAgent?: (agent: Agent) => void;
  /**
   * Callback when an agent is deleted
   */
  onDeleteAgent?: (agent: Agent) => void;
  /**
   * Callback when create agent is clicked
   */
  onCreateAgent?: () => void;
  /**
   * Callback when import agent is clicked
   */
  onImportAgent?: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * ProjectAgentsDropdown component - Shows all project agents in a collapsible section
 * 
 * @example
 * <ProjectAgentsDropdown
 *   projectPath="/Users/example/project"
 *   onExecuteAgent={(agent) => logger.log('Execute agent:', agent)}
 * />
 */
export const ProjectAgentsDropdown: React.FC<ProjectAgentsDropdownProps> = ({
  projectPath,
  onExecuteAgent,
  onEditAgent,
  onExportAgent,
  onDeleteAgent,
  onCreateAgent,
  onImportAgent,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load project agents when dropdown opens
  useEffect(() => {
    if (isOpen && agents.length === 0) {
      loadProjectAgents();
    }
  }, [isOpen, projectPath]);
  
  const loadProjectAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const foundAgents = await api.listAgents(projectPath);
      setAgents(foundAgents);
    } catch (err) {
      logger.error("Failed to load project agents:", err);
      setError("Failed to load project agents");
    } finally {
      setLoading(false);
    }
  };
  
  const handleExecuteAgent = (agent: Agent) => {
    onExecuteAgent?.(agent);
  };
  
  const handleEditAgent = (agent: Agent) => {
    onEditAgent?.(agent);
  };
  
  const handleExportAgent = (agent: Agent) => {
    onExportAgent?.(agent);
  };
  
  const handleDeleteAgent = (agent: Agent) => {
    onDeleteAgent?.(agent);
  };
  
  return (
    <div className={cn("w-full relative", className)}>
      <DebugLabel label="ProjectAgentsDropdown" />
      <Card className="overflow-hidden">
        {/* Dropdown Header */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Project Agents</span>
            {agents.length > 0 && !loading && (
              <span className="text-xs text-muted-foreground">({agents.length})</span>
            )}
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </button>
        
        {/* Dropdown Content */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border">
                {/* Create and Import buttons */}
                {(onCreateAgent || onImportAgent) && (
                  <div className="p-3 border-b border-border">
                    <div className="flex gap-2">
                      {onCreateAgent && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateAgent();
                          }}
                          className="flex-1 h-8 text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Create Agent
                        </Button>
                      )}
                      {onImportAgent && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onImportAgent();
                          }}
                          className="flex-1 h-8 text-xs"
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          Import Agent
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                
                {loading ? (
                  <div className="p-4 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : error ? (
                  <div className="p-3 text-xs text-destructive">{error}</div>
                ) : agents.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground text-center">
                    No project agents found in .claude/agents/
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto p-3 space-y-3">
                    {agents.map((agent, index) => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        onExecute={onExecuteAgent ? handleExecuteAgent : undefined}
                        onEdit={onEditAgent ? handleEditAgent : undefined}
                        onExport={onExportAgent ? handleExportAgent : undefined}
                        onDelete={onDeleteAgent ? handleDeleteAgent : undefined}
                        animationDelay={index * 0.05}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}; 