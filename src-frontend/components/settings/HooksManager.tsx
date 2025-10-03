import React from "react";
import {
  Zap,
  Activity,
  Bell,
  MessageSquare,
  Square,
  Layers,
  Archive,
  Play,
  AlertTriangle,
  Plus,
  Trash2,
  Edit3,
  FileText,
  Save,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DebugLabel } from "@/components/ui/atoms";
import { useUnifiedSettingsContext } from "@/lib/settings";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { HookInstallDialog } from "./HookInstallDialog";
import { open } from "@tauri-apps/plugin-dialog";
import { dirname, homeDir } from "@tauri-apps/api/path";
import { open as shellOpen } from "@tauri-apps/plugin-shell";

// Export types for other components that may need them
export interface EditableHookCommand {
  id: string;
  type: string;
  command: string;
  timeout?: number;
}

export interface EditableHookMatcher {
  id: string;
  matcher: string;
  hooks: EditableHookCommand[];
  expanded?: boolean;
}

interface HooksManagerProps {
  projectPath?: string;
  scope: "project" | "local" | "user";
  readOnly?: boolean;
  className?: string;
  onChange?: (hasChanges: boolean, getHooks: (() => any) | null) => void;
  hideActions?: boolean;
  containerHeight?: number;
  onEditFile?: (filePath: string) => void;
}

// All available hook events from Claude Code with metadata
export const HOOK_EVENTS = [
  {
    event: "SessionStart",
    icon: Play,
    title: "Session Start",
    description: "Triggered when a new session begins",
  },
  {
    event: "SessionEnd",
    icon: AlertTriangle,
    title: "Session End",
    description: "Runs when session terminates",
  },
  {
    event: "PreToolUse",
    icon: Zap,
    title: "Pre Tool Use",
    description: "Runs before any tool is executed",
  },
  {
    event: "PostToolUse",
    icon: Activity,
    title: "Post Tool Use",
    description: "Runs after tool execution completes",
  },
  {
    event: "Notification",
    icon: Bell,
    title: "Notification",
    description: "Triggered for permission requests or idle periods",
  },
  {
    event: "UserPromptSubmit",
    icon: MessageSquare,
    title: "User Prompt Submit",
    description: "Runs when user submits a new prompt",
  },
  {
    event: "Stop",
    icon: Square,
    title: "Stop",
    description: "Runs when main agent finishes responding",
  },
  {
    event: "SubagentStop",
    icon: Layers,
    title: "Subagent Stop",
    description: "Runs when a subagent completes execution",
  },
  {
    event: "PreCompact",
    icon: Archive,
    title: "Pre Compact",
    description: "Runs before context compaction occurs",
  },
] as const;

type HookEvent = (typeof HOOK_EVENTS)[number]["event"];

export const HooksManager: React.FC<HooksManagerProps> = ({
  scope,
  className = "",
  containerHeight,
  onEditFile,
}) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = React.useState({
    start: 0,
    end: 0,
  });
  const [showInstallDialog, setShowInstallDialog] = React.useState(false);
  const [editingHook, setEditingHook] = React.useState<{
    event: string;
    configIndex: number;
    hookIndex: number;
    command: string;
    matcher?: string;
  } | null>(null);
  const editingRef = React.useRef<HTMLDivElement>(null);

  // Handle click outside to cancel editing
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        editingHook &&
        editingRef.current &&
        !editingRef.current.contains(event.target as Node)
      ) {
        setEditingHook(null);
      }
    };

    if (editingHook) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [editingHook]);

  // Get data from unified settings
  const { claudecodeSettings, claudecodeLoading, claudecodeError, updateClaudecodeSetting } =
    useUnifiedSettingsContext();

  const hooks = claudecodeSettings?.effective?.hooks || {};

  const getHookCount = (eventName: string): number => {
    const eventHooks = (hooks as any)[eventName];
    if (!eventHooks || !Array.isArray(eventHooks)) return 0;

    // Count total hooks across all matchers
    return eventHooks.reduce((total, config) => {
      return total + (config.hooks?.length || 0);
    }, 0);
  };

  // Get visible hook sections (only those with hooks)
  const visibleHookSections = HOOK_EVENTS.filter(
    ({ event }) => getHookCount(event) > 0,
  );

  // Handle scroll position changes
  React.useEffect(() => {
    const element = scrollContainerRef?.current;
    if (!element) return;

    const handleScroll = () => {
      // Calculate approximate visible range (rough estimate)
      const itemHeight = 120; // approximate height per hook section
      const scrollTop = element.scrollTop;
      const containerHeight = element.clientHeight;

      const startIndex = Math.floor(scrollTop / itemHeight);
      const endIndex = Math.min(
        Math.ceil((scrollTop + containerHeight) / itemHeight),
        visibleHookSections.length - 1,
      );

      const start = Math.max(1, startIndex + 1); // 1-based
      const end = Math.min(endIndex + 1, visibleHookSections.length);
      setScrollPosition({ start, end });
    };

    element.addEventListener("scroll", handleScroll);
    handleScroll(); // Set initial position

    return () => {
      element.removeEventListener("scroll", handleScroll);
    };
  }, [visibleHookSections.length]);

  const handleInstallHook = async (
    event: string,
    command: string,
    matcher?: string,
  ) => {
    try {
      logger.info("Installing hook:", { event, command, matcher, scope });

      // Get current hooks or initialize empty object
      const currentHooks = { ...hooks } as any;

      // Initialize event array if it doesn't exist
      if (!currentHooks[event]) {
        currentHooks[event] = [];
      }

      // Find existing config with same matcher or create new one
      let configIndex = -1;
      if (matcher) {
        configIndex = currentHooks[event].findIndex((config: any) => config.matcher === matcher);
      } else {
        configIndex = currentHooks[event].findIndex((config: any) => !config.matcher);
      }

      if (configIndex === -1) {
        // Create new config
        const newConfig: any = { hooks: [{ type: 'command', command }] };
        if (matcher) {
          newConfig.matcher = matcher;
        }
        currentHooks[event].push(newConfig);
      } else {
        // Add to existing config
        currentHooks[event][configIndex].hooks.push({ type: 'command', command });
      }

      // Update settings
      await updateClaudecodeSetting('hooks', currentHooks);

      setShowInstallDialog(false);
    } catch (error) {
      logger.error("Failed to install hook:", error);
    }
  };

  const handleEditHook = (
    event: string,
    configIndex: number,
    hookIndex: number,
    hook: any,
    matcher?: string,
  ) => {
    setEditingHook({
      event,
      configIndex,
      hookIndex,
      command: hook.command,
      matcher: matcher || "",
    });
  };

  const saveHookChanges = async (newCommand: string, newMatcher?: string) => {
    if (!editingHook) return;

    try {
      // Get current hooks
      const currentHooks = { ...hooks } as any;

      // Update the specific hook
      const { event, configIndex, hookIndex } = editingHook;

      if (currentHooks[event] && currentHooks[event][configIndex] && currentHooks[event][configIndex].hooks[hookIndex]) {
        // Update the hook command
        currentHooks[event][configIndex].hooks[hookIndex].command = newCommand;

        // Update matcher if this is a tool event
        if (event === "PreToolUse" || event === "PostToolUse") {
          if (newMatcher && newMatcher.trim() !== '') {
            currentHooks[event][configIndex].matcher = newMatcher;
          } else {
            // Remove matcher if empty
            delete currentHooks[event][configIndex].matcher;
          }
        }

        // Update settings immediately
        await updateClaudecodeSetting('hooks', currentHooks);
      }
    } catch (error) {
      logger.error("Failed to save hook edit:", error);
    }
  };

  const handleDeleteHook = async (
    event: string,
    configIndex: number,
    hookIndex: number,
  ) => {
    try {
      logger.info("Deleting hook:", { event, configIndex, hookIndex });

      // Get current hooks
      const currentHooks = { ...hooks } as any;

      if (currentHooks[event] && currentHooks[event][configIndex] && currentHooks[event][configIndex].hooks) {
        // Remove the specific hook
        currentHooks[event][configIndex].hooks.splice(hookIndex, 1);

        // If this config has no more hooks, remove the entire config
        if (currentHooks[event][configIndex].hooks.length === 0) {
          currentHooks[event].splice(configIndex, 1);
        }

        // If this event has no more configs, remove the entire event
        if (currentHooks[event].length === 0) {
          delete currentHooks[event];
        }

        // Update settings
        await updateClaudecodeSetting('hooks', currentHooks);
      }
    } catch (error) {
      logger.error("Failed to delete hook:", error);
    }
  };

  const handleOpenFile = () => {
    if (!editingHook || !editingHook.command || !onEditFile) return;

    // Open the file in the embedded editor via callback
    onEditFile(editingHook.command);
    logger.info("Opening script file in editor:", editingHook.command);
  };

  const handleBrowse = async () => {
    if (!editingHook) return;

    try {
      // Get the directory of the current command file, or default to home directory
      const currentCommand = editingHook.command;
      const home = await homeDir();
      let defaultPath = home;

      if (currentCommand && currentCommand.trim() !== "") {
        try {
          // Use proper path operations to get directory
          defaultPath = await dirname(currentCommand);
        } catch (error) {
          // If dirname fails (e.g., for simple commands without paths), use home
          logger.debug(
            "Failed to get dirname for command:",
            currentCommand,
            error,
          );
        }
      }

      const selected = await open({
        multiple: false,
        defaultPath,
        filters: [
          {
            name: "Scripts",
            extensions: ["sh", "py", "js", "rb", "pl"],
          },
          {
            name: "All Files",
            extensions: ["*"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        setEditingHook({ ...editingHook, command: selected });
      }
    } catch (error) {
      logger.error("Failed to open file picker:", error);
    }
  };

  if (claudecodeLoading) {
    return (
      <div className={cn("p-4 text-center", className)}>
        <p className="text-sm text-muted-foreground">Loading hooks...</p>
      </div>
    );
  }

  if (claudecodeError) {
    return (
      <div
        className={cn(
          "p-4 border rounded-lg bg-red-50 dark:bg-red-950",
          className,
        )}
      >
        <p className="text-red-600 dark:text-red-400">
          Error: {claudecodeError.message}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2 relative flex flex-col", className)}>
      <DebugLabel label="HooksManager" />

      <div className="flex items-center justify-between flex-none">
        {visibleHookSections.length > 0 && (
          <div className="bg-muted px-3 py-1 rounded-lg text-xs text-muted-foreground">
            {scrollPosition.start === scrollPosition.end
              ? `${scrollPosition.start} of ${visibleHookSections.length}`
              : `${scrollPosition.start}-${scrollPosition.end} of ${visibleHookSections.length}`}
          </div>
        )}

        <Button
          size="sm"
          className="gap-2"
          onClick={() => setShowInstallDialog(true)}
        >
          <Plus className="h-4 w-4" />
          Install Hook
        </Button>
      </div>

      <div
        ref={scrollContainerRef}
        className="space-y-3 overflow-auto"
        style={
          containerHeight
            ? {
                contain: "strict",
                height: `${containerHeight}px`,
              }
            : {}
        }
      >
        {HOOK_EVENTS.map(({ event, icon: Icon, title, description }) => {
          const hookCount = getHookCount(event);

          // Hide sections with 0 hooks
          if (hookCount === 0) return null;

          return (
            <div key={event} className="border rounded-lg bg-card">
              <div className="p-3 pb-1">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-accent" />
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{title}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {description}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 pt-2 border-t">
                <div className="space-y-2">
                  {(hooks as any)[event]?.map(
                    (config: any, configIndex: number) => (
                      <div key={configIndex} className="space-y-1">
                        {config.hooks?.map((hook: any, hookIndex: number) => {
                          const isEditing =
                            editingHook &&
                            editingHook.event === event &&
                            editingHook.configIndex === configIndex &&
                            editingHook.hookIndex === hookIndex;

                          return (
                            <div key={hookIndex}>
                              {isEditing ? (
                                <div ref={editingRef} className="space-y-2">
                                  {(event === "PreToolUse" ||
                                    event === "PostToolUse") && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">
                                        Matcher:
                                      </span>
                                      <Input
                                        value={editingHook.matcher}
                                        onChange={(e) => {
                                          const newMatcher = e.target.value;
                                          setEditingHook({
                                            ...editingHook,
                                            matcher: newMatcher,
                                          });
                                          // Auto-save on change
                                          saveHookChanges(editingHook.command, newMatcher);
                                        }}
                                        placeholder="e.g., Write|Edit (leave empty for all tools)"
                                        className="flex-1 h-8 text-xs"
                                      />
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={editingHook.command}
                                      onChange={(e) => {
                                        const newCommand = e.target.value;
                                        setEditingHook({
                                          ...editingHook,
                                          command: newCommand,
                                        });
                                        // Auto-save on change
                                        saveHookChanges(newCommand, editingHook.matcher);
                                      }}
                                      className="flex-1 h-8 text-xs font-mono"
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={handleBrowse}
                                      className="h-8 px-2"
                                      title="Browse for script file"
                                    >
                                      <FileText className="h-3 w-3" />
                                      <span>Browse</span>
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={handleOpenFile}
                                      className="h-8 px-2"
                                      disabled={!editingHook.command || editingHook.command.trim() === ''}
                                      title="Open script in editor"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                      <span>Edit</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        handleDeleteHook(
                                          event,
                                          configIndex,
                                          hookIndex,
                                        );
                                        setEditingHook(null);
                                      }}
                                      className="h-8 px-2 text-destructive hover:text-destructive"
                                      title="Remove hook (doesn't delete script file)"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 p-1 rounded group"
                                  onClick={() =>
                                    handleEditHook(
                                      event,
                                      configIndex,
                                      hookIndex,
                                      hook,
                                      config.matcher,
                                    )
                                  }
                                >
                                  <div className="flex-1">
                                    {config.matcher && (
                                      <span className="text-xs text-muted-foreground font-mono">
                                        matcher: {config.matcher} →{" "}
                                      </span>
                                    )}
                                    <span className="text-sm font-mono">
                                      {hook.command}
                                    </span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteHook(
                                        event,
                                        configIndex,
                                        hookIndex,
                                      );
                                    }}
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <HookInstallDialog
        open={showInstallDialog}
        onOpenChange={setShowInstallDialog}
        onInstall={handleInstallHook}
      />
    </div>
  );
};
