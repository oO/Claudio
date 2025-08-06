import React, { useState } from "react";
import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/atoms/LoadingSpinner";
import { StatusMessage } from "@/components/ui/molecules/StatusMessage";
import { DataTable, TableData, ColumnInfo } from "@/components/ui/organisms/DataTable";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface QueryResult {
  columns: string[];
  rows: any[][];
  rows_affected?: number;
  last_insert_rowid?: number;
}

export interface SqlEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (query: string) => Promise<QueryResult>;
  isLoading?: boolean;
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

export const SqlEditor: React.FC<SqlEditorProps> = ({
  isOpen,
  onClose,
  onExecute,
  isLoading = false,
  className
}) => {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  const handleExecute = async () => {
    if (!query.trim()) return;

    try {
      setExecuting(true);
      setError(null);
      const queryResult = await onExecute(query);
      setResult(queryResult);
    } catch (err) {
      console.error("SQL execution error:", err);
      setError(err instanceof Error ? err.message : "Failed to execute SQL");
      setResult(null);
    } finally {
      setExecuting(false);
    }
  };

  const handleClose = () => {
    setQuery("");
    setResult(null);
    setError(null);
    setExecuting(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>SQL Query Editor</DialogTitle>
          <DialogDescription>
            Execute raw SQL queries on the database. Use with caution.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden space-y-4">
          {/* Query Input */}
          <div className="space-y-2">
            <Label htmlFor="sql-query">SQL Query</Label>
            <Textarea
              id="sql-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SELECT * FROM agents LIMIT 10;"
              className="font-mono text-sm h-32 resize-none"
            />
          </div>

          {/* Error Display */}
          {error && (
            <StatusMessage
              type="error"
              message={error}
              onDismiss={() => setError(null)}
            />
          )}

          {/* Results Display */}
          {result && (
            <div className="space-y-2 flex-1 overflow-hidden">
              {result.rows_affected !== undefined ? (
                <StatusMessage
                  type="success"
                  message={`Query executed successfully. ${result.rows_affected} rows affected.${
                    result.last_insert_rowid ? ` Last insert ID: ${result.last_insert_rowid}` : ""
                  }`}
                />
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          {result.columns.map((col, i) => (
                            <th
                              key={i}
                              className="px-2 py-1 text-left font-medium"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, i) => (
                          <tr key={i} className="border-b">
                            {row.map((cell, j) => {
                              const formattedValue = formatCellValue(cell, 50);
                              const fullValue = cell === null ? "NULL" : 
                                              cell === undefined ? "" : 
                                              typeof cell === "object" ? JSON.stringify(cell, null, 2) : 
                                              String(cell);
                              const isTruncated = fullValue.length > 50;
                              
                              return (
                                <td key={j} className="px-2 py-1 font-mono">
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Loading State */}
          {executing && (
            <LoadingSpinner message="Executing query..." className="py-4" />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          <Button
            onClick={handleExecute}
            disabled={executing || !query.trim()}
          >
            {executing ? (
              <LoadingSpinner size="sm" />
            ) : (
              "Execute"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};