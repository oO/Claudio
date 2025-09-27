import React from "react";
import { cn } from "@/lib/utils";

export interface RadioOptionProps {
  id: string;
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}

export const RadioOption: React.FC<RadioOptionProps> = ({
  id,
  label,
  description,
  selected,
  onClick,
  className
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 px-4 py-2.5 rounded-full border-2 font-medium transition-all",
        "hover:scale-[1.02] active:scale-[0.98] text-left",
        selected 
          ? "border-primary bg-primary text-primary-foreground shadow-lg" 
          : "border-muted-foreground/30 hover:border-muted-foreground/50",
        className
      )}
    >
      <div className="flex items-center justify-start gap-2.5">
        <div className={cn(
          "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
          selected ? "border-primary-foreground" : "border-current"
        )}>
          {selected && (
            <div className="w-2 h-2 rounded-full bg-primary-foreground" />
          )}
        </div>
        <div className="text-left">
          <div className="text-sm font-semibold">{label}</div>
          {description && (
            <div className="text-xs opacity-80">{description}</div>
          )}
        </div>
      </div>
    </button>
  );
};