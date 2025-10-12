import React from "react";
import { motion } from "framer-motion";
import { FileText, Clock, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUnixTimestamp } from "@/lib/date-utils";
import type { ClaudeMdFile } from "@/lib/api";
import { DebugLabel, DeleteButton } from "@/components/ui/atoms";

interface MemoryCardProps {
  file: ClaudeMdFile;
  projectPath: string;
  onClick?: (file: ClaudeMdFile) => void;
  onDelete?: (file: ClaudeMdFile) => void;
  className?: string;
  animationDelay?: number;
}

/**
 * Card component for displaying CLAUDE.md memory files
 * Click card to view/edit the memory file
 */
export const MemoryCard: React.FC<MemoryCardProps> = ({
  file,
  projectPath,
  onClick,
  onDelete,
  className,
  animationDelay = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay }}
      onClick={() => onClick?.(file)}
      className={cn(
        "group relative flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-card-hover hover:border-hover transition-colors cursor-pointer",
        className,
      )}
    >
      <DebugLabel label="MemoryCard" />
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex-shrink-0 p-2">
          <FileText className="h-4 w-4" />
        </div>
        <div className="flex-1 min-h-0">
          <div className="mb-1">
            {(() => {
              const parts = file.relative_path.split("/");
              const filename = parts.pop();
              const directory = parts.join("/");

              return (
                <>
                  <p className="text-sm font-mono font-bold truncate">
                    ./{directory ? `${directory}/` : ''}
                  </p>
                  <p className="text-sm font-mono font-normal text-muted-foreground">
                    {filename}
                  </p>
                </>
              );
            })()}
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
      <div className="flex items-center gap-2">
        {onDelete && (
          <DeleteButton
            onClick={(e) => {
              e.stopPropagation();
              onDelete(file);
            }}
          />
        )}
      </div>
    </motion.div>
  );
};
