import React from "react";
import {
  ChevronUp,
  Zap,
  Sparkles,
  Settings,
  Crown,
  Feather,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DebugLabel } from "@/components/ui/atoms";

export type ModelId = "default" | "opus" | "sonnet" | "haiku" | "opusplan";

export type Model = {
  id: ModelId;
  name: string;
  description: string;
  icon: React.ReactNode;
};

export const MODELS: Model[] = [
  {
    id: "default",
    name: "Default (recommended)",
    description: "Opus 4.1 for up to 20% of usage limits, then use Sonnet 4",
    icon: <Settings className="h-4 w-4" />,
  },
  {
    id: "opus",
    name: "Opus 4.1",
    description: "Most capable, best for complex tasks",
    icon: <Crown className="h-4 w-4" />,
  },
  {
    id: "sonnet",
    name: "Sonnet 4",
    description: "Balanced performance and speed",
    icon: <Zap className="h-4 w-4" />,
  },
  {
    id: "haiku",
    name: "Haiku 3.7",
    description: "Fastest, great for simple tasks",
    icon: <Feather className="h-4 w-4" />,
  },
  {
    id: "opusplan",
    name: "Opus Plan",
    description: "Opus for planning, Sonnet for execution",
    icon: <FileText className="h-4 w-4" />,
  },
];

export interface ModelSelectorProps {
  selectedModel: ModelId | null;
  onModelSelect: (model: ModelId) => void;
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
  const selectedModelData = selectedModel ? MODELS.find((m) => m.id === selectedModel) : null;

  // If selectedModel is provided but not found in MODELS, that's an error
  if (selectedModel && !selectedModelData) {
    throw new Error(`[ModelSelector] Invalid model '${selectedModel}' - not found in MODELS list!`);
  }

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
              !selectedModelData && "text-muted-foreground",
              className,
            )}
          >
            {selectedModelData?.icon || <Settings className="h-4 w-4" />}
            {!isCompact && (
              <>
                <span className="flex-1 text-left">
                  {selectedModelData?.name || "Select Model"}
                </span>
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
                  selectedModel === model.id && "bg-accent",
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
