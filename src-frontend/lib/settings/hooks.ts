/**
 * React hooks for the new settings system
 *
 * These hooks provide reactive, type-safe access to settings with automatic
 * handle management and cleanup
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { logger } from '@/lib/logger';
import type {
  SettingsType,
  ClaudioSettings,
  ClaudeCodeSettings,
  UseSettingsOptions,
  UseSettingsReturn,
  SettingsUpdateEvent,
  ProjectContext,
} from './types';
import { SettingsError } from './types';
import {
  createSettingsHandle,
  destroySettingsHandle,
  getSettingsForHandle,
  updateSettingForHandle,
  getClaudioSettings,
  getClaudeCodeSettings,
  getOrCreateProjectHandle,
  safeDestroyHandle,
  getProjectContext,
  toSettingsError,
} from './api';

// ===== Core Settings Hook =====

/**
 * Core hook for managing settings with handle lifecycle
 */
export function useSettings<T = any>(options: UseSettingsOptions): UseSettingsReturn<T> {
  const { projectPath, settingsType, autoCreate = true, onUpdate } = options;

  const [settings, setSettings] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SettingsError | null>(null);
  const [handleId, setHandleId] = useState<string | null>(null);

  const handleRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Create handle on mount
  useEffect(() => {
    if (!autoCreate) {
      logger.debug('⏸️ autoCreate is false, skipping handle creation');
      return;
    }

    let cancelled = false;

    async function initializeHandle() {
      try {
        setLoading(true);
        setError(null);

        const newHandleId = await createSettingsHandle(projectPath || null, settingsType);
        logger.debug('✅ Settings handle created successfully', { newHandleId, projectPath, settingsType });

        if (cancelled || !mountedRef.current) {
          // Component unmounted, clean up
          logger.debug('🗑️ Component unmounted during handle creation, cleaning up', { newHandleId });
          await safeDestroyHandle(newHandleId);
          return;
        }

        setHandleId(newHandleId);
        handleRef.current = newHandleId;
        logger.debug('📌 Handle ID set in state', { newHandleId });

        // Load initial settings
        logger.debug('🔄 About to load initial settings', { newHandleId });
        const initialSettings = await getSettingsForHandle(newHandleId);
        logger.debug('✅ Initial settings loaded successfully', { newHandleId, settingsKeys: Object.keys(initialSettings || {}) });
        if (!cancelled && mountedRef.current) {
          setSettings(initialSettings);
        }
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          setError(toSettingsError(err, 'Failed to initialize settings handle'));
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    }

    initializeHandle();

    return () => {
      cancelled = true;
    };
  }, [projectPath, settingsType, autoCreate]);

  // Cleanup handle on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (handleRef.current) {
        safeDestroyHandle(handleRef.current);
      }
    };
  }, []);

  // Update setting function
  const updateSetting = useCallback(async (key: string, value: any) => {
    if (!handleId) {
      throw new SettingsError('No settings handle available');
    }

    try {
      await updateSettingForHandle(handleId, key, value);

      // Refresh settings after update
      const updatedSettings = await getSettingsForHandle(handleId);
      if (mountedRef.current) {
        setSettings(updatedSettings);
        onUpdate?.({
          handle_id: handleId,
          settings_type: settingsType,
          changed_keys: [key],
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      const settingsError = toSettingsError(err, `Failed to update setting '${key}'`);
      setError(settingsError);
      throw settingsError;
    }
  }, [handleId, settingsType, onUpdate]);

  // Refresh settings function
  const refresh = useCallback(async () => {
    if (!handleId) return;

    try {
      setLoading(true);
      setError(null);
      const refreshedSettings = await getSettingsForHandle(handleId);
      if (mountedRef.current) {
        setSettings(refreshedSettings);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(toSettingsError(err, 'Failed to refresh settings'));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [handleId]);

  const result = {
    settings,
    loading,
    error,
    handleId,
    updateSetting,
    refresh,
  };


  return result;
}

// ===== Type-Safe Settings Hooks =====

/**
 * Hook for Claudio app settings
 */
export function useClaudioSettings(
  projectPath?: string,
  options: Omit<UseSettingsOptions, 'settingsType'> = {}
): UseSettingsReturn<ClaudioSettings> {
  return useSettings<ClaudioSettings>({
    ...options,
    projectPath,
    settingsType: 'claudio',
  });
}

/**
 * Hook for ClaudeCode CLI settings
 */
export function useClaudeCodeSettings(
  projectPath?: string,
  options: Omit<UseSettingsOptions, 'settingsType'> = {}
): UseSettingsReturn<ClaudeCodeSettings> {

  const result = useSettings<ClaudeCodeSettings>({
    ...options,
    projectPath,
    settingsType: 'claudecode',
  });


  return result;
}

// ===== Specialized Setting Hooks =====

/**
 * Hook specifically for the ClaudeCode model setting
 */
export function useModelSetting(projectPath?: string) {
  const { settings, updateSetting, loading, error } = useClaudeCodeSettings(projectPath);

  const currentModel = useMemo(() => {
    const model = settings?.effective?.model || 'default';
    return model;
  }, [settings, projectPath, loading, error]);

  const setModel = useCallback(async (model: string) => {
    await updateSetting('model', model);
  }, [updateSetting]);

  return {
    model: currentModel,
    setModel,
    loading,
    error,
    // Expose underlying settings for advanced usage
    allSettings: settings,
  };
}

/**
 * Hook specifically for the Claudio theme setting
 */
export function useThemeSetting() {
  const { settings, updateSetting, loading, error } = useClaudioSettings();

  const currentTheme = useMemo(() => {
    return settings?.theme || 'system';
  }, [settings]);

  const setTheme = useCallback(async (theme: string) => {
    await updateSetting('theme', theme);
  }, [updateSetting]);

  return {
    theme: currentTheme,
    setTheme,
    loading,
    error,
    // Expose underlying settings for advanced usage
    allSettings: settings,
  };
}

// ===== Project Context Hook =====

/**
 * Hook for getting project context (cached settings + metadata)
 */
export function useProjectContext(projectPath: string | null) {
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SettingsError | null>(null);

  const refreshContext = useCallback(async () => {
    if (!projectPath) {
      setContext(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const projectContext = await getProjectContext(projectPath);
      setContext(projectContext);
    } catch (err) {
      setError(toSettingsError(err, 'Failed to load project context'));
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    refreshContext();
  }, [refreshContext]);

  return {
    context,
    loading,
    error,
    refresh: refreshContext,
  };
}

// ===== Multi-Project Hook =====

/**
 * Hook for managing settings across multiple projects
 */
export function useMultiProjectSettings(projectPaths: string[]) {
  const [projectSettings, setProjectSettings] = useState<Map<string, {
    claudio: ClaudioSettings | null;
    claudecode: ClaudeCodeSettings | null;
  }>>(new Map());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SettingsError | null>(null);

  const loadProjectSettings = useCallback(async () => {
    if (projectPaths.length === 0) {
      setProjectSettings(new Map());
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const settingsMap = new Map();

      // Load settings for each project in parallel
      const loadPromises = projectPaths.map(async (projectPath) => {
        try {
          // Create temporary handles to get settings
          const claudioHandle = await createSettingsHandle(projectPath, 'claudio');
          const claudecodeHandle = await createSettingsHandle(projectPath, 'claudecode');

          const [claudioSettings, claudecodeSettings] = await Promise.all([
            getClaudioSettings(claudioHandle).catch(() => null),
            getClaudeCodeSettings(claudecodeHandle).catch(() => null),
          ]);

          // Clean up temporary handles
          await Promise.all([
            safeDestroyHandle(claudioHandle),
            safeDestroyHandle(claudecodeHandle),
          ]);

          settingsMap.set(projectPath, {
            claudio: claudioSettings,
            claudecode: claudecodeSettings,
          });
        } catch (err) {
          console.warn(`Failed to load settings for project ${projectPath}:`, err);
          settingsMap.set(projectPath, {
            claudio: null,
            claudecode: null,
          });
        }
      });

      await Promise.all(loadPromises);
      setProjectSettings(settingsMap);
    } catch (err) {
      setError(toSettingsError(err, 'Failed to load multi-project settings'));
    } finally {
      setLoading(false);
    }
  }, [projectPaths]);

  useEffect(() => {
    loadProjectSettings();
  }, [loadProjectSettings]);

  return {
    projectSettings,
    loading,
    error,
    refresh: loadProjectSettings,
  };
}

// ===== Handle Management Hook =====

/**
 * Hook for manual handle management (advanced usage)
 */
export function useSettingsHandle(projectPath?: string, settingsType?: SettingsType) {
  const [handleId, setHandleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SettingsError | null>(null);

  const createHandle = useCallback(async (
    targetProjectPath: string | null = projectPath || null,
    targetSettingsType: SettingsType = settingsType || 'claudio'
  ) => {
    try {
      setLoading(true);
      setError(null);
      const newHandleId = await createSettingsHandle(targetProjectPath, targetSettingsType);
      setHandleId(newHandleId);
      return newHandleId;
    } catch (err) {
      const settingsError = toSettingsError(err, 'Failed to create handle');
      setError(settingsError);
      throw settingsError;
    } finally {
      setLoading(false);
    }
  }, [projectPath, settingsType]);

  const destroyHandle = useCallback(async (targetHandleId: string = handleId!) => {
    if (!targetHandleId) return;

    try {
      await destroySettingsHandle(targetHandleId);
      if (targetHandleId === handleId) {
        setHandleId(null);
      }
    } catch (err) {
      const settingsError = toSettingsError(err, 'Failed to destroy handle');
      setError(settingsError);
      throw settingsError;
    }
  }, [handleId]);

  // Auto cleanup on unmount
  useEffect(() => {
    return () => {
      if (handleId) {
        safeDestroyHandle(handleId);
      }
    };
  }, [handleId]);

  return {
    handleId,
    loading,
    error,
    createHandle,
    destroyHandle,
  };
}

// ===== Utility Hooks =====

/**
 * Hook to debounce setting updates
 */
export function useDebouncedSettings<T>(
  settings: T,
  updateFn: (key: keyof T, value: T[keyof T]) => Promise<void>,
  delay: number = 500
) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const pendingUpdates = useRef<Map<keyof T, T[keyof T]>>(new Map());

  const debouncedUpdate = useCallback((key: keyof T, value: T[keyof T]) => {
    // Store the pending update
    pendingUpdates.current.set(key, value);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(async () => {
      const updates = Array.from(pendingUpdates.current.entries());
      pendingUpdates.current.clear();

      // Apply all pending updates
      try {
        await Promise.all(updates.map(([k, v]) => updateFn(k, v)));
      } catch (error) {
        console.error('Failed to apply debounced updates:', error);
      }
    }, delay);
  }, [updateFn, delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedUpdate;
}