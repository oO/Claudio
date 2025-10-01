import React, { useState } from "react";
import { Plus, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { logger } from "@/lib/logger";
import { HOOK_EVENTS } from "./HooksEditor";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";

interface HookInstallDialogProps {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onInstall: (event: string, command: string, matcher?: string) => void;
}

const COMMON_MATCHERS = [
  { value: "none", label: "All tools (no matcher)" },
  { value: "Write", label: "Write" },
  { value: "Edit", label: "Edit" },
  { value: "Write|Edit", label: "Write or Edit" },
  { value: "Bash", label: "Bash" },
  { value: "Read", label: "Read" },
  { value: "mcp__.*", label: "All MCP tools" },
];

export const HookInstallDialog: React.FC<HookInstallDialogProps> = ({
  open,
  onOpenChange,
  onInstall,
}) => {
  const [selectedEvent, setSelectedEvent] = useState("Stop");
  const [command, setCommand] = useState("");
  const [matcher, setMatcher] = useState("");
  const [customMatcher, setCustomMatcher] = useState("");

  const selectedEventData = HOOK_EVENTS.find((e) => e.event === selectedEvent);
  // Only PreToolUse and PostToolUse support matchers
  const showMatchers =
    selectedEvent === "PreToolUse" || selectedEvent === "PostToolUse";

  const handleInstall = () => {
    if (!selectedEvent || !command) return;

    const finalMatcher = showMatchers
      ? matcher === "custom"
        ? customMatcher
        : matcher === "none"
          ? undefined
          : matcher
      : undefined;

    logger.info("Installing hook:", {
      event: selectedEvent,
      command,
      matcher: finalMatcher,
    });

    onInstall(selectedEvent, command, finalMatcher);

    // Reset form
    setCommand("");
    setMatcher("");
    setCustomMatcher("");
    onOpenChange(false);
  };

  const handleBrowse = async () => {
    try {
      // Default to home directory since .claude may be hidden
      const home = await homeDir();

      const selected = await openDialog({
        multiple: false,
        defaultPath: home,
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
        setCommand(selected);
      }
    } catch (error) {
      logger.error("Failed to open file picker:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-accent">Install Hook</DialogTitle>
          <DialogDescription>
            Configure a script to run at specific points during Claude Code
            execution.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Event selector */}
          <div>
            <Label htmlFor="event">Hook Event</Label>
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger id="event" className="mt-1">
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectContent>
                {HOOK_EVENTS.map((event) => (
                  <SelectItem key={event.event} value={event.event}>
                    {event.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Matcher selector (only for tool events) */}
          {showMatchers && (
            <div>
              <Label htmlFor="matcher">Tool Matcher (optional)</Label>
              <Select value={matcher} onValueChange={setMatcher}>
                <SelectTrigger id="matcher" className="mt-1">
                  <SelectValue placeholder="Match specific tools" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_MATCHERS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom pattern...</SelectItem>
                </SelectContent>
              </Select>

              {matcher === "custom" && (
                <Input
                  className="mt-2"
                  placeholder="e.g., Write|Edit|MultiEdit"
                  value={customMatcher}
                  onChange={(e) => setCustomMatcher(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Command input */}
          <div>
            <Label htmlFor="command">Command or Script Path</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="command"
                className="flex-1"
                placeholder="e.g., ~/.claude/hooks/my-hook.sh"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBrowse}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                Browse
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Use absolute paths to script files
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleInstall} disabled={!command || !selectedEvent}>
            Install
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
