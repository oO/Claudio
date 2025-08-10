import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Clock,
  HardDrive,
  FolderOpen,
  FileCode,
  Edit,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatUnixTimestamp,
  truncateText,
} from "@/lib/date-utils";
import type { ClaudeMdFile } from "@/lib/api";
import { api } from "@/lib/api";
import { DebugLabel } from "@/components/ui/atoms";

interface ProjectMemoriesTabProps {
  projectPath: string;
  onEditClaudeFile?: (file: ClaudeMdFile) => void;
  className?: string;
}

export const ProjectMemoriesTab: React.FC<ProjectMemoriesTabProps> = ({
  projectPath,
  onEditClaudeFile,
  className,
}) => {
  const [claudeFiles, setClaudeFiles] = useState<ClaudeMdFile[]>([]);
  const [claudeFilesLoading, setClaudeFilesLoading] = useState(false);

  // Load Claude files
  useEffect(() => {
    loadClaudeFiles();
  }, [projectPath]);

  const loadClaudeFiles = async () => {
    setClaudeFilesLoading(true);
    try {
      const files = await api.findClaudeMdFiles(projectPath);
      setClaudeFiles(files);
    } catch (error) {
      console.error("Failed to load Claude files:", error);
      setClaudeFiles([]);
    } finally {
      setClaudeFilesLoading(false);
    }
  };

  return (
    <Card className="relative">
      <DebugLabel label="ProjectMemoriesTab" />
      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Memories</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Manage CLAUDE.md files containing project context and memories.
            </p>
          </div>

          {claudeFilesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {claudeFiles.length === 0 ? (
                <motion.div
                  key="no-files"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-8"
                >
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">
                    No CLAUDE.md files found
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Create a CLAUDE.md file in your project to store context and
                    memories for Claude Code.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="files-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {claudeFiles.map((file, index) => (
                    <motion.div
                      key={file.absolute_path}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "group flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
                        className
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex-shrink-0">
                          <FileCode className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium truncate">
                              {file.relative_path}
                            </p>
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
                            <div className="flex items-center gap-1">
                              <FolderOpen className="h-3 w-3" />
                              <span className="font-mono text-xs">
                                {truncateText(file.absolute_path, 50)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditClaudeFile?.(file)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </CardContent>
    </Card>
  );
};