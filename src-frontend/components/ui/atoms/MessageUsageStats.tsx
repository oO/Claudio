import React from "react";
import { cn } from "@/lib/utils";

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

interface MessageUsageStatsProps {
  usage?: TokenUsage;
  costUsd?: number;
  durationMs?: number;
  numTurns?: number;
  messageNumber?: number;
  className?: string;
}

/**
 * Atomic component for displaying message usage statistics
 * Shows token usage, cost, duration, and turn count in a consistent format
 */
export const MessageUsageStats: React.FC<MessageUsageStatsProps> = ({ 
  usage, 
  costUsd, 
  durationMs, 
  numTurns,
  messageNumber,
  className 
}) => {
  const hasAnyUsage = usage || costUsd !== undefined || durationMs !== undefined || numTurns !== undefined;
  
  if (!hasAnyUsage) return null;

  const formatDuration = (ms: number): string => {
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(4)} USD`;
  };

  return (
    <div className={cn("text-xs text-muted-foreground space-y-1", className)}>
      {usage && (
        <div>
          {messageNumber && `#${messageNumber.toString().padStart(3, '0')} `}
          Tokens: {usage.input_tokens} in, {usage.output_tokens} out
        </div>
      )}
      {costUsd !== undefined && (
        <div>Cost: {formatCost(costUsd)}</div>
      )}
      {durationMs !== undefined && (
        <div>Duration: {formatDuration(durationMs)}</div>
      )}
      {numTurns !== undefined && (
        <div>Turns: {numTurns}</div>
      )}
    </div>
  );
};