import React from "react";
import { motion } from "framer-motion";
import { Edit, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/types/agents";
import { getAgentColor, type AgentColorName } from "@/lib/agentColors";
import { ICON_MAP } from "@/components/common";
import { DebugLabel } from "@/components/ui/atoms";

// Agent colors now use centralized CSS classes

interface AgentCardProps {
  agent: Agent;
  onEdit?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => void;
  onExport?: (agent: Agent) => void;
  className?: string;
  animationDelay?: number;
}

/**
 * Shared AgentCard component for displaying agents in both personal and project contexts
 * 
 * @example
 * <AgentCard
 *   agent={agent}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   onExport={handleExport}
 * />
 */
export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onEdit,
  onDelete,
  onExport,
  className,
  animationDelay = 0,
}) => {
  const renderIcon = (iconName: string) => {
    const Icon = ICON_MAP[iconName as keyof typeof ICON_MAP] || ICON_MAP.bot;
    return <Icon className="h-8 w-8" />;
  };
  
  const getColorClass = (color?: string) => {
    if (!color) return getAgentColor('grey').cssClass;
    return getAgentColor(color).cssClass;
  };

  const colorClass = getColorClass(agent.color);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: animationDelay }}
      className={cn("relative", className)}
    >
      <DebugLabel label="AgentCard" />
      <Card className="hover:bg-card-hover hover:border-hover transition-all duration-200">
        <CardContent className="p-3 flex items-center gap-3">
          <div 
            className={cn(
              "p-2 rounded-full flex-shrink-0",
              colorClass
            )}
          >
            {renderIcon(agent.icon)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium truncate">
              {agent.name}
            </h4>
            <p className="text-xs text-muted-foreground">
              Created: {new Date(agent.created_at).toLocaleDateString()}
            </p>
            {agent.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {agent.description}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="p-2 pt-0 flex justify-end gap-1">
          {onEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(agent)}
              className="h-7 px-2 text-xs"
              title="Edit agent"
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
          {onExport && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onExport(agent)}
              className="h-7 px-2 text-xs"
              title="Export agent to .claudia.json"
            >
              <Upload className="h-3 w-3 mr-1" />
              Export
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(agent)}
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              title="Delete agent"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}; 