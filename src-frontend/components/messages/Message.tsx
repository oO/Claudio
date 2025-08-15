import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ClaudeStreamMessage } from '@/components/agents';
import { MessageFooter } from './MessageFooter';

interface MessageContainerProps {
  message: ClaudeStreamMessage;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

interface MessageHeaderProps {
  icon: React.ReactNode;
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
 * No variant-specific styling - each message component controls its own styling
 */
const Container: React.FC<MessageContainerProps> = ({
  message,
  children,
  className,
  contentClassName,
}) => {
  return (
    <Card className={cn('relative', className)}>
      <CardContent className={cn('p-4', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
};

/**
 * Header component with icon + title layout
 */
const Header: React.FC<MessageHeaderProps> = ({
  icon,
  title,
  titleClassName = 'text-base font-semibold',
  children,
}) => {
  return (
    <div className="flex items-start gap-3">
      {/* Icon with consistent positioning */}
      <div className="mt-1">
        {icon}
      </div>
      
      {/* Content wrapper with flex-1 min-w-0 for text truncation */}
      <div className="flex-1 min-w-0">
        {/* Title with customizable styling */}
        <div className={cn(titleClassName)}>
          {title}
        </div>
        
        {/* Main content area */}
        {children && (
          <div className="mt-3 space-y-2">
            {children}
          </div>
        )}
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
export const Message = {
  Container,
  Header,
  Content,
  Footer,
};