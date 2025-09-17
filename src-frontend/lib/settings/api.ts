/**
 * Tauri API wrapper for the new settings system
 *
 * This module provides type-safe wrappers around the Rust backend commands
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  SettingsType,
  ClaudioSettings,
  ClaudeCodeSettings,
  ProjectContext,
  SettingsStats,
} from './types';
import { SettingsError } from './types';

// ===== Handle Management =====

/**
 * Create a new settings handle for a project
 */
export async function createSettingsHandle(
  projectPath: string | null,
  settingsType: SettingsType
): Promise<string> {
  try {
    return await invoke('create_settings_handle', {
      project_path: projectPath,
      settings_type: settingsType,
    });
  } catch (error) {
    throw new SettingsError(`Failed to create settings handle: ${error}`);
  }
}

/**
 * Destroy a settings handle and clean up resources
 */
export async function destroySettingsHandle(handleId: string): Promise<void> {
  try {
    await invoke('destroy_settings_handle', { handle_id: handleId });
  } catch (error) {
    throw new SettingsError(`Failed to destroy settings handle: ${error}`);
  }
}

/**
 * Get current settings for a handle
 */
export async function getSettingsForHandle(handleId: string): Promise<any> {
  try {
    return await invoke('get_settings_for_handle', { handle_id: handleId });
  } catch (error) {
    throw new SettingsError(`Failed to get settings: ${error}`);
  }
}

/**
 * Update a specific setting for a handle
 */
export async function updateSettingForHandle(
  handleId: string,
  key: string,
  value: any
): Promise<void> {
  try {
    await invoke('update_setting_for_handle', {
      handle_id: handleId,
      key,
      value,
    });
  } catch (error) {
    throw new SettingsError(`Failed to update setting: ${error}`);
  }
}

// ===== Query Functions =====

/**
 * Get all active settings handles
 */
export async function getActiveSettingsHandles(): Promise<string[]> {
  try {
    return await invoke('get_active_settings_handles');
  } catch (error) {
    throw new SettingsError(`Failed to get active handles: ${error}`);
  }
}

/**
 * Get handles for a specific project
 */
export async function getProjectSettingsHandles(projectPath: string): Promise<string[]> {
  try {
    return await invoke('get_project_settings_handles', { projectPath });
  } catch (error) {
    throw new SettingsError(`Failed to get project handles: ${error}`);
  }
}

/**
 * Get all active projects with settings handles
 */
export async function getActiveSettingsProjects(): Promise<string[]> {
  try {
    return await invoke('get_active_settings_projects');
  } catch (error) {
    throw new SettingsError(`Failed to get active projects: ${error}`);
  }
}

/**
 * Get project context (cached settings and metadata)
 */
export async function getProjectContext(projectPath: string): Promise<ProjectContext | null> {
  try {
    return await invoke('get_project_context', { projectPath });
  } catch (error) {
    throw new SettingsError(`Failed to get project context: ${error}`);
  }
}

/**
 * Load settings for a project without creating a handle (preview mode)
 */
export async function loadProjectSettingsPreview(
  projectPath: string
): Promise<[ClaudioSettings, ClaudeCodeSettings]> {
  try {
    return await invoke('load_project_settings_preview', { projectPath });
  } catch (error) {
    throw new SettingsError(`Failed to load project settings preview: ${error}`);
  }
}

/**
 * Get orchestrator statistics for debugging
 */
export async function getSettingsStats(): Promise<SettingsStats> {
  try {
    return await invoke('get_settings_stats');
  } catch (error) {
    throw new SettingsError(`Failed to get settings stats: ${error}`);
  }
}

// ===== Type-Safe Settings Getters =====

/**
 * Get Claudio settings for a handle (with type safety)
 */
export async function getClaudioSettings(handleId: string): Promise<ClaudioSettings> {
  const settings = await getSettingsForHandle(handleId);
  return settings as ClaudioSettings;
}

/**
 * Get ClaudeCode settings for a handle (with type safety)
 */
export async function getClaudeCodeSettings(handleId: string): Promise<ClaudeCodeSettings> {
  const settings = await getSettingsForHandle(handleId);
  return settings as ClaudeCodeSettings;
}

// ===== Convenience Functions =====

/**
 * Create a handle and get settings in one call
 */
export async function createHandleAndGetSettings<T = any>(
  projectPath: string | null,
  settingsType: SettingsType
): Promise<{ handleId: string; settings: T }> {
  const handleId = await createSettingsHandle(projectPath, settingsType);
  const settings = await getSettingsForHandle(handleId);
  return { handleId, settings };
}

/**
 * Update multiple settings at once
 */
export async function updateMultipleSettings(
  handleId: string,
  updates: Record<string, any>
): Promise<void> {
  const promises = Object.entries(updates).map(([key, value]) =>
    updateSettingForHandle(handleId, key, value)
  );
  await Promise.all(promises);
}

/**
 * Safe handle destruction that doesn't throw on missing handle
 */
export async function safeDestroyHandle(handleId: string): Promise<void> {
  try {
    await destroySettingsHandle(handleId);
  } catch (error) {
    // Log but don't throw - handle might already be destroyed
    console.warn(`Failed to destroy handle ${handleId}:`, error);
  }
}

// ===== Model-Specific Helpers =====

/**
 * Get current ClaudeCode model setting
 */
export async function getCurrentModel(handleId: string): Promise<string | null> {
  try {
    const settings = await getClaudeCodeSettings(handleId);
    return settings.effective.model || null;
  } catch (error) {
    console.error('Failed to get current model:', error);
    return null;
  }
}

/**
 * Update ClaudeCode model setting
 */
export async function updateModel(handleId: string, model: string): Promise<void> {
  await updateSettingForHandle(handleId, 'model', model);
}

/**
 * Get current Claudio theme setting
 */
export async function getCurrentTheme(handleId: string): Promise<string | null> {
  try {
    const settings = await getClaudioSettings(handleId);
    return settings.theme || null;
  } catch (error) {
    console.error('Failed to get current theme:', error);
    return null;
  }
}

/**
 * Update Claudio theme setting
 */
export async function updateTheme(handleId: string, theme: string): Promise<void> {
  await updateSettingForHandle(handleId, 'theme', theme);
}

// ===== Project Management Helpers =====

/**
 * Get or create settings handle for a project
 */
export async function getOrCreateProjectHandle(
  projectPath: string | null,
  settingsType: SettingsType
): Promise<string> {
  if (!projectPath) {
    return await createSettingsHandle(null, settingsType);
  }

  // Check if handle already exists for this project
  const projectHandles = await getProjectSettingsHandles(projectPath);
  const existingHandle = projectHandles.find(handleId =>
    handleId.includes(settingsType === 'claudio' ? 'claudio-settings' : 'claudecode-settings')
  );

  if (existingHandle) {
    return existingHandle;
  }

  return await createSettingsHandle(projectPath, settingsType);
}

/**
 * Clean up all handles for a project
 */
export async function cleanupProjectHandles(projectPath: string): Promise<void> {
  try {
    const handles = await getProjectSettingsHandles(projectPath);
    const cleanupPromises = handles.map(handle => safeDestroyHandle(handle));
    await Promise.all(cleanupPromises);
  } catch (error) {
    console.error(`Failed to cleanup handles for project ${projectPath}:`, error);
  }
}

// ===== Debug Helpers =====

/**
 * Log current settings state for debugging
 */
export async function debugLogSettingsState(): Promise<void> {
  try {
    const stats = await getSettingsStats();
    const activeHandles = await getActiveSettingsHandles();
    const activeProjects = await getActiveSettingsProjects();

    console.group('🔧 Settings System State');
    console.log('Stats:', stats);
    console.log('Active Handles:', activeHandles);
    console.log('Active Projects:', activeProjects);
    console.groupEnd();
  } catch (error) {
    console.error('Failed to log settings state:', error);
  }
}

// ===== Error Handling Utilities =====

/**
 * Check if an error is a settings-specific error
 */
export function isSettingsError(error: any): error is SettingsError {
  return error instanceof SettingsError;
}

/**
 * Convert any error to a SettingsError for consistent error handling
 */
export function toSettingsError(error: any, context?: string): SettingsError {
  if (isSettingsError(error)) {
    return error;
  }

  const message = context
    ? `${context}: ${error?.message || error}`
    : error?.message || error;

  return new SettingsError(message);
}