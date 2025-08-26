// Session-related components
export { ClaudeCodeSession } from './ClaudeCodeSession';
export { ClaudeCodeSDKSession } from './ClaudeCodeSDKSession';
export { RunningClaudeSessions } from './RunningClaudeSessions';
export { ExecutionControlBar } from './ExecutionControlBar';
export { TimelineNavigator } from './TimelineNavigator';
export { CheckpointSettings } from './CheckpointSettings';
export { SessionHeader } from './SessionHeader';
export { PromptInput, type PromptInputRef } from './PromptInput';
export { PromptQueue } from './PromptQueue';
export { MessageRouter } from '../messages';
export { SessionOutputViewer } from './SessionOutputViewer';

// Hooks (re-exported from hooks folder)
export { useClaudeMessages } from '@/hooks/useClaudeMessages';
export { useCheckpoints } from '@/hooks/useCheckpoints';
export { useSessionState } from '@/hooks/useSessionState';

// Extracted session components
export { SessionMessageHandler, useSessionMessageHandler } from './SessionMessageHandler';
export { SessionActions, useSessionActions } from './SessionActions';
export { SessionPreview } from './SessionPreview';
export { SessionSettings } from './SessionSettings';
export { SessionTimeline } from './SessionTimeline';
// export { SessionQueuedPrompts } from './SessionQueuedPrompts'; // Moved to deprecated
export { SessionMessages } from './SessionMessages';
export { ClaudoSessionSettings } from './ClaudoSessionSettings';
export { SessionSettingsDemo } from './SessionSettingsDemo';

// Extracted FloatingPromptInput components
export { PromptTextarea } from './PromptTextarea';
export { ModelSelector, MODELS } from './ModelSelector';
export { ThinkingModeSelector, THINKING_MODES, type ThinkingMode } from './ThinkingModeSelector';
export { PromptControls } from './PromptControls';
export { ExpandedPromptModal } from './ExpandedPromptModal';