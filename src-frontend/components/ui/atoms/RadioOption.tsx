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
        "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-card-hover hover:border-hover transition-colors text-left",
        selected ? "text-accent" : "",
        className
      )}
    >
      <input
        type="radio"
        checked={selected}
        onChange={() => {}} // Handled by button onClick
        className="w-4 h-4 rounded-full pointer-events-none"
      />
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="text-xs opacity-70">{description}</div>
        )}
      </div>
    </button>
  );
};