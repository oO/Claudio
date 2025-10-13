import React from "react";
import { motion } from "framer-motion";
import { Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OutputStyle } from "@/lib/types/output_styles";
import { DebugLabel, DeleteButton } from "@/components/ui/atoms";

interface OutputStyleCardProps {
  style: OutputStyle;
  onEdit?: (style: OutputStyle) => void;
  onDelete?: (style: OutputStyle) => void;
  className?: string;
  animationDelay?: number;
}

/**
 * OutputStyleCard component for displaying output styles
 * Click card to edit, hover to reveal delete button
 *
 * @example
 * <OutputStyleCard
 *   style={style}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * />
 */
export const OutputStyleCard: React.FC<OutputStyleCardProps> = ({
  style,
  onEdit,
  onDelete,
  className,
  animationDelay = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay }}
      onClick={() => onEdit?.(style)}
      className={cn(
        "group relative flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-card-hover hover:border-hover transition-colors cursor-pointer",
        className
      )}
    >
      <DebugLabel label="OutputStyleCard" />
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex-shrink-0 p-2">
          <div className="p-2 rounded-full flex-shrink-0 bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium truncate flex-1">
              {style.name}
            </p>
          </div>
          {style.description && (
            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
              {style.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{new Date(style.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span>{(style.content.length / 1024).toFixed(1)} KB</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onDelete && (
          <DeleteButton
            onClick={(e) => {
              e.stopPropagation();
              onDelete(style);
            }}
          />
        )}
      </div>
    </motion.div>
  );
};
