import React from "react";
import { FileText, Code, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type OutputFormat = "jsonl" | "markdown" | "raw";

export interface OutputFormatBadgeProps {
  format: OutputFormat;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export const OutputFormatBadge: React.FC<OutputFormatBadgeProps> = ({
  format,
  size = "default",
  className
}) => {
  const formatConfig = {
    jsonl: {
      icon: Code,
      label: "JSONL",
      classes: "bg-purple-500/10 text-purple-600 border-purple-500/50 dark:text-purple-400"
    },
    markdown: {
      icon: FileText,
      label: "Markdown",
      classes: "bg-blue-500/10 text-blue-600 border-blue-500/50 dark:text-blue-400"
    },
    raw: {
      icon: Download,
      label: "Raw",
      classes: "bg-gray-500/10 text-gray-600 border-gray-500/50 dark:text-gray-400"
    }
  };

  const config = formatConfig[format];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    default: "text-xs px-2.5 py-1",
    lg: "text-sm px-3 py-1.5"
  };

  const iconSizeClasses = {
    sm: "h-3 w-3",
    default: "h-3.5 w-3.5",
    lg: "h-4 w-4"
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-medium border",
        sizeClasses[size],
        config.classes,
        className
      )}
    >
      <Icon className={iconSizeClasses[size]} />
      {config.label}
    </Badge>
  );
};