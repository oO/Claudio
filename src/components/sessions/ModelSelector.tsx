import React from "react";
import { ChevronUp, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DebugLabel } from "@/components/ui/atoms";

export type Model = {
  id: "sonnet" | "opus";
  name: string;
  description: string;
  icon: React.ReactNode;
};

export const MODELS: Model[] = [
  {
    id: "sonnet",
    name: "Claude 4 Sonnet",
    description: "Faster, efficient for most tasks",
    icon: <Zap className="h-4 w-4" />
  },
  {
    id: "opus",
    name: "Claude 4 Opus",
    description: "More capable, better for complex tasks",
    icon: <Sparkles className="h-4 w-4" />
  }
];

export interface ModelSelectorProps {
  selectedModel: "sonnet" | "opus";
  onModelSelect: (model: "sonnet" | "opus") => void;
  disabled?: boolean;
  variant?: "compact" | "full";
  className?: string;
}

/**
 * Model selection component with dropdown
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelSelect,
  disabled = false,
  variant = "full",
  className,
}) => {
  const [open, setOpen] = React.useState(false);
  const selectedModelData = MODELS.find(m => m.id === selectedModel) || MODELS[0];

  const isCompact = variant === "compact";

  return (
    <div className="relative">
      <DebugLabel label="ModelSelector" />
      <Popover
      trigger={
        <Button
          variant="outline"
          size="default"
          disabled={disabled}
          className={cn(
            "gap-2",
            isCompact ? "min-w-[60px]" : "min-w-[180px] justify-start",
            className
          )}
        >
          {selectedModelData.icon}
          {!isCompact && (
            <>
              <span className="flex-1 text-left">{selectedModelData.name}</span>
              <ChevronUp className="h-4 w-4 opacity-50" />
            </>
          )}
        </Button>
      }
      content={
        <div className="w-[300px] p-1">
          {MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                onModelSelect(model.id);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-start gap-3 p-3 rounded-md transition-colors text-left",
                "hover:bg-accent",
                selectedModel === model.id && "bg-accent"
              )}
            >
              <div className="mt-0.5">{model.icon}</div>
              <div className="flex-1 space-y-1">
                <div className="font-medium text-sm">{model.name}</div>
                <div className="text-xs text-muted-foreground">
                  {model.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      }
      open={open}
      onOpenChange={setOpen}
      align="start"
      side="top"
    />
    </div>
  );
};