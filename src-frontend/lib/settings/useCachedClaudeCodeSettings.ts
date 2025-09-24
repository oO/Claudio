/**
 * Hooks for cached Claude Code settings that survive component remounts
 * Claudio app settings use direct API via useClaudioAppSettings
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getCachedSettings, updateCachedSetting } from './claude_code_cache';
import { logger } from '@/lib/logger';
import type { SettingsType } from './types';
import { SettingsError } from './types';

interface UseCachedSettingsResult {
  settings: any;
  loading: boolean;
  error: SettingsError | null;
  updateSetting: (key: string, value: any) => Promise<void>;
  refresh: () => Promise<void>;
}

type UseCachedSettingsState = Pick<UseCachedSettingsResult, 'settings' | 'loading' | 'error'>;

/**
 * Hook that uses cached Claude Code settings to survive HMR and component remounts
 */
export function useCachedClaudeCodeSettings(
  projectPath?: string | null,
): UseCachedSettingsResult {
  const [state, setState] = useState<UseCachedSettingsState>({
    settings: null,
    loading: true,
    error: null
  });

  const cacheKey = `${projectPath || 'global'}-claudecode`;

  const updateSetting = useCallback(async (key: string, value: any) => {
    try {
      await updateCachedSetting(projectPath || null, key, value);
      logger.debug('✅ Setting updated via cache', { projectPath, key, value });
    } catch (error) {
      const settingsError = error instanceof SettingsError ? error : new SettingsError(String(error));
      setState(prev => ({ ...prev, error: settingsError }));
      throw settingsError;
    }
  }, [projectPath]);

  const refresh = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const freshSettings = await getCachedSettings(projectPath || null);
      setState({
        settings: freshSettings,
        loading: false,
        error: null
      });
    } catch (error) {
      const settingsError = error instanceof SettingsError ? error : new SettingsError(String(error));
      setState({
        settings: null,
        loading: false,
        error: settingsError
      });
    }
  }, [projectPath]);

  // Load initial settings
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const initialSettings = await getCachedSettings(projectPath || null);

        if (!cancelled) {
          setState({
            settings: initialSettings,
            loading: false,
            error: null
          });
        }
      } catch (error) {
        if (!cancelled) {
          const settingsError = error instanceof SettingsError ? error : new SettingsError(String(error));
          setState({
            settings: null,
            loading: false,
            error: settingsError
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  return {
    settings: state.settings,
    loading: state.loading,
    error: state.error,
    updateSetting,
    refresh,
  };
}

// Removed redundant useCachedClaudeCodeModelSetting hook - just use useCachedClaudeCodeSettings and extract model

/**
 * Hook for general Claude Code CLI settings
 */
export function useCachedClaudeCodeConfig(projectPath?: string) {
  const { settings, loading, error, updateSetting } = useCachedClaudeCodeSettings(projectPath);

  const claudeCodeConfig = useMemo(() => {
    if (!settings) return {};

    // Extract Claude Code specific settings
    return {
      model: (settings as any).model || 'default',
      permissions: (settings as any).permissions || {},
      hooks: (settings as any).hooks || {},
      system_prompt: (settings as any).system_prompt || '',
      ...(settings.effective || {})
    };
  }, [settings]);

  const updateClaudeCodeSetting = useCallback(async (key: string, value: any) => {
    try {
      await updateSetting(key, value);
    } catch (error) {
      logger.error('Failed to update Claude Code setting:', error);
      throw error;
    }
  }, [updateSetting]);

  return {
    claudeCodeConfig,
    loading,
    error,
    updateClaudeCodeSetting
  };
}