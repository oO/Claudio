import React, { useState, useEffect } from "react";
import { Plus, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, type Agent } from "@/lib/api";
import { AgentCard } from "./AgentCard";
import { DebugLabel } from "@/components/ui/atoms";

interface AgentsContentProps {
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
   * Optional className for styling
   */
  className?: string;
}

/**
 * Shared AgentsContent component that displays the create/import buttons and agent cards
 * Used both directly in Personal Agents and inside the collapsible wrapper for Project Agents
 */
export const AgentsContent: React.FC<AgentsContentProps> = ({
  projectPath,
  onExecuteAgent,
  onEditAgent,
  onExportAgent,
  onDeleteAgent,
  onCreateAgent,
  onImportAgent,
  className,
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load agents when component mounts or when projectPath changes
  useEffect(() => {
    loadAgents();
  }, [projectPath]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const foundAgents = await api.listAgents(projectPath);
      setAgents(foundAgents);
    } catch (err) {
      console.error("Failed to load agents:", err);
      setError("Failed to load agents");
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
      <DebugLabel label="AgentsContent" />
      {/* Create and Import buttons */}
      {(onCreateAgent || onImportAgent) && (
        <div className="mb-2">
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
            : "No personal agents found"}
        </div>
      ) : (
        <div className="space-y-3">
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
  );
};
