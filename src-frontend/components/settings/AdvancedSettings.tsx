import React from "react";
import { motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useDebugUnified } from "@/hooks";
import type { ClaudeSettings } from "@/lib/api";
import type { EnvironmentVariable } from "@/hooks/useSettingsState";
import { DebugLabel } from "@/components/ui/atoms";

/**
 * Debug Mode Toggle Component
 */
const DebugModeToggle: React.FC = () => {
  const { isDebugMode, toggleDebug } = useDebugUnified();

  return (
    <Switch
      id="debugMode"
      checked={isDebugMode}
      onCheckedChange={toggleDebug}
    />
  );
};

interface AdvancedSettingsProps {
  settings: ClaudeSettings | null;
  onUpdateSetting: (key: string, value: any) => void;
  envVars: EnvironmentVariable[];
  onAddEnvVar: () => void;
  onUpdateEnvVar: (id: string, field: "key" | "value", value: string) => void;
  onRemoveEnvVar: (id: string) => void;
  setToast: (message: string, type: "success" | "error") => void;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  settings,
  onUpdateSetting,
  envVars,
  onAddEnvVar,
  onUpdateEnvVar,
  onRemoveEnvVar,
  setToast,
}) => {
  return (
    <div className="relative flex flex-col h-full">
      <DebugLabel label="AdvancedSettings" />

      {/* Fixed header */}
      <div className="p-6 pb-4">
        <h3 className="text-lg font-semibold text-accent">Advanced Settings</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Additional configuration options for advanced users
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
        <div className="space-y-8">
          {/* Core Advanced Settings Section */}
          <section className="space-y-6">
            <div className="border-b pb-2">
              <h4 className="text-sm font-medium text-foreground">Core Settings</h4>
            </div>

            {/* Debug Mode Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="debugMode">Debug Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Show component labels for debugging UI issues
                  </p>
                </div>
                <DebugModeToggle />
              </div>
            </div>

            {/* API Key Helper */}
            <div className="space-y-2">
              <Label htmlFor="apiKeyHelper">API Key Helper Script</Label>
              <Input
                id="apiKeyHelper"
                placeholder="/path/to/generate_api_key.sh"
                value={settings?.apiKeyHelper || ""}
                onChange={(e) =>
                  onUpdateSetting("apiKeyHelper", e.target.value || undefined)
                }
              />
              <p className="text-xs text-muted-foreground">
                Custom script to generate auth values for API requests
              </p>
            </div>
          </section>

          {/* Environment Variables Section */}
          <section className="space-y-6">
            <div className="border-b pb-2">
              <h4 className="text-sm font-medium text-foreground">Environment Variables</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Environment variables applied to every Claude Code session
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {envVars.length === 0 ? "No environment variables configured" : `${envVars.length} variable${envVars.length !== 1 ? 's' : ''} configured`}
              </p>
              <Button
                onClick={onAddEnvVar}
                size="sm"
                className="gap-2"
              >
                <Plus className="h-3 w-3" />
                Add Variable
              </Button>
            </div>

            {envVars.length > 0 && (
              <div className="space-y-4">
                {envVars.map((envVar) => (
                  <motion.div
                    key={envVar.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-2"
                  >
                    <div className="flex-1">
                      <Input
                        placeholder="Variable name (e.g., API_KEY)"
                        value={envVar.key}
                        onChange={(e) => onUpdateEnvVar(envVar.id, "key", e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder="Variable value"
                        value={envVar.value}
                        onChange={(e) => onUpdateEnvVar(envVar.id, "value", e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={() => onRemoveEnvVar(envVar.id)}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* Proxy Settings Section */}
          <section className="space-y-6">
            <div className="border-b pb-2">
              <h4 className="text-sm font-medium text-foreground">Proxy Settings</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Configure proxy settings for network requests
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="proxyUrl">Proxy URL</Label>
                <Input
                  id="proxyUrl"
                  placeholder="http://proxy.example.com:8080"
                  value={settings?.proxyUrl || ""}
                  onChange={(e) =>
                    onUpdateSetting("proxyUrl", e.target.value || undefined)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  HTTP/HTTPS proxy server URL
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proxyAuth">Proxy Authentication</Label>
                <Input
                  id="proxyAuth"
                  placeholder="username:password"
                  value={settings?.proxyAuth || ""}
                  onChange={(e) =>
                    onUpdateSetting("proxyAuth", e.target.value || undefined)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Optional authentication credentials for proxy
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="proxyEnabled">Enable Proxy</Label>
                    <p className="text-xs text-muted-foreground">
                      Use proxy for all network requests
                    </p>
                  </div>
                  <Switch
                    id="proxyEnabled"
                    checked={settings?.proxyEnabled || false}
                    onCheckedChange={(checked) =>
                      onUpdateSetting("proxyEnabled", checked)
                    }
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
