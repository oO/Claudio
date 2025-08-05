import React from "react";
import { motion } from "framer-motion";
import { Edit, Trash2, Play, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Agent } from "@/lib/api";
import { ICON_MAP } from "./IconPicker";

// Agent color mapping - matches CreateAgent component
const AGENT_COLOR_CLASSES = {
  Red: { bg: "bg-red-500/10", text: "text-red-500" },
  Blue: { bg: "bg-blue-500/10", text: "text-blue-500" },
  Green: { bg: "bg-green-500/10", text: "text-green-500" },
  Yellow: { bg: "bg-yellow-500/10", text: "text-yellow-500" },
  Purple: { bg: "bg-purple-500/10", text: "text-purple-500" },
  Orange: { bg: "bg-orange-500/10", text: "text-orange-500" },
  Pink: { bg: "bg-pink-500/10", text: "text-pink-500" },
  Cyan: { bg: "bg-cyan-500/10", text: "text-cyan-500" },
} as const;

interface AgentCardProps {
  agent: Agent;
  onExecute?: (agent: Agent) => void;
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
 *   onExecute={handleExecute}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   onExport={handleExport}
 * />
 */
export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onExecute,
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
  
  const getColorClasses = (color?: string) => {
    const colorKey = color as keyof typeof AGENT_COLOR_CLASSES;
    return AGENT_COLOR_CLASSES[colorKey] || AGENT_COLOR_CLASSES.Blue;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: animationDelay }}
      className={className}
    >
      <Card className="hover:shadow-sm transition-shadow">
        <CardContent className="p-3 flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-full flex-shrink-0",
            getColorClasses(agent.color).bg,
            getColorClasses(agent.color).text
          )}>
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
          {onExecute && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onExecute(agent)}
              className="h-7 px-2 text-xs"
              title="Execute agent"
            >
              <Play className="h-3 w-3 mr-1" />
              Execute
            </Button>
          )}
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