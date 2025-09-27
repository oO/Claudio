/**
 * Settings system exports - Single Merged Provider Architecture
 *
 * UnifiedSettingsProvider handles global settings only:
 * - ClaudioAppSettings (theme, debug, telemetry)
 * - ClaudeCodeSettings.user (user-level model, permissions)
 *
 * Project-specific ClaudeCode settings (team/local) are handled by components
 * receiving projectPath as props and calling useCachedClaudeCodeSettings(projectPath).
 */

// ===== Types =====
export type {
  ClaudioSettings,
  ClaudeCodeSettings,
  WindowState,
  ProjectContext,
} from './types';

// ===== Error Class =====
export { SettingsError } from './types';

// ===== Single Merged Provider =====
export {
  UnifiedSettingsProvider,
  useUnifiedSettingsContext,

  // Convenience hooks for backward compatibility
  useCurrentTheme,
  useCurrentModel,
  useSettingsLoading,
  useSettingsError,
} from './contexts';

// ===== Project Context Hook (for components that need project-specific data) =====
export {
  useProjectContext,
} from './hooks';

// ===== Direct ClaudeCode Settings Hook (for project-specific tri-level settings) =====
export {
  useCachedClaudeCodeSettings,
} from './useCachedClaudeCodeSettings';