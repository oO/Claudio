import React from "react";
import { FolderOpen, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { open } from "@tauri-apps/plugin-dialog";
import { logger } from '@/lib/logger';

interface ExecutionConfigProps {
  projectPath: string;
  setProjectPath: (path: string) => void;
  task: string;
  setTask: (task: string) => void;
  model: string;
  setModel: (model: string) => void;
  isRunning: boolean;
  onExecute: () => void;
  onOpenHooksDialog: () => void;
  className?: string;
}

export const ExecutionConfig: React.FC<ExecutionConfigProps> = ({
  projectPath,
  setProjectPath,
  task,
  setTask,
  model,
  setModel,
  isRunning,
  onExecute,
  onOpenHooksDialog,
  className,
}) => {
  const handleSelectPath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Directory"
      });
      
      if (selected) {
        setProjectPath(selected as string);
      }
    } catch (err) {
      logger.error("Failed to select directory:", err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isRunning && projectPath && task.trim()) {
      onExecute();
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Project Path */}
      <div className="space-y-2">
        <Label>Project Path</Label>
        <div className="flex gap-2">
          <Input
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            placeholder="Select or enter project path"
            disabled={isRunning}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleSelectPath}
            disabled={isRunning}
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={onOpenHooksDialog}
            disabled={isRunning || !projectPath}
            title="Configure hooks"
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Hooks
          </Button>
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <Label>Model</Label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => !isRunning && setModel("sonnet")}
            className={cn(
              "flex-1 px-3.5 py-2 rounded-full border-2 font-medium transition-all text-sm",
              !isRunning && "hover:scale-[1.02] active:scale-[0.98]",
              isRunning && "opacity-50 cursor-not-allowed",
              model === "sonnet" 
                ? "border-primary bg-primary text-primary-foreground shadow-lg" 
                : "border-muted-foreground/30 hover:border-muted-foreground/50"
            )}
            disabled={isRunning}
          >
            <div className="flex items-center justify-center gap-2">
              <div className={cn(
                "w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                model === "sonnet" ? "border-primary-foreground" : "border-current"
              )}>
                {model === "sonnet" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                )}
              </div>
              <span>Claude 4 Sonnet</span>
            </div>
          </button>
          
          <button
            type="button"
            onClick={() => !isRunning && setModel("opus")}
            className={cn(
              "flex-1 px-3.5 py-2 rounded-full border-2 font-medium transition-all text-sm",
              !isRunning && "hover:scale-[1.02] active:scale-[0.98]",
              isRunning && "opacity-50 cursor-not-allowed",
              model === "opus" 
                ? "border-primary bg-primary text-primary-foreground shadow-lg" 
                : "border-muted-foreground/30 hover:border-muted-foreground/50"
            )}
            disabled={isRunning}
          >
            <div className="flex items-center justify-center gap-2">
              <div className={cn(
                "w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                model === "opus" ? "border-primary-foreground" : "border-current"
              )}>
                {model === "opus" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                )}
              </div>
              <span>Claude 4 Opus</span>
            </div>
          </button>
        </div>
      </div>

      {/* Task Input */}
      <div className="space-y-2">
        <Label>Task</Label>
        <Input
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Enter the task for the agent"
          disabled={isRunning}
          className="flex-1"
          onKeyPress={handleKeyPress}
        />
      </div>
    </div>
  );
};