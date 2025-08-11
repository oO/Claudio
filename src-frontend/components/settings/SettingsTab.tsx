import React from 'react';
import { TabPageLayout } from '@/components/common';
import { Settings } from '@/components/settings';
import { useScreenTracking } from '@/hooks/useAnalytics';
import { Tab } from '@/contexts/TabContext';

interface SettingsTabProps {
  tab: Tab;
  isActive: boolean;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ tab, isActive }) => {
  // Track screen when tab becomes active
  useScreenTracking(isActive ? tab.type : undefined, isActive ? tab.id : undefined);

  return (
    <TabPageLayout
      title="Settings"
      subtitle="Configure your Claudio preferences"
    >
      <Settings onBack={() => {}} />
    </TabPageLayout>
  );
};