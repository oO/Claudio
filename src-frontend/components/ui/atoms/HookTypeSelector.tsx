import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface HookTypeSelectorProps {
  scope: 'project' | 'local' | 'user';
  className?: string;
}

export const HookTypeSelector: React.FC<HookTypeSelectorProps> = ({
  scope,
  className
}) => {
  const getVariant = () => {
    switch (scope) {
      case 'project': return 'secondary';
      case 'local': return 'outline';
      case 'user': return 'default';
      default: return 'default';
    }
  };

  const getLabel = () => {
    switch (scope) {
      case 'project': return 'Project';
      case 'local': return 'Local';
      case 'user': return 'User';
      default: return scope;
    }
  };

  return (
    <Badge 
      variant={getVariant()} 
      className={cn(className)}
    >
      {getLabel()} Scope
    </Badge>
  );
};