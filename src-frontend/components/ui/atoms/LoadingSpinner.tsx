import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoadingSpinnerProps {
  size?: "sm" | "default" | "lg";
  className?: string;
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "default",
  className,
  message
}) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    default: "h-6 w-6",
    lg: "h-8 w-8"
  };

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Loader2 className={cn(
        "animate-spin text-muted-foreground",
        sizeClasses[size]
      )} />
      {message && (
        <span className="text-sm text-muted-foreground">{message}</span>
      )}
    </div>
  );
};