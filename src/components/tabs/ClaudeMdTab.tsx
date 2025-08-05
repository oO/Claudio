import React from 'react';
import { TabPageLayout } from '@/components/TabPageLayout';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { useScreenTracking } from '@/hooks/useAnalytics';
import { Tab } from '@/contexts/TabContext';

interface ClaudeMdTabProps {
  tab: Tab;
  isActive: boolean;
}

export const ClaudeMdTab: React.FC<ClaudeMdTabProps> = ({ tab, isActive }) => {
  // Track screen when tab becomes active
  useScreenTracking(isActive ? tab.type : undefined, isActive ? tab.id : undefined);

  return (
    <TabPageLayout
      title="CLAUDE.md"
      subtitle="Global Claude Code configuration"
    >
      <MarkdownEditor onBack={() => {}} />
    </TabPageLayout>
  );
};