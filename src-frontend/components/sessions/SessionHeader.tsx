import React from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MessagesSquare,
  FolderOpen,
  GitBranch,
  Hash,
  Clock,
  Activity,
  HardDrive,
  MessageSquare,
  ArrowUpFromLine,
  ArrowDownToLine,
  Download as LucideDownload,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  UnfoldVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { DebugLabel } from "@/components/ui/atoms";
import { cn } from "@/lib/utils";
import {
  formatUnixTimestamp,
  formatTimeAgo,
  formatFileSize,
} from "@/lib/date-utils";
import type { Session } from "@/lib/api";

interface SessionHeaderProps {
  projectPath: string;
  claudeSessionId: string | null;
  totalTokens: number;
  isStreaming: boolean;
  hasMessages: boolean;
  showTimeline: boolean;
  copyPopoverOpen: boolean;
  onBack: () => void;
  onSelectPath: () => void;
  onExportAsJson: () => void;
  onExportAsMarkdown: () => void;
  onToggleTimeline: () => void;
  onDeleteProject?: () => void;
  setCopyPopoverOpen: (open: boolean) => void;
  // Session metadata
  sessionData?: Session;
  // Session file path (from file watcher)
  sessionFilePath?: string;
  // Current displayable message count
  displayableMessageCount?: number;
  // List of UUIDs for filtered/collapsed messages
  collapsedMessageUuids?: string[];
  // Refresh state
  isRefreshing?: boolean;
  // Navigation
  showNavigation?: boolean;
  isPinnedToBottom?: boolean;
  onScrollToTop?: () => void;
  onScrollToBottom?: () => void;
  // Compact mode
  isCompactMode?: boolean;
  onToggleCompactMode?: () => void;
}

export const SessionHeader: React.FC<SessionHeaderProps> = ({
  projectPath,
  claudeSessionId,
  totalTokens,
  isStreaming,
  hasMessages,
  showTimeline,
  copyPopoverOpen,
  onBack,
  onSelectPath,
  onExportAsJson,
  onExportAsMarkdown,
  onToggleTimeline,
  onDeleteProject,
  setCopyPopoverOpen,
  sessionData,
  sessionFilePath,
  displayableMessageCount,
  collapsedMessageUuids,
  isRefreshing,
  showNavigation,
  isPinnedToBottom,
  onScrollToTop,
  onScrollToBottom,
  isCompactMode,
  onToggleCompactMode,
}) => {
  const handleCopySessionId = async () => {
    if (sessionFilePath) {
      try {
        await navigator.clipboard.writeText(sessionFilePath);
        console.log(
          `Session absolute path copied to clipboard: ${sessionFilePath}`,
        );
      } catch (error) {
        console.error("Failed to copy session path:", error);
      }
    }
  };

  const handleCopyCollapsedUuids = async () => {
    if (collapsedMessageUuids && collapsedMessageUuids.length > 0) {
      try {
        const uuidList = collapsedMessageUuids.join("\n");
        await navigator.clipboard.writeText(uuidList);
        console.log(
          `Copied ${collapsedMessageUuids.length} collapsed message UUIDs to clipboard`,
        );
      } catch (error) {
        console.error("Failed to copy UUID list:", error);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-background border-b px-4 py-3 sticky top-0 z-40"
    >
      <DebugLabel label="SessionHeader" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-accent flex items-center gap-3">
              Claude Code Session
              {claudeSessionId && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-normal border border-border rounded cursor-pointer text-accent hover:text-foreground hover:bg-accent transition-colors"
                  onClick={handleCopySessionId}
                  title="Click to copy absolute session path"
                >
                  {claudeSessionId.slice(0, 8)}
                </span>
              )}
            </h1>
            {projectPath && (
              <p className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                <span className="font-mono truncate">{projectPath}</span>
              </p>
            )}
            {!projectPath && (
              <p className="mt-1 text-sm text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSelectPath}
                  className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Select Project
                </Button>
              </p>
            )}

            {/* Session metadata */}
            {sessionData && (
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                {displayableMessageCount !== undefined &&
                  displayableMessageCount > 0 && (
                    <div
                      className="flex items-center gap-1 bg-accent px-2 py-1 rounded-full text-xs cursor-pointer hover:bg-accent/80 transition-colors"
                      onClick={handleCopyCollapsedUuids}
                      title={`Click to copy UUIDs of ${collapsedMessageUuids?.length || 0} collapsed messages`}
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span>{displayableMessageCount}</span>
                    </div>
                  )}
                {totalTokens > 0 && (
                  <div className="flex items-center gap-0.5">
                    <ArrowUpFromLine className="h-3 w-3" />
                    <span>{totalTokens.toLocaleString()} tokens</span>
                  </div>
                )}
                {sessionData.size_bytes !== undefined && (
                  <div className="flex items-center gap-0.5">
                    <HardDrive className="h-3 w-3" />
                    <span>{formatFileSize(sessionData.size_bytes)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatUnixTimestamp(sessionData.created_at)}</span>
                </div>
                {sessionData.modified_at && (
                  <div
                    className={cn(
                      "flex items-center gap-1 transition-colors duration-200",
                      isRefreshing && "text-accent animate-pulse",
                    )}
                  >
                    <Activity className="h-3 w-3" />
                    <span>{formatTimeAgo(sessionData.modified_at * 1000)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Navigation buttons */}
          {showNavigation && onScrollToTop && onScrollToBottom && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  console.log("Top button clicked");
                  onScrollToTop?.();
                }}
                className="h-8 w-8"
                title="Jump to first message"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant={isPinnedToBottom ? "default" : "ghost"}
                size="icon"
                onClick={() => {
                  console.log(
                    "Bottom button clicked, isPinnedToBottom:",
                    isPinnedToBottom,
                  );
                  onScrollToBottom?.();
                }}
                className="h-8 w-8"
                title={
                  isPinnedToBottom
                    ? "Following new messages"
                    : "Jump to latest message"
                }
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Compact mode toggle */}
          {onToggleCompactMode && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCompactMode}
              className={cn(
                "h-8 w-8 transition-colors",
                isCompactMode ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
              title={
                isCompactMode
                  ? "Show content excerpts"
                  : "Header-only mode"
              }
            >
              <UnfoldVertical className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTimeline}
            className={cn(
              "h-8 w-8 transition-colors",
              showTimeline && "bg-accent text-accent-foreground",
            )}
          >
            <GitBranch className="h-4 w-4" />
          </Button>

          {hasMessages && !isStreaming && claudeSessionId && (
            <Popover
              open={copyPopoverOpen}
              onOpenChange={setCopyPopoverOpen}
              trigger={
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              }
              content={
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={onExportAsJson}
                  >
                    <LucideDownload className="h-4 w-4 mr-2" />
                    Export as JSON
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={onExportAsMarkdown}
                  >
                    <LucideDownload className="h-4 w-4 mr-2" />
                    Export as Markdown
                  </Button>
                </div>
              }
              className="w-48 p-2"
            />
          )}
        </div>
      </div>
    </motion.div>
  );
};
