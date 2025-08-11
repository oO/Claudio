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
    // Always use simple fallback without navigation stack
    if (tab.previousState?.type === "projects") {
      // Return to the project detail view
      updateTab(tab.id, {
        type: "projects",
        title: tab.previousState.title || "Projects",
        // Restore project state if it exists
        restoreProjectState: tab.restoreProjectState,
        // Clear the agent data
        agentData: undefined,
      });
    } else {
      // Switch back to agents tab
      const agentsTab = tabs.find((t) => t.type === "agents");
      if (agentsTab) {
        window.dispatchEvent(
          new CustomEvent("switch-to-tab", {
            detail: { tabId: agentsTab.id },
          }),
        );
      }
      // Close this tab when back is clicked
      window.dispatchEvent(
        new CustomEvent("close-tab", { detail: { tabId: tab.id } }),
      );
    }
  };

  const handleAgentCreated = () => {
    // Always use simple fallback without navigation stack
    if (tab.previousState?.type === "projects") {
      // Return to the project detail view
      updateTab(tab.id, {
        type: "projects",
        title: tab.previousState.title || "Projects",
        // Restore project state if it exists
        restoreProjectState: tab.restoreProjectState,
        // Clear the agent data
        agentData: undefined,
      });
    } else {
      // Switch back to agents tab and close this one
      const agentsTab = tabs.find((t) => t.type === "agents");
      if (agentsTab) {
        window.dispatchEvent(
          new CustomEvent("switch-to-tab", {
            detail: { tabId: agentsTab.id },
          }),
        );
      }
      // Close this tab after agent is created/updated
      window.dispatchEvent(
        new CustomEvent("close-tab", { detail: { tabId: tab.id } }),
      );
    }
  };

  return (
    <CreateAgent
      agent={tab.agentData} // Pass agent data for editing if available
      onAgentCreated={handleAgentCreated}
      onBack={handleBack}
    />
  );
};