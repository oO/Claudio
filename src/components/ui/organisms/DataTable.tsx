import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Edit3, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ColumnHeader } from "@/components/ui/atoms/ColumnHeader";
import { PaginationControls } from "@/components/ui/molecules/PaginationControls";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ColumnInfo {
  cid: number;
  name: string;
  type_name: string;
  notnull: boolean;
  dflt_value: string | null;
  pk: boolean;
}

export interface TableData {
  table_name: string;
  columns: ColumnInfo[];
  rows: Record<string, any>[];
  total_rows: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DataTableProps {
  data: TableData;
  onEditRow: (row: Record<string, any>) => void;
  onDeleteRow: (row: Record<string, any>) => void;
  onPageChange: (page: number) => void;
  className?: string;
}

const formatCellValue = (value: any, maxLength: number = 50): string => {
  if (value === null) return "NULL";
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  
  const stringValue = String(value);
  if (stringValue.length > maxLength) {
    return stringValue.substring(0, maxLength) + "...";
  }
  return stringValue;
};

export const DataTable: React.FC<DataTableProps> = ({
  data,
  onEditRow,
  onDeleteRow,
  onPageChange,
  className
}) => {
  return (
    <Card className={className}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {data.columns.map((column) => (
                <th
                  key={column.name}
                  className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                >
                  <ColumnHeader
                    name={column.name}
                    type={column.type_name}
                    isPrimaryKey={column.pk}
                    isRequired={column.notnull}
                  />
                </th>
              ))}
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {data.rows.map((row, index) => (
                <motion.tr
                  key={index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border-b hover:bg-muted/25 transition-colors"
                >
                  {data.columns.map((column) => {
                    const value = row[column.name];
                    const formattedValue = formatCellValue(value, 50);
                    const fullValue = value === null ? "NULL" : 
                                    value === undefined ? "" : 
                                    typeof value === "object" ? JSON.stringify(value, null, 2) : 
                                    String(value);
                    const isTruncated = fullValue.length > 50;
                    
                    return (
                      <td
                        key={column.name}
                        className="px-3 py-2 text-xs font-mono"
                      >
                        {isTruncated ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help block truncate max-w-[200px]">
                                  {formattedValue}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent 
                                side="bottom" 
                                className="max-w-[500px] max-h-[300px] overflow-auto"
                              >
                                <pre className="text-xs whitespace-pre-wrap">{fullValue}</pre>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="block truncate max-w-[200px]">
                            {formattedValue}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEditRow(row)}
                        className="h-6 w-6"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteRow(row)}
                        className="h-6 w-6 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={data.page}
        totalPages={data.total_pages}
        totalItems={data.total_rows}
        itemsPerPage={data.page_size}
        onPageChange={onPageChange}
        size="sm"
        showItemCount={true}
      />
    </Card>
  );
};