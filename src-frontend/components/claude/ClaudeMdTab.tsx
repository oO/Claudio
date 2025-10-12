import React from 'react';
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { useScreenTracking } from '@/hooks/useAnalytics';
import { Tab } from '@/contexts/TabContext';
import { DebugLabel } from '@/components/ui/atoms';
import { claudeApi } from "@/lib/api";

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
      <MarkdownEditor
        loadContent={() => claudeApi.getSystemPrompt()}
        saveContent={(content) => claudeApi.saveSystemPrompt(content)}
        title="Global Memory"
        subtitle="Global memory and context for Claude Code"
        path="~/.claude/CLAUDE.md"
        initialMode="preview"
      />
    </div>
  );
};