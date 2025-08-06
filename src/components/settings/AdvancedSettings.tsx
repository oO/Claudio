import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ClaudeSettings } from "@/lib/api";

interface AdvancedSettingsProps {
  settings: ClaudeSettings | null;
  onUpdateSetting: (key: string, value: any) => void;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  settings,
  onUpdateSetting,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold mb-4">Advanced Settings</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Additional configuration options for advanced users
        </p>
      </div>
      
      {/* API Key Helper */}
      <div className="space-y-2">
        <Label htmlFor="apiKeyHelper">API Key Helper Script</Label>
        <Input
          id="apiKeyHelper"
          placeholder="/path/to/generate_api_key.sh"
          value={settings?.apiKeyHelper || ""}
          onChange={(e) => onUpdateSetting("apiKeyHelper", e.target.value || undefined)}
        />
        <p className="text-xs text-muted-foreground">
          Custom script to generate auth values for API requests
        </p>
      </div>
      
      {/* Raw JSON Editor */}
      <div className="space-y-2">
        <Label>Raw Settings (JSON)</Label>
        <div className="p-3 rounded-md bg-muted font-mono text-xs overflow-x-auto whitespace-pre-wrap">
          <pre>{JSON.stringify(settings, null, 2)}</pre>
        </div>
        <p className="text-xs text-muted-foreground">
          This shows the raw JSON that will be saved to ~/.claude/settings.json
        </p>
      </div>
    </div>
  );
};