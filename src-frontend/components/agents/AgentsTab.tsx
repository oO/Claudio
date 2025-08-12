import React from 'react';
import { TabPageLayout } from '@/components/common';
import { AgentsContent, CreateAgent } from '@/components/agents';
import { useTabState } from '@/hooks/useTabState';
import { useScreenTracking } from '@/hooks/useAnalytics';
import { Tab } from '@/contexts/TabContext';
import { DebugLabel } from '@/components/ui/atoms';

interface AgentsTabProps {
  tab: Tab;
  isActive: boolean;
}

export const AgentsTab: React.FC<AgentsTabProps> = ({ tab, isActive }) => {
  const { updateTab } = useTabState();
  
  // Track screen when tab becomes active
  useScreenTracking(isActive ? tab.type : undefined, isActive ? tab.id : undefined);

  // Check if we're in edit mode
  if (tab.agentData) {
    return (
      <div className="relative h-full">
        <DebugLabel label="AgentsTab" />
        <CreateAgent
        agent={tab.agentData}
        onAgentCreated={() => {
          // Clear agent data and return to agents list
          updateTab(tab.id, {
            agentData: undefined,
            title: 'Personal Agents'
          });
        }}
        onBack={() => {
          // Clear agent data and return to agents list
          updateTab(tab.id, {
            agentData: undefined,
            title: 'Personal Agents'
          });
        }}
      />
      </div>
    );
  }
  
  return (
    <div className="relative h-full">
      <DebugLabel label="AgentsTab" />
      <TabPageLayout
      title="Personal Agents"
      subtitle="Manage your personal Claude Code agents"
    >
      <AgentsContent
        onExecuteAgent={(agent) => {
          // Open agent execution in a new tab
          const tabId = `agent-exec-${agent.id}-${Date.now()}`;
          window.dispatchEvent(new CustomEvent('open-agent-execution', { 
            detail: { agent, tabId } 
          }));
        }}
        onEditAgent={(agent) => {
          // Edit in the same tab by updating tab data
          updateTab(tab.id, {
            agentData: agent,
            title: `Edit ${agent.name}`
          });
        }}
        onExportAgent={async (agent) => {
          // Export functionality is handled by AgentsContent
          // Agent export will be handled
        }}
        onDeleteAgent={(agent) => {
          // Agent deletion will be handled
        }}
        onCreateAgent={() => {
          // Create agent in the same tab
          updateTab(tab.id, {
            agentData: null, // null means create new agent
            title: 'Create Agent'
          });
        }}
        onImportAgent={() => {
          // AgentsContent handles import internally
        }}
        className="h-full"
      />
    </TabPageLayout>
    </div>
  );
};