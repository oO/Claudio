/**
 * Centralized Claude Code agent color definitions
 * 
 * These colors follow Claude Code's native agent specification.
 * Transparency is managed via CSS custom properties for DRY principle.
 */

export type AgentColorName = 'Red' | 'Blue' | 'Green' | 'Yellow' | 'Purple' | 'Orange' | 'Pink' | 'Cyan';

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
  { name: "Red", value: "Red", cssClass: "agent-red", solidClass: "agent-red-solid" },
  { name: "Blue", value: "Blue", cssClass: "agent-blue", solidClass: "agent-blue-solid" },
  { name: "Green", value: "Green", cssClass: "agent-green", solidClass: "agent-green-solid" },
  { name: "Yellow", value: "Yellow", cssClass: "agent-yellow", solidClass: "agent-yellow-solid" },
  { name: "Purple", value: "Purple", cssClass: "agent-purple", solidClass: "agent-purple-solid" },
  { name: "Orange", value: "Orange", cssClass: "agent-orange", solidClass: "agent-orange-solid" },
  { name: "Pink", value: "Pink", cssClass: "agent-pink", solidClass: "agent-pink-solid" },
  { name: "Cyan", value: "Cyan", cssClass: "agent-cyan", solidClass: "agent-cyan-solid" },
];

/**
 * Get agent color configuration by name
 */
export const getAgentColor = (colorName: AgentColorName): AgentColor => {
  return AGENT_COLORS.find(color => color.value === colorName) || AGENT_COLORS[1]; // Default to Blue
};

/**
 * Legacy compatibility - for CreateAgent component
 * @deprecated Use AGENT_COLORS directly
 */
export interface ColorOption {
  name: string;
  value: string;
  bgClass: string;
}

export const LEGACY_AGENT_COLORS: ColorOption[] = AGENT_COLORS.map(color => ({
  name: color.name,
  value: color.value,
  bgClass: color.solidClass
}));