import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { SlashCommandsManager } from "@/components/common";
import { DebugLabel } from "@/components/ui/atoms";

interface ProjectCommandsTabProps {
  projectPath: string;
  className?: string;
}

export const ProjectCommandsTab: React.FC<ProjectCommandsTabProps> = ({
  projectPath,
  className,
}) => {
  return (
    <Card className="relative flex flex-col h-full">
      <DebugLabel label="ProjectCommandsTab" />
      <CardContent className="p-0 pb-3 flex flex-col h-full min-h-0">
        <div className="flex flex-col h-full gap-4">
          <div className="px-6 pt-6">
            <h3 className="text-lg font-semibold mb-2 text-accent">Slash Commands</h3>
            <p className="text-sm text-muted-foreground">
              Manage project-specific slash commands for this project.
            </p>
          </div>
          <div className="flex-1 min-h-0 overflow-auto px-6">
            <SlashCommandsManager projectPath={projectPath} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
