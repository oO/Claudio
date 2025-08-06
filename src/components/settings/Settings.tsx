import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { ActionButton } from "@/components/ui/atoms/ActionButton";
import { LoadingSpinner } from "@/components/ui/atoms/LoadingSpinner";
import {
  GeneralSettings,
  PermissionsSettings,
  EnvironmentSettings,
  AdvancedSettings,
  HooksSettings,
  CommandsSettings,
  NetworkSettings,
  AnalyticsSettings
} from "@/components/settings";
import {
  useSettingsState,
  useClaudeBinaryConfig
} from "@/hooks";
import { analytics } from "@/lib/analytics";

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
 * Comprehensive Settings UI for managing Claude Code settings
 * Provides a no-code interface for editing the settings.json file
 */
export const Settings: React.FC<SettingsProps> = ({
  className,
}) => {
  const [activeTab, setActiveTab] = useState("general");
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Analytics state
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [analyticsConsented, setAnalyticsConsented] = useState(false);
  const [showAnalyticsConsent, setShowAnalyticsConsent] = useState(false);
  
  // Settings state and actions
  const {
    settings,
    loading,
    saving,
    error,
    allowRules,
    denyRules,
    envVars,
    loadSettings,
    saveSettings,
    updateSetting,
    addPermissionRule,
    updatePermissionRule,
    removePermissionRule,
    addEnvVar,
    updateEnvVar,
    removeEnvVar,
    setError,
  } = useSettingsState(
    (success, message) => {
      setToast({ message, type: success ? 'success' : 'error' });
    }
  );
  
  // Binary path management
  const { saveBinaryPath } = useClaudeBinaryConfig();

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    loadAnalyticsSettings();
  }, [loadSettings]);

  /**
   * Loads analytics settings
   */
  const loadAnalyticsSettings = async () => {
    const settings = analytics.getSettings();
    if (settings) {
      setAnalyticsEnabled(settings.enabled);
      setAnalyticsConsented(settings.hasConsented);
    }
  };

  /**
   * Enhanced save settings that handles binary path
   */
  const handleSaveSettings = async () => {
    try {
      // Save the main settings
      await saveSettings();
      
      // Save binary path if changed
      await saveBinaryPath();
      
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError("Failed to save settings.");
      setToast({ message: "Failed to save settings", type: "error" });
    }
  };

  /**
   * Handle hooks change callback
   */
  const handleHooksChange = (hasChanges: boolean, getHooks: (() => any) | null) => {
    // For now, we'll handle this in the component state
    // TODO: Integrate with useSettingsState hook
  };

  /**
   * Handle proxy change callback
   */
  const handleProxyChange = (hasChanges: boolean, _getSettings: (() => any) | null, save: (() => Promise<void>) | null) => {
    // For now, we'll handle this in the component state
    // TODO: Integrate with useSettingsState hook
  };

  /**
   * Handle binary path change callback
   */
  const handleBinaryPathChanged = (changed: boolean) => {
    // For now, we'll handle this in the component state
    // TODO: Integrate with useClaudeBinaryConfig hook
  };

  return (
    <div className={cn("flex flex-col h-full bg-background text-foreground", className)}>
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
      
      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/50 flex items-center gap-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" message="Loading settings..." />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-8 w-full">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
              <TabsTrigger value="environment">Environment</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
              <TabsTrigger value="hooks">Hooks</TabsTrigger>
              <TabsTrigger value="commands">Commands</TabsTrigger>
              <TabsTrigger value="proxy">Proxy</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
            
            {/* General Settings */}
            <TabsContent value="general" className="space-y-6">
              <Card className="p-6 space-y-6">
                <div>
                  {/* Save Button */}
                  <div className="flex justify-end mb-4">
                    <ActionButton
                      icon={Save}
                      label={saving ? "Saving..." : "Save Settings"}
                      onClick={handleSaveSettings}
                      disabled={saving || loading}
                      isLoading={saving}
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                    />
                  </div>
                  
                  <GeneralSettings
                    settings={settings}
                    onUpdateSetting={updateSetting}
                    onBinaryPathChanged={handleBinaryPathChanged}
                  />
                </div>
              </Card>
            </TabsContent>
            
            {/* Permissions Settings */}
            <TabsContent value="permissions" className="space-y-6">
              <Card className="p-6">
                <PermissionsSettings
                  allowRules={allowRules}
                  denyRules={denyRules}
                  onAddRule={addPermissionRule}
                  onUpdateRule={updatePermissionRule}
                  onRemoveRule={removePermissionRule}
                />
              </Card>
            </TabsContent>
            
            {/* Environment Variables */}
            <TabsContent value="environment" className="space-y-6">
              <Card className="p-6">
                <EnvironmentSettings
                  envVars={envVars}
                  onAddEnvVar={addEnvVar}
                  onUpdateEnvVar={updateEnvVar}
                  onRemoveEnvVar={removeEnvVar}
                />
              </Card>
            </TabsContent>

            {/* Advanced Settings */}
            <TabsContent value="advanced" className="space-y-6">
              <Card className="p-6">
                <AdvancedSettings
                  settings={settings}
                  onUpdateSetting={updateSetting}
                />
              </Card>
            </TabsContent>
            
            {/* Hooks Settings */}
            <TabsContent value="hooks" className="space-y-6">
              <Card className="p-6">
                <HooksSettings
                  onHooksChange={handleHooksChange}
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
            
            {/* Proxy Settings */}
            <TabsContent value="proxy">
              <Card className="p-6">
                <NetworkSettings
                  onProxyChange={handleProxyChange}
                  onToast={setToast}
                />
              </Card>
            </TabsContent>
            
            {/* Analytics Settings */}
            <TabsContent value="analytics" className="space-y-6">
              <Card className="p-6 space-y-6">
                <AnalyticsSettings
                  analyticsEnabled={analyticsEnabled}
                  analyticsConsented={analyticsConsented}
                  showAnalyticsConsent={showAnalyticsConsent}
                  onAnalyticsEnabledChange={setAnalyticsEnabled}
                  onAnalyticsConsentChange={setAnalyticsConsented}
                  onShowAnalyticsConsentChange={setShowAnalyticsConsent}
                  onToast={setToast}
                  onLoadAnalyticsSettings={loadAnalyticsSettings}
                />
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
      </div>
      
      {/* Toast Notification */}
      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>
    </div>
  );
};