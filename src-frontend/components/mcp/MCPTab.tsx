import React from 'react';
import { TabPageLayout } from '@/components/common';
import { MCPManager } from '@/components/mcp';
import { useScreenTracking } from '@/hooks/useAnalytics';
import { Tab } from '@/contexts/TabContext';

interface MCPTabProps {
  tab: Tab;
  isActive: boolean;
}

export const MCPTab: React.FC<MCPTabProps> = ({ tab, isActive }) => {
  // Track screen when tab becomes active
  useScreenTracking(isActive ? tab.type : undefined, isActive ? tab.id : undefined);

  return (
    <TabPageLayout
      title="MCP Servers"
      subtitle="Manage Model Context Protocol servers"
    >
      <MCPManager onBack={() => {}} />
    </TabPageLayout>
  );
};