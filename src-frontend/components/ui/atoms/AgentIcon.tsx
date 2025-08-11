import React from "react";
import { Bot, LucideIcon } from "lucide-react";
import { ICON_MAP as AGENT_ICONS } from "@/components/common";
import { cn } from "@/lib/utils";

export interface AgentIconProps {
  iconName?: string;
  size?: "sm" | "default" | "lg" | "xl";
  className?: string;
  fallbackIcon?: LucideIcon;
}

export const AgentIcon: React.FC<AgentIconProps> = ({
  iconName,
  size = "default",
  className,
  fallbackIcon = Bot
}) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    default: "h-5 w-5",
    lg: "h-6 w-6",
    xl: "h-8 w-8"
  };

  // Get the appropriate icon
  let IconComponent = fallbackIcon;
  if (iconName && iconName in AGENT_ICONS) {
    IconComponent = AGENT_ICONS[iconName as keyof typeof AGENT_ICONS];
  }

  return (
    <IconComponent className={cn(
      "text-muted-foreground",
      sizeClasses[size],
      className
    )} />
  );
};