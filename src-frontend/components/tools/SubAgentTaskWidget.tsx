import React from "react";
import { Bot, Sparkles, Zap } from "lucide-react";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";

/**
 * Widget for Task tool - displays sub-agent task information
 */
export const SubAgentTaskWidget: React.FC<{ 
  description?: string; 
  prompt?: string;
  result?: any;
}> = ({ description, prompt, result: _result }) => {
  // Create the icon with sparkles overlay
  const SubAgentIcon = () => (
    <div className="relative">
      <Bot className="h-4 w-4" />
      <Sparkles className="h-2.5 w-2.5 absolute -top-1 -right-1" />
    </div>
  );

  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="SubAgentTaskWidget" />
      <ToolWidgetTemplate.Header 
        icon={Bot} 
        title="Spawning Sub-Agent Task" 
      />
      
      <ToolWidgetTemplate.ExpandableResult
        headerContent={
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-purple-500" />
            <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Task Details</span>
          </div>
        }
        isExpandable={!!prompt}
        initiallyExpanded={true}
      >
        <ToolWidgetTemplate.PlainOutput>
          <div className="space-y-3">
            {description && (
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Task Description</span>
                </div>
                <p className="text-sm text-foreground ml-5">{description}</p>
              </div>
            )}
            
            {prompt && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Task Instructions</span>
                </div>
                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                  {prompt}
                </pre>
              </div>
            )}
          </div>
        </ToolWidgetTemplate.PlainOutput>
      </ToolWidgetTemplate.ExpandableResult>
    </ToolWidgetTemplate>
  );
};