import React from "react";
import { cn } from "@/lib/utils";

export interface ColumnHeaderProps {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isRequired?: boolean;
  className?: string;
}

export const ColumnHeader: React.FC<ColumnHeaderProps> = ({
  name,
  type,
  isPrimaryKey = false,
  isRequired = false,
  className
}) => {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-1">
        <span className="font-medium">{name}</span>
        {isPrimaryKey && (
          <span className="text-[10px] text-primary font-semibold bg-primary/10 px-1 rounded">
            PK
          </span>
        )}
        {isRequired && !isPrimaryKey && (
          <span className="text-[10px] text-destructive">*</span>
        )}
      </div>
      <div className="text-[10px] font-normal text-muted-foreground">
        {type}
      </div>
    </div>
  );
};