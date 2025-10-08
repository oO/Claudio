import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DebugLabel } from "@/components/ui/atoms";

export interface ManagerEmptyStateProps {
  /**
   * Icon component to display
   */
  icon: LucideIcon;
  /**
   * Title text
   */
  title: string;
  /**
   * Description text
   */
  description: string;
  /**
   * Optional action button(s)
   */
  action?: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Shared empty state component for all managers
 * Provides consistent centered empty state with icon, title, description, and optional action
 */
export const ManagerEmptyState: React.FC<ManagerEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div className={cn("text-center py-8 relative", className)}>
      <DebugLabel label="ManagerEmptyState" />
      <Icon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium text-muted-foreground mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {action}
    </div>
  );
};
