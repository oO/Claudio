import React from "react";
import { Info, MessageSquare, Clock } from "lucide-react";
import { DebugLabel } from "@/components/ui/atoms";

/**
 * Widget for AI-generated summaries
 */
export const SummaryWidget: React.FC<{ 
  summary: string;
  leafUuid?: string;
  messageNumber?: number;
}> = ({ summary, leafUuid, messageNumber }) => {
  return (
    <div className="rounded-lg border overflow-hidden relative">
      <DebugLabel label="SummaryWidget" />
      <div className="px-4 py-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 mt-1" />
          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold">Session Summary</div>
            <div className="mt-3">
              <p className="text-sm text-foreground">{summary}</p>
            </div>
          </div>
        </div>
        {messageNumber && (
          <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground mt-4">
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {messageNumber.toString().padStart(3, "0")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};