import React, { useState, useEffect } from "react";
import { Plus, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { agentsApi, type Agent } from "@/lib/api";
import { AgentCard } from "./AgentCard";
import { DebugLabel } from "@/components/ui/atoms";
import { logger } from '@/lib/logger';

interface AgentsManagerProps {
  /**
   * Optional project path - if provided, loads project agents, otherwise loads global agents
   */
  projectPath?: string;
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
   * Callback to report visible range for position label
   */
  onPositionChange?: (start: number, end: number, total: number) => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Shared AgentsManager component that displays the create/import buttons and agent cards
 * Used both directly in Global Agents and inside the collapsible wrapper for Project Agents
 */
export const AgentsManager: React.FC<AgentsManagerProps> = ({
  projectPath,
  onEditAgent,
  onExportAgent,
  onDeleteAgent,
  onCreateAgent,
  onImportAgent,
  onPositionChange,
  className,
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load agents when component mounts or when projectPath changes
  useEffect(() => {
    loadAgents();
  }, [projectPath]);

  // Report position changes to parent
  useEffect(() => {
    // For now, we show all agents (no pagination), so it's just 1 to total
    const total = agents.length;
    if (total > 0) {
      onPositionChange?.(1, total, total);
    } else {
      onPositionChange?.(0, 0, 0);
    }
  }, [agents.length]); // onPositionChange intentionally omitted - it's just a callback

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const foundAgents = await agentsApi.listAgents(projectPath);
      setAgents(foundAgents);
    } catch (err) {
      logger.error("Failed to load agents:", err);
      setError("Failed to load agents");
    } finally {
      setLoading(false);
    }
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
    <div className={cn("w-full relative flex flex-col h-full", className)}>
      <DebugLabel label="AgentsManager" />
      {/* Create and Import buttons */}
      {(onCreateAgent || onImportAgent) && (
        <div className="px-6 pb-2 flex-shrink-0">
          <div className="flex gap-2">
            {onCreateAgent && (
              <Button
                size="default"
                variant="outline"
                onClick={onCreateAgent}
                className="flex-1 h-10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            )}
            {onImportAgent && (
              <Button
                size="default"
                variant="outline"
                onClick={onImportAgent}
                className="flex-1 h-10"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Agent
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Agents List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="py-4 text-sm text-destructive text-center">{error}</div>
      ) : agents.length === 0 ? (
        <div className="py-8 text-sm text-muted-foreground text-center">
          {projectPath
            ? "No project agents found in .claude/agents/"
            : "No global agents found"}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto px-6">
          <div className="space-y-3">
          {agents.map((agent, index) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={onEditAgent ? handleEditAgent : undefined}
              onDelete={onDeleteAgent ? handleDeleteAgent : undefined}
              animationDelay={index * 0.05}
            />
          ))}
          </div>
        </div>
      )}
    </div>
  );
};
