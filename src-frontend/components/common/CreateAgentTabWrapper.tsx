import React from 'react';
import { useTabState } from '@/hooks/useTabState';
import { CreateAgent } from '@/components/agents';
import type { Tab } from '@/contexts/TabContext';

interface CreateAgentTabWrapperProps {
  tab: Tab;
}

export const CreateAgentTabWrapper: React.FC<CreateAgentTabWrapperProps> = ({ tab }) => {
  const { updateTab, tabs } = useTabState();

  const handleBack = () => {
    // Just go back to projects or agents - they'll maintain their own state
    updateTab(tab.id, {
      type: "projects",
      title: "Projects", 
      agentData: undefined,
    });
  };

  const handleAgentCreated = () => {
    // Just go back to projects - it'll maintain its own state
    updateTab(tab.id, {
      type: "projects",
      title: "Projects",
      agentData: undefined,
    });
  };

  return (
    <CreateAgent
      agent={tab.agentData} // Pass agent data for editing if available
      onAgentCreated={handleAgentCreated}
      onBack={handleBack}
    />
  );
};