import React from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DebugLabel } from "@/components/ui/atoms";
import { useSessionContext } from "@/contexts/SessionContext";
import { logger } from "@/lib/logger";

interface CwdNavigationProps {
  onNavigate: (messageIndex: number) => void;
}

/**
 * CWD navigation dropdown for jumping to directory changes in the session
 * Shows current directory path with dropdown history of when working directory changed
 */
export const CwdNavigation: React.FC<CwdNavigationProps> = ({
  onNavigate,
}) => {
  // Get CWD changes from context (processed by useMessageProcessing)
  const { cwdChanges = [] } = useSessionContext();

  const handleNavigate = (messageIndex: number) => {
    onNavigate(messageIndex);
  };

  const hasChanges = cwdChanges.length > 0;

  // Get the current (latest) CWD - this is what we display as the main text
  const currentCwd = hasChanges ? cwdChanges[cwdChanges.length - 1].cwd : null;


  return (
    <div className="relative">
      <DebugLabel label="CwdNavigation" />
      {currentCwd ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-auto p-1 text-left justify-start">
              <FolderOpen className="h-3 w-3 flex-shrink-0" />
              <span className="text-xs font-mono">
                {currentCwd}
              </span>
              {cwdChanges.length > 1 && (
                <div className="flex items-center justify-center w-5 h-4 bg-accent text-accent-foreground rounded-full text-xs font-medium ml-1 flex-shrink-0">
                  {cwdChanges.length}
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          {cwdChanges.length > 1 && (
            <DropdownMenuContent
              align="start"
              side="bottom"
              sideOffset={4}
              className="min-w-max max-h-96 overflow-y-auto backdrop-blur-sm"
            >
              {cwdChanges.map((cwdChange, index) => (
                <DropdownMenuItem
                  key={cwdChange.index}
                  onClick={() => handleNavigate(cwdChange.ui_index)}
                  className="p-1 px-3 text-sm"
                >
                  <div className="w-full font-mono text-xs whitespace-nowrap">
                    <span className="text-muted-foreground mr-2">#{index + 1}</span>
                    {cwdChange.cwd}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      ) : (
        // Fallback when no CWD data is available
        <div className="flex items-center gap-1 text-muted-foreground">
          <FolderOpen className="h-3 w-3" />
          <span className="text-xs">No directory data</span>
        </div>
      )}
    </div>
  );
};