import React, { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TriLevelPermissionsManager } from "@/components/common";
import { useTriLevelSettings, useUnsavedChanges } from "@/hooks";
import { api } from "@/lib/api";
import { DebugLabel } from "@/components/ui/atoms";

interface ProjectToolsTabProps {
  projectPath: string;
  className?: string;
}

export const ProjectToolsTab: React.FC<ProjectToolsTabProps> = ({
  projectPath,
  className,
}) => {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Tri-level settings management
  const {
    loading,
    saving,
    error,
    rules,
    hasChanges,
    loadSettings,
    addRule,
    toggleRuleLevel,
    updateRuleValue,
    deleteRule,
    saveAllLevels,
  } = useTriLevelSettings((success, message) => {
    setToast({ message, type: success ? "success" : "error" });
  });
  
  // Automatically sync unsaved changes state with the tab
  const { markAsSaved } = useUnsavedChanges(hasChanges);

  // Load settings when component mounts or project changes
  useEffect(() => {
    loadSettings(projectPath);
  }, [projectPath, loadSettings]);

  const handleSaveAllLevels = async () => {
    await saveAllLevels(projectPath);
    markAsSaved(); // Clear the unsaved changes flag
  };

  return (
    <Card className="relative">
      <DebugLabel label="ProjectToolsTab" />
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header with Save Button */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-accent">Tool Permissions</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Manage tool permissions across user, team, and local project levels. Click toggles to enable/disable rules at each level.
              </p>
            </div>
            
            <Button
              onClick={handleSaveAllLevels}
              disabled={loading || saving || !hasChanges}
              size="sm"
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3 w-3" />
                  Save Rules
                </>
              )}
            </Button>
          </div>


          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-500/10 rounded-md border border-red-500/20">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Tri-Level Permissions Manager */}
          <TriLevelPermissionsManager
            rules={rules}
            onAddRule={addRule}
            onToggleLevel={toggleRuleLevel}
            onUpdateRule={updateRuleValue}
            onDeleteRule={deleteRule}
            loading={loading || saving}
          />

          {/* Toast Notification */}
          {toast && (
            <div className={`fixed bottom-4 right-4 p-3 rounded-md shadow-lg ${
              toast.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
            }`}>
              {toast.message}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};