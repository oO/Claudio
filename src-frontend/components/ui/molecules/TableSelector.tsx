import React from "react";
import { Table } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableStatusBadge } from "@/components/ui/atoms/TableStatusBadge";
import { cn } from "@/lib/utils";

export interface TableInfo {
  name: string;
  row_count: number;
}

export interface TableSelectorProps {
  tables: TableInfo[];
  selectedTable: string;
  onTableSelect: (tableName: string) => void;
  placeholder?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
}

export const TableSelector: React.FC<TableSelectorProps> = ({
  tables,
  selectedTable,
  onTableSelect,
  placeholder = "Select a table",
  className,
  size = "default"
}) => {
  const sizeClasses = {
    sm: "h-8 text-xs",
    default: "h-9 text-sm", 
    lg: "h-10 text-base"
  };

  const iconSizes = {
    sm: "h-3 w-3",
    default: "h-4 w-4",
    lg: "h-5 w-5"
  };

  return (
    <Select value={selectedTable} onValueChange={onTableSelect}>
      <SelectTrigger className={cn("w-[200px]", sizeClasses[size], className)}>
        <SelectValue placeholder={placeholder}>
          {selectedTable && (
            <div className="flex items-center gap-2">
              <Table className={iconSizes[size]} />
              <span>{selectedTable}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {tables.map((table) => (
          <SelectItem key={table.name} value={table.name} className="text-xs">
            <div className="flex items-center justify-between w-full min-w-0">
              <span className="truncate">{table.name}</span>
              <TableStatusBadge 
                rowCount={table.row_count}
                size="sm"
                className="ml-2 shrink-0"
              />
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};