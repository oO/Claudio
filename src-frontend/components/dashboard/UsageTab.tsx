import React from 'react';
import { TabPageLayout } from '@/components/common';
import { UsageDashboard } from '@/components/dashboard';
import { useScreenTracking } from '@/hooks/useAnalytics';
import { Tab } from '@/contexts/TabContext';
import { DebugLabel } from '@/components/ui/atoms';

interface UsageTabProps {
  tab: Tab;
  isActive: boolean;
}

export const UsageTab: React.FC<UsageTabProps> = ({ tab, isActive }) => {
  // Track screen when tab becomes active
  useScreenTracking(isActive ? tab.type : undefined, isActive ? tab.id : undefined);

  return (
    <div className="relative h-full">
      <DebugLabel label="UsageTab" />
      <TabPageLayout
        title="Dashboard"
        subtitle="Monitor your Claude API usage and costs"
      >
        <UsageDashboard onBack={() => {}} />
      </TabPageLayout>
    </div>
  );
};