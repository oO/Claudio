/**
 * Single source of truth for theme definitions
 */

export interface ThemeDefinition {
  id: string;
  name: string;
  backgroundColor: string;
  isDark: boolean;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "pure_black",
    name: "Pure Black",
    backgroundColor: "rgb(0, 0, 0)",
    isDark: true,
  },
  {
    id: "cool_dark",
    name: "Cool Dark",
    backgroundColor: "rgb(41, 44, 55)",
    isDark: true,
  },
  {
    id: "neutral_dark",
    name: "Neutral Dark",
    backgroundColor: "rgb(30, 30, 30)",
    isDark: true,
  },
  {
    id: "warm_dark",
    name: "Warm Dark",
    backgroundColor: "rgb(58, 49, 41)",
    isDark: true,
  },
  {
    id: "cool_light",
    name: "Cool Light",
    backgroundColor: "rgb(236, 240, 248)",
    isDark: false,
  },
  {
    id: "neutral_light",
    name: "Neutral Light",
    backgroundColor: "rgb(250, 250, 250)",
    isDark: false,
  },
  {
    id: "warm_light",
    name: "Warm Light",
    backgroundColor: "rgb(244, 240, 236)",
    isDark: false,
  },
  {
    id: "pure_white",
    name: "Pure White",
    backgroundColor: "rgb(255, 255, 255)",
    isDark: false,
  },
  {
    id: "custom",
    name: "Custom",
    backgroundColor: "rgb(30, 30, 30)", // fallback
    isDark: true, // dynamically calculated
  },
];

export type ThemeMode = (typeof THEMES)[number]["id"] | "custom";

export const getThemeById = (id: string): ThemeDefinition | undefined => {
  return THEMES.find((theme) => theme.id === id);
};

export const getThemeBackgroundColor = (themeMode: ThemeMode): string => {
  if (themeMode === "custom") {
    throw new Error(
      "Custom theme background color must be provided separately",
    );
  }
  const theme = getThemeById(themeMode);
  return theme?.backgroundColor || "rgb(30, 30, 30)"; // fallback to neutral_dark
};

/**
 * Determines if a color is dark based on relative luminance
 * Uses standard luminance calculation for accessibility
 */
export const isColorDark = (color: string): boolean => {
  // Handle different color formats
  let r: number, g: number, b: number;

  if (color.startsWith('#')) {
    // Hex color
    const hex = color.slice(1);
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else if (color.startsWith('rgb(')) {
    // RGB color
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!rgbMatch) return true; // fallback to dark
    r = parseInt(rgbMatch[1]);
    g = parseInt(rgbMatch[2]);
    b = parseInt(rgbMatch[3]);
  } else {
    return true; // fallback to dark for unknown formats
  }

  // Calculate relative luminance using sRGB formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return true if dark (luminance < 0.5)
  return luminance < 0.5;
};
