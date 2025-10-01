import React from "react";
import { TabPageLayout } from "@/components/common";
import { Settings } from "@/components/settings";
import { useScreenTracking } from "@/hooks/useAnalytics";
import { Tab } from "@/contexts/TabContext";
import { DebugLabel } from "@/components/ui/atoms";

interface SettingsTabProps {
  tab: Tab;
  isActive: boolean;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ tab, isActive }) => {
  // Track screen when tab becomes active
  useScreenTracking(
    isActive ? tab.type : undefined,
    isActive ? tab.id : undefined,
  );

  return (
    <div className="relative h-full">
      <DebugLabel label="SettingsTab" />
      <TabPageLayout
        title="Settings"
        subtitle="Configure your Claudio and Claude Code preferences"
      >
        <Settings onBack={() => {}} />
      </TabPageLayout>
    </div>
  );
};
