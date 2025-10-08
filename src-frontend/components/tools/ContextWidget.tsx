import React, { Fragment } from "react";
import { BarChart3 } from "lucide-react";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";
import { parseContextOutput, ContextUsage } from "@/lib/contextParser";

interface ContextWidgetProps {
  output: string;
}

export const ContextWidget: React.FC<ContextWidgetProps> = ({ output }) => {
  const contextData = parseContextOutput(output);

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };

  const formatPercentage = (current: number, max: number): string => {
    return `${Math.round((current / max) * 100)}%`;
  };

  // Handle parse failure
  if (!contextData) {
    return (
      <ToolWidgetTemplate>
        <ToolWidgetTemplate.Debug label="ContextWidget" />
        <ToolWidgetTemplate.Header icon={BarChart3} title="Context Usage" />
        <ToolWidgetTemplate.ExpandableResult
          isExpandable={false}
          className="border-0"
        >
          <div className="p-4">
            <span className="text-sm text-muted-foreground">
              Failed to parse context data
            </span>
          </div>
        </ToolWidgetTemplate.ExpandableResult>
      </ToolWidgetTemplate>
    );
  }

  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="ContextWidget" />

      <ToolWidgetTemplate.Header icon={BarChart3} title="Context Usage" />

      <ToolWidgetTemplate.ExpandableResult
        isExpandable={true}
        initiallyExpanded={false}
        className="border-0"
        headerContent={<span className="text-sm font-medium">{contextData.model}</span>}
        lineCount={20}
      >
        {(excerptedContent, isShowingExcerpt, isExpanded) => (
          <div className="p-4 space-y-4">
            {/* Parse warnings if any */}
            {contextData.parseWarnings && contextData.parseWarnings.length > 0 && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-900 dark:text-amber-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Parser Warnings</span>
                </div>
                <ul className="text-xs text-amber-800 dark:text-amber-300 pl-6 space-y-0.5">
                  {contextData.parseWarnings.map((warning, idx) => (
                    <li key={idx} className="list-disc">{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Token Usage Stats */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Token Usage</span>
                <span className="text-sm text-muted-foreground">
                  {formatTokens(contextData.totalTokens)} /{" "}
                  {formatTokens(contextData.maxTokens)} ({contextData.percentage}
                  %)
                </span>
              </div>

              {/* Segmented Progress Bar */}
              <div className="w-full bg-muted rounded-full h-6 overflow-hidden flex">
                <div
                  className="bg-blue-600 dark:bg-blue-400 h-full transition-all duration-300"
                  style={{
                    width: `${contextData.breakdown.systemPrompt.percentage}%`,
                  }}
                  title={`System prompt: ${contextData.breakdown.systemPrompt.percentage}%`}
                />
                <div
                  className="bg-violet-600 dark:bg-violet-400 h-full transition-all duration-300"
                  style={{
                    width: `${contextData.breakdown.systemTools.percentage}%`,
                  }}
                  title={`System tools: ${contextData.breakdown.systemTools.percentage}%`}
                />
                <div
                  className="bg-slate-600 dark:bg-slate-400 h-full transition-all duration-300"
                  style={{
                    width: `${contextData.breakdown.reserved.percentage}%`,
                  }}
                  title={`Reserved: ${contextData.breakdown.reserved.percentage}%`}
                />
                <div
                  className="bg-emerald-600 dark:bg-emerald-400 h-full transition-all duration-300"
                  style={{
                    width: `${contextData.breakdown.customAgents.percentage}%`,
                  }}
                  title={`Custom agents: ${contextData.breakdown.customAgents.percentage}%`}
                />
                <div
                  className="bg-amber-600 dark:bg-amber-400 h-full transition-all duration-300"
                  style={{
                    width: `${contextData.breakdown.memoryFiles.percentage}%`,
                  }}
                  title={`Memory files: ${contextData.breakdown.memoryFiles.percentage}%`}
                />
                <div
                  className="bg-rose-600 dark:bg-rose-400 h-full transition-all duration-300"
                  style={{
                    width: `${contextData.breakdown.messages.percentage}%`,
                  }}
                  title={`Messages: ${contextData.breakdown.messages.percentage}%`}
                />
              </div>
            </div>

          {/* Token Breakdown */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Token Breakdown</h4>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-2 py-1 font-medium">Category</th>
                    <th className="text-right px-2 py-1 font-medium">%</th>
                    <th className="text-right px-2 py-1 font-medium">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-card">
                    <td className="px-2 py-1 flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-blue-600 dark:bg-blue-400"></div>
                      <span>System prompt</span>
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground">
                      {contextData.breakdown.systemPrompt.percentage}%
                    </td>
                    <td className="px-2 py-1 text-right font-medium">
                      {formatTokens(contextData.breakdown.systemPrompt.tokens)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1 flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-violet-600 dark:bg-violet-400"></div>
                      <span>System tools</span>
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground">
                      {contextData.breakdown.systemTools.percentage}%
                    </td>
                    <td className="px-2 py-1 text-right font-medium">
                      {formatTokens(contextData.breakdown.systemTools.tokens)}
                    </td>
                  </tr>
                  <tr className="bg-card">
                    <td className="px-2 py-1 flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-slate-600 dark:bg-slate-400"></div>
                      <span>Reserved</span>
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground">
                      {contextData.breakdown.reserved.percentage}%
                    </td>
                    <td className="px-2 py-1 text-right font-medium">
                      {formatTokens(contextData.breakdown.reserved.tokens)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1 flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-emerald-600 dark:bg-emerald-400"></div>
                      <span>Custom agents</span>
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground">
                      {contextData.breakdown.customAgents.percentage}%
                    </td>
                    <td className="px-2 py-1 text-right font-medium">
                      {formatTokens(contextData.breakdown.customAgents.tokens)}
                    </td>
                  </tr>
                  <tr className="bg-card">
                    <td className="px-2 py-1 flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-amber-600 dark:bg-amber-400"></div>
                      <span>Memory files</span>
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground">
                      {contextData.breakdown.memoryFiles.percentage}%
                    </td>
                    <td className="px-2 py-1 text-right font-medium">
                      {formatTokens(contextData.breakdown.memoryFiles.tokens)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1 flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-rose-600 dark:bg-rose-400"></div>
                      <span>Messages</span>
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground">
                      {contextData.breakdown.messages.percentage}%
                    </td>
                    <td className="px-2 py-1 text-right font-medium">
                      {formatTokens(contextData.breakdown.messages.tokens)}
                    </td>
                  </tr>
                  <tr className="bg-card">
                    <td className="px-2 py-1 flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-muted-foreground"></div>
                      <span>Free space</span>
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground">
                      {contextData.breakdown.freeSpace.percentage}%
                    </td>
                    <td className="px-2 py-1 text-right font-medium">
                      {formatTokens(contextData.breakdown.freeSpace.tokens)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Expanded-only sections */}
          {isExpanded && (
            <>
              {/* Custom agents */}
          {contextData.sections.find(s => s.title === 'Custom agents') && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Custom agents</h4>
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-2 py-1 font-medium w-20">Scope</th>
                      <th className="text-left px-2 py-1 font-medium">Name</th>
                      <th className="text-right px-2 py-1 font-medium">Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contextData.sections
                      .find(s => s.title === 'Custom agents')
                      ?.items.map((item, itemIndex) => (
                        <tr key={itemIndex} className={itemIndex % 2 === 0 ? "bg-card" : ""}>
                          <td className="px-2 py-1 text-muted-foreground">{item.scope}</td>
                          <td className="px-2 py-1 font-mono text-muted-foreground">{item.name}</td>
                          <td className="px-2 py-1 text-right font-medium">
                            {formatTokens(item.tokens)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Memory files */}
          {contextData.sections.find(s => s.title === 'Memory files') && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Memory files</h4>
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-2 py-1 font-medium w-20">Scope</th>
                      <th className="text-left px-2 py-1 font-medium">Path</th>
                      <th className="text-right px-2 py-1 font-medium">Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contextData.sections
                      .find(s => s.title === 'Memory files')
                      ?.items.map((item, itemIndex) => (
                        <tr key={itemIndex} className={itemIndex % 2 === 0 ? "bg-card" : ""}>
                          <td className="px-2 py-1 text-muted-foreground">{item.name}</td>
                          <td className="px-2 py-1 font-mono text-muted-foreground truncate max-w-[300px]">{item.path}</td>
                          <td className="px-2 py-1 text-right font-medium">
                            {formatTokens(item.tokens)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SlashCommand Tool - separate since it has different structure */}
          {contextData.sections.find(s => s.title === 'SlashCommand Tool') && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">SlashCommand Tool</h4>
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-2 py-1 font-medium">Command</th>
                      <th className="text-right px-2 py-1 font-medium">Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contextData.sections
                      .find(s => s.title === 'SlashCommand Tool')
                      ?.items.map((item, itemIndex) => (
                        <tr key={itemIndex} className={itemIndex % 2 === 0 ? "bg-card" : ""}>
                          <td className="px-2 py-1 font-mono">{item.name}</td>
                          <td className="px-2 py-1 text-right font-medium">
                            {formatTokens(item.tokens)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
            </>
          )}
          </div>
        )}
      </ToolWidgetTemplate.ExpandableResult>
    </ToolWidgetTemplate>
  );
};
