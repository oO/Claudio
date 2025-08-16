import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Bot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api, type Agent } from "@/lib/api";
import { AgentsContent } from "./AgentsContent";
import { DebugLabel } from "@/components/ui/atoms";
import { logger } from '@/lib/logger';

interface AgentsListProps {
  /**
   * Title for the agents section
   */
  title: string;
  /**
   * Optional project path - if provided, loads project agents, otherwise loads personal agents
   */
  projectPath?: string;
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
   * Whether to start collapsed (default: false for personal agents, true for project agents)
   */
  startCollapsed?: boolean;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Shared AgentsList component for displaying agents in both personal and project contexts
 * 
 * @example
 * // Personal agents
 * <AgentsList
 *   title="Personal Agents"
 *   onExecuteAgent={handleExecute}
 *   onCreateAgent={handleCreate}
 * />
 * 
 * // Project agents
 * <AgentsList
 *   title="Project Agents"
 *   projectPath="/path/to/project"
 *   startCollapsed={true}
 *   onExecuteAgent={handleExecute}
 * />
 */
export const AgentsList: React.FC<AgentsListProps> = ({
  title,
  projectPath,
  onExecuteAgent,
  onEditAgent,
  onExportAgent,
  onDeleteAgent,
  onCreateAgent,
  onImportAgent,
  startCollapsed = false,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(!startCollapsed);
  const [agents, setAgents] = useState<Agent[]>([]);
  
  // Load agents to get count for header
  useEffect(() => {
    loadAgentsCount();
  }, [projectPath]);
  
  const loadAgentsCount = async () => {
    try {
      const foundAgents = await api.listAgents(projectPath);
      setAgents(foundAgents);
    } catch (err) {
      logger.error("Failed to load agents count:", err);
    }
  };
  
  return (
    <div className={cn("w-full relative", className)}>
      <DebugLabel label="AgentsList" />
      <Card className="overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{title}</span>
            {agents.length > 0 && (
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
        
        {/* Content */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border p-3">
                <AgentsContent
                  projectPath={projectPath}
                  onExecuteAgent={onExecuteAgent}
                  onEditAgent={onEditAgent}
                  onExportAgent={onExportAgent}
                  onDeleteAgent={onDeleteAgent}
                  onCreateAgent={onCreateAgent}
                  onImportAgent={onImportAgent}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}; 