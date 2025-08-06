import React, { Suspense, lazy, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTabState } from "@/hooks/useTabState";
import { Tab } from "@/contexts/TabContext";
import { LoadingSpinner } from "@/components/ui/atoms/LoadingSpinner";
import { ProjectsTab } from "@/components/projects";
import { AgentsTab } from "@/components/agents";
import { SettingsTab } from "@/components/settings";
import { UsageTab } from "@/components/dashboard";
import { MCPTab } from "@/components/mcp";
import { ClaudeMdTab } from "@/components/claude";
import { invoke } from "@tauri-apps/api/core";

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

// Constants
const QUOTE_REFRESH_INTERVAL_MS = 60 * 1000; // 1 minute

// Simple session tracking for typewriter animation
const getHasPlayedTypewriterThisSession = () => {
  return sessionStorage.getItem('claudio-typewriter-played') === 'true';
};

const setHasPlayedTypewriterThisSession = (value: boolean) => {
  sessionStorage.setItem('claudio-typewriter-played', value.toString());
};

// Custom hook for word-by-word typewriter effect
const useWordTypewriter = (text: string, shouldStart: boolean, delay: number = 300) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!shouldStart || !text) {
      setDisplayedText("");
      setIsComplete(false);
      return;
    }

    const words = text.split(/(\s+|\n)/); // Split by spaces and newlines, keeping separators
    let currentIndex = 0;
    setDisplayedText("");
    setIsComplete(false);

    const animateWords = () => {
      if (currentIndex < words.length) {
        const nextText = words.slice(0, currentIndex + 1).join('');
        setDisplayedText(nextText);
        currentIndex++;
        setTimeout(animateWords, delay);
      } else {
        setIsComplete(true);
      }
    };

    const timeout = setTimeout(animateWords, delay);
    return () => clearTimeout(timeout);
  }, [text, shouldStart, delay]);

  return { displayedText, isComplete };
};

interface QuoteResponse {
  quote: string;
  source: string;
}

const TypewriterWelcome: React.FC = () => {
  const [quote, setQuote] = useState("");
  const [quoteSource, setQuoteSource] = useState<string>("pool");
  const fullText = "Hello, I'm Claudio";
  
  // Check if animation should play (only on first component mount of the session)
  const hasPlayed = getHasPlayedTypewriterThisSession();
  const [shouldAnimate] = useState(!hasPlayed);
  
  // Use word typewriter for title (150ms per word, only if should animate)
  const { displayedText: titleText, isComplete: titleComplete } = useWordTypewriter(
    fullText, 
    shouldAnimate, 
    150
  );
  
  // Use word typewriter for quote (250ms per word, always animate when quote is available)
  const { displayedText: quoteText } = useWordTypewriter(
    quote,
    !!quote && (titleComplete || !shouldAnimate), // Start when title complete or no title animation
    250
  );
  
  console.log("TypewriterWelcome: shouldAnimate =", shouldAnimate, "hasPlayed =", hasPlayed);

  // Function to fetch a new quote
  const fetchNewQuote = useCallback(async () => {
    try {
      const response = await invoke<QuoteResponse>("get_programming_quote");
      setQuote(response.quote);
      setQuoteSource(response.source);
      console.log("TypewriterWelcome: Fetched new quote:", response.quote.split('\n')[0] + "...");
    } catch (error) {
      console.error("Failed to get quote:", error);
      // Fallback quote if invoke fails - meta haiku about Claude being offline
      setQuote(
        "Claude sleeps silent\nNo quotes flow from distant mind\nSorry, try later",
      );
      setQuoteSource("fallback");
    }
  }, []);

  // Get quote on component mount and set up auto-refresh timer
  useEffect(() => {
    // Initial quote fetch
    fetchNewQuote();

    // Set up auto-refresh timer
    const refreshTimer = setInterval(() => {
      console.log("TypewriterWelcome: Auto-refreshing quote after", QUOTE_REFRESH_INTERVAL_MS / 1000, "seconds");
      fetchNewQuote();
    }, QUOTE_REFRESH_INTERVAL_MS);

    // Cleanup timer on unmount
    return () => {
      console.log("TypewriterWelcome: Cleaning up quote refresh timer");
      clearInterval(refreshTimer);
    };
  }, [fetchNewQuote]);

  // Mark animation as completed when title animation finishes
  useEffect(() => {
    if (shouldAnimate && titleComplete) {
      console.log("TypewriterWelcome: Title animation completed, setting session flag");
      setHasPlayedTypewriterThisSession(true);
    }
  }, [shouldAnimate, titleComplete]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Main content - centered */}
      <div className="flex items-center justify-center flex-1">
        <div className="text-center">
          <div className="relative">
            {/* Invisible placeholder text to maintain container width */}
            <h1 className="text-9xl font-bold mb-8 opacity-0 select-none pointer-events-none">
              {fullText}
            </h1>
            {/* Visible typing text positioned absolutely over placeholder */}
            <h1 className="absolute top-0 left-0 text-9xl font-bold mb-8 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400 bg-clip-text text-transparent">
              {shouldAnimate ? titleText : fullText}
            </h1>
          </div>
          <div className="relative">
            {/* Invisible placeholder for quote to maintain layout height */}
            <div className="text-2xl font-extrabold opacity-0 select-none pointer-events-none whitespace-pre-line">
              Line one of the quote\nLine two of the quote\nLine three of the
              quote
            </div>
            {/* Visible typewritten quote positioned absolutely over placeholder */}
            {quoteText && (
              <div className="absolute top-0 left-0 w-full">
                <div className="text-2xl font-extrabold whitespace-pre-line italic text-center bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400 bg-clip-text text-transparent opacity-80">
                  {quoteText}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Copyright - bottom of screen */}
      <div className="pb-6 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          © 2025. Designed with ❤️ by oO. Coded with ✨ by Claude Code.
        </p>
      </div>
    </div>
  );
};

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
        return <ProjectsTab tab={tab} isActive={isActive} />;

      case "agents":
        return <AgentsTab tab={tab} isActive={isActive} />;

      case "usage":
        return <UsageTab tab={tab} isActive={isActive} />;

      case "mcp":
        return <MCPTab tab={tab} isActive={isActive} />;

      case "settings":
        return <SettingsTab tab={tab} isActive={isActive} />;

      case "claude-md":
        return <ClaudeMdTab tab={tab} isActive={isActive} />;

      case "chat":
        return (
          <ClaudeCodeSession
            session={tab.sessionData} // Pass the full session object if available
            initialProjectPath={tab.initialProjectPath || tab.sessionId}
            onBack={() => {
              // Go back to projects view in the same tab
              updateTab(tab.id, {
                type: "projects",
                title: "Projects",
              });
            }}
          />
        );

      case "agent":
        if (!tab.agentRunId) {
          return <div className="p-4">No agent run ID specified</div>;
        }
        return (
          <AgentRunOutputViewer agentRunId={tab.agentRunId} tabId={tab.id} />
        );

      case "claude-file":
        if (!tab.claudeFileId) {
          return <div className="p-4">No Claude file path specified</div>;
        }
        // Create a ClaudeMdFile object from the stored file path
        const file = {
          absolute_path: tab.claudeFileId,
          relative_path: tab.title,
          size: 0,
          modified: 0,
        };
        // Import ClaudeFileEditor dynamically to avoid circular imports
        const ClaudeFileEditor = lazy(() =>
          import("@/components/claude").then((m) => ({
            default: m.ClaudeFileEditor,
          })),
        );
        return (
          <ClaudeFileEditor
            file={file}
            onBack={() => {
              // Return to projects tab - the effect will handle restoring state
              updateTab(tab.id, {
                type: "projects",
                title: tab.previousState?.title || "Projects",
              });
            }}
          />
        );

      case "agent-execution":
        if (!tab.agentData) {
          return <div className="p-4">No agent data specified</div>;
        }
        return <AgentExecution agent={tab.agentData} onBack={() => {}} />;

      case "create-agent":
        return (
          <CreateAgent
            agent={tab.agentData} // Pass agent data for editing if available
            onAgentCreated={() => {
              // Handle navigation based on previous state
              if (tab.previousState?.type === "project-detail") {
                // Return to the project detail view
                updateTab(tab.id, {
                  type: "projects",
                  title: tab.previousState.title || "Projects",
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
            }}
            onBack={() => {
              // Handle navigation based on previous state
              if (tab.previousState?.type === "project-detail") {
                // Return to the project detail view
                updateTab(tab.id, {
                  type: "projects",
                  title: tab.previousState.title || "Projects",
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
            }}
          />
        );

      case "import-agent":
        // TODO: Implement import agent component
        return (
          <div className="p-4">Import agent functionality coming soon...</div>
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
      setWelcomeKey(prev => prev + 1);
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
          title: session.project_path.split("/").pop() || "Session",
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
          title: session.project_path.split("/").pop() || "Session",
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

      {tabs.length === 0 && <TypewriterWelcome key={welcomeKey} />}
    </div>
  );
};

export default TabContent;
