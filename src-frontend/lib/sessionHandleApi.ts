import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/logger';
import { eventManager } from '@/lib/TauriEventManager';
import { processMessagesWithAgentInfo } from '@/lib/messageProcessor';

/**
 * Session type constants - single source of truth for session type values
 */
export const SESSION_TYPES = {
  CLAUDIO: 'CLAUDIO',
  NATIVE: 'NATIVE',
  ARCHIVED: 'ARCHIVED'
} as const;

export type SessionTypeValue = typeof SESSION_TYPES[keyof typeof SESSION_TYPES];

/**
 * Session types that can be managed
 */
export interface SessionType {
  type: SessionTypeValue;
  data: string | null; // claudio_id for Claudio (null for new sessions), session_id for Native
}

/**
 * Current state of a session handle
 */
export interface SessionState {
  handle_id: string;
  session_type: SessionType;
  project_id: string;        // Encoded folder name: -Users-olivier-Projects-claudio
  project_path: string;      // Actual file path: /Users/olivier/Projects/claudio
  current_claude_session_id: string | null;
  claudio_id?: string;       // For Claudio sessions: claudio-1234567890
  message_count: number;
  is_streaming: boolean;
  last_updated: number;
  session_file_path: string | null;
}

/**
 * Streamed messages from backend
 */
export interface StreamedMessage {
  handle_id: string;
  message_type: string; // "user", "assistant", "system", etc
  content: any;
  uuid: string;
  timestamp: string;
}

/**
 * Claude process events for thinking messages
 */
export interface ClaudeProcessEvent {
  claudio_session_id: string;
  claude_session_id: string;
  process_id?: number;
  status: {
    type: 'Starting' | 'Running' | 'Completed' | 'Failed';
    data?: { action: string } | { reason: string };
  };
  timestamp: number;
  title?: string;
  message?: string;
}

/**
 * Session handle for frontend - provides a clean abstraction over backend session complexity
 */
export class SessionHandle {
  private handleId: string;
  private projectPath: string;
  private messageListeners: Set<(messages: any[]) => void> = new Set();
  private stateUpdateListeners: Set<(state: SessionState) => void> = new Set();
  private processEventListeners: Set<(event: ClaudeProcessEvent) => void> = new Set();
  private messageStreamUnsubscribe: (() => void) | null = null;
  private processEventUnsubscribe: (() => void) | null = null;
  private stateChangeUnsubscribe: (() => void) | null = null;
  private sessionStateUnsubscribe: (() => void) | null = null;
  private isDestroyed: boolean = false;
  private isStreamingSetup: boolean = false;
  private isProcessEventSetup: boolean = false;
  private allMessages: any[] = [];
  private messagesPromise: Promise<any[]> | null = null;

  constructor(handleId: string, projectPath: string) {
    this.handleId = handleId;
    this.projectPath = projectPath;
    // Don't setup stream listener in constructor - do it lazily when first listener is added
    
    // Set up session state change listener immediately (always needed)
    this.setupSessionStateChangeListener().catch(error => {
      logger.error('❌ Failed to setup session state change listener:', error);
    });
  }

  /**
   * Get the current state of this session handle
   */
  async getState(): Promise<SessionState> {
    try {
      const invokeParams = {
        sessionId: this.handleId === 'new' ? null : this.handleId,
        projectPath: this.projectPath,
      };

      const state = await invoke<SessionState>('get_session_handle', invokeParams);

      // Update internal handleId with the actual handle_id from backend
      // This is crucial for new sessions where backend generates a UUID
      if (this.handleId === 'new' && state.handle_id !== 'new') {
        this.handleId = state.handle_id;
      }

      return state;
    } catch (error) {
      logger.error('Failed to get session state:', error);
      throw error;
    }
  }

  /**
   * Send a prompt to this session (handles all backend complexity automatically)
   */
  async sendPrompt(prompt: string, model?: string): Promise<void> {
    try {
      logger.info('Sending prompt to session');

      // Ensure process event listener is set up to handle completion
      if (!this.isProcessEventSetup) {
        await this.setupProcessEventListener();
      }

      // Add execution lock to prevent handle destruction during Claude CLI execution
      SessionHandleManager.addExecutionLock(this.handleId, this.projectPath);

      // Add timeout wrapper to detect hanging calls
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Tauri invoke timed out after 10 seconds')), 10000);
      });

      const invokePromise = invoke('send_session_prompt', {
        handleId: this.handleId,
        prompt,
        model: model || null, // Send null if no model override
      });

      await Promise.race([invokePromise, timeoutPromise]);
      logger.info('Prompt sent successfully');

    } catch (error) {
      logger.error('Failed to send prompt:', error);
      // Remove execution lock on error
      SessionHandleManager.removeExecutionLock(this.handleId, this.projectPath);
      throw error;
    }
  }

  /**
   * Get complete message history for this session (cached to prevent duplicate loads)
   */
  async getMessages(): Promise<any[]> {
    // If messages are already loaded, return them immediately
    if (this.allMessages.length > 0) {
      return [...this.allMessages]; // Return copy to prevent external mutation
    }

    // If a request is already in flight, wait for it
    if (this.messagesPromise) {
      return this.messagesPromise;
    }

    // Start the request and cache the promise
    this.messagesPromise = this.loadMessagesFromBackend();

    try {
      const messages = await this.messagesPromise;
      this.allMessages = [...messages]; // Store internal copy
      this.messagesPromise = null; // Clear promise

      // Process messages with agent attribution and notify listeners
      const processedMessages = processMessagesWithAgentInfo(this.allMessages);
      this.messageListeners.forEach(listener => {
        try {
          listener(processedMessages);
        } catch (error) {
          logger.error('Error in message listener:', error);
        }
      });

      return [...messages]; // Return copy
    } catch (error) {
      this.messagesPromise = null; // Clear promise on error
      logger.error('Failed to load session messages:', error);
      throw error;
    }
  }

  private async loadMessagesFromBackend(): Promise<any[]> {
    try {
      const messages = await invoke<any[]>('get_session_messages', {
        handleId: this.handleId,
      });
      return messages;
    } catch (error) {
      logger.error('Failed to get messages from backend:', error);
      throw error;
    }
  }

  /**
   * Append a new message and notify all listeners
   */
  private appendMessageAndNotify(newMessage: any): void {
    // Check for duplicate messages by UUID to prevent display issues
    if (newMessage.uuid) {
      const existingMessage = this.allMessages.find(msg => msg.uuid === newMessage.uuid);
      if (existingMessage) {
        return;
      }
    }

    this.allMessages.push(newMessage);

    // Process all messages with agent attribution (subagent detection, etc.)
    const processedMessages = processMessagesWithAgentInfo(this.allMessages);

    // Notify all listeners with the processed message list
    this.messageListeners.forEach((listener) => {
      try {
        listener(processedMessages);
      } catch (error) {
        logger.error('Error in message listener:', error);
      }
    });
  }

  /**
   * Listen for message list updates (gets complete message list)
   */
  onMessagesUpdate(callback: (messages: any[]) => void): () => void {
    this.messageListeners.add(callback);

    // Setup stream listener lazily when first listener is added
    if (!this.isStreamingSetup && this.messageListeners.size === 1) {
      this.setupStreamListener().catch(error => {
        logger.error('Failed to setup stream listener:', error);
      });
    }

    // Send initial message list if we have cached messages
    if (this.allMessages.length > 0) {
      setTimeout(() => {
        if (this.messageListeners.has(callback)) {
          const processedMessages = processMessagesWithAgentInfo(this.allMessages);
          callback(processedMessages);
        }
      }, 0);
    }

    return () => {
      this.messageListeners.delete(callback);

      // Clean up stream listener when last listener is removed
      if (this.messageListeners.size === 0 && this.messageStreamUnsubscribe) {
        this.messageStreamUnsubscribe();
        this.messageStreamUnsubscribe = null;
        this.isStreamingSetup = false;
      }
    };
  }

  /**
   * Listen for session state updates
   */
  onStateUpdate(callback: (state: SessionState) => void): () => void {
    this.stateUpdateListeners.add(callback);
    return () => {
      this.stateUpdateListeners.delete(callback);
    };
  }

  /**
   * Listen for process events (thinking messages, completion, etc.)
   */
  onProcessEvent(callback: (event: ClaudeProcessEvent) => void): () => void {
    this.processEventListeners.add(callback);

    // Setup process event listener lazily when first listener is added
    if (!this.isProcessEventSetup && this.processEventListeners.size === 1) {
      this.setupProcessEventListener().catch(error => {
        logger.error('Failed to setup process event listener:', error);
      });
    }

    return () => {
      this.processEventListeners.delete(callback);

      // Clean up process event listener when last listener is removed
      if (this.processEventListeners.size === 0 && this.processEventUnsubscribe) {
        this.processEventUnsubscribe();
        this.processEventUnsubscribe = null;
        this.isProcessEventSetup = false;
      }
    };
  }

  /**
   * Clean up resources when session handle is no longer needed
   */
  destroy(): void {
    this.isDestroyed = true;

    // Clean up all event subscriptions
    if (this.messageStreamUnsubscribe) {
      this.messageStreamUnsubscribe();
      this.messageStreamUnsubscribe = null;
    }

    if (this.processEventUnsubscribe) {
      this.processEventUnsubscribe();
      this.processEventUnsubscribe = null;
    }

    if (this.sessionStateUnsubscribe) {
      this.sessionStateUnsubscribe();
      this.sessionStateUnsubscribe = null;
    }

    if (this.stateChangeUnsubscribe) {
      this.stateChangeUnsubscribe();
      this.stateChangeUnsubscribe = null;
    }
    this.isStreamingSetup = false;
    this.isProcessEventSetup = false;
    this.allMessages = [];
    this.messagesPromise = null;
    this.messageListeners.clear();
    this.stateUpdateListeners.clear();
    this.processEventListeners.clear();
  }

  /**
   * Setup stream listener for real-time messages
   * Uses destruction flag to prevent React StrictMode issues
   */
  private async setupStreamListener(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    if (this.isStreamingSetup) {
      return;
    }

    try {
      this.isStreamingSetup = true;

      // Use global event manager for session message streaming
      this.messageStreamUnsubscribe = await eventManager.subscribe<StreamedMessage>(
        'session_message_stream',
        (message) => {
          // Early return if destroyed
          if (this.isDestroyed) {
            return;
          }

        // Only handle messages for this session handle
        if (message.handle_id === this.handleId) {
          // Append message and notify all listeners with complete list
          this.appendMessageAndNotify(message.content);
        }
      },
      { handleId: this.handleId }
      );

    } catch (error) {
      logger.error('Failed to setup stream listener:', error);
      this.isStreamingSetup = false;
    }
  }

  /**
   * Setup process event listener for thinking messages and status updates
   */
  private async setupProcessEventListener(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    if (this.isProcessEventSetup) {
      return;
    }

    try {
      this.isProcessEventSetup = true;

      // Use global event manager for claude process events
      this.processEventUnsubscribe = await eventManager.subscribe<ClaudeProcessEvent>(
        'claude-process-event',
        (processEvent) => {
          // Early return if destroyed
          if (this.isDestroyed) {
            return;
          }

        // Only handle process events for this session handle
        // Match by claudio_session_id since that's what the backend emits
        if (processEvent.claudio_session_id === this.handleId) {
          // Check if this indicates completion (Claude CLI finished)
          if (processEvent.status.type === 'Completed') {
            logger.info('Claude process completed');
            SessionHandleManager.removeExecutionLock(this.handleId, this.projectPath);
          } else if (processEvent.status.type === 'Failed') {
            logger.error('Claude process failed:', processEvent.status.data);
            SessionHandleManager.removeExecutionLock(this.handleId, this.projectPath);
          }

          // Notify all process event listeners
          this.processEventListeners.forEach((listener) => {
            try {
              listener(processEvent);
            } catch (error) {
              logger.error('Error in process event listener:', error);
            }
          });
        }
      },
      { claudioid: this.handleId }
      );

    } catch (error) {
      logger.error('Failed to setup process event listener:', error);
      this.isProcessEventSetup = false;
    }
  }

  /**
   * Set up listener for session state changes (when Claude session ID gets updated)
   */
  private async setupSessionStateChangeListener(): Promise<void> {
    try {
      interface SessionStateChangeEvent {
        claudio_id: string;
        new_claude_session_id: string;
        project_path: string;
      }

      this.sessionStateUnsubscribe = await eventManager.subscribe<SessionStateChangeEvent>(
        'session-state-changed',
        async (stateChange) => {
          // Handle state changes for this Claudio session (account for handleId updates)
          const isOurSession = (stateChange.claudio_id === this.handleId || this.handleId === 'new')
                              && stateChange.project_path === this.projectPath;
          if (isOurSession) {
            // If we're still "new", update to the real handleId
            if (this.handleId === 'new') {
              this.handleId = stateChange.claudio_id;
            }

            // Refresh the session state by calling getState() again
            try {
              await this.getState();
            } catch (error) {
              logger.error('Failed to refresh session state:', error);
            }
          }
        },
        { claudioid: this.handleId }
      );

    } catch (error) {
      logger.error('Failed to setup session state change listener:', error);
    }
  }
}

/**
 * Session handle manager - provides factory methods and caching
 */
export class SessionHandleManager {
  private static handles: Map<string, SessionHandle> = new Map();
  private static refCounts: Map<string, number> = new Map();
  private static executionLocks: Map<string, number> = new Map(); // Track execution locks per handle

  /**
   * Get or create a session handle for the given session ID and project
   * This is the main entry point for frontend session management
   */
  static async getHandle(sessionId: string | null, projectPath: string): Promise<SessionHandle> {
    const handleKey = `${projectPath}:${sessionId ?? 'new'}`;

    // Increment reference count
    const currentRefCount = this.refCounts.get(handleKey) || 0;
    this.refCounts.set(handleKey, currentRefCount + 1);

    // Return existing handle if available
    if (this.handles.has(handleKey)) {
      return this.handles.get(handleKey)!;
    }

    // Create new handle
    const handle = new SessionHandle(sessionId ?? 'new', projectPath);
    this.handles.set(handleKey, handle);

    // Verify the handle works by getting initial state
    try {
      await handle.getState();
      return handle;
    } catch (error) {
      logger.error('Failed to create session handle:', error);
      // Clean up failed handle and decrement ref count
      this.handles.delete(handleKey);
      this.refCounts.delete(handleKey);
      handle.destroy();
      throw error;
    }
  }

  /**
   * Create a new Claudio session and return its handle
   */
  static async createClaudioSession(projectPath: string): Promise<SessionHandle> {
    // Generate new Claudio session ID
    const claudioId = `claudio-${Date.now()}`;
    return this.getHandle(claudioId, projectPath);
  }

  /**
   * Clean up a session handle (reference counted to handle React StrictMode)
   */
  static destroyHandle(sessionId: string, projectPath: string): void {
    const handleKey = `${projectPath}:${sessionId}`;

    // Decrement reference count
    const currentRefCount = this.refCounts.get(handleKey) || 0;
    const newRefCount = Math.max(0, currentRefCount - 1);

    if (newRefCount === 0) {
      // Reference count reached zero - check execution locks before destroying
      const executionLocks = this.executionLocks.get(handleKey) || 0;
      if (executionLocks > 0) {
        this.refCounts.set(handleKey, newRefCount); // Keep ref count at 0 for later cleanup
      } else {
        // No references and no execution locks - actually destroy the handle
        const handle = this.handles.get(handleKey);
        if (handle) {
          handle.destroy();
          this.handles.delete(handleKey);
        }
        this.refCounts.delete(handleKey);
      }
    } else {
      // Still has references - just decrement counter
      this.refCounts.set(handleKey, newRefCount);
    }
  }

  /**
   * Clean up all session handles
   */
  static destroyAllHandles(): void {
    this.handles.forEach((handle) => handle.destroy());
    this.handles.clear();
    this.refCounts.clear();
    this.executionLocks.clear();
  }

  /**
   * Add execution lock to prevent handle destruction during Claude CLI execution
   */
  static addExecutionLock(sessionId: string, projectPath: string): void {
    const handleKey = `${projectPath}:${sessionId}`;
    const currentLocks = this.executionLocks.get(handleKey) || 0;
    this.executionLocks.set(handleKey, currentLocks + 1);
  }

  /**
   * Remove execution lock, allowing handle destruction if ref count is zero
   */
  static removeExecutionLock(sessionId: string, projectPath: string): void {
    const handleKey = `${projectPath}:${sessionId}`;
    const currentLocks = this.executionLocks.get(handleKey) || 0;
    const newLockCount = Math.max(0, currentLocks - 1);

    if (newLockCount === 0) {
      this.executionLocks.delete(handleKey);

      // Check if handle can be destroyed (no references and no execution locks)
      const refCount = this.refCounts.get(handleKey) || 0;
      if (refCount === 0) {
        const handle = this.handles.get(handleKey);
        if (handle) {
          handle.destroy();
          this.handles.delete(handleKey);
        }
        this.refCounts.delete(handleKey);
      }
    } else {
      this.executionLocks.set(handleKey, newLockCount);
    }
  }
}