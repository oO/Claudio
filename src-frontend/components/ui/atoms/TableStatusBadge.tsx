import React from "react";
import { cn } from "@/lib/utils";

export interface TableStatusBadgeProps {
  rowCount: number;
  variant?: "default" | "primary" | "secondary";
  size?: "sm" | "md";
  className?: string;
}

export const TableStatusBadge: React.FC<TableStatusBadgeProps> = ({
  rowCount,
  variant = "default",
  size = "sm",
  className
}) => {
  const baseClasses = "inline-flex items-center rounded-full font-medium";
  
  const variantClasses = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary text-secondary-foreground"
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm"
  };

  const formattedCount = rowCount.toLocaleString();

  return (
    <span className={cn(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      className
    )}>
      {formattedCount} {rowCount === 1 ? "row" : "rows"}
    </span>
  );
};