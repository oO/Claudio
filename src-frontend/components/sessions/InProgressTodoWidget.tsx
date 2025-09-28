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
  // TEMPORARY: Add fake todos for testing while we debug the real todo system
  const fakeTodos: Todo[] = [
    { content: "Implement CWD tracking feature", status: "completed", activeForm: "Implementing CWD tracking feature" },
    { content: "Fix todo display bug in SessionHeader", status: "in_progress", activeForm: "Fixing todo display bug" },
    { content: "Add navigation dropdown for directory changes", status: "completed", activeForm: "Adding navigation dropdown" },
    { content: "Test CWD widget with real sessions", status: "pending", activeForm: "Testing CWD widget with sessions" },
    { content: "Update documentation for new features", status: "pending", activeForm: "Updating documentation" },
  ];

  // Use fake todos if no real todos are provided (for testing)
  const displayTodos = todos.length > 0 ? todos : fakeTodos;
  const [displayMode, setDisplayMode] = React.useState<DisplayMode>("compact");
  const [currentView, setCurrentView] = React.useState(0);
  const overviewPopoverRef = React.useRef<HTMLDivElement>(null);
  const listPopoverRef = React.useRef<HTMLOListElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Cycle through todos every 3 seconds (only in overview modes)
  React.useEffect(() => {
    if (displayTodos.length <= 1 || displayMode === "compact") return;

    const interval = setInterval(() => {
      setCurrentView((prev) => (prev + 1) % displayTodos.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [displayTodos.length, displayMode]);

  // Handle click outside to close popover (for overview and overview-list modes)
  React.useEffect(() => {
    if (displayMode === "compact") return;

    const handleClickOutside = (event: MouseEvent) => {
      const currentPopover =
        displayMode === "overview"
          ? overviewPopoverRef.current
          : listPopoverRef.current;

      if (
        triggerRef.current &&
        currentPopover &&
        !triggerRef.current.contains(event.target as Node) &&
        !currentPopover.contains(event.target as Node)
      ) {
        setDisplayMode("compact");
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

  const hasTodos = displayTodos.length > 0;
  const currentTodo = hasTodos ? displayTodos[currentView] : null;
  const displayText = currentTodo
    ? currentTodo.activeForm || currentTodo.content
    : "";

  // Calculate todo counts
  const completedCount = displayTodos.filter((t) => t.status === "completed").length;
  const totalCount = displayTodos.length;

  // Handle cycling through display modes
  const handleClick = () => {
    if (!hasTodos) return; // Don't cycle if no todos

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
        disabled={!hasTodos}
        className={cn(
          "flex items-center p-1.5 rounded-md bg-card transition-colors text-xs",
          hasTodos ? "hover:bg-accent" : "opacity-60",
          className,
        )}
      >
        <ListTodo className="h-4 w-4 text-secondary-foreground" />
        <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0.5">
          {completedCount}/{totalCount}
        </Badge>
      </button>
    );
  }

  // If no todos, fallback to compact mode (shouldn't happen due to early guard, but just in case)
  if (!hasTodos) {
    return (
      <button
        ref={triggerRef}
        disabled
        className={cn(
          "flex items-center gap-2 p-1.5 rounded-md bg-card transition-colors text-xs opacity-60",
          className,
        )}
      >
        <ListTodo className="h-4 w-4 text-secondary-foreground" />
        <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0.5">
          0/0
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
          "flex items-center gap-2 p-1.5 rounded-md bg-card hover:bg-accent transition-colors text-xs",
          className,
        )}
      >
        <ListTodo className="h-4 w-4 text-secondary-foreground" />
        <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0.5">
          {completedCount}/{totalCount}
        </Badge>
      </button>

      {/* Overview popover - shows current todo with cycling */}
      {displayMode === "overview" && (
        <div
          ref={overviewPopoverRef}
          className="absolute z-50 top-full mt-2 left-0 w-120 rounded-md border border-border bg-popover p-3 shadow-md"
        >
          <div className="flex items-center gap-2 text-xs">
            {/* Current todo with status */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {/* Status icon */}
              {currentTodo?.status === "completed" && (
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              )}
              {currentTodo?.status === "in_progress" && (
                <Clock className="h-4 w-4 text-info flex-shrink-0" />
              )}
              {currentTodo?.status === "pending" && (
                <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}

              {/* Todo text with fade transition */}
              <span
                key={currentView} // Force re-render for animation
                className={cn(
                  "text-muted-foreground font-medium animate-in fade-in-50 duration-500 flex-1 min-w-0",
                )}
              >
                {displayText}
              </span>
            </div>
          </div>

          {/* Progress bar below */}
          <div className="flex items-end h-2 w-full mt-2">
            {displayTodos.map((todo, index) => (
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
      )}

      {/* Todo list - only shown in overview-list mode */}
      {displayMode === "overview-list" && (
        <ol
          ref={listPopoverRef}
          className="absolute z-50 top-full mt-2 left-0 w-120 rounded-md border border-border bg-popover p-3 py-1 shadow-md list-none"
        >
          {displayTodos.map((todo, index) => (
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
