import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { api } from '../lib/api';
import { type ThemeMode, getThemeBackgroundColor, getThemeById } from '../lib/themes';
import { logger } from '@/lib/logger';

// ThemeMode now imported from themes.ts

export interface CustomThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
}

interface ThemeContextType {
  theme: ThemeMode;
  customColors: CustomThemeColors;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setCustomColors: (colors: Partial<CustomThemeColors>) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'theme_preference';
const CUSTOM_COLORS_STORAGE_KEY = 'theme_custom_colors';

// Simple theme determination - no bullshit luminance calculations
const getThemeClass = (themeMode: ThemeMode, customColors: CustomThemeColors): string => {
  if (themeMode === 'custom') {
    // For custom themes, just assume dark for now (could add isDark to custom theme later)
    return 'theme-dark';
  }
  
  const theme = getThemeById(themeMode);
  return theme?.isDark ? 'theme-dark' : 'theme-light';
};

// Default custom theme colors (neutral dark)
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

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('neutral_dark');
  const [customColors, setCustomColorsState] = useState<CustomThemeColors>(DEFAULT_CUSTOM_COLORS);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme preference and custom colors from storage
  useEffect(() => {
    const loadTheme = async () => {
      try {
        // Load custom colors first
        const savedColors = await api.getSetting(CUSTOM_COLORS_STORAGE_KEY);
        let colors = customColors;

        if (savedColors) {
          colors = JSON.parse(savedColors) as CustomThemeColors;
          setCustomColorsState(colors);
        }

        // Load theme preference
        const savedTheme = await api.getSetting(THEME_STORAGE_KEY);

        let themeMode: ThemeMode = 'neutral_dark'; // default
        if (savedTheme) {
          themeMode = savedTheme as ThemeMode;
        }

        setThemeState(themeMode);
        applyTheme(themeMode, colors);

      } catch (error) {
        logger.error('Failed to load theme settings:', error);
        // Apply default theme even if loading fails
        applyTheme('neutral_dark', customColors);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  // Apply theme to document
  const applyTheme = useCallback((themeMode: ThemeMode, colors: CustomThemeColors) => {
    const root = document.documentElement;

    // Remove theme classes
    root.classList.remove('theme-dark', 'theme-light', 'dark');

    // Get the background color from the theme or custom colors
    let backgroundColor: string;

    if (themeMode === 'custom') {
      backgroundColor = colors.background;
    } else {
      backgroundColor = getThemeBackgroundColor(themeMode);
    }

    // Set the background color directly via CSS variable
    root.style.setProperty('--color-background', backgroundColor);

    // Determine theme class - no bullshit calculations
    const themeClass = getThemeClass(themeMode, colors);
    root.classList.add(themeClass);

    // Add dark class for Tailwind compatibility
    if (themeClass === 'theme-dark') {
      root.classList.add('dark');
    }

    logger.log(`Applied theme: ${themeMode}, Background: ${backgroundColor}, Class: ${themeClass}`);
  }, []);

  const setTheme = useCallback(async (newTheme: ThemeMode) => {
    try {
      setIsLoading(true);

      // Apply theme immediately
      setThemeState(newTheme);
      applyTheme(newTheme, customColors);

      // Save to storage
      await api.saveSetting(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      logger.error('Failed to save theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  }, [customColors, applyTheme]);

  const setCustomColors = useCallback(async (colors: Partial<CustomThemeColors>) => {
    try {
      setIsLoading(true);

      const newColors = { ...customColors, ...colors };
      setCustomColorsState(newColors);

      // Apply immediately if custom theme is active
      if (theme === 'custom') {
        applyTheme('custom', newColors);
      }

      // Save to storage
      await api.saveSetting(CUSTOM_COLORS_STORAGE_KEY, JSON.stringify(newColors));
    } catch (error) {
      logger.error('Failed to save custom colors:', error);
    } finally {
      setIsLoading(false);
    }
  }, [theme, customColors, applyTheme]);

  const value: ThemeContextType = {
    theme,
    customColors,
    setTheme,
    setCustomColors,
    isLoading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};

// Export theme helper for use in UI components
export { getThemeClass };
