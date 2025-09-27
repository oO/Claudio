import React from "react";
import { 
  Package2,
  Sparkles,
  ChevronRight,
  Code,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { getClaudeSyntaxTheme } from "@/lib/claudeSyntaxTheme";
import { useThemeUnified } from "@/hooks";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";

/**
 * Widget for MCP (Model Context Protocol) tools
 */
export const MCPWidget: React.FC<{ 
  toolName: string; 
  input?: any;
  result?: any;
}> = ({ toolName, input, result: _result }) => {
  const { theme } = useThemeUnified();
  const syntaxTheme = getClaudeSyntaxTheme(theme);
  
  // Parse the tool name to extract components
  // Format: mcp__namespace__method
  const parts = toolName.split('__');
  const namespace = parts[1] || '';
  const method = parts[2] || '';
  
  // Format namespace for display (handle kebab-case and snake_case)
  const formatNamespace = (ns: string) => {
    return ns
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  // Format method name
  const formatMethod = (m: string) => {
    return m
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  const hasInput = input && Object.keys(input).length > 0;
  const inputString = hasInput ? JSON.stringify(input, null, 2) : '';
  const isLargeInput = inputString.length > 200;
  
  // Count tokens approximation (very rough estimate)
  const estimateTokens = (str: string) => {
    // Rough approximation: ~4 characters per token
    return Math.ceil(str.length / 4);
  };
  
  const inputTokens = hasInput ? estimateTokens(inputString) : 0;

  // Create the icon with sparkles overlay
  const MCPIcon = () => (
    <div className="relative">
      <Package2 className="h-4 w-4" />
      <Sparkles className="h-2.5 w-2.5 absolute -top-1 -right-1" />
    </div>
  );

  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="MCPWidget" />
      <ToolWidgetTemplate.Header 
        icon={Package2} 
        title="MCP Tool"
      >
        {hasInput && (
          <Badge 
            variant="outline" 
            className="text-xs"
          >
            ~{inputTokens} tokens
          </Badge>
        )}
      </ToolWidgetTemplate.Header>
      
      <ToolWidgetTemplate.ExpandableResult
        headerContent={
          <div className="flex items-center gap-2 text-sm">
            <span className="text-violet-500 font-medium">MCP</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-purple-600 dark:text-purple-400 font-medium">
              {formatNamespace(namespace)}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-violet-500" />
              <code className="text-sm font-mono font-semibold text-foreground">
                {formatMethod(method)}
                <span className="text-muted-foreground">()</span>
              </code>
            </div>
          </div>
        }
        isExpandable={isLargeInput}
        initiallyExpanded={!isLargeInput}
        rawContent={inputString}
        lineCount={inputString ? inputString.split('\n').length : 0}
      >
        {(excerptedContent, isShowingExcerpt, isExpanded) => (
          <>
            <ToolWidgetTemplate.PlainOutput isExpanded={isExpanded}>
              {/* Input Parameters */}
              {hasInput ? (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-zinc-950/50 overflow-hidden">
                    <div className="px-3 py-2 border-b bg-zinc-900/50 flex items-center gap-2">
                      <Code className="h-3 w-3 text-violet-500" />
                      <span className="text-xs font-mono text-muted-foreground">Parameters</span>
                    </div>
                    <div className="overflow-auto">
                      <SyntaxHighlighter
                        language="json"
                        style={syntaxTheme}
                        customStyle={{
                          margin: 0,
                          padding: '0.75rem',
                          background: 'transparent',
                          fontSize: '0.75rem',
                          lineHeight: '1.5',
                        }}
                        wrapLongLines={false}
                      >
                        {excerptedContent}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">
                  No parameters required
                </div>
              )}
            </ToolWidgetTemplate.PlainOutput>
          </>
        )}
      </ToolWidgetTemplate.ExpandableResult>
    </ToolWidgetTemplate>
  );
};
