import React from "react";
import { Shield, PlayCircle, Zap, Code2, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { HookEvent } from "@/types/hooks";

export interface EventIconProps {
  event: HookEvent;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const EventIcon: React.FC<EventIconProps> = ({
  event,
  className,
  size = 'md'
}) => {
  const getIcon = () => {
    switch (event) {
      case 'PreToolUse':
        return Shield;
      case 'PostToolUse':
        return PlayCircle;
      case 'Notification':
        return Zap;
      case 'Stop':
        return Code2;
      case 'SubagentStop':
        return Terminal;
      default:
        return Code2;
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'h-3 w-3';
      case 'md': return 'h-4 w-4';
      case 'lg': return 'h-5 w-5';
    }
  };

  const Icon = getIcon();
  
  return (
    <Icon className={cn(getSizeClass(), className)} />
  );
};