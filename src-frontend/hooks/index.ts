// Export all custom hooks from a single entry point
export { useLoadingState } from './useLoadingState';
export { useDebounce, useDebouncedCallback } from './useDebounce';
export { useApiCall } from './useApiCall';
export { usePagination } from './usePagination';
export { useTheme } from './useTheme';
export { useDebug } from './useDebug';
export { 
  useAnalytics, 
  useTrackEvent, 
  usePageView, 
  useAppLifecycle,
  useComponentMetrics,
  useInteractionTracking,
  useScreenTracking,
  useFeatureExperiment,
  usePathTracking,
  useFeatureAdoptionTracking,
  useWorkflowTracking,
  useAIInteractionTracking,
  useNetworkPerformanceTracking
} from './useAnalytics';
export { TAB_SCREEN_NAMES } from './useAnalytics';

// Session file watching hooks
export { useSessionFileWatcher, useSessionListWatcher } from './useSessionFileWatcher';
export { useScrollPinning } from './useScrollPinning';

// Prompt input hooks
export { usePromptInput } from './usePromptInput';
export { useSlashCommands } from './useSlashCommands';
export { useImageHandling } from './useImageHandling';
export { useAutoResize } from './useAutoResize';
export { useFilePicker } from './useFilePicker';
export { useUnsavedChanges } from './useUnsavedChanges';

// Settings hooks
export { useSettingsState } from './useSettingsState';
export { useSettingsValidation } from './useSettingsValidation';
export { useClaudeBinaryConfig } from './useClaudeBinaryConfig';
export { useLocalProjectSettings } from './useLocalProjectSettings';
export { useTriLevelSettings } from './useTriLevelSettings';

// Agent execution hooks
export { useAgentExecution, type ClaudeStreamMessage } from './useAgentExecution';
export { useAgentMetadata } from './useAgentMetadata';
export { useExecutionOutput } from './useExecutionOutput';

// Message hooks
export { useMessageContent } from './useMessageContent';
export { useMessageClipboard } from './useMessageClipboard';
export { useAgentStyling } from './useAgentStyling';

// Session hooks
export { useClaudeMessages } from './useClaudeMessages';
export { useCheckpoints } from './useCheckpoints';
// export { useSessionState } from './useSessionState'; // DEPRECATED: moved to /deprecated folder
