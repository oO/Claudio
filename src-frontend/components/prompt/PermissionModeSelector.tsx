import React from "react";
import {
  ChevronUp,
  Shield,
  ShieldCheck,
  Terminal,
  ShieldOff,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DebugLabel } from "@/components/ui/atoms";

export type PermissionMode = "default" | "acceptEdits" | "sandboxBashMode" | "bypassPermissions" | "plan";

export type PermissionModeConfig = {
  id: PermissionMode;
  name: string;
  description: string;
  icon: React.ReactNode;
};

export const PERMISSION_MODES: PermissionModeConfig[] = [
  {
    id: "default",
    name: "Default",
    description: "Standard permission model with user prompts",
    icon: <Shield className="h-4 w-4" />,
  },
  {
    id: "acceptEdits",
    name: "Accept Edits",
    description: "Automatically accept all file edits",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    id: "sandboxBashMode",
    name: "Sandbox Bash",
    description: "Allow bash commands in isolated environment",
    icon: <Terminal className="h-4 w-4" />,
  },
  {
    id: "bypassPermissions",
    name: "Bypass Permissions",
    description: "Skip all permission checks (use with caution)",
    icon: <ShieldOff className="h-4 w-4" />,
  },
  {
    id: "plan",
    name: "Plan Mode",
    description: "Planning mode with restricted actions",
    icon: <FileCheck className="h-4 w-4" />,
  },
];

export interface PermissionModeSelectorProps {
  selectedMode: PermissionMode;
  onModeSelect: (mode: PermissionMode) => void;
  disabled?: boolean;
  variant?: "compact" | "full";
  className?: string;
}

/**
 * Permission mode selection component with dropdown
 */
export const PermissionModeSelector: React.FC<PermissionModeSelectorProps> = ({
  selectedMode,
  onModeSelect,
  disabled = false,
  variant = "full",
  className,
}) => {
  const [open, setOpen] = React.useState(false);
  const selectedModeData = PERMISSION_MODES.find((m) => m.id === selectedMode);

  // If selectedMode is provided but not found in PERMISSION_MODES, that's an error
  if (selectedMode && !selectedModeData) {
    throw new Error(`[PermissionModeSelector] Invalid permission mode '${selectedMode}' - not found in PERMISSION_MODES list!`);
  }

  const isCompact = variant === "compact";

  return (
    <div className="relative">
      <DebugLabel label="PermissionModeSelector" />
      <Popover
        trigger={
          <Button
            variant="outline"
            size="default"
            disabled={disabled}
            className={cn(
              "gap-2",
              isCompact ? "min-w-[60px]" : "min-w-[160px] justify-start",
              !selectedModeData && "text-muted-foreground",
              className,
            )}
          >
            {selectedModeData?.icon || <Shield className="h-4 w-4" />}
            {!isCompact && (
              <>
                <span className="flex-1 text-left">
                  {selectedModeData?.name || "Select Mode"}
                </span>
                <ChevronUp className="h-4 w-4 opacity-50" />
              </>
            )}
          </Button>
        }
        content={
          <div className="w-[280px] p-1">
            {PERMISSION_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => {
                  onModeSelect(mode.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-md transition-colors text-left",
                  "hover:bg-accent",
                  selectedMode === mode.id && "bg-accent",
                )}
              >
                <div className="mt-0.5">{mode.icon}</div>
                <div className="flex-1 space-y-1">
                  <div className="font-medium text-sm">{mode.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {mode.description}
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