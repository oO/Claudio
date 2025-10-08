import React from "react";
import { motion } from "framer-motion";
import { Clock, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/types/agents";
import { getAgentColor } from "@/lib/agentColors";
import { ICON_MAP } from "@/components/common";
import { DebugLabel, DeleteButton } from "@/components/ui/atoms";

interface AgentCardProps {
  agent: Agent;
  onEdit?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => void;
  className?: string;
  animationDelay?: number;
}

/**
 * Shared AgentCard component for displaying agents in both personal and project contexts
 * Click card to edit, hover to reveal delete button
 *
 * @example
 * <AgentCard
 *   agent={agent}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * />
 */
export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onEdit,
  onDelete,
  className,
  animationDelay = 0,
}) => {
  const renderIcon = (iconName: string) => {
    const Icon = ICON_MAP[iconName as keyof typeof ICON_MAP] || ICON_MAP.bot;
    return <Icon className="h-5 w-5" />;
  };

  const getColorClass = (color?: string) => {
    if (!color) return getAgentColor('grey').cssClass;
    return getAgentColor(color).cssClass;
  };

  const colorClass = getColorClass(agent.color);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay }}
      onClick={() => onEdit?.(agent)}
      className={cn(
        "group relative flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-card-hover hover:border-hover transition-colors cursor-pointer",
        className
      )}
    >
      <DebugLabel label="AgentCard" />
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex-shrink-0 p-2">
          <div
            className={cn(
              "p-2 rounded-full flex-shrink-0",
              colorClass
            )}
          >
            {renderIcon(agent.icon)}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium truncate flex-1">
              {agent.name}
            </p>
          </div>
          {agent.description && (
            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
              {agent.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{new Date(agent.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              <span>{(agent.system_prompt.length / 1024).toFixed(1)} KB</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onDelete && (
          <DeleteButton
            onClick={(e) => {
              e.stopPropagation();
              onDelete(agent);
            }}
          />
        )}
      </div>
    </motion.div>
  );
}; 