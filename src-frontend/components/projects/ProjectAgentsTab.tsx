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
    <Card className="relative">
      <DebugLabel label="ProjectAgentsTab" />
      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2 text-accent">Project Agents</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Manage agents specific to this project.
            </p>
          </div>
          <AgentsManager
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