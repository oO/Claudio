import React from "react";
import { Bot, ChevronRight, ListCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/ui/molecules";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";
import { useAgentMetadata } from "@/hooks";
import { getAgentColor } from "@/lib/agentColors";

/**
 * Widget for Task tool - displays sub-agent task information
 */
export const SubAgentTaskWidget: React.FC<{
  description?: string;
  prompt?: string;
  subagent_type?: string;
  result?: any;
}> = ({ description, prompt, subagent_type, result: _result }) => {
  // Get agent metadata for styling (similar to useAgentStyling hook)
  const { metadata: agentMetadata } = useAgentMetadata(subagent_type);

  // Get agent name and background class
  const getAgentInfo = () => {
    if (!subagent_type) {
      return {
        agentName: "Sub-Agent Task",
        agentBackgroundClass: "agent-bg-grey",
      };
    }

    // Built-in Claude Code subagents
    if (subagent_type === "general-purpose") {
      return {
        agentName: "General Purpose",
        agentBackgroundClass: "agent-bg-grey",
      };
    }

    // Project/personal agents with metadata
    if (agentMetadata?.name) {
      const agentBackgroundClass = agentMetadata.color
        ? getAgentColor(agentMetadata.color).cssClass.replace(
            "agent-",
            "agent-bg-",
          )
        : "agent-bg-grey";
      return { agentName: agentMetadata.name, agentBackgroundClass };
    }

    // Fallback: use subagent_type as display name
    const formattedName = subagent_type
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    return { agentName: formattedName, agentBackgroundClass: "agent-bg-grey" };
  };

  const { agentName, agentBackgroundClass } = getAgentInfo();

  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="SubAgentTaskWidget" />
      <ToolWidgetTemplate.Header
        icon={ListCheck}
        title={
          <span
            className={cn("px-1 py-0.5 rounded text-sm", agentBackgroundClass)}
          >
            {agentName}
          </span>
        }
      >
        {description && (
          <>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">{description}</div>
          </>
        )}
      </ToolWidgetTemplate.Header>

      <ToolWidgetTemplate.ExpandableResult
        headerContent={
          <span className="text-xs font-medium text-muted-foreground">
            Task Details
          </span>
        }
        isExpandable={!!prompt}
        lineCount={prompt ? prompt.split("\n").length : 0}
        rawContent={prompt || ""}
        initiallyExpanded={false}
      >
        {(excerptedContent, isShowingExcerpt, isExpanded) => (
          <ToolWidgetTemplate.PlainOutput isExpanded={isExpanded}>
            <div className="space-y-3">
              {excerptedContent && (
                <MarkdownRenderer
                  content={excerptedContent}
                  compact={true}
                  className="text-sm"
                />
              )}
            </div>
          </ToolWidgetTemplate.PlainOutput>
        )}
      </ToolWidgetTemplate.ExpandableResult>
    </ToolWidgetTemplate>
  );
};
