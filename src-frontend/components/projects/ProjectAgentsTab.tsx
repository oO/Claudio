import React from "react";
import { Bot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AgentsManager } from "@/components/agents";
import type { Agent } from "@/lib/api";
import { DebugLabel } from "@/components/ui/atoms";

interface ProjectAgentsTabProps {
  projectPath: string;
  onEditAgent?: (agent: Agent) => void;
  onExportAgent?: (agent: Agent) => void;
  onDeleteAgent?: (agent: Agent) => void;
  onCreateAgent?: () => void;
  onImportAgent?: () => void;
  className?: string;
}

export const ProjectAgentsTab: React.FC<ProjectAgentsTabProps> = ({
  projectPath,
  onEditAgent,
  onExportAgent,
  onDeleteAgent,
  onCreateAgent,
  onImportAgent,
  className,
}) => {
  return (
    <Card className="relative flex flex-col h-full">
      <DebugLabel label="ProjectAgentsTab" />
      <CardContent className="p-0 pb-3 flex flex-col h-full min-h-0">
        <div className="flex flex-col h-full gap-4">
          <div className="px-6 pt-6">
            <h3 className="text-lg font-semibold mb-2 text-accent">Project Agents</h3>
            <p className="text-sm text-muted-foreground">
              Manage agents specific to this project.
            </p>
          </div>
          <AgentsManager
            className="flex-1 min-h-0"
            projectPath={projectPath}
            onEditAgent={onEditAgent}
            onExportAgent={onExportAgent}
            onDeleteAgent={onDeleteAgent}
            onCreateAgent={onCreateAgent}
            onImportAgent={onImportAgent}
          />
        </div>
      </CardContent>
    </Card>
  );
};