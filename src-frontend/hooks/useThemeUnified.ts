/**
 * New useTheme hook that uses UnifiedSettingsProvider instead of ThemeProvider
 * This eliminates duplicate API calls and uses cached settings
 */

import { useUnifiedSettingsContext } from '@/lib/settings/contexts';
import { logger } from '@/lib/logger';
import { useState, useCallback, useEffect } from 'react';
import type { CustomThemeColors, ThemeMode } from '@/lib/themeTypes';
import { getThemeBackgroundColor, getThemeById, isColorDark } from '@/lib/themes';

// Default custom theme colors (copied from ThemeContext)
const DEFAULT_CUSTOM_COLORS: CustomThemeColors = {
  background: 'rgb(13, 17, 23)',
  foreground: 'rgba(255,255,255,0.95)',
  card: 'rgba(255,255,255,0.08)',
  cardForeground: 'rgba(255,255,255,0.95)',
  primary: 'rgba(255,255,255,0.95)',
  primaryForeground: 'rgb(13, 17, 23)',
  secondary: 'rgba(255,255,255,0.06)',
  secondaryForeground: 'rgba(255,255,255,0.95)',
  muted: 'rgba(255,255,255,0.06)',
  mutedForeground: 'rgba(255,255,255,0.6)',
  accent: 'rgba(255,255,255,0.10)',
  accentForeground: 'rgba(255,255,255,0.95)',
  destructive: 'rgb(248, 81, 73)',
  destructiveForeground: 'rgb(255, 255, 255)',
  border: 'rgba(255,255,255,0.1)',
  input: 'rgba(255,255,255,0.06)',
  ring: 'rgba(255,255,255,0.20)',
};

export function useThemeUnified() {
  const {
    claudioSettings,
    updateClaudioSetting,
    theme,
    setTheme,
    claudioLoading,
    claudioError
  } = useUnifiedSettingsContext();

  // Get theme object from settings for custom RGB access
  const themeObject = claudioSettings?.theme;
  const customRgb = themeObject?.rgb;

  // Custom colors state (simplified for now - could be moved to settings later)
  const [customColors, setCustomColorsState] = useState<CustomThemeColors>(DEFAULT_CUSTOM_COLORS);

  // Update customColors.background when we have custom RGB from settings
  useEffect(() => {
    if (theme === 'custom' && customRgb && customColors.background !== customRgb) {
      setCustomColorsState(prev => ({ ...prev, background: customRgb }));
    }
  }, [theme, customRgb, customColors.background]);

  // Apply theme to DOM (copied from ThemeProvider)
  const applyTheme = useCallback((themeMode: ThemeMode, colors: CustomThemeColors, customRgbColor?: string) => {
    const root = document.documentElement;

    // Remove theme classes
    root.classList.remove('theme-dark', 'theme-light', 'dark');

    // Get the background color from the theme or custom colors
    let backgroundColor: string;

    if (themeMode === 'custom') {
      // Use custom RGB from settings if available, otherwise fall back to colors.background
      backgroundColor = customRgbColor || customRgb || colors.background;
    } else {
      backgroundColor = getThemeBackgroundColor(themeMode);
    }

    // Set the background color directly via CSS variable
    root.style.setProperty('--color-background', backgroundColor);

    // Determine theme class
    const getThemeClass = (themeMode: ThemeMode, customColors: CustomThemeColors, customRgb?: string): string => {
      if (themeMode === 'custom') {
        // Dynamically detect if custom color is dark
        const colorToCheck = customRgb || colors.background;
        return isColorDark(colorToCheck) ? 'theme-dark' : 'theme-light';
      }
      const theme = getThemeById(themeMode);
      return theme?.isDark ? 'theme-dark' : 'theme-light';
    };

    const themeClass = getThemeClass(themeMode, colors, customRgbColor || customRgb);
    root.classList.add(themeClass);

    // Add dark class for Tailwind compatibility
    if (themeClass === 'theme-dark') {
      root.classList.add('dark');
    }
  }, []);

  // Apply theme when settings load or change (same immediate path as setTheme)
  useEffect(() => {
    if (theme && !claudioLoading) {
      // Apply theme immediately - same path as enhancedSetTheme for DRY compliance
      applyTheme(theme as ThemeMode, customColors, customRgb);
    }
  }, [theme, customRgb, customColors, claudioLoading, applyTheme]);

  // Get debug mode from cached settings
  const debugMode = claudioSettings?.debugMode || false;

  // Toggle debug mode
  const toggleDebug = async () => {
    try {
      const newDebugMode = !debugMode;
      await updateClaudioSetting('debugMode', newDebugMode);
      logger.info(`Debug mode ${newDebugMode ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error('Failed to toggle debug mode:', error);
    }
  };

  // Override setTheme to handle both preset themes and custom colors
  const enhancedSetTheme = useCallback(async (newTheme: string | { name: string, rgb?: string }) => {
    try {
      let themeToApply: string;

      if (typeof newTheme === 'string') {
        // Preset theme
        themeToApply = newTheme;
      } else {
        // Theme object with custom color
        themeToApply = newTheme.name;
      }

      // Apply theme immediately
      const rgbToUse = typeof newTheme === 'object' ? newTheme.rgb : undefined;
      applyTheme(themeToApply as ThemeMode, customColors, rgbToUse);

      // Save to settings via UnifiedSettings
      await setTheme(newTheme);

      logger.debug('Theme updated:', newTheme);
    } catch (error) {
      logger.error('Failed to update theme:', error);
    }
  }, [setTheme, applyTheme, customColors]);

  // Set custom colors (now saves to theme object when on custom theme)
  const setCustomColors = useCallback(async (colors: Partial<CustomThemeColors>) => {
    try {
      const newColors = { ...customColors, ...colors };
      setCustomColorsState(newColors);

      // If on custom theme and background color changed, save to settings
      if (theme === 'custom' && colors.background) {
        await enhancedSetTheme({ name: 'custom', rgb: colors.background });
      } else if (theme) {
        // Re-apply theme with new colors for preview
        applyTheme(theme as ThemeMode, newColors, customRgb);
      }

      logger.debug('Custom colors updated');
    } catch (error) {
      logger.error('Failed to update custom colors:', error);
    }
  }, [customColors, theme, applyTheme, enhancedSetTheme]);

  return {
    // Theme functionality
    theme,
    setTheme: enhancedSetTheme,
    customColors,
    setCustomColors,

    // Debug functionality
    debugMode,
    toggleDebug,

    // Loading states
    loading: claudioLoading,
    error: claudioError,

    // Access to all settings if needed
    settings: claudioSettings
  };
}