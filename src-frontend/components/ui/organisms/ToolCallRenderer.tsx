import React from "react";
import { Terminal } from "lucide-react";
import { 
  TasksWidget,
  LSWidget,
  GlobWidget,
  BashWidget,
  FileWidget,
  GrepWidget,
  EditWidget,
  MCPWidget,
  SubAgentTaskWidget,
  ThinkingWidget,
  WebSearchWidget,
  WebFetchWidget,
  MultiEditWidget,
  CommandWidget
} from "@/components/tools/ToolWidgets";

interface ToolCallRendererProps {
  toolCall: {
    type: string;
    name?: string;
    input?: any;
    id?: string;
    thinking?: string;
    signature?: any;
  };
  toolResult?: any;
  commandContent?: {
    commandName: string;
    commandMessage: string; 
    commandArgs?: string;
    output?: string;
  };
}

/**
 * Organism component for rendering tool calls and their widgets
 * Centralizes tool widget selection and rendering logic
 */
export const ToolCallRenderer: React.FC<ToolCallRendererProps> = ({
  toolCall,
  toolResult,
  commandContent
}) => {
  // Handle thinking content
  if (toolCall.type === "thinking") {
    return (
      <ThinkingWidget 
        thinking={toolCall.thinking || ''} 
        signature={toolCall.signature}
      />
    );
  }

  // Handle command content
  if (commandContent) {
    return (
      <CommandWidget 
        commandName={commandContent.commandName} 
        commandMessage={commandContent.commandMessage}
        commandArgs={commandContent.commandArgs}
        output={commandContent.output}
      />
    );
  }

  // Handle tool_use
  if (toolCall.type === "tool_use") {
    const toolName = toolCall.name?.toLowerCase();
    const input = toolCall.input;
    
    // Task tool - for sub-agent tasks
    if (toolName === "task" && input) {
      return <SubAgentTaskWidget description={input.description} prompt={input.prompt} subagent_type={input.subagent_type} result={toolResult} />;
    }
    
    // Edit tool
    if (toolName === "edit" && input?.file_path) {
      return <EditWidget {...input} result={toolResult} />;
    }
    
    // MultiEdit tool
    if (toolName === "multiedit" && input?.file_path && input?.edits) {
      return <MultiEditWidget {...input} result={toolResult} />;
    }
    
    // MCP tools (starting with mcp__)
    if (toolCall.name?.startsWith("mcp__")) {
      return <MCPWidget toolName={toolCall.name} input={input} result={toolResult} />;
    }
    
    // TodoWrite tool
    if (toolName === "todowrite" && input?.todos) {
      return <TasksWidget todos={input.todos} result={toolResult} />;
    }
    
    
    // LS tool
    if (toolName === "ls" && input?.path) {
      return <LSWidget path={input.path} result={toolResult} />;
    }
    
    // Read tool
    if (toolName === "read" && input?.file_path) {
      return <FileWidget type="read" filePath={input.file_path} result={toolResult} />;
    }
    
    // Glob tool
    if (toolName === "glob" && input?.pattern) {
      return <GlobWidget pattern={input.pattern} result={toolResult} />;
    }
    
    // Bash tool
    if (toolName === "bash" && input?.command) {
      return <BashWidget command={input.command} description={input.description} result={toolResult} />;
    }
    
    // Write tool
    if (toolName === "write" && input?.file_path && input?.content) {
      return <FileWidget type="write" filePath={input.file_path} content={input.content} result={toolResult} />;
    }
    
    // Grep tool
    if (toolName === "grep" && input?.pattern) {
      return <GrepWidget pattern={input.pattern} include={input.include} path={input.path} exclude={input.exclude} result={toolResult} />;
    }
    
    // WebSearch tool
    if (toolName === "websearch" && input?.query) {
      return <WebSearchWidget query={input.query} result={toolResult} />;
    }
    
    // WebFetch tool
    if (toolName === "webfetch" && input?.url) {
      return <WebFetchWidget url={input.url} prompt={input.prompt} result={toolResult} />;
    }
    
    // Fallback to basic tool display
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            Using tool: <code className="font-mono">{toolCall.name}</code>
          </span>
        </div>
        {input && (
          <div className="ml-6 p-2 bg-background rounded-md border">
            <pre className="text-xs font-mono overflow-x-auto">
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return null;
};