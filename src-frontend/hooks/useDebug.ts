import { useState, useEffect } from "react";

/**
 * Hook for debug mode - shows component labels and other debug info
 * Controlled by localStorage flag and global toggleDebug() function in App.tsx
 */
export const useDebug = () => {
  const [isDebugMode, setIsDebugMode] = useState(() => {
    // Initialize from localStorage
    return localStorage.getItem("claudio_debug_mode") === "true";
  });

  useEffect(() => {
    // Listen for debug mode changes from the global toggle
    const handleDebugModeChanged = (event: CustomEvent<boolean>) => {
      setIsDebugMode(event.detail);
    };

    window.addEventListener('debugModeChanged', handleDebugModeChanged as EventListener);
    
    return () => {
      window.removeEventListener('debugModeChanged', handleDebugModeChanged as EventListener);
    };
  }, []);

  return {
    isDebugMode,
    toggleDebug: () => {
      // Use the global toggle function if available
      if ((window as any).toggleDebug) {
        (window as any).toggleDebug();
      } else {
        // Fallback for direct component usage
        const newDebugMode = !isDebugMode;
        localStorage.setItem("claudio_debug_mode", newDebugMode.toString());
        setIsDebugMode(newDebugMode);
        window.dispatchEvent(new CustomEvent('debugModeChanged', { detail: newDebugMode }));
      }
    }
  };
};