import React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ValidationFeedbackProps {
  warnings?: string[];
  errors?: string[];
  className?: string;
}

export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({
  warnings = [],
  errors = [],
  className
}) => {
  if (warnings.length === 0 && errors.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-3 bg-red-500/10 rounded-md space-y-1">
          <p className="text-sm font-medium text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Validation Errors:
          </p>
          {errors.map((error, i) => (
            <p key={i} className="text-xs text-red-600 ml-6">• {error}</p>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="p-3 bg-yellow-500/10 rounded-md space-y-1">
          <p className="text-sm font-medium text-yellow-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Security Warnings:
          </p>
          {warnings.map((warning, i) => (
            <p key={i} className="text-xs text-yellow-600 ml-6">• {warning}</p>
          ))}
        </div>
      )}
    </div>
  );
};