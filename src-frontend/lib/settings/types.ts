/**
 * TypeScript types for the new settings system
 *
 * These mirror the Rust backend types for type safety across the bridge
 */

// ===== Core Settings Types =====

export type SettingsType = 'claudecode'; // Only Claude Code settings use orchestrator now

export type SettingsLevel = 'env' | 'local' | 'project' | 'global';

// ===== Claudio App Settings =====

export interface WindowState {
  width: number;
  height: number;
  x: number;
  y: number;
  maximized: boolean;
}

export interface ClaudioSettings {
  telemetry?: boolean;
  auto_update?: boolean;
  default_project_path?: string;
  window_state?: WindowState;
  debug_mode?: boolean;
  log_level?: string;
  // Additional dynamic fields
  [key: string]: any;
}

// ===== ClaudeCode Settings =====

export interface Permissions {
  allow?: string[];
  deny?: string[];
}

export interface HookConfig {
  pre_session?: string;
  post_session?: string;
  on_error?: string;
}

export interface ClaudeCodeConfig {
  model?: string;
  permissions?: Permissions;
  hooks?: HookConfig;
  system_prompt?: string;
  // Additional dynamic fields
  [key: string]: any;
}

// Support for direct JSON format from new backend
export interface ClaudeCodeConfigDirect {
  model?: string;
  permissions?: any; // Raw JSON format
  hooks?: any;       // Raw JSON format
  env?: any;
  statusLine?: any;
  verbose?: boolean;
  // Additional dynamic fields
  [key: string]: any;
}

export interface ClaudeCodeLayers {
  env?: ClaudeCodeConfig;
  local?: ClaudeCodeConfig;
  project?: ClaudeCodeConfig;
  global?: ClaudeCodeConfig;
}

export interface ClaudeCodeSettings {
  effective: ClaudeCodeConfig;
  layers: ClaudeCodeLayers;
  last_computed: string; // ISO timestamp
  project_path?: string;
}

// ===== Handle Management =====

export interface ProjectHandle {
  handle_id: string;
  project_path?: string;
  settings_type: SettingsType;
  created_at: string; // ISO timestamp
}

export interface ProjectContext {
  path: string;
  claudio_settings: ClaudioSettings;
  claudecode_settings: ClaudeCodeSettings;
  has_local_settings: boolean;
  has_project_settings: boolean;
  active_handles: string[];
  last_accessed: string; // ISO timestamp
}

// ===== Events =====

export interface SettingsUpdateEvent {
  handle_id: string;
  settings_type: SettingsType;
  changed_level?: SettingsLevel;
  changed_keys: string[];
  timestamp: string; // ISO timestamp
}

export interface ProjectChangeEvent {
  handle_id: string;
  old_project?: string;
  new_project?: string;
  timestamp: string; // ISO timestamp
}

// ===== API Response Types =====

export interface SettingsStats {
  active_handles: number;
  active_projects: number;
  cached_contexts: number;
  handle_details: {
    claudio_handles: number;
    claudecode_handles: number;
  };
}

// ===== Error Types =====

export class SettingsError extends Error {
  constructor(
    message: string,
    public code?:
      | 'FILE_NOT_FOUND'
      | 'PERMISSION_DENIED'
      | 'INVALID_JSON'
      | 'INVALID_PATH'
      | 'HANDLE_NOT_FOUND'
      | 'PROJECT_NOT_FOUND'
      | 'WATCHER_ERROR'
      | 'IO_ERROR'
  ) {
    super(message);
    this.name = 'SettingsError';
  }
}

// ===== Validation Types =====

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

// ===== Model Types (for ClaudeCode settings) =====

export type ModelId = 'auto' | 'default' | 'opus' | 'sonnet' | 'opusplan';

export interface ModelConfig {
  id: ModelId;
  name: string;
  description: string;
  available: boolean;
}

// ===== Theme Types (for Claudio settings) =====

export type ThemeId = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
}

// ===== Settings Update Payloads =====

export interface ClaudioSettingsUpdate {
  telemetry?: boolean;
  auto_update?: boolean;
  default_project_path?: string;
  debug_mode?: boolean;
  log_level?: string;
  window_state?: Partial<WindowState>;
  [key: string]: any;
}

export interface ClaudeCodeSettingsUpdate {
  model?: ModelId;
  permissions?: Partial<Permissions>;
  hooks?: Partial<HookConfig>;
  system_prompt?: string;
  [key: string]: any;
}

// ===== Hook Types =====

export interface SettingsHandle {
  id: string;
  projectPath?: string;
  settingsType: SettingsType;
  createdAt: Date;
}

export interface UseSettingsOptions {
  projectPath?: string;
  autoCreate?: boolean;
  onUpdate?: (event: SettingsUpdateEvent) => void;
}

export interface UseSettingsReturn<T = any> {
  settings: T | null;
  loading: boolean;
  error: SettingsError | null;
  handleId: string | null;
  updateSetting: (key: string, value: any) => Promise<void>;
  refresh: () => Promise<void>;
}

// ===== Utility Types =====

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type SettingsKeys<T> = keyof T extends string ? keyof T : never;

// ===== Default Values =====

export const DEFAULT_CLAUDIO_SETTINGS: ClaudioSettings = {
  theme: 'system',
  telemetry: false,
  auto_update: true,
  debug_mode: false,
  log_level: 'info',
};

export const DEFAULT_CLAUDECODE_SETTINGS: ClaudeCodeSettings = {
  effective: {
    model: 'auto',
  },
  layers: {},
  last_computed: new Date().toISOString(),
};

export const VALID_MODELS: ModelConfig[] = [
  { id: 'auto', name: 'Auto', description: 'Use default model selection', available: true },
  { id: 'default', name: 'Default', description: 'Use configured default model', available: true },
  { id: 'opus', name: 'Claude 3.5 Opus', description: 'Most capable model', available: true },
  { id: 'sonnet', name: 'Claude 3.5 Sonnet', description: 'Balanced performance', available: true },
  { id: 'opusplan', name: 'Claude 3.5 Opus (Plan)', description: 'Opus with planning', available: true },
];

export const VALID_THEMES: ThemeConfig[] = [
  { id: 'light', name: 'Light', description: 'Light theme' },
  { id: 'dark', name: 'Dark', description: 'Dark theme' },
  { id: 'system', name: 'System', description: 'Follow system preference' },
];

// ===== Type Guards =====

export function isClaudioSettings(settings: any): settings is ClaudioSettings {
  return settings && typeof settings === 'object' &&
    (settings.telemetry !== undefined || settings.auto_update !== undefined);
}

export function isClaudeCodeSettings(settings: any): settings is ClaudeCodeSettings {
  return settings && typeof settings === 'object' &&
    settings.effective !== undefined && settings.layers !== undefined;
}

export function isValidModel(model: string): model is ModelId {
  return VALID_MODELS.some(m => m.id === model);
}

export function isValidTheme(theme: string): theme is ThemeId {
  return VALID_THEMES.some(t => t.id === theme);
}

// ===== Settings Path Helpers =====

export function getSettingsDisplayName(settingsType: SettingsType): string {
  return 'Claude Code Settings';
}

export function getSettingsLevelDisplayName(level: SettingsLevel): string {
  switch (level) {
    case 'env': return 'Environment';
    case 'local': return 'Local (.claude/settings.local.json)';
    case 'project': return 'Project (.claude/settings.json)';
    case 'global': return 'Global (~/.claude/settings.json)';
  }
}

export function getSettingsLevelPrecedence(level: SettingsLevel): number {
  switch (level) {
    case 'env': return 4;
    case 'local': return 3;
    case 'project': return 2;
    case 'global': return 1;
  }
}