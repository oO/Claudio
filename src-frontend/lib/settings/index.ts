/**
 * Settings system exports
 *
 * New unified settings architecture for multi-project support
 */

// ===== Types =====
export type {
  // Core types
  SettingsType,
  SettingsLevel,
  ClaudioSettings,
  ClaudeCodeSettings,
  ProjectContext,

  // Config types
  ClaudeCodeConfig,
  ClaudeCodeLayers,
  Permissions,
  HookConfig,
  WindowState,

  // Handle types
  ProjectHandle,
  SettingsHandle,
  UseSettingsOptions,
  UseSettingsReturn,

  // Event types
  SettingsUpdateEvent,
  ProjectChangeEvent,

  // Model/Theme types
  ModelId,
  ModelConfig,
  ThemeId,
  ThemeConfig,

  // Update types
  ClaudioSettingsUpdate,
  ClaudeCodeSettingsUpdate,

  // Utility types
  DeepPartial,
  SettingsKeys,
  ValidationResult,
  SettingsStats,
} from './types';

// ===== Constants =====
export {
  DEFAULT_CLAUDIO_SETTINGS,
  DEFAULT_CLAUDECODE_SETTINGS,
  VALID_MODELS,
  VALID_THEMES,
} from './types';

// ===== Type Guards =====
export {
  isClaudioSettings,
  isClaudeCodeSettings,
  isValidModel,
  isValidTheme,
} from './types';

// ===== Helper Functions =====
export {
  getSettingsDisplayName,
  getSettingsLevelDisplayName,
  getSettingsLevelPrecedence,
} from './types';

// ===== API Functions =====
export {
  // Core API
  createSettingsHandle,
  destroySettingsHandle,
  getSettingsForHandle,
  updateSettingForHandle,

  // Query functions
  getActiveSettingsHandles,
  getProjectSettingsHandles,
  getActiveSettingsProjects,
  getProjectContext,
  loadProjectSettingsPreview,
  getSettingsStats,

  // Type-safe getters
  getClaudioSettings,
  getClaudeCodeSettings,

  // Convenience functions
  createHandleAndGetSettings,
  updateMultipleSettings,
  safeDestroyHandle,
  getOrCreateProjectHandle,
  cleanupProjectHandles,

  // Model/theme helpers
  getCurrentModel,
  updateModel,
  getCurrentTheme,
  updateTheme,

  // Debug helpers
  debugLogSettingsState,

  // Error utilities
  isSettingsError,
  toSettingsError,
} from './api';

// ===== React Hooks =====
export {
  // Core hooks
  useSettings,
  useClaudioSettings,
  useClaudeCodeSettings,

  // Specialized hooks
  useModelSetting,

  // Project hooks
  useProjectContext,
  useMultiProjectSettings,

  // Advanced hooks
  useSettingsHandle,
  useDebouncedSettings,
} from './hooks';

// ===== React Contexts =====
export {
  // Context providers
  ProjectSettingsProvider,
  ClaudioSettingsProvider,
  ClaudeCodeSettingsProvider,
  UnifiedSettingsProvider,
  SettingsRouterProvider,

  // Context hooks
  useProjectSettingsContext,
  useClaudioSettingsContext,
  useClaudeCodeSettingsContext,
  useUnifiedSettingsContext,
  useSettingsRouterContext,

  // Convenience hooks
  useCurrentModel,
  useCurrentTheme,
  useCurrentProject,
  useSettingsLoading,
  useSettingsError,
} from './contexts';

// ===== Error Class =====
export { SettingsError } from './types';