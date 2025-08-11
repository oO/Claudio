import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColumnInfo } from "@/components/ui/organisms/DataTable";

export interface RowEditorProps {
  isOpen: boolean;
  mode: "edit" | "create";
  tableName: string;
  columns: ColumnInfo[];
  initialData?: Record<string, any>;
  onSave: (data: Record<string, any>) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
  className?: string;
}

const getInputType = (column: ColumnInfo): string => {
  const type = column.type_name.toUpperCase();
  if (type.includes("INT")) return "number";
  if (type.includes("REAL") || type.includes("FLOAT") || type.includes("DOUBLE")) return "number";
  if (type.includes("BOOL")) return "checkbox";
  return "text";
};

export const RowEditor: React.FC<RowEditorProps> = ({
  isOpen,
  mode,
  tableName,
  columns,
  initialData = {},
  onSave,
  onClose,
  isLoading = false,
  className
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData);
    }
  }, [isOpen, initialData]);

  const handleSave = async () => {
    try {
      await onSave(formData);
    } catch (error) {
      // Error handling should be done by parent component
      console.error("Row editor save error:", error);
    }
  };

  const handleInputChange = (columnName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [columnName]: value
    }));
  };

  const title = mode === "edit" ? "Edit Row" : "New Row";
  const description = mode === "edit" 
    ? `Update the values for this row in the ${tableName} table.`
    : `Add a new row to the ${tableName} table.`;
  const saveButtonText = mode === "edit" ? "Update" : "Insert";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {columns.map((column) => (
            <div key={column.name} className="space-y-2">
              <Label htmlFor={`${mode}-${column.name}`}>
                {column.name}
                {column.pk && mode === "edit" && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (Primary Key)
                  </span>
                )}
                {column.notnull && mode === "create" && (
                  <span className="text-xs text-destructive ml-2">
                    (Required)
                  </span>
                )}
              </Label>
              
              {getInputType(column) === "checkbox" ? (
                <input
                  type="checkbox"
                  id={`${mode}-${column.name}`}
                  checked={!!formData[column.name]}
                  onChange={(e) =>
                    handleInputChange(column.name, e.target.checked)
                  }
                  disabled={(column.pk && mode === "edit") || isLoading}
                  className="h-4 w-4"
                />
              ) : (
                <Input
                  id={`${mode}-${column.name}`}
                  type={getInputType(column)}
                  value={formData[column.name] ?? ""}
                  onChange={(e) =>
                    handleInputChange(column.name, e.target.value)
                  }
                  disabled={(column.pk && mode === "edit") || isLoading}
                  placeholder={column.dflt_value || "NULL"}
                />
              )}
              
              <p className="text-xs text-muted-foreground">
                Type: {column.type_name}
                {column.notnull && ", NOT NULL"}
                {column.dflt_value && `, Default: ${column.dflt_value}`}
              </p>
            </div>
          ))}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              saveButtonText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};