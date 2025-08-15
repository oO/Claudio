import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClaudeStreamMessage } from "@/components/agents";
import { MessageFooter } from "./MessageFooter";
import type { LucideIcon } from "lucide-react";

interface MessageContainerProps {
  message: ClaudeStreamMessage;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

interface MessageHeaderProps {
  IconComponent: LucideIcon;
  iconClassName?: string;
  title: string;
  titleClassName?: string;
  children?: React.ReactNode;
}

interface MessageContentProps {
  children: React.ReactNode;
}

/**
 * Compound Message components using the dot notation pattern
 * Provides a clean, composable API for building message UI
 */
/**
 * Generic container component that provides consistent Card layout
 */
const Container: React.FC<MessageContainerProps> = ({
  message,
  children,
  className,
  contentClassName,
}) => {
  return (
    <Card className={cn("relative", className)}>
      <CardContent className={cn("p-3", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
};

/**
 * Header component with icon + title layout
 * Applies standard icon classes while allowing color customization
 */
const Header: React.FC<MessageHeaderProps> = ({
  IconComponent,
  iconClassName = "bg-accent",
  title,
  titleClassName = "text-foreground",
  children,
}) => {
  return (
    <div className="flex items-start gap-3">
      {/* Icon with consistent positioning and standard classes */}
      <div
        className={cn(
          "rounded-full p-2 flex items-center justify-center -mt-1 -ml-1",
          iconClassName,
        )}
      >
        <IconComponent className="h-4 w-4 text-foreground" />
      </div>

      {/* Content wrapper with flex-1 min-w-0 for text truncation */}
      <div className="flex-1 min-w-0">
        {/* Title with customizable styling */}
        <span className={cn("font-semibold", titleClassName)}>{title}</span>

        {/* Main content area */}
        {children && <div className="mt-3 space-y-2">{children}</div>}
      </div>
    </div>
  );
};

/**
 * Content component - simple wrapper for message content
 */
const Content: React.FC<MessageContentProps> = ({ children }) => {
  return <>{children}</>;
};

// Use MessageFooter directly as the Footer component
const Footer = MessageFooter;

/**
 * Export compound components using dot notation
 */
export const MessageTemplate = {
  Container,
  Header,
  Content,
  Footer,
};
