import React, { useState } from "react";
import {
  AlertCircle,
  Shield,
  Command,
  Settings as SettingsIcon,
  TerminalSquare,
  Globe,
  Webhook,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/ui/atoms/LoadingSpinner";
import { DebugLabel } from "@/components/ui/atoms";
import {
  GeneralSettings,
  AdvancedSettings,
  CommandsSettings,
  PermissionsSettings,
  EnvironmentSettings,
  HooksSettings,
  ProxySettings,
} from "@/components/settings";
import { useSettingsState } from "@/hooks/useSettingsState";
import { logger } from "@/lib/logger";

interface SettingsProps {
  /**
   * Callback to go back to the main view
   */
  onBack: () => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Modern Settings UI with auto-save functionality
 * No save buttons needed - changes persist automatically!
 */
export const Settings: React.FC<SettingsProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState("general");

  // Use original working settings state hook
  const {
    settings,
    loading,
    error,
    allowRules,
    askRules,
    denyRules,
    envVars,
    hasChanges,
    updateSetting,
    addPermissionRule,
    updatePermissionRule,
    removePermissionRule,
    addEnvVar,
    updateEnvVar,
    removeEnvVar,
    saveSettings,
  } = useSettingsState();

  // File watching is now handled automatically by the new orchestrator!
  // No need for manual event listeners - the backend handles everything

  // No more manual save functions needed! Auto-save handles everything ✨

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-background text-foreground relative",
        className,
      )}
    >
      <DebugLabel label="Settings" />
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
        {/* Error message */}
        {error && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/50 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {String(error)}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" message="Loading settings..." />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="general" className="gap-2 hover:bg-accent">
                  <SettingsIcon className="h-4 w-4" />
                  General
                </TabsTrigger>
                <TabsTrigger
                  value="permissions"
                  className="gap-2 hover:bg-accent"
                >
                  <Shield className="h-4 w-4" />
                  Tools
                </TabsTrigger>
                <TabsTrigger value="hooks" className="gap-2 hover:bg-accent">
                  <Webhook className="h-4 w-4" />
                  Hooks
                </TabsTrigger>
                <TabsTrigger value="commands" className="gap-2 hover:bg-accent">
                  <Command className="h-4 w-4" />
                  Commands
                </TabsTrigger>
                <TabsTrigger value="advanced" className="gap-2 hover:bg-accent">
                  <SettingsIcon className="h-4 w-4" />
                  Advanced
                </TabsTrigger>
              </TabsList>

              {/* General Settings */}
              <TabsContent value="general" className="space-y-6">
                <Card className="p-6">
                  <GeneralSettings
                    settings={settings}
                    onUpdateSetting={updateSetting}
                  />
                </Card>
              </TabsContent>

              {/* Tools Settings */}
              <TabsContent value="permissions" className="space-y-6">
                <Card className="p-6">
                  <PermissionsSettings
                    allowRules={allowRules}
                    askRules={askRules}
                    denyRules={denyRules}
                    onAddRule={addPermissionRule}
                    onUpdateRule={updatePermissionRule}
                    onRemoveRule={removePermissionRule}
                  />
                </Card>
              </TabsContent>

              {/* Advanced Settings */}
              <TabsContent value="advanced" className="space-y-6">
                <Card className="p-6">
                  <AdvancedSettings
                    settings={settings}
                    onUpdateSetting={updateSetting}
                    envVars={envVars}
                    onAddEnvVar={addEnvVar}
                    onUpdateEnvVar={updateEnvVar}
                    onRemoveEnvVar={removeEnvVar}
                    setToast={() => {}}
                  />
                </Card>
              </TabsContent>

              {/* Hooks Settings */}
              <TabsContent value="hooks" className="space-y-6">
                <Card className="p-6">
                  <HooksSettings
                    onHooksChange={() => {}}
                    activeTab={activeTab}
                  />
                </Card>
              </TabsContent>

              {/* Commands Tab */}
              <TabsContent value="commands">
                <Card className="p-6">
                  <CommandsSettings />
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Success/error indicators are now handled by individual AutoSave inputs */}
    </div>
  );
};
