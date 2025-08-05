import React from 'react';
import { TabPageLayout } from '@/components/TabPageLayout';
import { UsageDashboard } from '@/components/UsageDashboard';
import { useScreenTracking } from '@/hooks/useAnalytics';
import { Tab } from '@/contexts/TabContext';

interface UsageTabProps {
  tab: Tab;
  isActive: boolean;
}

export const UsageTab: React.FC<UsageTabProps> = ({ tab, isActive }) => {
  // Track screen when tab becomes active
  useScreenTracking(isActive ? tab.type : undefined, isActive ? tab.id : undefined);

  return (
    <TabPageLayout
      title="Dashboard"
      subtitle="Monitor your Claude API usage and costs"
    >
      <UsageDashboard onBack={() => {}} />
    </TabPageLayout>
  );
};