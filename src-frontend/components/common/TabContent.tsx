import React, { Suspense, lazy, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTabState } from "@/hooks/useTabState";
import { Tab } from "@/contexts/TabContext";
import { LoadingSpinner } from "@/components/ui/atoms/LoadingSpinner";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { ChatTabWrapper } from "./ChatTabWrapper";
import { ClaudeFileTabWrapper } from "./ClaudeFileTabWrapper";
import { CreateAgentTabWrapper } from "./CreateAgentTabWrapper";
import { ProjectsTab } from "@/components/projects";
import { AgentsTab } from "@/components/agents";
import { SettingsTab } from "@/components/settings";
import { UsageTab } from "@/components/dashboard";
import { MCPTab } from "@/components/mcp";
import { ClaudeMdTab } from "@/components/claude";
import { WelcomeScreen } from "./Welcome";
import { invoke } from "@tauri-apps/api/core";
import { prettifyProjectName } from "@/lib/utils";

// Lazy load heavy components
const ClaudeCodeSession = lazy(() =>
  import("@/components/sessions").then((m) => ({
    default: m.ClaudeCodeSession,
  })),
);
const AgentRunOutputViewer = lazy(() =>
  import("@/components/agents").then((m) => ({
    default: m.AgentRunOutputViewer,
  })),
);
const AgentExecution = lazy(() =>
  import("@/components/agents").then((m) => ({ default: m.AgentExecution })),
);
const CreateAgent = lazy(() =>
  import("@/components/agents").then((m) => ({ default: m.CreateAgent })),
);
// const ClaudeFileEditor = lazy(() => import('@/components/ClaudeFileEditor').then(m => ({ default: m.ClaudeFileEditor })));

interface TabPanelProps {
  tab: Tab;
  isActive: boolean;
}

const TabPanel: React.FC<TabPanelProps> = ({ tab, isActive }) => {
  const { updateTab, tabs } = useTabState();

  // Panel visibility - hide when not active
  const panelVisibilityClass = isActive ? "" : "hidden";

  const renderContent = () => {
    switch (tab.type) {
      case "projects":
        return (
          <NavigationProvider tabId={tab.id}>
            <ProjectsTab tab={tab} isActive={isActive} />
          </NavigationProvider>
        );


      case "agents":
        return (
          <NavigationProvider tabId={tab.id}>
            <AgentsTab tab={tab} isActive={isActive} />
          </NavigationProvider>
        );

      case "usage":
        return (
          <NavigationProvider tabId={tab.id}>
            <UsageTab tab={tab} isActive={isActive} />
          </NavigationProvider>
        );

      case "mcp":
        return (
          <NavigationProvider tabId={tab.id}>
            <MCPTab tab={tab} isActive={isActive} />
          </NavigationProvider>
        );

      case "settings":
        return (
          <NavigationProvider tabId={tab.id}>
            <SettingsTab tab={tab} isActive={isActive} />
          </NavigationProvider>
        );

      case "claude-md":
        return (
          <NavigationProvider tabId={tab.id}>
            <ClaudeMdTab tab={tab} isActive={isActive} />
          </NavigationProvider>
        );

      case "chat":
        return (
          <NavigationProvider tabId={tab.id}>
            <ChatTabWrapper tab={tab} />
          </NavigationProvider>
        );

      case "agent":
        if (!tab.agentRunId) {
          return <div className="p-4">No agent run ID specified</div>;
        }
        return (
          <NavigationProvider tabId={tab.id}>
            <AgentRunOutputViewer agentRunId={tab.agentRunId} tabId={tab.id} />
          </NavigationProvider>
        );

      case "claude-file":
        return (
          <NavigationProvider tabId={tab.id}>
            <ClaudeFileTabWrapper tab={tab} />
          </NavigationProvider>
        );

      case "agent-execution":
        if (!tab.agentData) {
          return <div className="p-4">No agent data specified</div>;
        }
        return (
          <NavigationProvider tabId={tab.id}>
            <AgentExecution agent={tab.agentData} onBack={() => {}} />
          </NavigationProvider>
        );

      case "create-agent":
        return (
          <NavigationProvider tabId={tab.id}>
            <CreateAgentTabWrapper tab={tab} />
          </NavigationProvider>
        );

      case "import-agent":
        // TODO: Implement import agent component
        return (
          <NavigationProvider tabId={tab.id}>
            <div className="p-4">Import agent functionality coming soon...</div>
          </NavigationProvider>
        );

      default:
        return <div className="p-4">Unknown tab type: {tab.type}</div>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={`h-full w-full ${panelVisibilityClass}`}
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        {renderContent()}
      </Suspense>
    </motion.div>
  );
};

export const TabContent: React.FC = () => {
  const {
    tabs,
    activeTabId,
    createChatTab,
    findTabBySessionId,
    createClaudeFileTab,
    createAgentExecutionTab,
    createCreateAgentTab,
    createImportAgentTab,
    closeTab,
    updateTab,
  } = useTabState();

  // Track when welcome screen becomes visible to trigger new quote
  const [welcomeKey, setWelcomeKey] = useState(0);

  // Update welcome key when returning to welcome screen (no tabs)
  useEffect(() => {
    if (tabs.length === 0) {
      setWelcomeKey((prev) => prev + 1);
    }
  }, [tabs.length]);

  // Listen for events to open sessions in tabs
  useEffect(() => {
    const handleOpenSessionInTab = (event: CustomEvent) => {
      const { session } = event.detail;

      // Check if tab already exists for this session
      const existingTab = findTabBySessionId(session.id);
      if (existingTab) {
        // Update existing tab with session data and switch to it
        updateTab(existingTab.id, {
          sessionData: session,
          title: prettifyProjectName(session.project_path),
        });
        window.dispatchEvent(
          new CustomEvent("switch-to-tab", {
            detail: { tabId: existingTab.id },
          }),
        );
      } else {
        // Create new tab for this session
        const projectName = session.project_path.split("/").pop() || "Session";
        const newTabId = createChatTab(session.id, projectName);
        // Update the new tab with session data
        updateTab(newTabId, {
          sessionData: session,
          initialProjectPath: session.project_path,
        });
      }
    };

    const handleOpenClaudeFile = (event: CustomEvent) => {
      const { file, returnContext } = event.detail;
      // Use absolute_path as the file identifier and extract filename from relative_path
      const fileName = file.relative_path.split("/").pop() || "CLAUDE.md";
      const tabId = createClaudeFileTab(file.absolute_path, fileName);

      // Store return context if provided
      if (returnContext && tabId) {
        updateTab(tabId, {
          previousState: returnContext,
        });
      }
    };

    const handleOpenAgentExecution = (event: CustomEvent) => {
      const { agent, tabId } = event.detail;
      createAgentExecutionTab(agent, tabId);
    };

    const handleOpenCreateAgentTab = () => {
      createCreateAgentTab();
    };
    const handleCreateEditAgentTab = (event: CustomEvent) => {
      const { agent, returnContext } = event.detail;
      // Create a create-agent tab but with agent data for editing
      const newTabId = createCreateAgentTab();
      updateTab(newTabId, {
        agentData: agent,
        title: `Edit ${agent.name}`,
        previousState: returnContext,
      });
    };

    const handleOpenImportAgentTab = () => {
      createImportAgentTab();
    };

    const handleCloseTab = (event: CustomEvent) => {
      const { tabId } = event.detail;
      closeTab(tabId);
    };

    const handleClaudeSessionSelected = (event: CustomEvent) => {
      const { session } = event.detail;
      // Reuse same logic as handleOpenSessionInTab
      const existingTab = findTabBySessionId(session.id);
      if (existingTab) {
        updateTab(existingTab.id, {
          sessionData: session,
          title: prettifyProjectName(session.project_path),
        });
        window.dispatchEvent(
          new CustomEvent("switch-to-tab", {
            detail: { tabId: existingTab.id },
          }),
        );
      } else {
        const projectName = session.project_path.split("/").pop() || "Session";
        const newTabId = createChatTab(session.id, projectName);
        updateTab(newTabId, {
          sessionData: session,
          initialProjectPath: session.project_path,
        });
      }
    };

    window.addEventListener(
      "open-session-in-tab",
      handleOpenSessionInTab as EventListener,
    );
    window.addEventListener(
      "open-claude-file",
      handleOpenClaudeFile as EventListener,
    );
    window.addEventListener(
      "open-agent-execution",
      handleOpenAgentExecution as EventListener,
    );
    window.addEventListener("open-create-agent-tab", handleOpenCreateAgentTab);
    window.addEventListener(
      "create-edit-agent-tab",
      handleCreateEditAgentTab as EventListener,
    );
    window.addEventListener("open-import-agent-tab", handleOpenImportAgentTab);
    window.addEventListener("close-tab", handleCloseTab as EventListener);
    window.addEventListener(
      "claude-session-selected",
      handleClaudeSessionSelected as EventListener,
    );
    return () => {
      window.removeEventListener(
        "open-session-in-tab",
        handleOpenSessionInTab as EventListener,
      );
      window.removeEventListener(
        "open-claude-file",
        handleOpenClaudeFile as EventListener,
      );
      window.removeEventListener(
        "open-agent-execution",
        handleOpenAgentExecution as EventListener,
      );
      window.removeEventListener(
        "open-create-agent-tab",
        handleOpenCreateAgentTab,
      );
      window.removeEventListener(
        "create-edit-agent-tab",
        handleCreateEditAgentTab as EventListener,
      );
      window.removeEventListener(
        "open-import-agent-tab",
        handleOpenImportAgentTab,
      );
      window.removeEventListener("close-tab", handleCloseTab as EventListener);
      window.removeEventListener(
        "claude-session-selected",
        handleClaudeSessionSelected as EventListener,
      );
    };
  }, [
    createChatTab,
    findTabBySessionId,
    createClaudeFileTab,
    createAgentExecutionTab,
    createCreateAgentTab,
    createImportAgentTab,
    closeTab,
    updateTab,
  ]);

  return (
    <div className="flex-1 h-full relative">
      <AnimatePresence mode="wait">
        {tabs.map((tab) => (
          <TabPanel key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
        ))}
      </AnimatePresence>

      {tabs.length === 0 && <WelcomeScreen key={welcomeKey} />}
    </div>
  );
};

export default TabContent;
