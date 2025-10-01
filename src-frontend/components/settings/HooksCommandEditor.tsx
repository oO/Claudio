import React, { useState, useEffect } from "react";
import { ArrowLeft, Save, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DebugLabel } from "@/components/ui/atoms";
import { logger } from "@/lib/logger";
import { invoke } from "@tauri-apps/api/core";
import { homeDir } from "@tauri-apps/api/path";

interface HooksCommandEditorProps {
  filePath: string;
  onBack: () => void;
  containerHeight?: number;
}

export const HooksCommandEditor: React.FC<HooksCommandEditorProps> = ({
  filePath,
  onBack,
  containerHeight,
}) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);

  // Expand tilde in file paths
  const expandPath = async (path: string): Promise<string> => {
    if (path.startsWith('~')) {
      const home = await homeDir();
      return path.replace('~', home.replace(/\/$/, '')); // Remove trailing slash from home
    }
    return path;
  };

  // Load file content
  useEffect(() => {
    const loadFile = async () => {
      try {
        setLoading(true);
        setError(null);
        // Expand tilde in file path and use backend command for any text file
        const expandedPath = await expandPath(filePath);
        const fileContent = await invoke<string>("read_text_file", { filePath: expandedPath });
        logger.info("Loaded file content:", { path: expandedPath, contentLength: fileContent.length, preview: fileContent.substring(0, 100) });
        setContent(fileContent);
      } catch (error) {
        logger.error("Failed to load script file:", error);
        setError(`Failed to load file: ${error}`);
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [filePath]);

  const handleBack = () => {
    if (hasChanges) {
      setUnsavedDialogOpen(true);
    } else {
      onBack();
    }
  };

  const handleConfirmLeave = () => {
    setUnsavedDialogOpen(false);
    onBack();
  };

  const handleCancelLeave = () => {
    setUnsavedDialogOpen(false);
  };

  const handleSave = async () => {
    try {
      // Expand tilde in file path and use backend command for any text file
      const expandedPath = await expandPath(filePath);
      await invoke("write_text_file", { filePath: expandedPath, content });
      setHasChanges(false);
      logger.info("Saved script file:", expandedPath);
    } catch (error) {
      logger.error("Failed to save script file:", error);
      setError(`Failed to save file: ${error}`);
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
  };

  // Get file extension for syntax highlighting
  const getFileExtension = (path: string) => {
    const parts = path.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  };

  const extension = getFileExtension(filePath);

  return (
    <div className="flex flex-col h-full relative">
      <DebugLabel label="HooksCommandEditor" />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-accent" />
            <span className="font-mono text-sm">{filePath}</span>
          </div>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          className="gap-2"
          disabled={!hasChanges}
        >
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>

      {/* Content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-hidden"
        style={containerHeight ? {
          height: `${containerHeight}px`,
        } : {}}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-muted-foreground">Loading file...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-destructive text-center">
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="w-full h-full p-4 bg-background font-mono text-sm resize-none focus:outline-none"
            spellCheck={false}
            placeholder="Enter your script here..."
          />
        )}
      </div>

      {/* Footer with file info */}
      <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
        <span>
          {extension && `${extension.toUpperCase()} file`}
        </span>
        {content && (
          <span>
            {content.split('\n').length} lines
          </span>
        )}
      </div>

      {/* Unsaved Changes Dialog */}
      <Dialog open={unsavedDialogOpen} onOpenChange={setUnsavedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Are you sure you want to leave?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelLeave}>
              Stay
            </Button>
            <Button variant="destructive" onClick={handleConfirmLeave}>
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};