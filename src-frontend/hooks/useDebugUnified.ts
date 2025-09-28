/**
 * New useDebug hook that uses UnifiedSettingsProvider instead of DebugProvider
 * This eliminates duplicate API calls and uses cached settings
 */

import { useUnifiedSettingsContext } from '@/lib/settings/contexts';
import { logger } from '@/lib/logger';

export function useDebugUnified() {
  const {
    claudioSettings,
    updateClaudioSetting,
    claudioLoading,
    claudioError
  } = useUnifiedSettingsContext();

  // Get debug mode from cached settings - no API call needed!
  const isDebugMode = claudioSettings?.debugMode || false;

  // Toggle debug mode
  const toggleDebug = async () => {
    try {
      const newDebugMode = !isDebugMode;
      await updateClaudioSetting('debugMode', newDebugMode);

      // Dispatch event for components that still listen to this
      window.dispatchEvent(new CustomEvent('debugModeChanged', { detail: newDebugMode }));

      logger.info(`Debug mode ${newDebugMode ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error('Failed to toggle debug mode:', error);
    }
  };

  return {
    isDebugMode,
    toggleDebug,
    loading: claudioLoading,
    error: claudioError
  };
}