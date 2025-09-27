/**
 * Unified Settings Context - Single Merged Provider
 *
 * This context provides ONLY global settings:
 * 1. ClaudioAppSettings - theme, debug, telemetry (from ~/.claudio/settings.json)
 * 2. ClaudeCodeSettings.user - user-level model, permissions (from ~/.claude/settings.json)
 *
 * Project-specific settings (team/local levels) are handled by components receiving
 * projectPath as props and calling useCachedClaudeCodeSettings(projectPath) directly.
 */

import React, { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { logger } from '@/lib/logger';
import type { ClaudioSettings, ClaudeCodeSettings } from './types';
import { SettingsError } from './types';
import { useClaudioAppSettings, type ClaudioAppSettings } from '@/lib/claudio-app-settings';
import { useCachedClaudeCodeSettings } from './useCachedClaudeCodeSettings';

// ===== Unified Settings Context =====

interface UnifiedSettingsContextState {
  // Claudio app settings (global only)
  claudioSettings: ClaudioSettings | null;
  updateClaudioSetting: (key: string, value: any) => Promise<void>;

  // Theme (extracted from Claudio settings for convenience)
  theme: string;
  setTheme: (theme: string) => Promise<void>;

  // ClaudeCode user-level settings (global only, no project context)
  claudecodeSettings: ClaudeCodeSettings | null;
  updateClaudecodeSetting: (key: string, value: any) => Promise<void>;

  // Model (extracted from ClaudeCode user settings for convenience)
  model: string;
  setModel: (model: string) => Promise<void>;

  // Loading states
  claudioLoading: boolean;
  claudecodeLoading: boolean;
  loading: boolean;

  // Error states
  claudioError: SettingsError | null;
  claudecodeError: SettingsError | null;
  error: SettingsError | null;
}

const UnifiedSettingsContext = createContext<UnifiedSettingsContextState | undefined>(undefined);

interface UnifiedSettingsProviderProps {
  children: ReactNode;
}

export function UnifiedSettingsProvider({ children }: UnifiedSettingsProviderProps) {
  // Global Claudio app settings
  const {
    settings: appSettings,
    updateSetting: updateAppSetting,
    loading: appLoading,
    error: appStringError
  } = useClaudioAppSettings();

  // Global ClaudeCode user settings (no projectPath = user level only)
  const {
    settings: userClaudeCodeSettings,
    updateSetting: updateUserClaudeCodeSetting,
    loading: userClaudeCodeLoading,
    error: userClaudeCodeError
  } = useCachedClaudeCodeSettings(); // No projectPath = user-level settings only

  // Convert ClaudioAppSettings to ClaudioSettings format
  const claudioSettings: ClaudioSettings | null = appSettings ? {
    telemetry: appSettings.telemetry,
    auto_update: appSettings.auto_update,
    window_state: appSettings.window_state ? {
      width: appSettings.window_state.width,
      height: appSettings.window_state.height,
      x: appSettings.window_state.x ?? 0,
      y: appSettings.window_state.y ?? 0,
      maximized: appSettings.window_state.maximized,
    } : undefined,
    debug_mode: appSettings.debug_mode,
    claude_binary_path: appSettings.claude_binary_path,
    tabs_session: appSettings.tabs_session,
    proxy: appSettings.proxy,
  } : null;

  // Convert string error to SettingsError format
  const claudioError: SettingsError | null = appStringError ?
    new SettingsError(appStringError, 'IO_ERROR') : null;

  // Extract theme from Claudio settings with fallback
  const theme = appSettings?.theme_preference || 'neutral_dark';

  // Extract model from ClaudeCode user settings with fallback
  const model = userClaudeCodeSettings?.effective?.model || 'sonnet';

  // Wrapper for Claudio settings updates
  const updateClaudioSetting = useCallback(async (key: string, value: any) => {
    try {
      await updateAppSetting(key as keyof ClaudioAppSettings, value);
    } catch (err) {
      logger.error('Failed to update Claudio setting:', { key, value, error: err });
      throw err;
    }
  }, [updateAppSetting]);

  // Theme setter
  const setTheme = useCallback(async (newTheme: string) => {
    try {
      await updateAppSetting('theme_preference', newTheme);
    } catch (err) {
      logger.error('Failed to update theme:', err);
      throw err;
    }
  }, [updateAppSetting]);

  // ClaudeCode user settings wrapper
  const updateClaudecodeSetting = useCallback(async (key: string, value: any) => {
    try {
      await updateUserClaudeCodeSetting(key, value);
    } catch (err) {
      logger.error('Failed to update ClaudeCode user setting:', { key, value, error: err });
      throw err;
    }
  }, [updateUserClaudeCodeSetting]);

  // Model setter
  const setModel = useCallback(async (newModel: string) => {
    try {
      await updateUserClaudeCodeSetting('model', newModel);
    } catch (err) {
      logger.error('Failed to update model:', err);
      throw err;
    }
  }, [updateUserClaudeCodeSetting]);

  const contextValue = useMemo(() => ({
    // Claudio settings
    claudioSettings,
    updateClaudioSetting,
    theme,
    setTheme,

    // ClaudeCode user settings
    claudecodeSettings: userClaudeCodeSettings,
    updateClaudecodeSetting,
    model,
    setModel,

    // Loading states
    claudioLoading: appLoading,
    claudecodeLoading: userClaudeCodeLoading,
    loading: appLoading || userClaudeCodeLoading,

    // Error states
    claudioError,
    claudecodeError: userClaudeCodeError,
    error: claudioError || userClaudeCodeError,
  }), [
    claudioSettings,
    updateClaudioSetting,
    theme,
    setTheme,
    userClaudeCodeSettings,
    updateClaudecodeSetting,
    model,
    setModel,
    appLoading,
    userClaudeCodeLoading,
    claudioError,
    userClaudeCodeError,
  ]);

  return (
    <UnifiedSettingsContext.Provider value={contextValue}>
      {children}
    </UnifiedSettingsContext.Provider>
  );
}

export function useUnifiedSettingsContext() {
  const context = useContext(UnifiedSettingsContext);
  if (context === undefined) {
    throw new Error('useUnifiedSettingsContext must be used within a UnifiedSettingsProvider');
  }
  return context;
}

// ===== Convenience Hooks for Backward Compatibility =====

/**
 * Get current model setting from user-level settings
 */
export function useCurrentModel(): string {
  const { model } = useUnifiedSettingsContext();
  return model;
}

/**
 * Get current theme setting from Claudio settings
 */
export function useCurrentTheme(): string {
  const { theme } = useUnifiedSettingsContext();
  return theme;
}

/**
 * Check if settings are loading
 */
export function useSettingsLoading(): boolean {
  const { loading } = useUnifiedSettingsContext();
  return loading;
}

/**
 * Get any settings errors
 */
export function useSettingsError(): SettingsError | null {
  const { error } = useUnifiedSettingsContext();
  return error;
}