import { useState, useEffect } from "react";
import * as api from "@/lib/api";
import { logger } from "@/lib/logger";

/**
 * Hook for debug mode - shows component labels and other debug info
 * Now uses ClaudioAppSettings instead of localStorage
 */
export const useDebug = () => {
  const [isDebugMode, setIsDebugMode] = useState(false);

  useEffect(() => {
    // Load initial debug mode from settings
    const loadDebugMode = async () => {
      try {
        const saved = await api.loadClaudioAppSetting("debugMode");
        const isDebug = saved === "true";
        setIsDebugMode(isDebug);
      } catch (error) {
        logger.warn("Failed to load debug mode, defaulting to false:", error);
        setIsDebugMode(false);
      }
    };

    loadDebugMode();

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
        api.saveClaudioAppSetting("debugMode", newDebugMode.toString())
          .then(() => {
            setIsDebugMode(newDebugMode);
            window.dispatchEvent(new CustomEvent('debugModeChanged', { detail: newDebugMode }));
            logger.log(`Debug mode ${newDebugMode ? "enabled" : "disabled"}`);
          })
          .catch((error) => {
            logger.error("Failed to save debug mode:", error);
          });
      }
    }
  };
};