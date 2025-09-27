import type { Session } from './api';

/**
 * Check if a session is currently in editor mode (interactive/streamable)
 * Editor sessions are ones that Claudio is actively managing and can send messages to
 * 
 * For now, all Claudio sessions (those starting with "claudio-") are considered editor sessions
 * Native sessions are read-only (viewer mode)
 */
export function isEditorSession(session: Session | { id: string }): boolean {
  return session.id.startsWith('claudio-');
}

/**
 * Check if a session is in viewer mode (read-only)
 * Viewer sessions are completed sessions or ones managed by external processes
 */
export function isViewerSession(session: Session | { id: string }): boolean {
  return !isEditorSession(session);
}

/**
 * Get the display title for a session
 * Uses the first message content or falls back to "Untitled Session"
 */
export function getSessionTitle(session: Pick<Session, 'first_message'>): string {
  return session.first_message || "Untitled Session";
}

/**
 * Format a session ID to compact form (first 4 + last 4 chars)
 * Example: c86fcb14-c69d-430e-87b2-4ec2db308c90 → c86f-8c90
 * Returns null if sessionId is null/undefined
 */
export function formatSessionIdCompact(sessionId: string | null | undefined): string | null {
  if (!sessionId || sessionId.length < 8) return sessionId || null;
  
  // Remove hyphens and get first 4 + last 4 characters
  const cleanId = sessionId.replace(/-/g, '');
  return `${cleanId.slice(0, 4)}-${cleanId.slice(-4)}`;
}