import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { invoke } from '@tauri-apps/api/core';
import { logger } from "@/lib/logger";

/**
 * Hook for managing Claude Code settings handle via orchestrator
 * KISS: Only Claude Code settings use orchestrator, Claudio uses direct API
 */
export const useSettingsHandle = (
  projectPath: string | undefined
) => {
  // Simple state - just what we need for the UI
  const [settingsHandle, setSettingsHandle] = useState<string | null>(null);
  const [settings, setSettings] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Refs for cleanup
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use useMemo to create stable settings key to prevent unnecessary re-initializations
  const settingsKey = useMemo(() => {
    return `${projectPath || 'global'}-claudecode`;
  }, [projectPath]);

  // Settings initialization effect - COPY THE WORKING SESSION PATTERN
  useEffect(() => {
    // Skip re-initialization if we already have a settings handle
    if (settingsHandle) {
      return;
    }

    const initializeHandle = async () => {
      try {
        setError(null);
        setLoading(true);

        logger.debug('Creating Claude Code settings handle for:', { projectPath });

        // Get settings handle from Claude Code orchestrator
        const handleId = await invoke<string>('create_settings_handle', {
          projectPath: projectPath || null,
        });

        logger.debug('Created unified settings handle:', handleId);

        // Get initial settings
        const initialSettings = await invoke<any>('get_settings_for_handle', {
          handleId: handleId,
        });

        logger.debug('Loaded settings from unified orchestrator:', initialSettings);

        // Batch state updates to prevent multiple re-renders
        setSettingsHandle(handleId);
        setSettings(initialSettings);
        setLoading(false);

      } catch (err) {
        logger.error("❌ Failed to initialize settings handle:", err);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    };

    initializeHandle();

    // Cleanup timeout on unmount or dependency change
    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, [settingsKey, projectPath]);

  // Update settings function
  const updateSetting = useCallback(async (key: string, value: any, level?: 'env' | 'local' | 'project' | 'global') => {
    if (!settingsHandle) {
      throw new Error('No settings handle available');
    }

    try {
      await invoke('update_setting_for_handle', {
        handleId: settingsHandle,
        key,
        value,
        level, // Optional level for ClaudeCode settings precedence
      });

      // Refresh settings after update
      const updatedSettings = await invoke('get_settings_for_handle', {
        handleId: settingsHandle,
      });

      setSettings(updatedSettings);
    } catch (err) {
      logger.error('Failed to update setting:', err);
      throw err;
    }
  }, [settingsHandle]);

  return {
    settings,
    loading,
    error,
    handleId: settingsHandle,
    updateSetting,
  };
};

/**
 * Hook specifically for ClaudeCode model setting
 */
export function useModelSetting(projectPath?: string) {
  const { settings, updateSetting, loading, error } = useSettingsHandle(projectPath);

  const currentModel = useMemo(() => {
    const model = settings?.effective?.model || 'default';
    logger.debug('🔍 useModelSetting computed model:', {
      projectPath,
      rawSettings: settings,
      effectiveModel: settings?.effective?.model,
      finalModel: model,
      loading,
      error
    });
    return model;
  }, [settings, projectPath, loading, error]);

  const setModel = useCallback(async (model: string, level?: 'env' | 'local' | 'project' | 'global') => {
    await updateSetting('model', model, level);
  }, [updateSetting]);

  return {
    model: currentModel,
    setModel,
    loading,
    error,
    allSettings: settings,
  };
}