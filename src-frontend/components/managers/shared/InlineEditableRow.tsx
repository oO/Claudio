import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { DebugLabel } from "@/components/ui/atoms";

export interface InlineEditableRowProps {
  /**
   * Whether this row is currently being edited
   */
  isEditing: boolean;
  /**
   * Callback when user clicks to start editing
   */
  onStartEdit: () => void;
  /**
   * Callback when user clicks outside to stop editing
   */
  onStopEdit: () => void;
  /**
   * Content to display in normal (non-editing) mode
   */
  displayContent: React.ReactNode;
  /**
   * Content to display in editing mode
   */
  editContent: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Shared inline editable row component for all managers
 * Provides click-to-edit functionality with click-outside-to-close behavior
 *
 * Usage:
 * ```tsx
 * <InlineEditableRow
 *   isEditing={editingId === item.id}
 *   onStartEdit={() => setEditingId(item.id)}
 *   onStopEdit={() => setEditingId(null)}
 *   displayContent={<div>Normal view</div>}
 *   editContent={<div>Edit view</div>}
 * />
 * ```
 */
export const InlineEditableRow: React.FC<InlineEditableRowProps> = ({
  isEditing,
  onStartEdit,
  onStopEdit,
  displayContent,
  editContent,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Click outside to close edit mode
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onStopEdit();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing, onStopEdit]);

  return (
    <div ref={ref} className={cn("border-b last:border-b-0 relative", className)}>
      <DebugLabel label="InlineEditableRow" />
      {isEditing ? (
        <div className="p-3">{editContent}</div>
      ) : (
        <div
          className="p-3 hover:bg-muted/30 cursor-pointer transition-colors"
          onClick={onStartEdit}
        >
          {displayContent}
        </div>
      )}
    </div>
  );
};
