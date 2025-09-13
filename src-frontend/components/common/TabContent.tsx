import React, { Suspense, lazy, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTabState } from "@/hooks/useTabState";
import { Tab, useTabContext } from "@/contexts/TabContext";
import { LoadingSpinner } from "@/components/ui/atoms/LoadingSpinner";
import { NavigationProvider } from "@/contexts/NavigationContext";
// import { ChatTabWrapper } from "./ChatTabWrapper"; // REMOVED: Chat tab no longer needed
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
import { logger } from "@/lib/logger";
import { formatSessionIdCompact } from "@/lib/sessionUtils";

// Import SessionDetail directly instead of lazy loading to prevent mount/unmount cycles
import { SessionDetail } from "@/components/sessions/SessionDetail";
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
      case "project":
      case "project-session":
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
        // LEGACY: Chat tab no longer needed - users can create sessions via Projects tab "Start New Session" button
        return (
          <div className="p-4 text-center">
            <h2 className="text-lg font-semibold mb-2">Chat Tab Removed</h2>
            <p className="text-muted-foreground">
              Use the "Start New Session" button in the Projects tab to create new Claude Code sessions.
            </p>
          </div>
        );


      case "claude-file":
        return (
          <NavigationProvider tabId={tab.id}>
            <ClaudeFileTabWrapper tab={tab} />
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

interface PanelContentProps {
  panelIndex: number;
  isActive: boolean;
}

const PanelContent: React.FC<PanelContentProps> = ({ panelIndex, isActive }) => {
  const { getTabsForPanel, getActiveTabForPanel } = useTabContext();
  const tabs = getTabsForPanel(panelIndex);
  const activeTabId = getActiveTabForPanel(panelIndex);
  
  return (
    <div className={`h-full overflow-hidden border-r border-border/20 last:border-r-0 
                     ${isActive ? 'ring-1 ring-primary/20' : ''}`}>
      {tabs.map((tab) => (
        <TabPanel 
          key={tab.id} 
          tab={tab} 
          isActive={tab.id === activeTabId} 
        />
      ))}
      
      {/* Show welcome screen if this panel has no tabs */}
      {tabs.length === 0 && <WelcomeScreen />}
    </div>
  );
};

export const TabContent: React.FC = () => {
  const {
    tabs,
    activeTabId,
    createSessionTab,
    findTabBySessionId,
    createClaudeFileTab,
    createCreateAgentTab,
    createImportAgentTab,
    closeTab,
    updateTab,
  } = useTabState();
  
  const {
    getPanelCount,
    getTabsForPanel,
    getActiveTabForPanel,
    activePanelIndex,
  } = useTabContext();

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
      logger.log('🎯 handleOpenSessionInTab called with session:', session.id);

      // Check if tab already exists for this session
      const existingTab = findTabBySessionId(session.id);
      logger.log('🔍 TabContent deduplication check - existing tab:', existingTab?.id);
      
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
        const sessionShort = formatSessionIdCompact(session.id);
        const tabTitle = `${projectName}:${sessionShort}`;
        const newTabId = createSessionTab(session.project_path, tabTitle, session.id);
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
      logger.log('🎯 handleClaudeSessionSelected called with session:', session.id);
      
      // Reuse same logic as handleOpenSessionInTab
      const existingTab = findTabBySessionId(session.id);
      logger.log('🔍 TabContent claude session deduplication check - existing tab:', existingTab?.id);
      
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
        const projectName = session.project_path.split("/").pop() || "Session";
        const sessionShort = formatSessionIdCompact(session.id);
        const tabTitle = `${projectName}:${sessionShort}`;
        const newTabId = createSessionTab(session.project_path, tabTitle, session.id);
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
    createSessionTab,
    findTabBySessionId,
    createClaudeFileTab,
    createCreateAgentTab,
    createImportAgentTab,
    closeTab,
    updateTab,
  ]);

  // Determine panel count and grid class
  const panelCount = getPanelCount();
  const gridClass = panelCount === 2 ? 'grid-cols-2' : 
                    panelCount === 3 ? 'grid-cols-3' : 
                    '';

  // Single panel mode - use existing behavior for backward compatibility
  if (panelCount === 1) {
    return (
      <div className="flex-1 h-full relative">
        {tabs.map((tab) => (
          <TabPanel key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
        ))}

        {tabs.length === 0 && <WelcomeScreen key={welcomeKey} />}
      </div>
    );
  }

  // Multi-panel mode - use CSS Grid
  return (
    <div className={`flex-1 h-full grid ${gridClass}`}>
      {Array.from({ length: panelCount }).map((_, panelIndex) => (
        <PanelContent 
          key={panelIndex} 
          panelIndex={panelIndex}
          isActive={activePanelIndex === panelIndex}
        />
      ))}
    </div>
  );
};

export default TabContent;