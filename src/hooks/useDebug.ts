import { useState, useEffect } from "react";

/**
 * Hook for debug mode - shows component labels and other debug info
 * Controlled by localStorage flag and can be toggled via console
 */
export const useDebug = () => {
  const [isDebugMode, setIsDebugMode] = useState(false);

  useEffect(() => {
    // Check localStorage for debug flag
    const debugFlag = localStorage.getItem("claudio_debug_mode");
    setIsDebugMode(debugFlag === "true");

    // Add global debug toggle function
    (window as any).toggleDebug = () => {
      const newDebugMode = !isDebugMode;
      setIsDebugMode(newDebugMode);
      localStorage.setItem("claudio_debug_mode", newDebugMode.toString());
      console.log(`Debug mode ${newDebugMode ? "enabled" : "disabled"}`);
    };

    // Log current debug state
    if (debugFlag === "true") {
      console.log("Debug mode is enabled. Use toggleDebug() in console to disable.");
    }
  }, [isDebugMode]);

  return {
    isDebugMode,
    toggleDebug: () => {
      const newDebugMode = !isDebugMode;
      setIsDebugMode(newDebugMode);
      localStorage.setItem("claudio_debug_mode", newDebugMode.toString());
      console.log(`Debug mode ${newDebugMode ? "enabled" : "disabled"}`);
    }
  };
};