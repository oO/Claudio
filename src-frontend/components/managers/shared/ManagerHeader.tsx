import React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DebugLabel } from "@/components/ui/atoms";

export interface ManagerHeaderProps {
  /**
   * Title of the manager section
   */
  title: string;
  /**
   * Description text below the title
   */
  description: string;
  /**
   * Primary action button(s) - can be a single button or button group
   */
  action?: React.ReactNode;
  /**
   * Optional search configuration
   */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  /**
   * Optional scroll counter configuration
   */
  scrollCounter?: {
    start: number;
    end: number;
    total: number;
  };
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Shared header component for all manager components
 * Provides consistent title, description, action buttons, search, and scroll counter
 */
export const ManagerHeader: React.FC<ManagerHeaderProps> = ({
  title,
  description,
  action,
  search,
  scrollCounter,
  className,
}) => {
  return (
    <div className={cn("flex-none space-y-3 mb-4 relative", className)}>
      <DebugLabel label="ManagerHeader" />
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-accent">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        {action}
      </div>

      {/* Optional search row */}
      {search && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder || "Search..."}
            className="pl-9"
          />
        </div>
      )}

      {/* Optional scroll counter */}
      {scrollCounter && (
        <div className="bg-muted px-3 py-1 rounded-lg text-xs text-muted-foreground inline-block">
          {scrollCounter.start === scrollCounter.end
            ? `${scrollCounter.start} of ${scrollCounter.total}`
            : `${scrollCounter.start}-${scrollCounter.end} of ${scrollCounter.total}`}
        </div>
      )}
    </div>
  );
};
