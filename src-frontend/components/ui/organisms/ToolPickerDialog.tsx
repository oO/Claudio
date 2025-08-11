import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ToolCategory {
  name: string;
  value: string;
  description: string;
}

export interface Tool {
  name: string;
  category: string;
  description: string;
}

export interface ToolPickerDialogProps {
  isOpen: boolean;
  selectedCategories: Set<string>;
  selectedTools: Set<string>;
  categories: ToolCategory[];
  tools: Tool[];
  onCategoryToggle: (categoryValue: string) => void;
  onToolToggle: (toolName: string) => void;
  onClose: () => void;
  title?: string;
  className?: string;
}

export const ToolPickerDialog: React.FC<ToolPickerDialogProps> = ({
  isOpen,
  selectedCategories,
  selectedTools,
  categories,
  tools,
  onCategoryToggle,
  onToolToggle,
  onClose,
  title = "Choose Agent Tools",
  className
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={cn(
        "bg-background border border-border rounded-lg p-6 shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto",
        className
      )}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        
        <div className="space-y-4">
          {/* Tool Categories */}
          <div>
            <h4 className="text-sm font-medium mb-3">Tool Categories</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categories.map((category) => (
                <button
                  key={category.value}
                  onClick={() => onCategoryToggle(category.value)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                    selectedCategories.has(category.value)
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.has(category.value)}
                    onChange={() => {}} // Handled by button onClick
                    className="w-4 h-4 rounded border-border pointer-events-none"
                  />
                  <div>
                    <div className="text-sm font-medium">{category.name}</div>
                    <div className="text-xs text-muted-foreground">{category.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Separator */}
          <hr className="border-border" />

          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? 'Hide individual tools' : 'Show individual tools'}
            <ChevronDown className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-180")} />
          </button>

          {/* Individual Tools */}
          {showAdvanced && (
            <div>
              <h4 className="text-sm font-medium mb-3">Individual Tools</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tools.map((tool) => (
                  <button
                    key={tool.name}
                    onClick={() => onToolToggle(tool.name)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                      selectedTools.has(tool.name)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTools.has(tool.name)}
                      onChange={() => {}} // Handled by button onClick
                      className="w-4 h-4 rounded border-border pointer-events-none"
                    />
                    <div>
                      <div className="text-sm font-medium">{tool.name}</div>
                      <div className="text-xs text-muted-foreground">{tool.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {selectedTools.size} of {tools.length} tools selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};