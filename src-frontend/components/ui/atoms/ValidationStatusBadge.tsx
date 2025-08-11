import React from "react";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ValidationStatusBadgeProps {
  status: 'valid' | 'warning' | 'error';
  count?: number;
  className?: string;
}

export const ValidationStatusBadge: React.FC<ValidationStatusBadgeProps> = ({
  status,
  count,
  className
}) => {
  const getConfig = () => {
    switch (status) {
      case 'valid':
        return {
          variant: 'default' as const,
          icon: <CheckCircle className="h-3 w-3" />,
          label: 'Valid',
          className: 'bg-green-500/10 text-green-600 border-green-500/20'
        };
      case 'warning':
        return {
          variant: 'outline' as const,
          icon: <AlertTriangle className="h-3 w-3" />,
          label: 'Warning',
          className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
        };
      case 'error':
        return {
          variant: 'destructive' as const,
          icon: <XCircle className="h-3 w-3" />,
          label: 'Error',
          className: 'bg-red-500/10 text-red-600 border-red-500/20'
        };
    }
  };

  const config = getConfig();

  return (
    <Badge 
      variant={config.variant}
      className={cn(config.className, "flex items-center gap-1", className)}
    >
      {config.icon}
      {config.label}
      {count !== undefined && count > 0 && (
        <span className="ml-1">{count}</span>
      )}
    </Badge>
  );
};