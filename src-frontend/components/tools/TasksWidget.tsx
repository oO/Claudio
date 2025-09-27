import React from "react";
import { CheckCircle2, Circle, Clock, ListCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";

/**
 * Widget for TodoWrite tool - displays a beautiful task list
 */
export const TasksWidget: React.FC<{ todos: any[]; result?: any }> = ({
  todos,
  result: _result,
}) => {
  const statusIcons = {
    completed: <CheckCircle2 className="h-4 w-4 text-success" />,
    in_progress: <Clock className="h-4 w-4 text-info animate-pulse" />,
    pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  };

  const priorityColors = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-warning/10 text-warning border-warning/20",
    low: "bg-success/10 text-success border-success/20",
  };

  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="TasksWidget" />
      <ToolWidgetTemplate.Header
        icon={ListCheck}
        title={`Tasks (${todos.length} ${todos.length === 1 ? "item" : "items"})`}
      />

      <ToolWidgetTemplate.PlainOutput>
        <div className="space-y-2">
          {todos.map((todo, idx) => (
            <div
              key={todo.id || idx}
              className={cn(
                "flex items-start gap-3",
                todo.status === "completed" && "opacity-60",
              )}
            >
              <div className="mt-0.5">
                {statusIcons[todo.status as keyof typeof statusIcons] ||
                  statusIcons.pending}
              </div>
              <div className="flex-1 space-y-1">
                <p
                  className={cn(
                    "text-sm",
                    todo.status === "completed" && "line-through",
                    todo.status === "in_progress" && "font-bold text-info",
                  )}
                >
                  {todo.content}
                </p>
                {todo.priority && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      priorityColors[
                        todo.priority as keyof typeof priorityColors
                      ],
                    )}
                  >
                    {todo.priority}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </ToolWidgetTemplate.PlainOutput>
    </ToolWidgetTemplate>
  );
};
