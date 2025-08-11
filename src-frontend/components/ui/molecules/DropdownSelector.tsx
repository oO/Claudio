import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownSelectorProps {
  label: string;
  value: string;
  placeholder?: string;
  onClick: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const DropdownSelector: React.FC<DropdownSelectorProps> = ({
  label,
  value,
  placeholder = "Select...",
  onClick,
  children,
  className
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "h-10 px-3 py-2 bg-background border border-input rounded-md cursor-pointer",
        "hover:bg-accent hover:text-accent-foreground transition-colors",
        "flex items-center justify-between",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {children}
        <span className="text-sm">{value || placeholder}</span>
      </div>
      <ChevronDown className="h-4 w-4 text-muted-foreground" />
    </div>
  );
};