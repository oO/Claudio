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
  READONLY: 'READONLY'
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
      logger.info('🔍 SessionHandle.getState calling Tauri invoke:', invokeParams);
      
      const state = await invoke<SessionState>('get_session_handle', invokeParams);
      logger.info('✅ SessionHandle.getState received response:', state);
      
      // Update internal handleId with the actual handle_id from backend
      // This is crucial for new sessions where backend generates a UUID
      if (this.handleId === 'new' && state.handle_id !== 'new') {
        logger.info('📝 Updating handleId from "new" to actual backend handle_id:', state.handle_id);
        this.handleId = state.handle_id;
      }
      
      return state;
    } catch (error) {
      logger.error('❌ SessionHandle.getState failed:', error);
      throw error;
    }
  }

  /**
   * Send a prompt to this session (handles all backend complexity automatically)
   */
  async sendPrompt(prompt: string): Promise<void> {
    try {
      await invoke('send_session_prompt', {
        handleId: this.handleId,
        prompt,
      });
    } catch (error) {
      logger.error('Failed to send prompt:', error);
      throw error;
    }
  }

  /**
   * Get complete message history for this session (cached to prevent duplicate loads)
   */
  async getMessages(): Promise<any[]> {
    // If messages are already loaded, return them immediately
    if (this.allMessages.length > 0) {
      logger.info('📦 Returning cached messages for handle:', this.handleId, 'count:', this.allMessages.length);
      return [...this.allMessages]; // Return copy to prevent external mutation
    }

    // If a request is already in flight, wait for it
    if (this.messagesPromise) {
      logger.info('⏳ Waiting for existing message load for handle:', this.handleId);
      return this.messagesPromise;
    }

    logger.info('🔄 Loading messages for handle:', this.handleId);
    
    // Start the request and cache the promise
    this.messagesPromise = this.loadMessagesFromBackend();
    
    try {
      const messages = await this.messagesPromise;
      this.allMessages = [...messages]; // Store internal copy
      this.messagesPromise = null; // Clear promise
      logger.info('✅ Messages loaded and cached for handle:', this.handleId, 'count:', messages.length);
      
      // Process messages with agent attribution and notify listeners
      const processedMessages = processMessagesWithAgentInfo(this.allMessages);
      this.messageListeners.forEach(listener => {
        try {
          listener(processedMessages);
        } catch (error) {
          logger.error('❌ Error in message listener:', error);
        }
      });
      
      return [...messages]; // Return copy
    } catch (error) {
      this.messagesPromise = null; // Clear promise on error
      logger.error('❌ Failed to load messages for handle:', this.handleId, error);
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
    this.allMessages.push(newMessage);
    logger.info('📝 Appended streaming message for handle:', this.handleId, 'new count:', this.allMessages.length);
    
    // Process all messages with agent attribution (subagent detection, etc.)
    const processedMessages = processMessagesWithAgentInfo(this.allMessages);
    
    // Notify all listeners with the processed message list
    let listenerIndex = 0;
    this.messageListeners.forEach((listener) => {
      listenerIndex++;
      try {
        logger.info(`🔔 Calling message listener ${listenerIndex}/${this.messageListeners.size} with ${processedMessages.length} processed messages`);
        listener(processedMessages);
        logger.info(`✅ Message listener ${listenerIndex} completed successfully`);
      } catch (error) {
        logger.error(`❌ Error in message listener ${listenerIndex}:`, error);
      }
    });
  }

  /**
   * Listen for message list updates (gets complete message list)
   */
  onMessagesUpdate(callback: (messages: any[]) => void): () => void {
    logger.info('📝 Adding message listener for handle:', this.handleId, 'total listeners will be:', this.messageListeners.size + 1);
    this.messageListeners.add(callback);
    
    // Setup stream listener lazily when first listener is added
    // BUT prevent duplicate setup during React StrictMode
    if (!this.isStreamingSetup && this.messageListeners.size === 1) {
      logger.info('🎧 Setting up SINGLE stream listener for first listener');
      this.setupStreamListener().catch(error => {
        logger.error('❌ Failed to setup stream listener:', error);
      });
    } else if (this.messageListeners.size > 1) {
      logger.info('⚠️ Multiple listeners detected - stream already setup, skipping');
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
      logger.info('🗑️ Removing message listener for handle:', this.handleId, 'remaining listeners will be:', this.messageListeners.size - 1);
      this.messageListeners.delete(callback);
      
      // Clean up stream listener when last listener is removed
      if (this.messageListeners.size === 0 && this.messageStreamUnsubscribe) {
        logger.info('🧹 No more listeners, cleaning up stream listener for handle:', this.handleId);
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
    logger.info('📝 Adding process event listener for handle:', this.handleId, 'total listeners will be:', this.processEventListeners.size + 1);
    this.processEventListeners.add(callback);
    
    // Setup process event listener lazily when first listener is added
    if (!this.isProcessEventSetup && this.processEventListeners.size === 1) {
      logger.info('🎧 Setting up process event listener for first listener');
      this.setupProcessEventListener().catch(error => {
        logger.error('❌ Failed to setup process event listener:', error);
      });
    }
    
    return () => {
      logger.info('🗑️ Removing process event listener for handle:', this.handleId, 'remaining listeners will be:', this.processEventListeners.size - 1);
      this.processEventListeners.delete(callback);
      
      // Clean up process event listener when last listener is removed
      if (this.processEventListeners.size === 0 && this.processEventUnsubscribe) {
        logger.info('🧹 No more process event listeners, cleaning up for handle:', this.handleId);
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
    logger.info('🗑️ Destroying session handle:', this.handleId);
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
    logger.info('✅ Session handle destroyed:', this.handleId);
  }

  /**
   * Setup stream listener for real-time messages
   * Uses destruction flag to prevent React StrictMode issues
   */
  private async setupStreamListener(): Promise<void> {
    if (this.isDestroyed) {
      logger.info('🚫 Not setting up listener - handle already destroyed:', this.handleId);
      return;
    }
    
    if (this.isStreamingSetup) {
      logger.info('⚡ Stream listener already setup for handle:', this.handleId);
      return;
    }
    
    try {
      logger.info('🎧 Setting up Tauri event listener for session_message_stream, handleId:', this.handleId);
      this.isStreamingSetup = true;
      
      // Use global event manager for session message streaming
      this.messageStreamUnsubscribe = await eventManager.subscribe<StreamedMessage>(
        'session_message_stream',
        (message) => {
          // Early return if destroyed
          if (this.isDestroyed) {
            logger.info('🚫 Ignoring message - handle destroyed:', this.handleId);
            return;
          }
        logger.info('📻 Received Tauri event session_message_stream:', { 
          messageHandleId: message.handle_id, 
          ourHandleId: this.handleId,
          messageType: message.message_type,
          uuid: message.uuid,
          timestamp: message.timestamp,
          eventTimestamp: new Date().toISOString()
        });
        
        // Only handle messages for this session handle
        if (message.handle_id === this.handleId) {
          logger.info('✅ Message matches our handle, appending and notifying:', {
            handleId: this.handleId,
            messageUuid: message.uuid,
            currentMessageCount: this.allMessages.length
          });
          
          // Append message and notify all listeners with complete list
          this.appendMessageAndNotify(message.content);
        } else {
          logger.info('🔇 Ignoring message for different handle:', { 
            messageHandleId: message.handle_id, 
            ourHandleId: this.handleId,
            messageUuid: message.uuid
          });
        }
      },
      { handleId: this.handleId }
      );
      
    } catch (error) {
      logger.error('❌ Failed to setup stream listener for handle:', this.handleId, error);
      this.isStreamingSetup = false;
    }
  }

  /**
   * Setup process event listener for thinking messages and status updates
   */
  private async setupProcessEventListener(): Promise<void> {
    if (this.isDestroyed) {
      logger.info('🚫 Not setting up process event listener - handle already destroyed:', this.handleId);
      return;
    }
    
    if (this.isProcessEventSetup) {
      logger.info('⚡ Process event listener already setup for handle:', this.handleId);
      return;
    }
    
    try {
      logger.info('🎧 Setting up Tauri event listener for claude-process-event, handleId:', this.handleId);
      this.isProcessEventSetup = true;
      
      // Use global event manager for claude process events
      this.processEventUnsubscribe = await eventManager.subscribe<ClaudeProcessEvent>(
        'claude-process-event',
        (processEvent) => {
          // Early return if destroyed
          if (this.isDestroyed) {
            logger.info('🚫 Ignoring process event - handle destroyed:', this.handleId);
            return;
          }
        logger.info('📻 Received claude-process-event:', { 
          claudioSessionId: processEvent.claudio_session_id, 
          ourHandleId: this.handleId,
          status: processEvent.status.type,
          title: processEvent.title,
          timestamp: processEvent.timestamp
        });
        
        // Only handle process events for this session handle
        // Match by claudio_session_id since that's what the backend emits
        if (processEvent.claudio_session_id === this.handleId) {
          logger.info('✅ Process event matches our handle, notifying listeners:', {
            handleId: this.handleId,
            status: processEvent.status.type,
            title: processEvent.title,
            listenersCount: this.processEventListeners.size
          });
          
          // Notify all process event listeners
          this.processEventListeners.forEach((listener) => {
            try {
              listener(processEvent);
            } catch (error) {
              logger.error('❌ Error in process event listener:', error);
            }
          });
        } else {
          logger.info('🔇 Ignoring process event for different handle:', { 
            eventClaudioSessionId: processEvent.claudio_session_id, 
            ourHandleId: this.handleId
          });
        }
      },
      { claudioid: this.handleId }
      );
      
    } catch (error) {
      logger.error('❌ Failed to setup process event listener for handle:', this.handleId, error);
      this.isProcessEventSetup = false;
    }
  }

  /**
   * Set up listener for session state changes (when Claude session ID gets updated)
   */
  private async setupSessionStateChangeListener(): Promise<void> {
    try {
      logger.info('🎧 Setting up session-state-changed listener for handle:', this.handleId);
      
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
              logger.info('📝 Updated handleId from state change event:', this.handleId);
            }
            
            logger.info('🔄 Received session state change for our handle:', {
              handleId: this.handleId,
              newClaudeSessionId: stateChange.new_claude_session_id
            });
            
            // Refresh the session state by calling getState() again
            try {
              await this.getState();
              logger.info('✅ Successfully refreshed session state after Claude session creation');
            } catch (error) {
              logger.error('❌ Failed to refresh session state:', error);
            }
          }
        },
        { claudioid: this.handleId }
      );
      
    } catch (error) {
      logger.error('❌ Failed to setup session state change listener for handle:', this.handleId, error);
    }
  }
}

/**
 * Session handle manager - provides factory methods and caching
 */
export class SessionHandleManager {
  private static handles: Map<string, SessionHandle> = new Map();
  private static refCounts: Map<string, number> = new Map();

  /**
   * Get or create a session handle for the given session ID and project
   * This is the main entry point for frontend session management
   */
  static async getHandle(sessionId: string | null, projectPath: string): Promise<SessionHandle> {
    const handleKey = `${projectPath}:${sessionId ?? 'new'}`;
    
    logger.info('🔍 SessionHandleManager.getHandle called:', { sessionId, projectPath, handleKey });
    
    // Increment reference count
    const currentRefCount = this.refCounts.get(handleKey) || 0;
    this.refCounts.set(handleKey, currentRefCount + 1);
    logger.info('📊 Reference count incremented:', { handleKey, newRefCount: currentRefCount + 1 });
    
    // Return existing handle if available
    if (this.handles.has(handleKey)) {
      logger.info('♻️ Returning existing handle for key:', handleKey, 'with refCount:', currentRefCount + 1);
      return this.handles.get(handleKey)!;
    }

    logger.info('🆕 Creating new handle for key:', handleKey);
    // Create new handle
    const handle = new SessionHandle(sessionId ?? 'new', projectPath);
    this.handles.set(handleKey, handle);
    logger.info('💾 Stored handle in cache');
    
    // Verify the handle works by getting initial state
    try {
      logger.info('🔍 Verifying handle by getting initial state...');
      await handle.getState();
      logger.info('✨ Created and verified session handle:', { sessionId, projectPath });
      return handle;
    } catch (error) {
      logger.error('❌ Handle verification failed:', error);
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
      // Reference count reached zero - actually destroy the handle
      logger.info('🗑️ Reference count reached zero, destroying handle:', { handleKey, sessionId, projectPath });
      const handle = this.handles.get(handleKey);
      if (handle) {
        handle.destroy();
        this.handles.delete(handleKey);
      }
      this.refCounts.delete(handleKey);
      logger.info('✅ Session handle destroyed:', { sessionId, projectPath });
    } else {
      // Still has references - just decrement counter
      this.refCounts.set(handleKey, newRefCount);
      logger.info('📊 Reference count decremented (handle preserved):', { 
        handleKey, 
        sessionId, 
        projectPath, 
        newRefCount 
      });
    }
  }

  /**
   * Clean up all session handles
   */
  static destroyAllHandles(): void {
    this.handles.forEach((handle) => handle.destroy());
    this.handles.clear();
    this.refCounts.clear();
    logger.info('🧹 Destroyed all session handles');
  }
}