import React from "react";
import { BarChart3, Shield, Trash } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { AnalyticsConsent } from "@/components/settings";
import { useTrackEvent } from "@/hooks";
import { analytics } from "@/lib/analytics";

interface AnalyticsSettingsProps {
  analyticsEnabled: boolean;
  analyticsConsented: boolean;
  showAnalyticsConsent: boolean;
  onAnalyticsEnabledChange: (enabled: boolean) => void;
  onAnalyticsConsentChange: (consented: boolean) => void;
  onShowAnalyticsConsentChange: (show: boolean) => void;
  onToast: (toast: { message: string; type: 'success' | 'error' }) => void;
  onLoadAnalyticsSettings: () => Promise<void>;
}

export const AnalyticsSettings: React.FC<AnalyticsSettingsProps> = ({
  analyticsEnabled,
  analyticsConsented,
  showAnalyticsConsent,
  onAnalyticsEnabledChange,
  onAnalyticsConsentChange,
  onShowAnalyticsConsentChange,
  onToast,
  onLoadAnalyticsSettings,
}) => {
  const trackEvent = useTrackEvent();

  const handleAnalyticsToggle = async (checked: boolean) => {
    if (checked && !analyticsConsented) {
      onShowAnalyticsConsentChange(true);
    } else if (checked) {
      await analytics.enable();
      onAnalyticsEnabledChange(true);
      trackEvent.settingsChanged('analytics_enabled', true);
      onToast({ message: "Analytics enabled", type: "success" });
    } else {
      await analytics.disable();
      onAnalyticsEnabledChange(false);
      trackEvent.settingsChanged('analytics_enabled', false);
      onToast({ message: "Analytics disabled", type: "success" });
    }
  };

  const handleDeleteAllData = async () => {
    await analytics.deleteAllData();
    onAnalyticsEnabledChange(false);
    onAnalyticsConsentChange(false);
    onToast({ message: "All analytics data deleted", type: "success" });
  };

  const handleConsentComplete = async () => {
    await onLoadAnalyticsSettings();
    onShowAnalyticsConsentChange(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-base font-semibold">Analytics Settings</h3>
        </div>
        
        <div className="space-y-6">
          {/* Analytics Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="analytics-enabled" className="text-base">Enable Analytics</Label>
              <p className="text-sm text-muted-foreground">
                Help improve Claudia by sharing anonymous usage data
              </p>
            </div>
            <Switch
              id="analytics-enabled"
              checked={analyticsEnabled}
              onCheckedChange={handleAnalyticsToggle}
            />
          </div>
          
          {/* Privacy Info */}
          <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-4">
            <div className="flex gap-3">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-blue-900 dark:text-blue-100">Your privacy is protected</p>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• No personal information is collected</li>
                  <li>• No file contents, paths, or project names</li>
                  <li>• All data is anonymous with random IDs</li>
                  <li>• You can disable analytics at any time</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Data Collection Info */}
          {analyticsEnabled && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">What we collect:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Feature usage patterns</li>
                  <li>• Performance metrics</li>
                  <li>• Error reports (without sensitive data)</li>
                  <li>• Session frequency and duration</li>
                </ul>
              </div>
              
              {/* Delete Data Button */}
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAllData}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete All Analytics Data
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Consent Dialog */}
      <AnalyticsConsent
        open={showAnalyticsConsent}
        onOpenChange={onShowAnalyticsConsentChange}
        onComplete={handleConsentComplete}
      />
    </div>
  );
};