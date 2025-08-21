import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { logger } from '@/lib/logger';

// Message types based on the Hello World example
export interface ClaudeCodeSystemMessage {
  type: 'system';
  subtype: 'init';
  cwd: string;
  session_id: string;
  tools: string[];
  mcp_servers: any[];
  model: string;
  permissionMode: string;
  slash_commands: string[];
  apiKeySource: string;
}

export interface ClaudeCodeAssistantMessage {
  type: 'assistant';
  message: {
    id: string;
    type: 'message';
    role: 'assistant';
    model: string;
    content: Array<{
      type: 'text';
      text: string;
    }>;
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: {
      input_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
      cache_creation: {
        ephemeral_5m_input_tokens: number;
        ephemeral_1h_input_tokens: number;
      };
      output_tokens: number;
      service_tier: string;
    };
  };
  parent_tool_use_id: string | null;
  session_id: string;
}

export interface ClaudeCodeResultMessage {
  type: 'result';
  subtype: 'success' | 'error';
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  session_id: string;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    output_tokens: number;
    server_tool_use: {
      web_search_requests: number;
    };
    service_tier: string;
  };
  permission_denials: any[];
}

export type ClaudeCodeMessage = 
  | ClaudeCodeSystemMessage 
  | ClaudeCodeAssistantMessage 
  | ClaudeCodeResultMessage;

export interface ClaudeCodeSessionOptions {
  maxTurns?: number;
  customSystemPrompt?: string;
  allowedTools?: string[];
  workingDirectory?: string;
  previous_session_id?: string;
}

export interface ActiveClaudeSession {
  sessionId: string;
  claudeSessionId?: string; // The actual session ID from Claude Code SDK
  projectPath: string;
  isActive: boolean;
  startTime: Date;
  lastActivity: Date;
  abortController: AbortController;
  messageHistory: ClaudeCodeMessage[]; // Track conversation history
}

/**
 * Claude Code SDK Session Manager
 * Handles multiple parallel Claude Code sessions with streaming support
 */
class ClaudeCodeSDKManager {
  private activeSessions: Map<string, ActiveClaudeSession> = new Map();
  private sessionMessageHandlers: Map<string, (message: ClaudeCodeMessage) => void> = new Map();

  /**
   * Start a new Claude Code session with streaming via Tauri backend
   */
  async startSession(
    sessionId: string,
    projectPath: string,
    prompt: string,
    options: ClaudeCodeSessionOptions = {},
    onMessage: (message: ClaudeCodeMessage) => void
  ): Promise<void> {
    logger.info('Starting Claude Code SDK session via Tauri:', { sessionId, projectPath });

    // Check if session already exists
    if (this.activeSessions.has(sessionId)) {
      logger.warn('Session already exists, terminating existing session:', sessionId);
      await this.terminateSession(sessionId);
    }

    // Create abort controller for this session
    const abortController = new AbortController();

    // Track the session
    const session: ActiveClaudeSession = {
      sessionId,
      projectPath,
      isActive: true,
      startTime: new Date(),
      lastActivity: new Date(),
      abortController,
      messageHistory: []
    };

    this.activeSessions.set(sessionId, session);
    this.sessionMessageHandlers.set(sessionId, onMessage);

    // Set up event listeners for this session
    const unlistenMessage = await listen(`claude-sdk-message:${sessionId}`, (event: any) => {
      if (this.activeSessions.has(sessionId)) {
        const session = this.activeSessions.get(sessionId)!;
        session.lastActivity = new Date();
      }

      const payload = event.payload;
      logger.debug('Received SDK message:', { sessionId, payload });

      if (payload.type === 'claude_sdk_message' && payload.message) {
        // Store message in history
        const session = this.activeSessions.get(sessionId);
        if (session) {
          session.messageHistory.push(payload.message);
        }
        
        onMessage(payload.message);
        
        // Capture the actual Claude session ID from system messages or direct payload
        if (payload.claude_session_id) {
          if (session) {
            session.claudeSessionId = payload.claude_session_id;
            logger.info('Updated Claude session ID:', { sessionId, claudeSessionId: payload.claude_session_id });
          }
        }
      } else if (payload.type === 'claude_sdk_error') {
        // Convert error to result message
        onMessage({
          type: 'result',
          subtype: 'error',
          is_error: true,
          duration_ms: 0,
          duration_api_ms: 0,
          num_turns: 0,
          result: payload.error || 'Unknown error',
          session_id: sessionId,
          total_cost_usd: 0,
          usage: {
            input_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
            output_tokens: 0,
            server_tool_use: { web_search_requests: 0 },
            service_tier: 'standard'
          },
          permission_denials: []
        });
      }
    });

    const unlistenError = await listen(`claude-sdk-error:${sessionId}`, (event: any) => {
      logger.error('SDK session error:', event.payload);
      onMessage({
        type: 'result',
        subtype: 'error',
        is_error: true,
        duration_ms: 0,
        duration_api_ms: 0,
        num_turns: 0,
        result: event.payload.error || 'Unknown error',
        session_id: sessionId,
        total_cost_usd: 0,
        usage: {
          input_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          output_tokens: 0,
          server_tool_use: { web_search_requests: 0 },
          service_tier: 'standard'
        },
        permission_denials: []
      });
    });

    const unlistenCompleted = await listen(`claude-sdk-completed:${sessionId}`, (event: any) => {
      logger.info('SDK session completed:', event.payload);
      // Clean up
      this.activeSessions.delete(sessionId);
      this.sessionMessageHandlers.delete(sessionId);
      unlistenMessage();
      unlistenError();
      unlistenCompleted();
    });

    try {
      // Configure options for Tauri backend
      const sdkOptions = {
        max_turns: options.maxTurns || 5,
        custom_system_prompt: options.customSystemPrompt,
        allowed_tools: options.allowedTools || ['Bash', 'Read', 'Write', 'Edit', 'LS', 'Grep'],
        working_directory: options.workingDirectory || projectPath,
        previous_session_id: options.previous_session_id // THIS WAS MISSING! 🔥
      };

      logger.info('🔗 Starting Claude Code session via Tauri backend:', sdkOptions);
      
      // Extra debug to confirm previous_session_id makes it through
      if (sdkOptions.previous_session_id) {
        logger.info('🎯 RESUME DETECTED: Will use --resume with session ID:', sdkOptions.previous_session_id);
      } else {
        logger.info('🆕 FRESH START: No previous session ID');
      }

      // Start the session via Tauri command (now redirects to direct CLI internally)
      await invoke('start_claude_sdk_session', {
        sessionId,
        projectPath,
        prompt,
        options: sdkOptions
      });

    } catch (error) {
      logger.error('Failed to start Claude Code SDK session:', { sessionId, error });
      
      // Clean up listeners
      unlistenMessage();
      unlistenError();
      unlistenCompleted();
      
      // Clean up session
      this.activeSessions.delete(sessionId);
      this.sessionMessageHandlers.delete(sessionId);

      // Send error message to handler
      onMessage({
        type: 'result',
        subtype: 'error',
        is_error: true,
        duration_ms: 0,
        duration_api_ms: 0,
        num_turns: 0,
        result: `Failed to start session: ${error instanceof Error ? error.message : String(error)}`,
        session_id: sessionId,
        total_cost_usd: 0,
        usage: {
          input_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          output_tokens: 0,
          server_tool_use: { web_search_requests: 0 },
          service_tier: 'standard'
        },
        permission_denials: []
      });
    }
  }

  /**
   * Send additional prompt to existing session using Claude Code's --resume mechanism
   */
  async sendPromptToSession(sessionId: string, prompt: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`No active session found: ${sessionId}`);
    }

    logger.info('Continuing Claude Code conversation with --resume:', { 
      sessionId, 
      claudeSessionId: session.claudeSessionId,
      prompt: prompt.substring(0, 100) 
    });
    
    try {
      // Call direct session with previous Claude session ID for --resume
      await invoke('start_claude_direct_session', {
        sessionId, // Keep same frontend session ID
        projectPath: session.projectPath,
        prompt,
        options: {
          previous_session_id: session.claudeSessionId, // This triggers --resume
          working_directory: session.projectPath
        }
      });
    } catch (error) {
      logger.error('Failed to continue conversation:', { sessionId, error });
      throw new Error(`Failed to continue conversation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Terminate a specific session
   */
  async terminateSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn('Attempted to terminate non-existent session:', sessionId);
      return;
    }

    logger.info('Terminating Claude Code session:', sessionId);
    
    try {
      // Terminate via Tauri backend
      await invoke('terminate_claude_sdk_session', { sessionId });
    } catch (error) {
      logger.error('Failed to terminate session via backend:', error);
    }
    
    // Signal abort locally
    session.abortController.abort();
    session.isActive = false;

    // Clean up
    this.activeSessions.delete(sessionId);
    this.sessionMessageHandlers.delete(sessionId);
  }

  /**
   * Terminate all active sessions
   */
  async terminateAllSessions(): Promise<void> {
    logger.info('Terminating all Claude Code sessions');
    
    const sessionIds = Array.from(this.activeSessions.keys());
    await Promise.all(sessionIds.map(id => this.terminateSession(id)));
  }

  /**
   * Get list of active sessions
   */
  getActiveSessions(): ActiveClaudeSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get a specific session by ID
   */
  getSession(sessionId: string): ActiveClaudeSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Check if session is active
   */
  isSessionActive(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    return session?.isActive || false;
  }

}

// Export singleton instance
export const claudeCodeSDK = new ClaudeCodeSDKManager();

// Helper function to generate unique session IDs
export function generateSessionId(): string {
  return `claude-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}