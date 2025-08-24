import { claudeCodeSDK } from './claudeCodeSdk';
import type { Session } from './api';

/**
 * Check if a session is currently in editor mode (interactive/streamable)
 * Editor sessions are ones that Claudio is actively managing and can send messages to
 */
export function isEditorSession(session: Session | { id: string }): boolean {
  return claudeCodeSDK.isSessionActive(session.id);
}

/**
 * Check if a session is in viewer mode (read-only)
 * Viewer sessions are completed sessions or ones managed by external processes
 */
export function isViewerSession(session: Session | { id: string }): boolean {
  return !isEditorSession(session);
}