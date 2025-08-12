import React from 'react';
import { TabPageLayout, MarkdownEditor } from '@/components/common';
import { useScreenTracking } from '@/hooks/useAnalytics';
import { Tab } from '@/contexts/TabContext';
import { DebugLabel } from '@/components/ui/atoms';

interface ClaudeMdTabProps {
  tab: Tab;
  isActive: boolean;
}

export const ClaudeMdTab: React.FC<ClaudeMdTabProps> = ({ tab, isActive }) => {
  // Track screen when tab becomes active
  useScreenTracking(isActive ? tab.type : undefined, isActive ? tab.id : undefined);

  return (
    <div className="relative h-full">
      <DebugLabel label="ClaudeMdTab" />
      <TabPageLayout
        title="CLAUDE.md"
        subtitle="Global Claude Code configuration"
      >
        <MarkdownEditor onBack={() => {}} />
      </TabPageLayout>
    </div>
  );
};