import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Loader2, Eye, Edit, Split, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toast, ToastContainer } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThemedMDEditor } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DebugLabel } from "@/components/ui/atoms";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { logger } from "@/lib/logger";

type PreviewMode = "edit" | "preview" | "live";

interface MarkdownEditorProps {
  /**
   * Function to load the file content
   */
  loadContent: () => Promise<string>;
  /**
   * Function to save the file content
   */
  saveContent: (content: string) => Promise<void>;
  /**
   * Optional function to delete the file
   */
  onDelete?: () => Promise<void>;
  /**
   * Optional callback when back button is clicked
   */
  onBack?: () => void;
  /**
   * Title for the editor (e.g., "CLAUDE.md", "README.md")
   */
  title: string;
  /**
   * Subtitle/description text
   */
  subtitle: string;
  /**
   * Optional file path (displayed in monospace font)
   */
  path?: string;
  /**
   * Initial display mode for the editor
   * @default "preview"
   */
  initialMode?: PreviewMode;
  /**
   * Whether to show the delete button
   * @default false
   */
  showDeleteButton?: boolean;
  /**
   * Whether to use TabPageLayout wrapper (true) or custom header (false)
   * @default false
   */
  useTabLayout?: boolean;
  /**
   * Optional render prop for custom actions
   */
  renderActions?: (props: {
    currentMode: PreviewMode;
    setCurrentMode: (mode: PreviewMode) => void;
    handleSave: () => void;
    hasChanges: boolean;
    saving: boolean;
  }) => React.ReactNode;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Generic MarkdownEditor component for editing any markdown files
 * Handles loading, saving, preview modes, and unsaved changes tracking
 *
 * @example
 * // For global CLAUDE.md
 * <MarkdownEditor
 *   loadContent={() => claudeApi.getSystemPrompt()}
 *   saveContent={(content) => claudeApi.saveSystemPrompt(content)}
 *   title="CLAUDE.md"
 *   subtitle="Global Claude Code configuration"
 *   useTabLayout={true}
 * />
 *
 * @example
 * // For project-specific files
 * <MarkdownEditor
 *   loadContent={() => claudeApi.readClaudeMdFile(filePath)}
 *   saveContent={(content) => claudeApi.saveClaudeMdFile(filePath, content)}
 *   onDelete={() => claudeApi.deleteFile(filePath)}
 *   onBack={() => goBack()}
 *   title="project/CLAUDE.md"
 *   subtitle="Edit project-specific Claude Code system prompt"
 *   showDeleteButton={true}
 * />
 */
export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  loadContent,
  saveContent,
  onDelete,
  onBack,
  title,
  subtitle,
  path,
  initialMode = "preview",
  showDeleteButton = false,
  useTabLayout = false,
  renderActions,
  className,
}) => {
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [currentMode, setCurrentMode] = useState<PreviewMode>(initialMode);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);

  const hasChanges = content !== originalContent;

  // Automatically sync unsaved changes state with the tab
  const { markAsSaved } = useUnsavedChanges(hasChanges);

  // Load the file content on mount
  useEffect(() => {
    loadFileContent();
  }, []);

  const loadFileContent = async () => {
    try {
      setLoading(true);
      setError(null);
      const fileContent = await loadContent();
      setContent(fileContent);
      setOriginalContent(fileContent);
    } catch (err) {
      logger.error("Failed to load file:", err);
      setError("Failed to load file");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setToast(null);
      await saveContent(content);
      setOriginalContent(content);
      markAsSaved(); // Clear the unsaved changes flag
      setToast({ message: "File saved", type: "success" });
    } catch (err) {
      logger.error("Failed to save file:", err);
      setError("Failed to save file");
      setToast({ message: "Failed to save file", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (!onBack) return;

    if (hasChanges) {
      setUnsavedDialogOpen(true);
    } else {
      onBack();
    }
  };

  const handleConfirmLeave = () => {
    setUnsavedDialogOpen(false);
    onBack?.();
  };

  const handleCancelLeave = () => {
    setUnsavedDialogOpen(false);
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!onDelete) return;

    setDeleting(true);
    try {
      await onDelete();
      setDeleteDialogOpen(false);
      onBack?.(); // Go back after successful deletion
    } catch (error) {
      logger.error("Failed to delete file:", error);
      setToast({ message: "Failed to delete file", type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  // Default actions render
  const defaultActions = () => (
    <>
      <div className="flex items-center border border-border rounded-lg overflow-hidden">
        <Button
          variant={currentMode === "preview" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentMode("preview")}
          className="h-8 px-3 text-xs rounded-none rounded-l-md border-0"
        >
          <Eye className="h-3 w-3 mr-1" />
          View
        </Button>
        <Button
          variant={currentMode === "edit" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentMode("edit")}
          className="h-8 px-3 text-xs rounded-none border-0 border-l border-r border-border/50"
        >
          <Edit className="h-3 w-3 mr-1" />
          Edit
        </Button>
        <Button
          variant={currentMode === "live" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentMode("live")}
          className="h-8 px-3 text-xs rounded-none rounded-r-md border-0"
        >
          <Split className="h-3 w-3 mr-1" />
          Live
        </Button>
      </div>

      <Button
        onClick={handleSave}
        disabled={!hasChanges || saving}
        size="sm"
        className="h-8"
      >
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        {saving ? "Saving..." : "Save"}
      </Button>

      {showDeleteButton && onDelete && (
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeleteClick}
          className="h-8"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      )}
    </>
  );

  const actions = renderActions
    ? renderActions({ currentMode, setCurrentMode, handleSave, hasChanges, saving })
    : defaultActions();

  // Custom header layout (used by ClaudeFileEditor)
  const customHeaderLayout = (
    <div className={cn("relative flex flex-col h-full bg-background", className)}>
      <DebugLabel label="MarkdownEditor" />
      <div className="w-full max-w-5xl mx-auto flex flex-col h-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between p-4 border-b border-border"
        >
          <div className="flex items-center space-x-3">
            {onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold tracking-tight text-accent truncate">{title}</h1>
              {path && (
                <p className="mt-1 text-sm text-muted-foreground font-mono">
                  {path}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">{actions}</div>
        </motion.div>

        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-4 mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive"
          >
            {error}
          </motion.div>
        )}

        {/* Editor */}
        <div className="flex-1 p-4 overflow-hidden min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ThemedMDEditor
              value={content}
              onChange={(val) => setContent(val || "")}
              preview={currentMode}
            />
          )}
        </div>
      </div>

      {/* Toast Notification */}
      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>

      {/* Delete confirmation dialog */}
      {showDeleteButton && onDelete && (
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Delete File
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{title}"?
                <br />
                <span className="text-destructive font-medium">This action cannot be undone.</span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={handleDeleteCancel} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Unsaved Changes Dialog */}
      {onBack && (
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
      )}
    </div>
  );

  // For TabPageLayout usage - just return the editor content
  if (useTabLayout) {
    return (
      <>
        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-6 mt-6 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive"
          >
            {error}
          </motion.div>
        )}

        {/* Editor */}
        <div className="flex-1 p-6 overflow-hidden min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ThemedMDEditor
              value={content}
              onChange={(val) => setContent(val || "")}
              preview={currentMode}
            />
          )}
        </div>

        {/* Toast Notification */}
        <ToastContainer>
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onDismiss={() => setToast(null)}
            />
          )}
        </ToastContainer>
      </>
    );
  }

  // Default: custom header layout
  return customHeaderLayout;
};

// Export helper for creating action buttons
export const createMarkdownEditorActions = (props: {
  currentMode: PreviewMode;
  setCurrentMode: (mode: PreviewMode) => void;
  handleSave: () => void;
  hasChanges: boolean;
  saving: boolean;
}) => {
  const { currentMode, setCurrentMode, handleSave, hasChanges, saving } = props;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center border border-border rounded-lg overflow-hidden">
        <Button
          variant={currentMode === "preview" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentMode("preview")}
          className="h-8 px-3 text-xs rounded-none rounded-l-md border-0"
        >
          <Eye className="h-3 w-3 mr-1" />
          View
        </Button>
        <Button
          variant={currentMode === "edit" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentMode("edit")}
          className="h-8 px-3 text-xs rounded-none border-0 border-l border-r border-border/50"
        >
          <Edit className="h-3 w-3 mr-1" />
          Edit
        </Button>
        <Button
          variant={currentMode === "live" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentMode("live")}
          className="h-8 px-3 text-xs rounded-none rounded-r-md border-0"
        >
          <Split className="h-3 w-3 mr-1" />
          Live
        </Button>
      </div>

      <Button
        onClick={handleSave}
        disabled={!hasChanges || saving}
        size="sm"
        className="h-8"
      >
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
};
