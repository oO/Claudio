import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { systemApi } from "@/lib/api/system";
import type { ClaudeMdFile } from "@/lib/types/claude";
import { TabProvider } from "@/contexts/TabContext";
import { TodoProvider } from "@/contexts/TodoContext";
import { UnifiedSettingsProvider } from "@/lib/settings";
import { Topbar, TabManager, TabContent, ThemeApplier } from "@/components/common";
import { ClaudeFileEditor, ClaudeBinaryDialog } from "@/components/claude";
import { logger } from "@/lib/logger";
import { Settings, AnalyticsConsentBanner } from "@/components/settings";
import { UsageDashboard } from "@/components/dashboard";
import { MCPManager } from "@/components/mcp";
import { NFOCredits } from "@/components/common";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { useTabState } from "@/hooks/useTabState";
import { useAppLifecycle } from "@/hooks";

type View =
  | "welcome"
  | "claude-file-editor"
  | "settings"
  | "mcp"
  | "usage-dashboard"
  | "tabs"; // New view for tab-based interface

/**
 * AppContent component - Contains the main app logic, wrapped by providers
 */
function AppContent() {
  const [view, setView] = useState<View>("tabs");
  const {
    createClaudeMdTab,
    createSettingsTab,
    createUsageTab,
    createMCPTab,
    createAgentsTab,
    createProjectsTab,
    createOutputStylesTab,
  } = useTabState();
  const [editingClaudeFile, setEditingClaudeFile] =
    useState<ClaudeMdFile | null>(null);
  const [showNFO, setShowNFO] = useState(false);
  const [showClaudeBinaryDialog, setShowClaudeBinaryDialog] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  // Initialize analytics lifecycle tracking
  useAppLifecycle();




  // Set window title with version using Tauri API and restore window state
  useEffect(() => {
    const initializeWindow = async () => {
      try {
        const window = getCurrentWindow();
        await window.setTitle(`Claudio v${__APP_VERSION__}`);

        // Restore window state
        try {
          await systemApi.restoreWindowState();
          logger.log("Window state restored");
        } catch (error) {
          logger.warn("Failed to restore window state, using defaults:", error);
        }
      } catch (error) {
        logger.error("Failed to set Tauri window title:", error);
        // Fallback to document.title
        document.title = `Claudio v${__APP_VERSION__}`;
      }
    };

    initializeWindow();
  }, []);

  // Global debug mode setup - runs once on app start
  useEffect(() => {
    // Set up global toggle function that uses settings instead of localStorage
    (window as any).toggleDebug = async () => {
      try {
        // Get current debug mode from settings
        const currentDebug = await systemApi.loadClaudioAppSetting<boolean>("debugMode");
        const newDebugMode = !currentDebug;

        // Save to settings
        await systemApi.saveClaudioAppSetting("debugMode", newDebugMode);
        logger.log(`Debug mode ${newDebugMode ? "enabled" : "disabled"}`);

        // Trigger a custom event to notify debug components
        window.dispatchEvent(new CustomEvent('debugModeChanged', { detail: newDebugMode }));
      } catch (error) {
        logger.error("Failed to toggle debug mode:", error);
      }
    };

    // Cleanup global function on unmount
    return () => {
      delete (window as any).toggleDebug;
    };
  }, []);

  // Save window state when app is about to close
  useEffect(() => {
    const handleBeforeUnload = async () => {
      try {
        const currentState = await systemApi.getCurrentWindowState();
        await systemApi.saveWindowState(currentState);
        logger.log("Window state saved");
      } catch (error) {
        logger.warn("Failed to save window state on close:", error);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);


  // Keyboard shortcuts for tab navigation
  useEffect(() => {
    if (view !== "tabs") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey) {
        switch (e.key) {
          case "t":
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("create-chat-tab"));
            break;
          case "w":
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("close-current-tab"));
            break;
          case "Tab":
            e.preventDefault();
            if (e.shiftKey) {
              window.dispatchEvent(new CustomEvent("switch-to-previous-tab"));
            } else {
              window.dispatchEvent(new CustomEvent("switch-to-next-tab"));
            }
            break;
          default:
            // Handle number keys 1-9
            if (e.key >= "1" && e.key <= "9") {
              e.preventDefault();
              const index = parseInt(e.key) - 1;
              window.dispatchEvent(
                new CustomEvent("switch-to-tab-by-index", {
                  detail: { index },
                }),
              );
            }
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view]);

  // Listen for Claude not found events
  useEffect(() => {
    const handleClaudeNotFound = () => {
      setShowClaudeBinaryDialog(true);
    };

    window.addEventListener(
      "claude-not-found",
      handleClaudeNotFound as EventListener,
    );
    return () => {
      window.removeEventListener(
        "claude-not-found",
        handleClaudeNotFound as EventListener,
      );
    };
  }, []);


  /**
   * Handles editing a CLAUDE.md file from a project
   */
  const handleEditClaudeFile = (file: ClaudeMdFile) => {
    setEditingClaudeFile(file);
    handleViewChange("claude-file-editor");
  };

  /**
   * Returns from CLAUDE.md file editor to tabs view
   */
  const handleBackFromClaudeFileEditor = () => {
    setEditingClaudeFile(null);
    handleViewChange("tabs");
  };

  /**
   * Handles view changes
   */
  const handleViewChange = (newView: View) => {
    setView(newView);
  };

  const renderContent = () => {
    switch (view) {
      case "welcome":
        return (
          <div
            className="flex items-center justify-center p-4"
            style={{ height: "100%" }}
          >
            <div className="w-full max-w-4xl">
              {/* Welcome Header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-12 text-center"
              >
                <h1 className="text-4xl font-bold tracking-tight">
                  <span className="rotating-symbol"></span>
                  Welcome to Claudia
                </h1>
              </motion.div>

            </div>
          </div>
        );


      case "settings":
        return (
          <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
            <Settings onBack={() => handleViewChange("welcome")} />
          </div>
        );

      case "claude-file-editor":
        return editingClaudeFile ? (
          <ClaudeFileEditor
            file={editingClaudeFile}
            onBack={handleBackFromClaudeFileEditor}
          />
        ) : null;

      case "tabs":
        return (
          <div className="h-full flex flex-col">
            <TabManager className="flex-shrink-0" />
            <div className="flex-1 overflow-hidden">
              <TabContent />
            </div>
          </div>
        );

      case "usage-dashboard":
        return <UsageDashboard onBack={() => handleViewChange("welcome")} />;

      case "mcp":
        return <MCPManager onBack={() => handleViewChange("welcome")} />;

      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Topbar */}
      <Topbar
        onProjectsClick={() => createProjectsTab()}
        onAgentsClick={() => createAgentsTab()}
        onOutputStylesClick={() => createOutputStylesTab()}
        onUsageClick={() => createUsageTab()}
        onClaudeClick={() => createClaudeMdTab()}
        onMCPClick={() => createMCPTab()}
        onSettingsClick={() => createSettingsTab()}
      />

      {/* Analytics Consent Banner */}
      <AnalyticsConsentBanner />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">{renderContent()}</div>

      {/* NFO Credits Modal */}
      {showNFO && <NFOCredits onClose={() => setShowNFO(false)} />}

      {/* Claude Binary Dialog */}
      <ClaudeBinaryDialog
        open={showClaudeBinaryDialog}
        onOpenChange={setShowClaudeBinaryDialog}
        onSuccess={() => {
          setToast({
            message: "Claude binary path saved successfully",
            type: "success",
          });
          // Trigger a refresh of the Claude version check
          window.location.reload();
        }}
        onError={(message) => setToast({ message, type: "error" })}
      />

      {/* Toast Container */}
      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>

    </div>
  );
}

/**
 * Main App component - Wraps the app with providers
 */
function App() {
  return (
    <UnifiedSettingsProvider>
      <ThemeApplier>
            <TabProvider>
              <TodoProvider>
                <AppContent />
              </TodoProvider>
            </TabProvider>
      </ThemeApplier>
    </UnifiedSettingsProvider>
  );
}

export default App;
