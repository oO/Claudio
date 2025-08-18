import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DebugLabel } from '@/components/ui/atoms';
import { logger } from '@/lib/logger';
import { 
  claudeCodeSDK, 
  generateSessionId, 
  type ClaudeCodeMessage,
  type ActiveClaudeSession 
} from '@/lib/claudeCodeSdk';

interface SessionLog {
  sessionId: string;
  messages: ClaudeCodeMessage[];
  prompt: string;
  startTime: Date;
  status: 'running' | 'completed' | 'error';
  projectPath: string;
}

/**
 * Test component for Claude Code SDK with multiple parallel sessions
 */
export const ClaudeCodeSDKTest: React.FC = () => {
  const [sessions, setSessions] = useState<Map<string, SessionLog>>(new Map());
  const [activePrompts, setActivePrompts] = useState<Map<string, string>>(new Map());
  const [globalPrompt, setGlobalPrompt] = useState('Say hello and tell me what tools you have access to. Keep it brief.');
  const [projectPath] = useState(process.cwd() || '/Users/olivier/Projects/claudio');

  const activeSessions = claudeCodeSDK.getActiveSessions();

  const handleStartSession = useCallback(async () => {
    const sessionId = generateSessionId();
    const prompt = globalPrompt.trim();
    
    if (!prompt) {
      logger.warn('Cannot start session with empty prompt');
      return;
    }

    logger.info('Starting new Claude Code SDK session:', { sessionId, prompt });

    // Initialize session log
    const sessionLog: SessionLog = {
      sessionId,
      messages: [],
      prompt,
      startTime: new Date(),
      status: 'running',
      projectPath
    };

    setSessions(prev => new Map(prev.set(sessionId, sessionLog)));
    setActivePrompts(prev => new Map(prev.set(sessionId, '')));

    // Start the session
    try {
      await claudeCodeSDK.startSession(
        sessionId,
        projectPath,
        prompt,
        {
          maxTurns: 3,
          customSystemPrompt: 'You are a helpful assistant testing multiple concurrent sessions.',
          allowedTools: ['Bash', 'Read', 'Write', 'LS']
        },
        (message: ClaudeCodeMessage) => {
          // Handle incoming message
          logger.debug('Received message from session:', { sessionId, type: message.type });
          
          setSessions(prev => {
            const newSessions = new Map(prev);
            const session = newSessions.get(sessionId);
            if (session) {
              session.messages.push(message);
              
              // Update status based on message type
              if (message.type === 'result') {
                session.status = message.is_error ? 'error' : 'completed';
              }
              
              newSessions.set(sessionId, session);
            }
            return newSessions;
          });
        }
      );
    } catch (error) {
      logger.error('Failed to start Claude Code session:', error);
      
      // Update session status
      setSessions(prev => {
        const newSessions = new Map(prev);
        const session = newSessions.get(sessionId);
        if (session) {
          session.status = 'error';
          newSessions.set(sessionId, session);
        }
        return newSessions;
      });
    }
  }, [globalPrompt, projectPath]);

  const handleTerminateSession = useCallback(async (sessionId: string) => {
    logger.info('Terminating session:', sessionId);
    await claudeCodeSDK.terminateSession(sessionId);
    
    // Update local state
    setActivePrompts(prev => {
      const newPrompts = new Map(prev);
      newPrompts.delete(sessionId);
      return newPrompts;
    });
  }, []);

  const handleTerminateAll = useCallback(async () => {
    logger.info('Terminating all Claude Code sessions');
    await claudeCodeSDK.terminateAllSessions();
    setActivePrompts(new Map());
  }, []);

  const handleClearLogs = useCallback(() => {
    setSessions(new Map());
    setActivePrompts(new Map());
  }, []);

  const renderMessage = (message: ClaudeCodeMessage, index: number) => {
    switch (message.type) {
      case 'system':
        return (
          <div key={index} className="text-sm text-blue-600 p-2 bg-blue-50 rounded">
            <strong>System Init:</strong> Session {message.session_id.split('-')[1]} | 
            Tools: {message.tools.length} | Model: {message.model}
          </div>
        );

      case 'assistant':
        return (
          <div key={index} className="text-sm p-2 bg-green-50 rounded">
            <strong>Claude:</strong>
            {message.message.content.map((block, blockIndex) => (
              <div key={blockIndex} className="mt-1">
                {block.type === 'text' && block.text}
              </div>
            ))}
            <div className="text-xs text-gray-500 mt-1">
              Tokens: {message.message.usage.input_tokens}→{message.message.usage.output_tokens}
            </div>
          </div>
        );

      case 'result':
        return (
          <div key={index} className={`text-sm p-2 rounded ${message.is_error ? 'bg-red-50' : 'bg-gray-50'}`}>
            <strong>Result:</strong> {message.subtype} | 
            Duration: {message.duration_ms}ms | 
            Cost: ${message.total_cost_usd.toFixed(4)} | 
            Turns: {message.num_turns}
          </div>
        );

      default:
        return (
          <div key={index} className="text-sm text-gray-600 p-2 bg-gray-50 rounded">
            Unknown message type: {JSON.stringify(message, null, 2)}
          </div>
        );
    }
  };

  return (
    <div className="relative p-4 space-y-4">
      <DebugLabel label="ClaudeCodeSDKTest" />
      
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Claude Code SDK - Multiple Session Test</h2>
        
        {/* Controls */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Test Prompt:</label>
            <Input
              value={globalPrompt}
              onChange={(e) => setGlobalPrompt(e.target.value)}
              placeholder="Enter prompt to test..."
              className="w-full"
            />
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleStartSession} variant="default">
              Start New Session
            </Button>
            <Button onClick={handleTerminateAll} variant="destructive" disabled={activeSessions.length === 0}>
              Terminate All ({activeSessions.length})
            </Button>
            <Button onClick={handleClearLogs} variant="outline">
              Clear Logs
            </Button>
          </div>
        </div>

        {/* Active Sessions Status */}
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">Active Sessions: {activeSessions.length}</h3>
          <div className="flex gap-2 flex-wrap">
            {activeSessions.map((session) => (
              <Badge key={session.sessionId} variant="default" className="text-xs">
                {session.sessionId.split('-')[1]} 
                <button
                  onClick={() => handleTerminateSession(session.sessionId)}
                  className="ml-1 text-red-400 hover:text-red-600"
                >
                  ✕
                </button>
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      {/* Session Logs */}
      <div className="space-y-4">
        {Array.from(sessions.values()).map((session) => (
          <Card key={session.sessionId} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">Session: {session.sessionId.split('-')[1]}</h3>
                <Badge 
                  variant={session.status === 'completed' ? 'default' : 
                          session.status === 'error' ? 'destructive' : 'secondary'}
                >
                  {session.status}
                </Badge>
              </div>
              <div className="text-xs text-gray-500">
                Started: {session.startTime.toLocaleTimeString()} | 
                Messages: {session.messages.length}
              </div>
            </div>
            
            <div className="text-sm mb-3 p-2 bg-gray-100 rounded">
              <strong>Prompt:</strong> {session.prompt}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {session.messages.length === 0 ? (
                <div className="text-gray-500 text-sm">Waiting for messages...</div>
              ) : (
                session.messages.map((message, index) => renderMessage(message, index))
              )}
            </div>
          </Card>
        ))}
      </div>

      {sessions.size === 0 && (
        <Card className="p-8 text-center">
          <div className="text-gray-500">
            No sessions started yet. Click "Start New Session" to begin testing.
          </div>
        </Card>
      )}
    </div>
  );
};