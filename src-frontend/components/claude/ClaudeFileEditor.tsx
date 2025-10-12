import React from "react";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { claudeApi, type ClaudeMdFile } from "@/lib/api";

interface ClaudeFileEditorProps {
  /**
   * The CLAUDE.md file to edit
   */
  file: ClaudeMdFile;
  /**
   * Callback to go back to the previous view
   */
  onBack: () => void;
  /**
   * Initial display mode for the editor
   * @default "preview"
   */
  initialMode?: "edit" | "preview" | "live";
  /**
   * Callback when the file is deleted
   */
  onDelete?: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * ClaudeFileEditor component for editing project-specific CLAUDE.md files
 *
 * @example
 * <ClaudeFileEditor
 *   file={claudeMdFile}
 *   onBack={() => setEditingFile(null)}
 * />
 */
export const ClaudeFileEditor: React.FC<ClaudeFileEditorProps> = ({
  file,
  onBack,
  initialMode = "preview",
  onDelete,
  className,
}) => {
  const handleDelete = async () => {
    await claudeApi.deleteFile(file.absolute_path);
    onDelete?.();
  };

  return (
    <MarkdownEditor
      loadContent={() => claudeApi.readClaudeMdFile(file.absolute_path)}
      saveContent={(content) => claudeApi.saveClaudeMdFile(file.absolute_path, content)}
      onDelete={handleDelete}
      onBack={onBack}
      title={file.relative_path}
      subtitle="Edit project-specific Claude Code system prompt"
      initialMode={initialMode}
      showDeleteButton={true}
      className={className}
    />
  );
}; 