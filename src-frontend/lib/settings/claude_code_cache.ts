/**
 * Settings cache that survives component remounts and HMR
 *
 * This provides a simple in-memory cache for settings that persists
 * across React component lifecycles, solving the HMR development issue
 */

import { logger } from '@/lib/logger';
import { createSettingsHandle, getSettingsForHandle, updateSettingForHandle, safeDestroyHandle } from './api';
import type { SettingsType } from './types';
import { SettingsError } from './types';

interface CachedSettings {
  data: any;
  timestamp: number;
  handleId: string;
}

// Global cache that survives HMR
const SETTINGS_CACHE = new Map<string, CachedSettings>();
const CACHE_TTL = 30000; // 30 seconds

// Track active handles to prevent leaks
const ACTIVE_HANDLES = new Set<string>();

/**
 * Get cache key for settings
 */
function getCacheKey(projectPath: string | null, settingsType: SettingsType): string {
  const path = projectPath || 'global';
  return `${path}:${settingsType}`;
}

/**
 * Check if cache entry is valid
 */
function isCacheValid(entry: CachedSettings): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL;
}

/**
 * Get settings with caching
 */
export async function getCachedSettings(
  projectPath: string | null
): Promise<any> {
  const cacheKey = getCacheKey(projectPath, 'claudecode');
  const cached = SETTINGS_CACHE.get(cacheKey);

  // Return cached data if valid
  if (cached && isCacheValid(cached)) {
    return cached.data;
  }

  // Cache miss or expired - load fresh data
  // Removed debug logging - cache hits/misses are frequent and not user-relevant

  try {
    // Create handle and load settings
    const handleId = await createSettingsHandle(projectPath);
    ACTIVE_HANDLES.add(handleId);

    const settings = await getSettingsForHandle(handleId);

    // Cache the result
    SETTINGS_CACHE.set(cacheKey, {
      data: settings,
      timestamp: Date.now(),
      handleId
    });

    // Settings loaded and cached successfully - removed debug logging

    return settings;
  } catch (error) {
    logger.error('Failed to load settings', {
      cacheKey,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: error instanceof SettingsError ? error.code : undefined,
      errorStack: error instanceof Error ? error.stack : undefined
    });
    const settingsError = error instanceof SettingsError ? error : new SettingsError(String(error));
    throw settingsError;
  }
}

/**
 * Invalidate cache entry
 */
export function invalidateSettingsCache(projectPath: string | null, settingsType: SettingsType) {
  const cacheKey = getCacheKey(projectPath, settingsType);
  const cached = SETTINGS_CACHE.get(cacheKey);

  if (cached) {
    SETTINGS_CACHE.delete(cacheKey);

    // Clean up handle
    if (ACTIVE_HANDLES.has(cached.handleId)) {
      ACTIVE_HANDLES.delete(cached.handleId);
      safeDestroyHandle(cached.handleId);
    }

    logger.debug('Settings cache invalidated', { cacheKey, handleId: cached.handleId });
  }
}

/**
 * Clear all cache (useful for debugging)
 */
export function clearSettingsCache() {
  logger.debug('Clearing all settings cache');

  // Clean up all handles
  for (const handleId of ACTIVE_HANDLES) {
    safeDestroyHandle(handleId);
  }

  SETTINGS_CACHE.clear();
  ACTIVE_HANDLES.clear();
}

/**
 * Update a setting and refresh cache
 */
export async function updateCachedSetting(
  projectPath: string | null,
  key: string,
  value: any
): Promise<void> {
  const cacheKey = getCacheKey(projectPath, 'claudecode');
  const cached = SETTINGS_CACHE.get(cacheKey);

  if (!cached || !ACTIVE_HANDLES.has(cached.handleId)) {
    // No cached handle, create fresh one
    logger.debug('No cached handle for update, creating fresh one', { cacheKey, key, value });
    await getCachedSettings(projectPath);
    const newCached = SETTINGS_CACHE.get(cacheKey);
    if (!newCached) {
      throw new Error('Failed to create handle for settings update');
    }
    await updateSettingForHandle(newCached.handleId, key, value);
  } else {
    // Use existing handle
    await updateSettingForHandle(cached.handleId, key, value);
  }

  // Refresh the cached data
  logger.debug('Refreshing cache after update', { cacheKey, key, value });
  invalidateSettingsCache(projectPath, 'claudecode');
  await getCachedSettings(projectPath);
}

/**
 * Get cache stats for debugging
 */
export function getSettingsCacheStats() {
  return {
    entries: SETTINGS_CACHE.size,
    activeHandles: ACTIVE_HANDLES.size,
    keys: Array.from(SETTINGS_CACHE.keys())
  };
}