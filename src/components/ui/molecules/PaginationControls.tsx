import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
  size?: "sm" | "default" | "lg";
  showItemCount?: boolean;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className,
  size = "sm",
  showItemCount = true
}) => {
  if (totalPages <= 1) return null;

  const sizeClasses = {
    sm: "h-7 text-xs",
    default: "h-8 text-sm",
    lg: "h-9 text-base"
  };

  const iconSizes = {
    sm: "h-3 w-3",
    default: "h-4 w-4", 
    lg: "h-5 w-5"
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className={cn(
      "flex items-center justify-between p-3 border-t",
      className
    )}>
      {showItemCount && (
        <div className="text-xs text-muted-foreground">
          Showing {startItem.toLocaleString()} to {endItem.toLocaleString()} of{" "}
          {totalItems.toLocaleString()} results
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size={size}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn("gap-1", sizeClasses[size])}
        >
          <ChevronLeft className={iconSizes[size]} />
          Previous
        </Button>
        
        <div className={cn(
          "flex items-center gap-2 text-muted-foreground",
          sizeClasses[size]
        )}>
          Page {currentPage} of {totalPages}
        </div>
        
        <Button
          variant="outline"
          size={size}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn("gap-1", sizeClasses[size])}
        >
          Next
          <ChevronRight className={iconSizes[size]} />
        </Button>
      </div>
    </div>
  );
};