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
    // Check if we came from a project detail view
    if (tab.previousState?.type === "projects" && tab.previousState?.selectedProject) {
      // Return to the project detail view with the correct state
      updateTab(tab.id, {
        type: "projects",
        title: tab.previousState.title || "Projects",
        // Restore the full project state to show project detail, not project list
        restoreProjectState: {
          selectedProject: tab.previousState.selectedProject,
          sessions: tab.previousState.sessions || [],
          activeTab: tab.restoreProjectState?.activeTab || "agents",
        },
        // Clear the agent data
        agentData: undefined,
      });
    } else if (tab.previousState?.type === "projects") {
      // Return to projects list if no selected project
      updateTab(tab.id, {
        type: "projects",
        title: "Projects",
        restoreProjectState: undefined,
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
    // Check if we came from a project detail view
    if (tab.previousState?.type === "projects" && tab.previousState?.selectedProject) {
      // Return to the project detail view with the correct state
      updateTab(tab.id, {
        type: "projects",
        title: tab.previousState.title || "Projects",
        // Restore the full project state to show project detail, not project list
        restoreProjectState: {
          selectedProject: tab.previousState.selectedProject,
          sessions: tab.previousState.sessions || [],
          activeTab: tab.restoreProjectState?.activeTab || "agents",
        },
        // Clear the agent data
        agentData: undefined,
      });
    } else if (tab.previousState?.type === "projects") {
      // Return to projects list if no selected project
      updateTab(tab.id, {
        type: "projects",
        title: "Projects",
        restoreProjectState: undefined,
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