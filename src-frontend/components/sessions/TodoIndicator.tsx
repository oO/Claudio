import React from "react";
import { CheckCircle, Clock, Circle, ListCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TodoCounts {
  open: number;
  completed: number;
  total: number;
}

export interface TodoIndicatorProps {
  counts: TodoCounts;
  hasInProgress?: boolean;
  className?: string;
}

export const TodoIndicator: React.FC<TodoIndicatorProps> = ({
  counts,
  hasInProgress = false,
  className,
}) => {
  // Don't render if no todos exist
  if (counts.total === 0) {
    return null;
  }

  // Determine badge color and icon based on todo state
  const getBadgeVariant = () => {
    if (hasInProgress) {
      return {
        bgColor: "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
        icon: <Clock className="h-3 w-3" />,
      };
    }
    
    if (counts.open > 0) {
      return {
        bgColor: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400",
        icon: <Circle className="h-3 w-3" />,
      };
    }
    
    // All completed
    return {
      bgColor: "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400",
      icon: <CheckCircle className="h-3 w-3" />,
    };
  };

  const { bgColor, icon } = getBadgeVariant();
  
  const getDisplayText = () => {
    if (counts.open > 0) {
      return `${counts.open} task${counts.open !== 1 ? "s" : ""}`;
    }
    return `${counts.completed} done`;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border",
        bgColor,
        className,
      )}
      title={`${counts.open} open, ${counts.completed} completed`}
    >
      {icon}
      <span>{getDisplayText()}</span>
    </div>
  );
};