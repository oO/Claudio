import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Clock,
  HardDrive,
  FolderOpen,
  FileCode,
  Plus,
  Search,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatUnixTimestamp,
  truncateText,
} from "@/lib/date-utils";
import type { ClaudeMdFile } from "@/lib/api";
import { api } from "@/lib/api";
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

interface ProjectMemoriesTabProps {
  projectPath: string;
  onViewClaudeFile?: (file: ClaudeMdFile) => void;
  onCreateMemory?: () => void;
  className?: string;
}

export const ProjectMemoriesTab: React.FC<ProjectMemoriesTabProps> = ({
  projectPath,
  onViewClaudeFile,
  onCreateMemory,
  className,
}) => {
  const [claudeFiles, setClaudeFiles] = useState<ClaudeMdFile[]>([]);
  const [claudeFilesLoading, setClaudeFilesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const loadClaudeFiles = useCallback(async () => {
    setClaudeFilesLoading(true);
    try {
      const files = await api.findClaudeMdFiles(projectPath);
      // Sort by relative path for consistent ordering
      const sortedFiles = files.sort((a, b) => a.relative_path.localeCompare(b.relative_path));
      setClaudeFiles(sortedFiles);
    } catch (error) {
      console.error("Failed to load Claude files:", error);
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

    window.addEventListener('file-deleted', handleFileDeleted as EventListener);
    
    return () => {
      window.removeEventListener('file-deleted', handleFileDeleted as EventListener);
    };
  }, [projectPath, loadClaudeFiles]);

  // Handle clicking on a memory card to view
  const handleCardClick = (file: ClaudeMdFile) => {
    onViewClaudeFile?.(file);
  };

  // Handle create memory button click
  const handleCreateMemory = () => {
    setSelectedPath("");
    setShowAddDialog(true);
  };

  // Check if a directory already contains a CLAUDE.md file
  const hasExistingMemory = (directoryPath: string): boolean => {
    return claudeFiles.some(file => {
      const fileDir = file.absolute_path.substring(0, file.absolute_path.lastIndexOf('/'));
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
        console.warn(`Directory ${entry.path} already contains a CLAUDE.md file`);
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
        relative_path: fullPath.replace(projectPath, '').replace(/^\//, ''),
        size: initialContent.length,
        modified: Date.now() / 1000,
      };
      
      onViewClaudeFile?.(newFile);
    } catch (error) {
      console.error("Failed to create memory file:", error);
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
    return selectedPath.replace(projectPath, '').replace(/^\//, '') || '(project root)';
  };

  // Filter memories based on search query
  const filteredFiles = claudeFiles.filter((file) =>
    file.relative_path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="relative">
      <DebugLabel label="ProjectMemoriesTab" />
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header with search and add button */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">Memories</h3>
              <p className="text-sm text-muted-foreground">
                Manage CLAUDE.md files containing project context and memories.
              </p>
            </div>
            <Button
              onClick={handleCreateMemory}
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Memory
            </Button>
          </div>

          {/* Search bar */}
          {claudeFiles.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          )}

          {claudeFilesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredFiles.length === 0 ? (
                <motion.div
                  key="no-files"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-8"
                >
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  {claudeFiles.length === 0 ? (
                    <>
                      <h3 className="text-lg font-medium text-muted-foreground mb-2">
                        No memories found
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create your first CLAUDE.md file to store project context and memories.
                      </p>
                      <Button onClick={handleCreateMemory} size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create First Memory
                      </Button>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-medium text-muted-foreground mb-2">
                        No memories match your search
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Try adjusting your search query or clear the filter.
                      </p>
                    </>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="files-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {filteredFiles.map((file, index) => (
                    <motion.div
                      key={file.absolute_path}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleCardClick(file)}
                      className={cn(
                        "group flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-card-hover hover:border-hover transition-colors cursor-pointer",
                        className
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex-shrink-0">
                          <FileText className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium truncate">
                              {file.relative_path.split('/').pop() || file.relative_path}
                            </p>
                            {file.relative_path.includes('/') && (
                              <span className="text-xs text-muted-foreground font-mono">
                                {file.relative_path.split('/').slice(0, -1).join('/')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatUnixTimestamp(file.modified)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <HardDrive className="h-3 w-3" />
                              <span>{(file.size / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
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
              <label className="text-sm font-medium mb-2 block">Directory</label>
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
              A new <code className="bg-muted px-1 py-0.5 rounded font-mono text-xs">CLAUDE.md</code> file will be created in the selected directory.
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
            <Button variant="outline" onClick={handleCancel} disabled={creating}>
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