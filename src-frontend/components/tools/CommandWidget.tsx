import React from "react";
import { Terminal } from "lucide-react";
import { DebugLabel } from "@/components/ui/atoms";

/**
 * Widget for user commands (e.g., model, clear)
 */
export const CommandWidget: React.FC<{
  commandName: string;
  commandMessage: string;
  commandArgs?: string;
  output?: string;
}> = ({ commandName, commandMessage, commandArgs, output }) => {
  return (
    <div className="rounded-lg border bg-card overflow-hidden relative">
      <DebugLabel label="CommandWidget" />
      <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2">
        <Terminal className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-mono text-primary/80">Command</span>
      </div>
      <div className="p-3 space-y-1 bg-background">
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono text-info">{commandName}</code>
          {commandArgs && (
            <code className="text-sm font-mono text-muted-foreground">
              {commandArgs}
            </code>
          )}
        </div>
        {commandMessage && commandMessage !== commandName && (
          <div className="text-xs text-muted-foreground ml-4">
            {commandMessage}
          </div>
        )}
        {output && (
          <div className="mt-3 pt-2 border-t border-muted/30">
            <pre className="text-sm font-mono text-foreground whitespace-pre-wrap">
              {output}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
