import React from "react";
import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface HookConfigFormProps {
  matcherId: string;
  matcher: string;
  onMatcherChange: (value: string) => void;
  commonPatterns: string[];
  readOnly?: boolean;
  className?: string;
}

export const HookConfigForm: React.FC<HookConfigFormProps> = ({
  matcherId,
  matcher,
  onMatcherChange,
  commonPatterns,
  readOnly = false,
  className
}) => {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Label htmlFor={`matcher-${matcherId}`}>Pattern</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Tool name pattern (regex supported). Leave empty to match all tools.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <div className="flex items-center gap-2">
        <Input
          id={`matcher-${matcherId}`}
          placeholder="e.g., Bash, Edit|Write, mcp__.*"
          value={matcher}
          onChange={(e) => onMatcherChange(e.target.value)}
          disabled={readOnly}
          className="flex-1"
        />
        
        <Select
          value={matcher || 'custom'}
          onValueChange={(value) => {
            if (value !== 'custom') {
              onMatcherChange(value);
            }
          }}
          disabled={readOnly}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Common patterns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom">Custom</SelectItem>
            {commonPatterns.map(pattern => (
              <SelectItem key={pattern} value={pattern}>
                {pattern}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};