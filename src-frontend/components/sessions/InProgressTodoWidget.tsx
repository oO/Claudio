import React from "react";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Todo {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

interface InProgressTodoWidgetProps {
  todos?: Todo[];
  className?: string;
}

/**
 * Compact widget that displays todo progress in the SessionHeader
 * Cycles through context around the in-progress todo (previous, current, next)
 */
export const InProgressTodoWidget: React.FC<InProgressTodoWidgetProps> = ({
  todos = [],
  className,
}) => {
  const [currentView, setCurrentView] = React.useState(0);

  // Don't render if there are no todos
  if (todos.length === 0) {
    return null;
  }

  // Cycle through todos every 3 seconds
  React.useEffect(() => {
    if (todos.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentView((prev) => (prev + 1) % todos.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [todos.length]);

  const currentTodo = todos[currentView];
  if (!currentTodo) return null;

  const displayText = currentTodo.activeForm || currentTodo.content;

  return (
    <div
      className={cn(
        "w-80 text-muted-foreground p-1 px-3 rounded-md bg-card",
        className,
      )}
    >
      <div className="flex items-center justify-start gap-2 text-xs transition-all duration-500 transform">
        {/* Status indicator */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Status icon */}
          {currentTodo.status === "completed" && (
            <CheckCircle2 className="h-4 w-4 text-success" />
          )}
          {currentTodo.status === "in_progress" && (
            <Clock className="h-4 w-4 text-info" />
          )}
          {currentTodo.status === "pending" && (
            <Circle className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Todo text with fade transition */}
        <span
          key={currentView} // Force re-render for animation
          className={cn(
            "truncate font-medium animate-in fade-in-50 duration-500",
          )}
        >
          {displayText}
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex items-end h-2 w-full bg-border mt-0">
        {todos.map((todo, index) => (
          <div
            key={index}
            className={cn("flex-1 transition-all duration-300", {
              "bg-success": todo.status === "completed",
              "bg-info": todo.status === "in_progress",
              "bg-card": todo.status === "pending",
              "h-1.5": index === currentView,
              "h-1": index !== currentView,
            })}
          />
        ))}
      </div>
    </div>
  );
};
