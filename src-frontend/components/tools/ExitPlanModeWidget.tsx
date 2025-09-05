import React from "react";
import {
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";
import { MarkdownRenderer } from "@/components/ui/molecules/MarkdownRenderer";
import { useToolStatus } from "@/contexts/MessageEnhancementContext";
import type { ClaudeStreamMessage } from "@/lib/outputCache";

interface ExitPlanModeWidgetProps {
  /** The assistant message containing the ExitPlanMode tool call */
  message: ClaudeStreamMessage;
  /** Optional tool result message (approval/rejection) */
  toolResult?: ClaudeStreamMessage;
}

interface PlanToolCall {
  type: "tool_use";
  id: string;
  name: "ExitPlanMode";
  input: {
    plan: string;
  };
}

/**
 * Widget for displaying ExitPlanMode tool calls with the plan content
 * Shows the plan in an expandable format with approval/rejection status
 */
export const ExitPlanModeWidget: React.FC<ExitPlanModeWidgetProps> = ({
  message,
  toolResult,
}) => {
  // Find the ExitPlanMode tool call in the message content
  const toolCall = React.useMemo(() => {
    if (!message.message?.content || !Array.isArray(message.message.content)) {
      return null;
    }

    return message.message.content.find(
      (content): content is PlanToolCall =>
        content.type === "tool_use" && content.name === "ExitPlanMode",
    );
  }, [message.message?.content]);

  // Get tool status from the enhanced message context
  const toolStatus = useToolStatus(toolCall?.id);

  if (!toolCall || !toolCall.input.plan) {
    return null;
  }

  const planContent = toolCall.input.plan;
  const lineCount = planContent.split("\n").length;

  const getStatusIcon = () => {
    switch (toolStatus?.status) {
      case "approved":
        return <CheckCircle className="h-3 w-3 text-success" />;
      case "rejected":
        return <XCircle className="h-3 w-3 text-destructive" />;
      case "error":
        return <AlertCircle className="h-3 w-3 text-destructive" />;
      case "pending":
        return <Clock className="h-3 w-3 text-info" />;
      default:
        return null;
    }
  };

  const getStatusTextClassName = () => {
    switch (toolStatus?.status) {
      case "approved":
        return "text-success";
      case "rejected":
        return "text-destructive";
      case "error":
        return "text-destructive";
      case "pending":
        return "text-info";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusMessage = () => {
    switch (toolStatus?.status) {
      case "approved":
        return "This plan was approved and Claude proceeded with implementation";
      case "rejected":
        return "This plan was rejected by the user";
      case "error":
        return "This plan encountered an error during execution";
      default:
        return "Plan status unknown";
    }
  };

  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="ExitPlanModeWidget" />

      <ToolWidgetTemplate.Header icon={FileText} title="Plan Mode" />

      <ToolWidgetTemplate.ExpandableResult
        rawContent={planContent}
        initiallyExpanded={false}
        headerContent={
          <span className="text-xs font-medium text-muted-foreground">
            Implementation Plan
          </span>
        }
      >
        {(excerptedContent, isShowingExcerpt, isExpanded) => (
          <ToolWidgetTemplate.PlainOutput isExpanded={isExpanded}>
            <MarkdownRenderer
              content={isShowingExcerpt ? excerptedContent : planContent}
              compact={true}
              className="text-sm"
            />
            {isShowingExcerpt && (
              <div className="mt-2 text-xs text-muted-foreground italic border-t pt-2">
                ... {lineCount - 5} more lines
              </div>
            )}
          </ToolWidgetTemplate.PlainOutput>
        )}
      </ToolWidgetTemplate.ExpandableResult>

      {toolStatus?.status && toolStatus.status !== "pending" && (
        <ToolWidgetTemplate.Footer>
          <div className="flex items-center gap-2 text-sm">
            {getStatusIcon()}
            <span className={getStatusTextClassName()}>
              {getStatusMessage()}
            </span>
          </div>
        </ToolWidgetTemplate.Footer>
      )}
    </ToolWidgetTemplate>
  );
};
