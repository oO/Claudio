// ============================================================================
// CLAUDIO APP SETTINGS - DIRECT API (NO ORCHESTRATOR)
// ============================================================================
// Direct frontend API for Claudio app-only settings
// Bypasses the orchestrator completely for clean separation
// Uses simple get/set operations with optimistic updates
// ============================================================================

import { invoke } from '@tauri-apps/api/core';
import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';

// Claudio app settings interface
export interface ClaudioAppSettings {
  window_state?: {
    width: number;
    height: number;
    x?: number;
    y?: number;
    maximized: boolean;
    fullscreen: boolean;
  };
  tabs_session?: any;
  proxy?: {
    http_proxy?: string;
    https_proxy?: string;
    no_proxy?: string;
    all_proxy?: string;
    enabled: boolean;
  };
  claude_binary_path?: string;
  theme?: string;
  telemetry?: boolean;
  auto_update?: boolean;
  debug_mode?: boolean;
}

/**
 * Direct hook for Claudio app settings - bypasses orchestrator
 * Optimistic updates for instant UI response
 */
export function useClaudioAppSettings() {
  const [settings, setSettings] = useState<ClaudioAppSettings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get all settings at once for efficiency
        const windowState = await invoke<any>('get_claudio_app_setting', { key: 'window_state' });
        const tabsSession = await invoke<any>('get_claudio_app_setting', { key: 'tabs_session' });
        const proxy = await invoke<any>('get_claudio_app_setting', { key: 'proxy' });
        const binaryPath = await invoke<string>('get_claudio_app_setting', { key: 'claude_binary_path' });
        const theme = await invoke<string>('get_claudio_app_setting', { key: 'theme' });
        const telemetry = await invoke<boolean>('get_claudio_app_setting', { key: 'telemetry' });
        const autoUpdate = await invoke<boolean>('get_claudio_app_setting', { key: 'auto_update' });
        const debugMode = await invoke<boolean>('get_claudio_app_setting', { key: 'debug_mode' });

        setSettings({
          window_state: windowState,
          tabs_session: tabsSession,
          proxy: proxy,
          claude_binary_path: binaryPath,
          theme: theme,
          telemetry: telemetry,
          auto_update: autoUpdate,
          debug_mode: debugMode,
        });
      } catch (err) {
        logger.error('Failed to load Claudio app settings:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Update setting with optimistic updates
  const updateSetting = useCallback(async (key: keyof ClaudioAppSettings, value: any) => {
    // Optimistic update - update UI immediately
    const previousValue = settings[key];
    setSettings(prev => ({ ...prev, [key]: value }));

    try {
      // Persist to backend
      await invoke('set_claudio_app_setting', { key, value });
      logger.debug('Updated Claudio app setting:', { key, value });
    } catch (err) {
      // Revert on failure
      setSettings(prev => ({ ...prev, [key]: previousValue }));
      logger.error('Failed to update Claudio app setting:', { key, value, error: err });
      throw err;
    }
  }, [settings]);

  return {
    settings,
    updateSetting,
    loading,
    error,
  };
}

/**
 * Get a single Claudio app setting
 */
export async function getClaudioAppSetting<T = any>(key: string): Promise<T | null> {
  try {
    return await invoke<T>('get_claudio_app_setting', { key });
  } catch (err) {
    logger.error('Failed to get Claudio app setting:', { key, error: err });
    return null;
  }
}

/**
 * Set a single Claudio app setting
 */
export async function setClaudioAppSetting(key: string, value: any): Promise<void> {
  try {
    await invoke('set_claudio_app_setting', { key, value });
    logger.debug('Set Claudio app setting:', { key, value });
  } catch (err) {
    logger.error('Failed to set Claudio app setting:', { key, value, error: err });
    throw err;
  }
}