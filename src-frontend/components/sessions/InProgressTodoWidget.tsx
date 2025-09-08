import React from "react";
import { CheckCircle2, Circle, Clock, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

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
type DisplayMode = "compact" | "overview" | "overview-list";

export const InProgressTodoWidget: React.FC<InProgressTodoWidgetProps> = ({
  todos = [],
  className,
}) => {
  const [displayMode, setDisplayMode] = React.useState<DisplayMode>("compact");
  const [currentView, setCurrentView] = React.useState(0);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);


  // Cycle through todos every 3 seconds (only in overview modes)
  React.useEffect(() => {
    if (todos.length <= 1 || displayMode === "compact") return;

    const interval = setInterval(() => {
      setCurrentView((prev) => (prev + 1) % todos.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [todos.length, displayMode]);

  // Handle click outside to close list (only when in overview-list mode)
  React.useEffect(() => {
    if (displayMode !== "overview-list") return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        popoverRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setDisplayMode("overview");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [displayMode]);

  // Handle escape key to cycle back to compact mode
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDisplayMode("compact");
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // Don't render if there are no todos
  if (todos.length === 0) {
    return null;
  }

  const currentTodo = todos[currentView];
  if (!currentTodo) return null;

  const displayText = currentTodo.activeForm || currentTodo.content;

  // Calculate todo counts
  const completedCount = todos.filter(t => t.status === "completed").length;
  const totalCount = todos.length;

  // Handle cycling through display modes
  const handleClick = () => {
    switch (displayMode) {
      case "compact":
        setDisplayMode("overview");
        break;
      case "overview":
        setDisplayMode("overview-list");
        break;
      case "overview-list":
        setDisplayMode("compact");
        break;
    }
  };

  if (displayMode === "compact") {
    return (
      <button
        ref={triggerRef}
        onClick={handleClick}
        className={cn(
          "flex items-center gap-2 p-1.5 rounded-md bg-card hover:bg-accent cursor-pointer transition-colors text-xs",
          className,
        )}
      >
        <ListTodo className="h-4 w-4 text-secondary-foreground" />
        <span className="text-xs font-medium text-secondary-foreground">Todo</span>
        <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0.5">
          {completedCount}/{totalCount}
        </Badge>
      </button>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        onClick={handleClick}
        className={cn(
          "w-100 p-1 rounded-md bg-card overflow-hidden hover:bg-accent cursor-pointer transition-colors",
          className,
        )}
      >
        <div className="flex items-center gap-2 text-xs">
          {/* Todo prefix - horizontal flex */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ListTodo className="h-4 w-4 text-secondary-foreground" />
            <span className="text-xs font-medium text-secondary-foreground">
              Todo
            </span>
          </div>

          {/* Todo content - vertical flex */}
          <div className="flex-1 min-w-0">
            {/* Current todo with status */}
            <div className="flex items-center gap-1.5">
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

              {/* Todo text with fade transition */}
              <span
                key={currentView} // Force re-render for animation
                className={cn(
                  "truncate text-muted-foreground font-medium animate-in fade-in-50 duration-500 flex-1",
                )}
              >
                {displayText}
              </span>
            </div>

            {/* Progress bar below */}
            <div className="flex items-end h-2 w-full">
              {todos.map((todo, index) => (
                <div
                  key={index}
                  className={cn("flex-1 transition-all duration-300", {
                    "bg-success": todo.status === "completed",
                    "bg-info": todo.status === "in_progress",
                    "bg-background": todo.status === "pending",
                    "h-1.5": index === currentView,
                    "h-1": index !== currentView,
                  })}
                />
              ))}
            </div>
          </div>
        </div>
      </button>

      {/* Todo list - only shown in overview-list mode */}
      {displayMode === "overview-list" && (
        <ol
          ref={popoverRef}
          className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2 w-100 rounded-md border border-border bg-popover p-3 py-1 shadow-md list-none"
        >
          {todos.map((todo, index) => (
            <li
              key={index}
              className={cn(
                "flex items-center gap-2 p-1.5 rounded-md text-xs mb-0",
                {
                  "opacity-60": todo.status === "completed",
                },
              )}
            >
              {/* Status icon */}
              <div className="mt-0.5 flex-shrink-0">
                {todo.status === "completed" && (
                  <CheckCircle2 className="h-3 w-3 text-success" />
                )}
                {todo.status === "in_progress" && (
                  <Clock className="h-3 w-3 text-info" />
                )}
                {todo.status === "pending" && (
                  <Circle className="h-3 w-3 text-muted-foreground" />
                )}
              </div>

              {/* Todo content */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn("text-xs leading-relaxed", {
                    "line-through": todo.status === "completed",
                    "font-medium text-info": todo.status === "in_progress",
                  })}
                >
                  {todo.activeForm || todo.content}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
