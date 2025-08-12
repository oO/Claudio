import React from 'react';
import { cn } from '@/lib/utils';

interface AgentAvatarProps {
  agentType: "main" | "subagent";
  agentName: string;
  icon?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const AgentAvatar: React.FC<AgentAvatarProps> = ({
  agentType,
  agentName,
  icon,
  color,
  size = "md",
  className
}) => {
  // Default icons and colors
  const defaultIcon = agentType === "main" ? "🤖" : "⚡";
  const defaultColor = agentType === "main" ? "#6366f1" : "#8b5cf6";
  
  const displayIcon = icon || defaultIcon;
  const displayColor = color || defaultColor;
  
  // Size classes
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base"
  };
  
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-semibold",
        sizeClasses[size],
        className
      )}
      style={{
        backgroundColor: `${displayColor}20`,
        border: `2px solid ${displayColor}`
      }}
      title={agentName}
    >
      <span className="select-none">{displayIcon}</span>
    </div>
  );
};

export default AgentAvatar;