import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { api } from '../lib/api';

export type ThemeMode = 'neutral_dark' | 'neutral_light' | 'cool_dark' | 'warm_light';

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

// Helper function to calculate relative luminance of a color
const getRelativeLuminance = (color: string): number => {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    // Apply gamma correction
    const gamma = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    
    // Calculate relative luminance
    return 0.2126 * gamma(r) + 0.7152 * gamma(g) + 0.0722 * gamma(b);
  }
  
  // For other formats, default to 0.5 (will use dark overlay)
  return 0.5;
};

// Validate background color for proper contrast boundaries
const validateBackgroundColor = (color: string): { valid: boolean; luminance: number; reason?: string } => {
  const luminance = getRelativeLuminance(color);
  
  if (luminance < 0.3 || luminance > 0.7) {
    return { valid: true, luminance };
  }
  
  return {
    valid: false,
    luminance,
    reason: `Luminance ${(luminance * 100).toFixed(1)}% is too middle-range. Use dark colors (< 30%) or light colors (> 70%) for proper contrast.`
  };
};

// Default custom theme colors (neutral dark)
const DEFAULT_CUSTOM_COLORS: CustomThemeColors = {
  background: '#0d1117',
  foreground: 'rgba(255,255,255,0.95)',
  card: 'rgba(255,255,255,0.08)',
  cardForeground: 'rgba(255,255,255,0.95)',
  primary: 'rgba(255,255,255,0.95)',
  primaryForeground: '#0d1117',
  secondary: 'rgba(255,255,255,0.06)',
  secondaryForeground: 'rgba(255,255,255,0.95)',
  muted: 'rgba(255,255,255,0.06)',
  mutedForeground: 'rgba(255,255,255,0.6)',
  accent: 'rgba(255,255,255,0.10)',
  accentForeground: 'rgba(255,255,255,0.95)',
  destructive: '#f85149',
  destructiveForeground: '#ffffff',
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
        // Load theme preference
        const savedTheme = await api.getSetting(THEME_STORAGE_KEY);
        
        if (savedTheme) {
          const themeMode = savedTheme as ThemeMode;
          setThemeState(themeMode);
          applyTheme(themeMode, customColors);
        }

        // Load custom colors
        const savedColors = await api.getSetting(CUSTOM_COLORS_STORAGE_KEY);
        
        if (savedColors) {
          const colors = JSON.parse(savedColors) as CustomThemeColors;
          setCustomColorsState(colors);
          if (theme === 'custom') {
            applyTheme('custom', colors);
          }
        }
      } catch (error) {
        console.error('Failed to load theme settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  // Apply theme to document
  const applyTheme = useCallback((themeMode: ThemeMode, colors: CustomThemeColors) => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove(
      'theme-neutral_dark', 'theme-neutral_light', 'theme-cool_dark', 'theme-warm_light',
      'theme-dark-overlay', 'theme-light-overlay', 'dark'
    );
    
    // For preset themes, apply the theme class and determine overlay
    root.classList.add(`theme-${themeMode}`);
    
    // Get the background color from the theme and determine overlay
    const backgroundColors = {
      'neutral_dark': '#141414',   // 6500K daylight
      'cool_dark': '#151617',      // 7500K cool blue  
      'warm_light': '#fefcf0',     // subtle warm tint
      'neutral_light': '#fffffc'   // 6500K daylight
    };
    
    const backgroundColor = backgroundColors[themeMode] || '#0d1117';
    const luminance = getRelativeLuminance(backgroundColor);
    const overlayClass = luminance < 0.3 ? 'theme-dark-overlay' : 'theme-light-overlay';
    root.classList.add(overlayClass);
    
    // Add dark class for Tailwind compatibility
    console.log(`Theme: ${themeMode}, Luminance: ${(luminance * 100).toFixed(1)}%, Dark class: ${luminance < 0.3}`);
    
    // Force clear first
    root.classList.remove('dark');
    
    if (luminance < 0.3) {
      root.classList.add('dark');
      console.log('Added dark class');
    } else {
      console.log('Removed dark class - should be light theme');
    }
    
    // Debug: log actual classes
    console.log('HTML classes:', root.className);
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
      console.error('Failed to save theme preference:', error);
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
      console.error('Failed to save custom colors:', error);
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

// Export validation function for use in UI components
export { validateBackgroundColor, getRelativeLuminance };