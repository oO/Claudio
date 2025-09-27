import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  X,
  Plus,
  MessageSquare,
  MessagesSquare,
  Bot,
  AlertCircle,
  Loader2,
  Folder,
  FolderOpen,
  BarChart,
  Server,
  Settings,
  FileText,
} from "lucide-react";
import { useTabState } from "@/hooks/useTabState";
import { Tab, useTabContext } from "@/contexts/TabContext";
import { cn } from "@/lib/utils";
import { useTrackEvent } from "@/hooks";
import { LoadingSpinner } from "@/components/ui/atoms/LoadingSpinner";
import { ActionButton } from "@/components/ui/atoms/ActionButton";
import { DebugLabel } from "@/components/ui/atoms";
import { ConfirmationDialog } from "@/components/ui/organisms";

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onClose: (id: string) => void;
  onClick: (id: string) => void;
  isDragging?: boolean;
  setDraggedTabId?: (id: string | null) => void;
}

const TabItem: React.FC<TabItemProps> = ({
  tab,
  isActive,
  onClose,
  onClick,
  isDragging = false,
  setDraggedTabId,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [shouldFade, setShouldFade] = useState(false);

  // Trigger fade animation when activity timestamp changes
  useEffect(() => {
    if (tab.lastActivityAt) {
      setShouldFade(false); // Reset to opaque
      // Trigger fade on next frame
      const timer = setTimeout(() => setShouldFade(true), 10);
      return () => clearTimeout(timer);
    }
  }, [tab.lastActivityAt]);

  const getIcon = () => {
    switch (tab.type) {
      case "chat": // Legacy support
        return MessageSquare;
      case "agents":
        return Bot;
      case "projects":
        return FolderOpen; // Project list (browsing)
      case "project":
        return Folder; // Single project (focused)
      case "project-session":
        return MessagesSquare; // Project showing session
      case "usage":
        return BarChart;
      case "mcp":
        return Server;
      case "settings":
        return Settings;
      case "claude-md":
      case "claude-file":
        return FileText;
      case "create-agent":
        return Plus;
      case "import-agent":
        return Plus;
      default:
        return MessageSquare;
    }
  };

  const Icon = getIcon();

  return (
    <Reorder.Item
      value={tab}
      id={tab.id}
      dragListener={true}
      transition={{ duration: 0.1 }} // Snappy reorder animation
      className={cn(
        "relative flex items-center gap-2 text-sm cursor-pointer select-none group",
        "transition-colors duration-100 overflow-hidden border-r border-border/20",
        "before:absolute before:bottom-0 before:left-0 before:right-0 before:h-0.5 before:transition-colors before:duration-100",
        isActive
          ? "bg-card text-card-foreground before:bg-primary"
          : "bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground before:bg-transparent",
        isDragging && "bg-card border-primary/50 shadow-sm z-50",
        "min-w-[120px] max-w-[220px] h-8 px-3",
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(tab.id)}
      onDragStart={() => setDraggedTabId?.(tab.id)}
      onDragEnd={() => setDraggedTabId?.(null)}
    >
      {/* Tab Icon */}
      <div className="flex-shrink-0 relative">
        <Icon className="w-4 h-4" />
        {/* Flash overlay */}
        {tab.lastActivityAt && (
          <div
            key={tab.lastActivityAt} // Key changes force re-mount and restart animation
            className={`absolute inset-0 rounded-sm bg-orange-500 mix-blend-multiply pointer-events-none transition-opacity duration-[3000ms] ease-linear ${shouldFade ? "opacity-0" : "opacity-100"}`}
          />
        )}
      </div>

      {/* Tab Title */}
      {tab.displayId ? (
        // Session tabs: [title(truncate) | id(no truncate)]
        <div className="flex-1 flex items-center gap-1 min-w-0">
          <span className="truncate text-xs font-medium min-w-0">
            {tab.title}
          </span>
          <span className="flex-shrink-0 text-xs font-medium">
            {tab.displayId}
          </span>
        </div>
      ) : (
        // Other tabs: just title (truncates)
        <span className="flex-1 truncate text-xs font-medium min-w-0">
          {tab.title}
        </span>
      )}

      {/* Close Button - Always reserves space */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
        className={cn(
          "flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-sm",
          "transition-all duration-100 hover:bg-destructive/20 hover:text-destructive",
          "focus:outline-none focus:ring-1 focus:ring-destructive/50",
          isHovered || isActive ? "opacity-100" : "opacity-0",
        )}
        title={`Close ${tab.title}`}
        tabIndex={-1}
      >
        <X className="w-3 h-3" />
      </button>
    </Reorder.Item>
  );
};

interface TabManagerProps {
  className?: string;
}

export const TabManager: React.FC<TabManagerProps> = ({ className }) => {
  const { tabs, activeTabId, createSessionTab, closeTab, switchToTab } =
    useTabState();

  // Access panel methods and reorderTabs from context
  const {
    reorderTabs,
    getPanelCounts,
    getTabsForPanel,
    addPanel,
    closePanel,
    canAddPanel,
    setActiveTabForPanel,
    getActiveTabForPanel,
    getPanelIndexForTab,
    getActivePanelIndex,
  } = useTabContext();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

  // State for unsaved changes dialog
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(
    null,
  );
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Analytics tracking
  const trackEvent = useTrackEvent();

  // Panel-aware tab click handler
  const handleTabClick = (tabId: string) => {
    const panelIndex = getPanelIndexForTab(tabId);
    setActiveTabForPanel(panelIndex, tabId);
  };

  // Listen for tab switch events
  useEffect(() => {
    const handleSwitchToTab = (event: CustomEvent) => {
      const { tabId } = event.detail;
      handleTabClick(tabId);
    };

    window.addEventListener(
      "switch-to-tab",
      handleSwitchToTab as EventListener,
    );
    return () => {
      window.removeEventListener(
        "switch-to-tab",
        handleSwitchToTab as EventListener,
      );
    };
  }, [handleTabClick]);

  // Listen for keyboard shortcut events
  useEffect(() => {
    const handleCreateTab = () => {
      createSessionTab();
      trackEvent.tabCreated("session");
    };

    const handleCloseTab = async () => {
      if (activeTabId) {
        const tab = tabs.find((t) => t.id === activeTabId);
        if (tab) {
          trackEvent.tabClosed(tab.type);
        }
        await closeTab(activeTabId);
      }
    };

    const handleNextTab = () => {
      const currentIndex = tabs.findIndex((tab) => tab.id === activeTabId);
      const nextIndex = (currentIndex + 1) % tabs.length;
      if (tabs[nextIndex]) {
        handleTabClick(tabs[nextIndex].id);
      }
    };

    const handlePreviousTab = () => {
      const currentIndex = tabs.findIndex((tab) => tab.id === activeTabId);
      const previousIndex =
        currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
      if (tabs[previousIndex]) {
        handleTabClick(tabs[previousIndex].id);
      }
    };

    const handleTabByIndex = (event: CustomEvent) => {
      const { index } = event.detail;
      if (tabs[index]) {
        handleTabClick(tabs[index].id);
      }
    };

    window.addEventListener("create-chat-tab", handleCreateTab);
    window.addEventListener("close-current-tab", handleCloseTab);
    window.addEventListener("switch-to-next-tab", handleNextTab);
    window.addEventListener("switch-to-previous-tab", handlePreviousTab);
    window.addEventListener(
      "switch-to-tab-by-index",
      handleTabByIndex as EventListener,
    );

    return () => {
      window.removeEventListener("create-chat-tab", handleCreateTab);
      window.removeEventListener("close-current-tab", handleCloseTab);
      window.removeEventListener("switch-to-next-tab", handleNextTab);
      window.removeEventListener("switch-to-previous-tab", handlePreviousTab);
      window.removeEventListener(
        "switch-to-tab-by-index",
        handleTabByIndex as EventListener,
      );
    };
  }, [tabs, activeTabId, createSessionTab, closeTab, handleTabClick]);

  // Check scroll buttons visibility
  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowLeftScroll(scrollLeft > 0);
    setShowRightScroll(scrollLeft + clientWidth < scrollWidth - 1);
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", checkScrollButtons);
    window.addEventListener("resize", checkScrollButtons);

    return () => {
      container.removeEventListener("scroll", checkScrollButtons);
      window.removeEventListener("resize", checkScrollButtons);
    };
  }, [tabs]);

  const handleReorder = (newOrder: Tab[]) => {
    // Find the positions that changed
    const oldOrder = tabs.map((tab) => tab.id);
    const newOrderIds = newOrder.map((tab) => tab.id);

    // Find what moved
    const movedTabId = newOrderIds.find((id, index) => oldOrder[index] !== id);
    if (!movedTabId) return;

    const oldIndex = oldOrder.indexOf(movedTabId);
    const newIndex = newOrderIds.indexOf(movedTabId);

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      // Use the context's reorderTabs function
      reorderTabs(oldIndex, newIndex);
      // Track the reorder event
      trackEvent.featureUsed?.("tab_reorder", "drag_drop", {
        from_index: oldIndex,
        to_index: newIndex,
      });
    }
  };

  const handleCloseTab = async (id: string) => {
    const tab = tabs.find((t) => t.id === id);
    if (tab) {
      // Check if the tab has unsaved changes
      if (tab.hasUnsavedChanges) {
        setPendingCloseTabId(id);
        setShowUnsavedDialog(true);
        return;
      }

      trackEvent.tabClosed(tab.type);
    }
    await closeTab(id);
  };

  const handleConfirmCloseTab = async () => {
    if (pendingCloseTabId) {
      const tab = tabs.find((t) => t.id === pendingCloseTabId);
      if (tab) {
        trackEvent.tabClosed(tab.type);
      }
      await closeTab(pendingCloseTabId, true); // Force close
      setPendingCloseTabId(null);
      setShowUnsavedDialog(false);
    }
  };

  const handleCancelCloseTab = () => {
    setPendingCloseTabId(null);
    setShowUnsavedDialog(false);
  };

  const scrollTabs = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    const newScrollLeft =
      direction === "left"
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount;

    container.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });
  };

  return (
    <>
      <div
        className={cn(
          "flex items-stretch bg-muted/15 border-b relative",
          className,
        )}
      >
        <DebugLabel label="TabManager" />
        {/* Left fade gradient */}
        {showLeftScroll && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-muted/15 to-transparent pointer-events-none z-10" />
        )}

        {/* Left scroll button */}
        <AnimatePresence>
          {showLeftScroll && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="z-20 ml-1"
            >
              <button
                onClick={() => scrollTabs("left")}
                className={cn(
                  "p-1.5 hover:bg-muted/80 rounded-sm",
                  "transition-colors duration-200 flex items-center justify-center",
                  "bg-background/80 backdrop-blur-sm shadow-sm border border-border/50",
                )}
                title="Scroll tabs left"
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    d="M15 18l-6-6 6-6"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Single reorder group for cross-panel dragging */}
        <Reorder.Group
          ref={scrollContainerRef}
          axis="x" 
          values={tabs}
          onReorder={handleReorder}
          className={cn(
            "flex-1 h-8 flex overflow-x-auto scrollbar-hide",
            // Full width background for single panel
            getPanelCounts().length === 1 && "bg-card"
          )}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {/* Render visual sections with proper width distribution */}
          {Array.from({ length: getPanelCounts().length }).map((_, panelIndex) => {
            const panelTabs = getTabsForPanel(panelIndex);
            const isActivePanel = getActivePanelIndex() === panelIndex;
            
            return (
              <React.Fragment key={`panel-${panelIndex}`}>
                {/* Panel section with correct width */}
                <div
                  className={cn(
                    "relative h-8 flex overflow-hidden",
                    // Width distribution for equal panels
                    getPanelCounts().length === 1 && "flex-1",
                    getPanelCounts().length === 2 && "w-1/2",
                    getPanelCounts().length === 3 && "w-1/3",
                    // Active panel background
                    (getPanelCounts().length === 1 || isActivePanel) && "bg-card"
                  )}
                >
                  {/* Reorder group for within-section dragging only */}
                  <Reorder.Group
                    axis="x"
                    values={panelTabs}
                    onReorder={(newOrder) => {
                      // Handle reordering within this panel only
                      if (newOrder.length !== panelTabs.length) return;
                      
                      const movedTab = newOrder.find((tab, index) => panelTabs[index]?.id !== tab.id);
                      if (!movedTab) return;
                      
                      const oldLocalIndex = panelTabs.findIndex(t => t.id === movedTab.id);
                      const newLocalIndex = newOrder.findIndex(t => t.id === movedTab.id);
                      
                      if (oldLocalIndex === newLocalIndex) return;
                      
                      // Convert to global indices
                      const globalStartIndex = tabs.findIndex(t => getPanelIndexForTab(t.id) === panelIndex);
                      const oldGlobalIndex = globalStartIndex + oldLocalIndex;
                      const newGlobalIndex = globalStartIndex + newLocalIndex;
                      
                      reorderTabs(oldGlobalIndex, newGlobalIndex);
                    }}
                    className={cn(
                      "flex h-full",
                      panelTabs.length > 0 ? "flex-1" : "w-0"
                    )}
                    onClick={(e: React.MouseEvent) => {
                      // Handle panel activation when clicking empty space in Reorder.Group
                      if (e.target === e.currentTarget && panelTabs.length > 0) {
                        const currentActiveTab = getActiveTabForPanel(panelIndex) || panelTabs[0].id;
                        setActiveTabForPanel(panelIndex, currentActiveTab);
                      }
                    }}
                  >
                    {panelTabs.map((tab) => (
                      <TabItem
                        key={tab.id}
                        tab={tab}
                        isActive={tab.id === activeTabId}
                        onClose={handleCloseTab}
                        onClick={handleTabClick}
                        isDragging={draggedTabId === tab.id}
                        setDraggedTabId={setDraggedTabId}
                      />
                    ))}
                  </Reorder.Group>
                  
                  {/* Spacer for empty panels - acts like an invisible tab */}
                  {panelTabs.length === 0 && (
                    <div 
                      className="flex-1 h-full cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => setActiveTabForPanel(panelIndex, '')}
                      title="Click to activate this panel"
                    ></div>
                  )}
                  
                  {/* Panel controls - only in the last panel */}
                  {panelIndex === getPanelCounts().length - 1 && (
                    <div className="flex items-center ml-auto">
                      {/* Close panel button - always visible */}
                      <button
                        onClick={() => closePanel(getPanelCounts().length - 1, true)}
                        disabled={getPanelCounts().length <= 1}
                        className={cn(
                          "w-5 h-5 flex items-center justify-center rounded-sm mr-1",
                          "transition-all duration-100 hover:bg-destructive/20 hover:text-destructive",
                          "focus:outline-none focus:ring-1 focus:ring-destructive/50",
                          getPanelCounts().length > 1
                            ? "opacity-60 hover:opacity-100 cursor-pointer"
                            : "opacity-30 cursor-not-allowed",
                        )}
                        title={
                          getPanelCounts().length > 1
                            ? `Close panel ${getPanelCounts().length}`
                            : "Cannot close the last panel"
                        }
                      >
                        <X className="w-3 h-3" />
                      </button>

                      {/* Add panel button - always visible */}
                      <button
                        onClick={addPanel}
                        disabled={!canAddPanel()}
                        className={cn(
                          "w-5 h-5 flex items-center justify-center rounded-sm mr-4",
                          "transition-all duration-100 hover:bg-accent hover:text-accent-foreground",
                          "focus:outline-none focus:ring-1 focus:ring-primary/50",
                          canAddPanel()
                            ? "opacity-60 hover:opacity-100 cursor-pointer"
                            : "opacity-30 cursor-not-allowed",
                        )}
                        title={
                          canAddPanel()
                            ? "Split panel"
                            : "Window too narrow to add another panel"
                        }
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </Reorder.Group>

        {/* Right fade gradient */}
        {showRightScroll && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-muted/15 to-transparent pointer-events-none z-10" />
        )}

        {/* Right scroll button */}
        <AnimatePresence>
          {showRightScroll && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="z-20 mr-1"
            >
              <button
                onClick={() => scrollTabs("right")}
                className={cn(
                  "p-1.5 hover:bg-muted/80 rounded-sm",
                  "transition-colors duration-200 flex items-center justify-center",
                  "bg-background/80 backdrop-blur-sm shadow-sm border border-border/50",
                )}
                title="Scroll tabs right"
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    d="M9 18l6-6-6-6"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Unsaved Changes Dialog */}
      <ConfirmationDialog
        isOpen={showUnsavedDialog}
        title="Unsaved Changes"
        description={`Tab "${tabs.find((t) => t.id === pendingCloseTabId)?.title || ""}" has unsaved changes. Close anyway?`}
        confirmText="Close Tab"
        cancelText="Keep Open"
        onConfirm={handleConfirmCloseTab}
        onCancel={handleCancelCloseTab}
        variant="destructive"
      />
    </>
  );
};

export default TabManager;
