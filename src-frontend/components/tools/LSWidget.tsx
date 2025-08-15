import React, { useState } from "react";
import {
  FolderOpen,
  FileText,
  FileCode,
  Folder,
  ChevronRight,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";
import { useSessionContext } from "@/contexts/SessionContext";

/**
 * Merged widget for LS (List Directory) tool
 * Handles both tool calls and results with interactive directory tree
 */
export const LSWidget: React.FC<{
  path?: string;
  result?: any;
  content?: string; // For direct result rendering
}> = ({ path, result, content }) => {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const { isCompactMode } = useSessionContext();

  // Extract content from various sources
  const extractContent = (): string => {
    if (content) return content;

    if (result) {
      if (typeof result.content === "string") {
        return result.content;
      } else if (result.content && typeof result.content === "object") {
        if (result.content.text) {
          return result.content.text;
        } else if (Array.isArray(result.content)) {
          return result.content
            .map((c: any) =>
              typeof c === "string" ? c : c.text || JSON.stringify(c),
            )
            .join("\n");
        } else {
          return JSON.stringify(result.content, null, 2);
        }
      }
    }
    return "";
  };

  const directoryContent = extractContent();

  // Parse the directory tree structure
  const parseDirectoryTree = (rawContent: string) => {
    const lines = rawContent.split("\n");
    const entries: Array<{
      path: string;
      name: string;
      type: "file" | "directory";
      level: number;
    }> = [];

    let currentPath: string[] = [];

    for (const line of lines) {
      // Skip NOTE section and everything after it
      if (line.startsWith("NOTE:")) {
        break;
      }

      // Skip empty lines
      if (!line.trim()) continue;

      // Calculate indentation level
      const indent = line.match(/^(\s*)/)?.[1] || "";
      const level = Math.floor(indent.length / 2);

      // Extract the entry name
      const entryMatch = line.match(/^\s*-\s+(.+?)(\/$)?$/);
      if (!entryMatch) continue;

      const fullName = entryMatch[1];
      const isDirectory = line.trim().endsWith("/");
      const name = isDirectory ? fullName : fullName;

      // Update current path based on level
      currentPath = currentPath.slice(0, level);
      currentPath.push(name);

      entries.push({
        path: currentPath.join("/"),
        name,
        type: isDirectory ? "directory" : "file",
        level,
      });
    }

    return entries;
  };

  const toggleDirectory = (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  };

  const expandAll = (entries: ReturnType<typeof parseDirectoryTree>) => {
    const allDirPaths = entries
      .filter(e => e.type === 'directory')
      .map(e => e.path);
    setExpandedDirs(new Set(allDirPaths));
  };

  const collapseAll = () => {
    setExpandedDirs(new Set());
  };

  const isAllExpanded = (entries: ReturnType<typeof parseDirectoryTree>) => {
    const allDirPaths = entries.filter(e => e.type === 'directory').map(e => e.path);
    return allDirPaths.length > 0 && allDirPaths.every(path => expandedDirs.has(path));
  };

  const toggleAllExpanded = (entries: ReturnType<typeof parseDirectoryTree>) => {
    if (isAllExpanded(entries)) {
      collapseAll();
    } else {
      expandAll(entries);
    }
  };

  // Group entries by parent for collapsible display
  const getChildren = (
    parentPath: string,
    parentLevel: number,
    entries: ReturnType<typeof parseDirectoryTree>,
  ) => {
    return entries.filter((e) => {
      if (e.level !== parentLevel + 1) return false;
      const parentParts = parentPath.split("/").filter(Boolean);
      const entryParts = e.path.split("/").filter(Boolean);

      // Check if this entry is a direct child of the parent
      if (entryParts.length !== parentParts.length + 1) return false;

      // Check if all parent parts match
      for (let i = 0; i < parentParts.length; i++) {
        if (parentParts[i] !== entryParts[i]) return false;
      }

      return true;
    });
  };

  const getFileIcon = (
    fileName: string,
    isDirectory: boolean,
    isExpanded: boolean,
  ) => {
    if (isDirectory) {
      return isExpanded ? (
        <FolderOpen className="h-3.5 w-3.5 text-blue-500" />
      ) : (
        <Folder className="h-3.5 w-3.5 text-blue-500" />
      );
    }

    // File type icons based on extension
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "rs":
        return <FileCode className="h-3.5 w-3.5 text-orange-500" />;
      case "toml":
      case "yaml":
      case "yml":
      case "json":
        return <FileText className="h-3.5 w-3.5 text-yellow-500" />;
      case "md":
        return <FileText className="h-3.5 w-3.5 text-blue-400" />;
      case "js":
      case "jsx":
      case "ts":
      case "tsx":
        return <FileCode className="h-3.5 w-3.5 text-yellow-400" />;
      case "py":
        return <FileCode className="h-3.5 w-3.5 text-blue-500" />;
      case "go":
        return <FileCode className="h-3.5 w-3.5 text-cyan-500" />;
      case "sh":
      case "bash":
        return (
          <Terminal className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        );
      default:
        return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const renderEntry = (
    entry: ReturnType<typeof parseDirectoryTree>[0],
    entries: ReturnType<typeof parseDirectoryTree>,
    isRoot = false,
  ): React.ReactNode => {
    const hasChildren =
      entry.type === "directory" &&
      entries.some(
        (e) =>
          e.path.startsWith(entry.path + "/") && e.level === entry.level + 1,
      );
    const isExpanded = expandedDirs.has(entry.path);

    return (
      <div key={entry.path}>
        <div
          className={cn(
            "flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 transition-colors cursor-pointer",
            !isRoot && "ml-4",
          )}
          onClick={() =>
            entry.type === "directory" &&
            hasChildren &&
            toggleDirectory(entry.path)
          }
        >
          {entry.type === "directory" && hasChildren && (
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground transition-transform",
                isExpanded && "rotate-90",
              )}
            />
          )}
          {(!hasChildren || entry.type !== "directory") && (
            <div className="w-3" />
          )}
          {getFileIcon(entry.name, entry.type === "directory", isExpanded)}
          <span className="text-sm font-mono">{entry.name}</span>
        </div>

        {entry.type === "directory" && hasChildren && isExpanded && (
          <div className="ml-2">
            {getChildren(entry.path, entry.level, entries).map((child) =>
              renderEntry(child, entries),
            )}
          </div>
        )}
      </div>
    );
  };

  // Show loading state when path provided but no result/content
  if (path && !result && !content) {
    return (
      <ToolWidgetTemplate>
        <ToolWidgetTemplate.Debug label="LSWidget" />
        <ToolWidgetTemplate.Header 
          icon={FolderOpen} 
          title="Directory listing" 
          isLoading={true}
          loadingText="Loading..."
        >
          <code className="text-sm font-mono bg-background px-2 py-0.5 rounded">
            {path}
          </code>
        </ToolWidgetTemplate.Header>
      </ToolWidgetTemplate>
    );
  }

  // Render interactive directory tree
  if (directoryContent) {
    const entries = parseDirectoryTree(directoryContent);
    const rootEntries = entries.filter((e) => e.level === 0);
    
    // Calculate statistics for header
    const totalFiles = entries.filter(e => e.type === 'file').length;
    const totalDirs = entries.filter(e => e.type === 'directory').length;

    return (
      <ToolWidgetTemplate>
        <ToolWidgetTemplate.Debug label="LSWidget" />
        <ToolWidgetTemplate.Header icon={FolderOpen} title="Directory listing">
          {path && (
            <code className="text-sm font-mono bg-background px-2 py-0.5 rounded">
              {path}
            </code>
          )}
        </ToolWidgetTemplate.Header>
        
        {/* Only show content if not in compact mode */}
        {!isCompactMode && (
          <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {totalDirs} {totalDirs === 1 ? 'directory' : 'directories'}, {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
              </span>
            </div>
            
            {totalDirs > 0 && (
              <button
                onClick={() => toggleAllExpanded(entries)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight
                  className={cn(
                    'h-3 w-3 transition-transform',
                    isAllExpanded(entries) && 'rotate-90'
                  )}
                />
                {isAllExpanded(entries) ? 'Collapse' : 'Expand'}
              </button>
            )}
          </div>
          
          <div className="p-3 bg-background">
            <div className="space-y-1">
              {rootEntries.map((entry) => renderEntry(entry, entries, false))}
            </div>
          </div>
        </div>
        )}
      </ToolWidgetTemplate>
    );
  }

  // Fallback for edge cases
  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="LSWidget" />
      <ToolWidgetTemplate.Header icon={FolderOpen} title="Directory listing" />
      <ToolWidgetTemplate.PlainOutput>
        <div className="text-muted-foreground">
          No directory content available
        </div>
      </ToolWidgetTemplate.PlainOutput>
    </ToolWidgetTemplate>
  );
};
