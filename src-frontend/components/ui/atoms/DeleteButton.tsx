import React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeleteButtonProps {
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Shared delete button that appears on hover for cards
 * Shows trash icon, only visible on group hover
 */
export const DeleteButton: React.FC<DeleteButtonProps> = ({
  onClick,
  disabled = false,
  className,
}) => {
  return (
    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        disabled={disabled}
        className="h-6 w-6 text-muted-foreground hover:text-destructive disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};
