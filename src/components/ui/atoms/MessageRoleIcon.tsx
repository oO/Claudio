import React from "react";
import { User, Bot, Terminal, CircleUser } from "lucide-react";
import { cn } from "@/lib/utils";

export type MessageRole = "user" | "assistant" | "system";

interface MessageRoleIconProps {
  role: MessageRole;
  className?: string;
}

/**
 * Atomic component for displaying message role icons
 * Provides consistent iconography for user, assistant, and system messages
 */
export const MessageRoleIcon: React.FC<MessageRoleIconProps> = ({ role, className }) => {
  const baseClasses = "h-5 w-5 mt-0.5";
  const boldClasses = "h-5 w-5 mt-0.5 stroke-2"; // Bolder stroke for consistency
  
  switch (role) {
    case "user":
      return <CircleUser className={cn(baseClasses, "text-muted-foreground", className)} />;
    case "assistant":
      return <Bot className={cn(baseClasses, "text-primary", className)} />;
    case "system":
      return <Terminal className={cn(baseClasses, "text-blue-500", className)} />;
    default:
      return <CircleUser className={cn(baseClasses, "text-muted-foreground", className)} />;
  }
};