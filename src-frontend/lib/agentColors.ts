/**
 * Centralized Claude Code agent color definitions
 * 
 * These colors follow Claude Code's native agent specification.
 * Transparency is managed via CSS custom properties for DRY principle.
 */

export type AgentColorName = 'grey' | 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'pink' | 'cyan';

export interface AgentColor {
  name: string;
  value: AgentColorName;
  cssClass: string;
  solidClass: string;
}

/**
 * Single source of truth for agent colors
 * Maps to CSS classes defined in styles.css
 */
export const AGENT_COLORS: AgentColor[] = [
  { name: "grey", value: "grey", cssClass: "agent-grey", solidClass: "agent-grey-solid" },
  { name: "red", value: "red", cssClass: "agent-red", solidClass: "agent-red-solid" },
  { name: "blue", value: "blue", cssClass: "agent-blue", solidClass: "agent-blue-solid" },
  { name: "green", value: "green", cssClass: "agent-green", solidClass: "agent-green-solid" },
  { name: "yellow", value: "yellow", cssClass: "agent-yellow", solidClass: "agent-yellow-solid" },
  { name: "purple", value: "purple", cssClass: "agent-purple", solidClass: "agent-purple-solid" },
  { name: "orange", value: "orange", cssClass: "agent-orange", solidClass: "agent-orange-solid" },
  { name: "pink", value: "pink", cssClass: "agent-pink", solidClass: "agent-pink-solid" },
  { name: "cyan", value: "cyan", cssClass: "agent-cyan", solidClass: "agent-cyan-solid" },
];

/**
 * Get agent color configuration by name or hex value
 */
export const getAgentColor = (colorValue: string | AgentColorName): AgentColor => {
  // Handle hex colors
  const hexToColorMap: Record<string, AgentColorName> = {
    "#ef4444": "red",
    "#3b82f6": "blue", 
    "#10b981": "green",
    "#22c55e": "green", // Alternative green
    "#f59e0b": "yellow",
    "#eab308": "yellow", // Alternative yellow
    "#8b5cf6": "purple",
    "#a855f7": "purple", // Alternative purple
    "#f97316": "orange",
    "#ec4899": "pink",
    "#06b6d4": "cyan",
    "#6b7280": "grey", // gray-500
    "#9ca3af": "grey", // gray-400
  };
  
  // Normalize the input
  const normalizedValue = colorValue?.toLowerCase().trim();
  
  // Check if it's a hex color
  if (normalizedValue?.startsWith('#')) {
    const mappedColor = hexToColorMap[normalizedValue];
    if (mappedColor) {
      return AGENT_COLORS.find(color => color.value === mappedColor) || AGENT_COLORS[0];
    }
  }
  
  // Direct color name match (case-insensitive)
  return AGENT_COLORS.find(color => color.value === normalizedValue) || AGENT_COLORS[0]; // Default to grey
};

/**
 * Color options for the color picker dialog
 */
export interface ColorOption {
  name: string;
  value: string;
  bgClass: string;
}

export const AGENT_COLOR_OPTIONS: ColorOption[] = AGENT_COLORS
  .filter(color => color.value !== 'grey') // Exclude grey from picker (it's only for fallback)
  .map(color => ({
    name: color.name,
    value: color.value,
    bgClass: color.solidClass
  }));