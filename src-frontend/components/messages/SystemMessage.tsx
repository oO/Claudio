import React from "react";
import {
  Settings,
  Info,
  AlertTriangle,
  Bug,
  Zap,
  HelpCircle,
} from "lucide-react";
import { DebugLabel } from "@/components/ui/atoms";
import { MessageTemplate } from "./MessageTemplate";
import type { ClaudeStreamMessage } from "@/lib/outputCache";
import { MessageEnhancementProvider } from "@/contexts/MessageEnhancementContext";
import { ToolWidgetTemplate } from "@/components/tools/ToolWidgetTemplate";
import { useAnsiStrip } from "@/hooks/useAnsiStrip";

interface SystemMessageProps {
  message: ClaudeStreamMessage;
}

/**
 * Component for rendering system messages (non-init system messages)
 * Uses ToolWidgetTemplate for consistent expand/collapse functionality
 */
export const SystemMessage: React.FC<SystemMessageProps> = ({ message }) => {
  const stripAnsi = useAnsiStrip();

  // Extract just the content for collapsed view
  const rawContent = (message as any).content || "";
  const cleanContent = stripAnsi(rawContent);
  // Show raw JSON of the entire message for expanded view
  const fullJson = JSON.stringify(message, null, 2);
  const lineCount = fullJson
    .split("\n")
    .filter((line: string) => line.trim()).length;

  // Get subtype and determine icon
  const level = (message as any).level || "unknown";

  const getIconAndTitle = () => {
    switch (level.toLowerCase()) {
      case "info":
        return { icon: Info, title: "Info" };
      case "debug":
        return { icon: Bug, title: "Debug" };
      case "warn":
      case "warning":
        return { icon: AlertTriangle, title: "Warning" };
      case "error":
        return { icon: AlertTriangle, title: "Error" };
      case "trace":
        return { icon: Zap, title: "Trace" };
      default:
        return {
          icon: HelpCircle,
          title: level.charAt(0).toUpperCase() + level.slice(1),
        };
    }
  };

  const { icon, title } = getIconAndTitle();

  return (
    <MessageEnhancementProvider message={message}>
      <MessageTemplate.Container message={message}>
        <DebugLabel label="SystemMessage" />
        <MessageTemplate.Header
          IconComponent={Settings}
          iconClassName="bg-background text-info"
          title="System"
          titleClassName="w-full text-info"
        >
          <MessageTemplate.Content>
            <ToolWidgetTemplate>
              <ToolWidgetTemplate.ExpandableResult
                rawContent={fullJson}
                lineCount={lineCount}
                initiallyExpanded={false}
                largeContentThreshold={10}
                headerContent={
                  <div className="flex items-center gap-2">
                    {React.createElement(icon, { className: "h-3 w-3" })}
                    <span className="text-xs text-muted-foreground">{title}</span>
                  </div>
                }
              >
                {(excerptedContent, isShowingExcerpt, isExpanded) => (
                  <ToolWidgetTemplate.CodeOutput isExpanded={isExpanded}>
                    {isExpanded ? fullJson : cleanContent}
                  </ToolWidgetTemplate.CodeOutput>
                )}
              </ToolWidgetTemplate.ExpandableResult>
            </ToolWidgetTemplate>
          </MessageTemplate.Content>
        </MessageTemplate.Header>
        <MessageTemplate.Footer message={message} />
      </MessageTemplate.Container>
    </MessageEnhancementProvider>
  );
};
