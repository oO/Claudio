import { useState, useEffect } from "react";
import { api, type ClaudeInstallation } from "@/lib/api";

export interface ClaudeBinaryState {
  currentBinaryPath: string | null;
  selectedInstallation: ClaudeInstallation | null;
  binaryPathChanged: boolean;
  loading: boolean;
  error: string | null;
}

export interface ClaudeBinaryActions {
  loadClaudeBinaryPath: () => Promise<void>;
  handleClaudeInstallationSelect: (installation: ClaudeInstallation) => void;
  saveBinaryPath: () => Promise<void>;
  resetBinaryPath: () => void;
}

/**
 * Custom hook for managing Claude binary configuration
 */
export const useClaudeBinaryConfig = (
  onPathChanged?: (changed: boolean) => void
): ClaudeBinaryState & ClaudeBinaryActions => {
  const [currentBinaryPath, setCurrentBinaryPath] = useState<string | null>(null);
  const [selectedInstallation, setSelectedInstallation] = useState<ClaudeInstallation | null>(null);
  const [binaryPathChanged, setBinaryPathChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Loads the current Claude binary path
   */
  const loadClaudeBinaryPath = async () => {
    try {
      setLoading(true);
      setError(null);
      const path = await api.getClaudeBinaryPath();
      setCurrentBinaryPath(path);
    } catch (err) {
      console.error("Failed to load Claude binary path:", err);
      setError("Failed to load Claude binary path");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Claude installation selection
   */
  const handleClaudeInstallationSelect = (installation: ClaudeInstallation) => {
    setSelectedInstallation(installation);
    const changed = installation.path !== currentBinaryPath;
    setBinaryPathChanged(changed);
    onPathChanged?.(changed);
  };

  /**
   * Save the selected binary path
   */
  const saveBinaryPath = async () => {
    if (!selectedInstallation || !binaryPathChanged) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.setClaudeBinaryPath(selectedInstallation.path);
      setCurrentBinaryPath(selectedInstallation.path);
      setBinaryPathChanged(false);
      onPathChanged?.(false);
    } catch (err) {
      console.error("Failed to save Claude binary path:", err);
      setError("Failed to save Claude binary path");
      throw err; // Re-throw so parent can handle
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset binary path changes
   */
  const resetBinaryPath = () => {
    if (currentBinaryPath) {
      // Find the installation that matches current path
      // This is a bit hacky but we need to reset the selection
      const mockInstallation: ClaudeInstallation = {
        path: currentBinaryPath,
        version: "current",
        source: "current",
        installation_type: "System"
      };
      setSelectedInstallation(mockInstallation);
    }
    setBinaryPathChanged(false);
    onPathChanged?.(false);
  };

  // Load binary path on mount
  useEffect(() => {
    loadClaudeBinaryPath();
  }, []);

  return {
    // State
    currentBinaryPath,
    selectedInstallation,
    binaryPathChanged,
    loading,
    error,
    
    // Actions
    loadClaudeBinaryPath,
    handleClaudeInstallationSelect,
    saveBinaryPath,
    resetBinaryPath,
  };
};