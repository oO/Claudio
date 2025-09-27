import React, { createContext, useContext, useCallback } from 'react';
import { useTabState } from '@/hooks/useTabState';

export interface NavigationState {
  // Core view information
  tabType: string;
  title: string;
  tabData?: any;
  
  // Sub-navigation state for complex tabs (like ProjectDetail)
  subState?: {
    activeTab?: string;           // Current sub-tab ("sessions", "agents", "memories", etc.)
    selectedProject?: any;        // Selected project data
    sessions?: any[];             // Project sessions
    agents?: any[];               // Project agents  
    memories?: any[];             // Project memories
    scrollPosition?: number;      // Preserve scroll position
    searchQuery?: string;         // Preserve search/filter state
    pagination?: {               // Preserve pagination state
      page: number;
      itemsPerPage: number;
    };
    [key: string]: any;          // Allow for future extension
  };
  
  // Metadata
  timestamp: number;
}

export interface NavigationStack {
  stack: NavigationState[];
  currentIndex: number;
}

interface NavigationContextType {
  // Core navigation operations
  push: (state: Omit<NavigationState, 'timestamp'>) => void;
  goBack: () => boolean;
  goForward: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  
  // Stack inspection
  getCurrentState: () => NavigationState | null;
  getStackDepth: () => number;
  
  // Utilities
  replaceCurrentState: (state: Partial<NavigationState>) => void;
  clearStack: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

interface NavigationProviderProps {
  children: React.ReactNode;
  tabId: string;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({
  children,
  tabId,
}) => {
  const { updateTab, getTabById } = useTabState();
  
  const getNavigationStack = useCallback((): NavigationStack => {
    const tab = getTabById(tabId);
    return tab?.navigationStack || { stack: [], currentIndex: -1 };
  }, [tabId, getTabById]);

  const updateNavigationStack = useCallback((stack: NavigationStack) => {
    updateTab(tabId, { navigationStack: stack });
  }, [tabId, updateTab]);

  const push = useCallback((state: Omit<NavigationState, 'timestamp'>) => {
    const currentStack = getNavigationStack();
    const newState: NavigationState = {
      ...state,
      timestamp: Date.now(),
    };
    
    // If we're not at the top of the stack, remove forward history
    const newStack = currentStack.stack.slice(0, currentStack.currentIndex + 1);
    newStack.push(newState);
    
    updateNavigationStack({
      stack: newStack,
      currentIndex: newStack.length - 1,
    });
  }, [getNavigationStack, updateNavigationStack]);

  const goBack = useCallback((): boolean => {
    const currentStack = getNavigationStack();
    
    if (currentStack.currentIndex > 0) {
      const newIndex = currentStack.currentIndex - 1;
      const previousState = currentStack.stack[newIndex];
      
      // Update the navigation stack index
      updateNavigationStack({
        ...currentStack,
        currentIndex: newIndex,
      });
      
      // Update the tab to the previous state
      updateTab(tabId, {
        type: previousState.tabType as any,
        title: previousState.title,
        ...previousState.tabData,
      });
      
      // Dispatch event to notify components of navigation change
      window.dispatchEvent(
        new CustomEvent('navigation-restored', {
          detail: {
            tabId,
            navigationState: previousState,
          },
        })
      );
      
      return true;
    }
    
    return false;
  }, [getNavigationStack, updateNavigationStack, updateTab, tabId]);

  const goForward = useCallback(() => {
    const currentStack = getNavigationStack();
    
    if (currentStack.currentIndex < currentStack.stack.length - 1) {
      const newIndex = currentStack.currentIndex + 1;
      const nextState = currentStack.stack[newIndex];
      
      updateNavigationStack({
        ...currentStack,
        currentIndex: newIndex,
      });
      
      updateTab(tabId, {
        type: nextState.tabType as any,
        title: nextState.title,
        ...nextState.tabData,
      });
      
      window.dispatchEvent(
        new CustomEvent('navigation-restored', {
          detail: {
            tabId,
            navigationState: nextState,
          },
        })
      );
    }
  }, [getNavigationStack, updateNavigationStack, updateTab, tabId]);

  const canGoBack = useCallback((): boolean => {
    const currentStack = getNavigationStack();
    return currentStack.currentIndex > 0;
  }, [getNavigationStack]);

  const canGoForward = useCallback((): boolean => {
    const currentStack = getNavigationStack();
    return currentStack.currentIndex < currentStack.stack.length - 1;
  }, [getNavigationStack]);

  const getCurrentState = useCallback((): NavigationState | null => {
    const currentStack = getNavigationStack();
    return currentStack.currentIndex >= 0 
      ? currentStack.stack[currentStack.currentIndex] 
      : null;
  }, [getNavigationStack]);

  const getStackDepth = useCallback((): number => {
    const currentStack = getNavigationStack();
    return currentStack.stack.length;
  }, [getNavigationStack]);

  const replaceCurrentState = useCallback((state: Partial<NavigationState>) => {
    const currentStack = getNavigationStack();
    
    if (currentStack.currentIndex >= 0) {
      const updatedStack = [...currentStack.stack];
      updatedStack[currentStack.currentIndex] = {
        ...updatedStack[currentStack.currentIndex],
        ...state,
        timestamp: Date.now(),
      };
      
      updateNavigationStack({
        ...currentStack,
        stack: updatedStack,
      });
    }
  }, [getNavigationStack, updateNavigationStack]);

  const clearStack = useCallback(() => {
    updateNavigationStack({
      stack: [],
      currentIndex: -1,
    });
  }, [updateNavigationStack]);

  const value: NavigationContextType = {
    push,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    getCurrentState,
    getStackDepth,
    replaceCurrentState,
    clearStack,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};