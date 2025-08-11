import { useCallback, useEffect, useState } from 'react';
import { useTabState } from './useTabState';
import type { NavigationState } from '@/contexts/NavigationContext';

/**
 * Hook for managing navigation stack within a tab
 * Provides a simple interface for hierarchical navigation
 */
export function useNavigationStack(tabId: string) {
  const { updateTab, getTabById } = useTabState();
  const [isNavigating, setIsNavigating] = useState(false);

  // Get current navigation stack
  const getNavigationStack = useCallback(() => {
    const tab = getTabById(tabId);
    return tab?.navigationStack || { stack: [], currentIndex: -1 };
  }, [tabId, getTabById]);

  // Push new navigation state
  const pushNavigation = useCallback((state: Omit<NavigationState, 'timestamp'>) => {
    const currentStack = getNavigationStack();
    const newState: NavigationState = {
      ...state,
      timestamp: Date.now(),
    };
    
    // Remove any forward history if we're not at the top
    const newStack = currentStack.stack.slice(0, currentStack.currentIndex + 1);
    newStack.push(newState);
    
    updateTab(tabId, {
      navigationStack: {
        stack: newStack,
        currentIndex: newStack.length - 1,
      },
    });
  }, [getNavigationStack, updateTab, tabId]);

  // Go back in navigation stack
  const goBack = useCallback((): boolean => {
    const currentStack = getNavigationStack();
    
    if (currentStack.currentIndex > 0) {
      setIsNavigating(true);
      const newIndex = currentStack.currentIndex - 1;
      const previousState = currentStack.stack[newIndex];
      
      // Update navigation stack first
      updateTab(tabId, {
        navigationStack: {
          ...currentStack,
          currentIndex: newIndex,
        },
        // Update tab to previous state
        type: previousState.tabType as any,
        title: previousState.title,
        ...previousState.tabData,
      });
      
      // Dispatch event for components to handle state restoration
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('navigation-restored', {
            detail: {
              tabId,
              navigationState: previousState,
            },
          })
        );
        setIsNavigating(false);
      }, 0);
      
      return true;
    }
    
    return false;
  }, [getNavigationStack, updateTab, tabId]);

  // Check if can go back
  const canGoBack = useCallback((): boolean => {
    const currentStack = getNavigationStack();
    return currentStack.currentIndex > 0;
  }, [getNavigationStack]);

  // Get current navigation state
  const getCurrentState = useCallback((): NavigationState | null => {
    const currentStack = getNavigationStack();
    return currentStack.currentIndex >= 0 
      ? currentStack.stack[currentStack.currentIndex] 
      : null;
  }, [getNavigationStack]);

  // Replace current navigation state (for updating sub-state)
  const updateCurrentState = useCallback((updates: Partial<NavigationState>) => {
    const currentStack = getNavigationStack();
    
    if (currentStack.currentIndex >= 0) {
      const updatedStack = [...currentStack.stack];
      updatedStack[currentStack.currentIndex] = {
        ...updatedStack[currentStack.currentIndex],
        ...updates,
        timestamp: Date.now(),
      };
      
      updateTab(tabId, {
        navigationStack: {
          ...currentStack,
          stack: updatedStack,
        },
      });
    }
  }, [getNavigationStack, updateTab, tabId]);

  // Initialize navigation stack with current state if empty
  const initializeIfEmpty = useCallback((initialState: Omit<NavigationState, 'timestamp'>) => {
    const currentStack = getNavigationStack();
    
    if (currentStack.stack.length === 0) {
      pushNavigation(initialState);
    }
  }, [getNavigationStack, pushNavigation]);

  // Listen for navigation restored events
  useEffect(() => {
    const handleNavigationRestored = (event: CustomEvent) => {
      const { tabId: eventTabId } = event.detail;
      if (eventTabId === tabId) {
        // Handle any additional restoration logic here if needed
      }
    };

    window.addEventListener('navigation-restored', handleNavigationRestored as EventListener);
    return () => {
      window.removeEventListener('navigation-restored', handleNavigationRestored as EventListener);
    };
  }, [tabId]);

  return {
    // Core navigation operations
    pushNavigation,
    goBack,
    canGoBack,
    
    // State management
    getCurrentState,
    updateCurrentState,
    initializeIfEmpty,
    
    // Status
    isNavigating,
    stackDepth: getNavigationStack().stack.length,
  };
}