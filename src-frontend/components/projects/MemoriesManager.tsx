import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Plus,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import type { ClaudeMdFile } from "@/lib/api";
import { api, claudeApi } from "@/lib/api";
import { DebugLabel } from "@/components/ui/atoms";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilePicker } from "@/components/common";
import type { FileEntry } from "@/lib/api";
import {
  ManagerHeader,
  ManagerLoadingState,
  ManagerEmptyState,
} from "@/components/managers/shared";
import { MemoryCard } from "./MemoryCard";

interface MemoriesManagerProps {
  projectPath: string;
  onViewClaudeFile?: (file: ClaudeMdFile) => void;
  onCreateMemory?: () => void;
  className?: string;
}

export const MemoriesManager: React.FC<MemoriesManagerProps> = ({
  projectPath,
  onViewClaudeFile,
  onCreateMemory,
  className,
}) => {
  const [claudeFiles, setClaudeFiles] = useState<ClaudeMdFile[]>([]);
  const [claudeFilesLoading, setClaudeFilesLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const loadClaudeFiles = useCallback(async () => {
    setClaudeFilesLoading(true);
    try {
      const files = await api.findClaudeMdFiles(projectPath);
      // Sort by relative path for consistent ordering
      const sortedFiles = files.sort((a: any, b: any) =>
        a.relative_path.localeCompare(b.relative_path),
      );
      setClaudeFiles(sortedFiles);
    } catch (error) {
      logger.error("Failed to load Claude files:", error);
      setClaudeFiles([]);
    } finally {
      setClaudeFilesLoading(false);
    }
  }, [projectPath]);

  // Load Claude files
  useEffect(() => {
    loadClaudeFiles();
  }, [loadClaudeFiles]);

  // Listen for file deletion events to refresh the list
  useEffect(() => {
    const handleFileDeleted = (event: CustomEvent) => {
      const { filePath } = event.detail;
      // Only reload if the deleted file is from this project
      if (filePath && filePath.includes(projectPath)) {
        loadClaudeFiles();
      }
    };

    window.addEventListener("file-deleted", handleFileDeleted as EventListener);

    return () => {
      window.removeEventListener(
        "file-deleted",
        handleFileDeleted as EventListener,
      );
    };
  }, [projectPath, loadClaudeFiles]);

  // Handle clicking on a memory card to view
  const handleCardClick = (file: ClaudeMdFile) => {
    onViewClaudeFile?.(file);
  };

  // Handle deleting a memory file
  const handleDeleteFile = async (file: ClaudeMdFile) => {
    try {
      await claudeApi.deleteFile(file.absolute_path);
      // Refresh the file list
      await loadClaudeFiles();
      logger.info("Memory file deleted:", file.relative_path);
    } catch (error) {
      logger.error("Failed to delete memory file:", error);
    }
  };

  // Handle create memory button click
  const handleCreateMemory = () => {
    setSelectedPath("");
    setShowAddDialog(true);
  };

  // Check if a directory already contains a CLAUDE.md file
  const hasExistingMemory = (directoryPath: string): boolean => {
    return claudeFiles.some((file) => {
      const fileDir = file.absolute_path.substring(
        0,
        file.absolute_path.lastIndexOf("/"),
      );
      return fileDir === directoryPath;
    });
  };

  // Handle file picker selection
  const handleFilePickerSelect = (entry: FileEntry) => {
    // Only directories should be selectable now
    if (entry.is_directory) {
      // Check if this directory already has a CLAUDE.md file
      if (hasExistingMemory(entry.path)) {
        // Show error or prevent selection, but don't close picker
        return;
      }

      setSelectedPath(entry.path);
      setShowFilePicker(false);
    }
  };

  // Handle creating the memory file
  const handleCreateFile = async () => {
    if (!selectedPath) return;

    setCreating(true);
    try {
      const fullPath = `${selectedPath}/CLAUDE.md`;

      // Create the file with initial content
      const initialContent = `# Memory: CLAUDE.md\n\nThis is a project-specific memory file. Add context, notes, or instructions here.\n`;

      await api.saveClaudeMdFile(fullPath, initialContent);

      // Refresh the file list
      await loadClaudeFiles();

      // Close dialog
      setShowAddDialog(false);

      // Open the new file in editor
      const newFile: ClaudeMdFile = {
        absolute_path: fullPath,
        relative_path: fullPath.replace(projectPath, "").replace(/^\//, ""),
        size: initialContent.length,
        modified: Date.now() / 1000,
      };

      onViewClaudeFile?.(newFile);
    } catch (error) {
      logger.error("Failed to create memory file:", error);
      // Could add toast notification here
    } finally {
      setCreating(false);
    }
  };

  // Handle dialog cancel
  const handleCancel = () => {
    setShowAddDialog(false);
    setShowFilePicker(false);
    setSelectedPath("");
  };

  // Get display path for selected directory
  const getDisplayPath = () => {
    if (!selectedPath) return "Select a directory...";
    return (
      selectedPath.replace(projectPath, "").replace(/^\//, "") ||
      "(project root)"
    );
  };

  return (
    <Card className="relative flex flex-col h-full">
      <DebugLabel label="MemoriesManager" />
      <CardContent className="p-0 pb-3 flex flex-col h-full min-h-0">
        <div className="flex flex-col h-full gap-4">
          <div className="px-6 pt-6">
            <ManagerHeader
              title="Project Memories"
              description="Manage CLAUDE.md files containing project context and memories."
              action={
                <Button onClick={handleCreateMemory} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Memory
                </Button>
              }
            />
          </div>

          {claudeFilesLoading ? (
            <ManagerLoadingState />
          ) : (
            <div className="flex-1 min-h-0 overflow-auto px-6">
              {claudeFiles.length === 0 ? (
                <ManagerEmptyState
                  icon={FileText}
                  title="No memories found"
                  description="Create your first CLAUDE.md file to store project context and memories."
                  action={
                    <Button
                      onClick={handleCreateMemory}
                      size="sm"
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create First Memory
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {claudeFiles.map((file, index) => (
                    <MemoryCard
                      key={file.absolute_path}
                      file={file}
                      projectPath={projectPath}
                      onClick={handleCardClick}
                      onDelete={handleDeleteFile}
                      animationDelay={index * 0.05}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      {/* Add Memory Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Memory</DialogTitle>
            <DialogDescription>
              Create a new CLAUDE.md file to store project context and memories.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 relative">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Directory
              </label>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2 border border-border rounded-md bg-muted text-sm font-mono">
                  {getDisplayPath()}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilePicker(true)}
                >
                  Browse
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              A new{" "}
              <code className="bg-muted px-1 py-0.5 rounded font-mono text-xs">
                CLAUDE.md
              </code>{" "}
              file will be created in the selected directory.
            </div>

            {/* File Picker */}
            {showFilePicker && (
              <div className="absolute top-0 left-0 right-0 z-50">
                <FilePicker
                  basePath={projectPath}
                  onSelect={handleFilePickerSelect}
                  onClose={() => setShowFilePicker(false)}
                  directoriesOnly={true}
                  canSelectDirectory={(entry) => !hasExistingMemory(entry.path)}
                  isDirectoryDisabled={(entry) => hasExistingMemory(entry.path)}
                  className="relative"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFile}
              disabled={!selectedPath || creating}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
