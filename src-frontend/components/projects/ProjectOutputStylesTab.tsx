import React, { useState } from "react";
import { Palette } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { OutputStylesManager, CreateOutputStyle } from "@/components/output-styles";
import { outputStylesApi, type OutputStyle } from "@/lib/api";
import { DebugLabel } from "@/components/ui/atoms";
import { logger } from '@/lib/logger';

interface ProjectOutputStylesTabProps {
  projectPath: string;
  className?: string;
}

export const ProjectOutputStylesTab: React.FC<ProjectOutputStylesTabProps> = ({
  projectPath,
  className,
}) => {
  const [editingStyle, setEditingStyle] = useState<OutputStyle | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // If we're editing or creating a style, show the editor
  if (editingStyle || isCreating) {
    return (
      <div className="relative h-full">
        <DebugLabel label="ProjectOutputStylesTab (Editor)" />
        <CreateOutputStyle
          style={editingStyle || undefined}
          projectPath={projectPath}
          onStyleCreated={() => {
            // Return to list and refresh
            setEditingStyle(null);
            setIsCreating(false);
            setRefreshKey(prev => prev + 1);
          }}
          onBack={() => {
            // Return to list without refresh
            setEditingStyle(null);
            setIsCreating(false);
          }}
        />
      </div>
    );
  }

  return (
    <Card className="relative flex flex-col h-full">
      <DebugLabel label="ProjectOutputStylesTab" />
      <CardContent className="p-0 pb-3 flex flex-col h-full min-h-0">
        <div className="flex flex-col h-full gap-4">
          <div className="px-6 pt-6">
            <h3 className="text-lg font-semibold mb-2 text-accent">Project Output Styles</h3>
            <p className="text-sm text-muted-foreground">
              Manage output styles specific to this project.
            </p>
          </div>
          <OutputStylesManager
            key={refreshKey}
            className="flex-1 min-h-0"
            projectPath={projectPath}
            onEditStyle={(style) => {
              setEditingStyle(style);
            }}
            onDeleteStyle={async (style) => {
              try {
                await outputStylesApi.deleteOutputStyle(style.name, projectPath);
                logger.info("Output style deleted:", style.name);
                setRefreshKey(prev => prev + 1);
              } catch (error) {
                logger.error("Failed to delete output style:", error);
              }
            }}
            onCreateStyle={() => {
              setIsCreating(true);
            }}
            onImportStyle={() => {
              // TODO: Implement import
              logger.info('Import output style clicked');
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
};
