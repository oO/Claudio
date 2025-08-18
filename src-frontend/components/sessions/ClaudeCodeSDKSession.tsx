import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DebugLabel } from '@/components/ui/atoms';
import { logger } from '@/lib/logger';
import { 
  claudeCodeSDK, 
  generateSessionId, 
  type ClaudeCodeMessage 
} from '@/lib/claudeCodeSdk';

interface ClaudeCodeSDKSessionProps {
  projectPath: string;
  onClose?: () => void;
}

interface SessionMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'result';
  content: string;
  timestamp: Date;
  tokens?: { input: number; output: number };
  cost?: number;
  duration?: number;
}

/**
 * Direct Claude Code SDK Session Component
 * Uses the Claude Code SDK directly without Tauri backend
 */
export const ClaudeCodeSDKSession: React.FC<ClaudeCodeSDKSessionProps> = ({
  projectPath,
  onClose
}) => {
  const [sessionId] = useState(() => generateSessionId());
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [totalCost, setTotalCost] = useState(0);
  const [totalTokens, setTotalTokens] = useState({ input: 0, output: 0 });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSDKMessage = useCallback((message: ClaudeCodeMessage) => {
    logger.debug('SDK Message received:', { type: message.type, sessionId });
    
    const timestamp = new Date();
    
    switch (message.type) {
      case 'system':
        setMessages(prev => [...prev, {
          id: `${Date.now()}-system`,
          type: 'system',
          content: `Session initialized: ${message.session_id.split('-')[1]} | Tools: ${message.tools.length} | Model: ${message.model}`,
          timestamp
        }]);
        break;

      case 'assistant':
        const assistantContent = message.message.content
          .map(block => block.type === 'text' ? block.text : '')
          .join('\\n');
        
        setMessages(prev => [...prev, {
          id: message.message.id,
          type: 'assistant',
          content: assistantContent,
          timestamp,
          tokens: {
            input: message.message.usage.input_tokens,
            output: message.message.usage.output_tokens
          }
        }]);
        
        // Update running totals
        setTotalTokens(prev => ({
          input: prev.input + message.message.usage.input_tokens,
          output: prev.output + message.message.usage.output_tokens
        }));
        break;

      case 'result':
        setMessages(prev => [...prev, {
          id: `${Date.now()}-result`,
          type: 'result',
          content: message.is_error ? 
            `Error: ${message.result}` : 
            `Session completed successfully. Duration: ${message.duration_ms}ms`,
          timestamp,
          cost: message.total_cost_usd,
          duration: message.duration_ms
        }]);
        
        setTotalCost(prev => prev + message.total_cost_usd);
        setSessionStatus(message.is_error ? 'error' : 'completed');
        setIsRunning(false);
        break;
    }
  }, [sessionId]);

  const handleSendPrompt = useCallback(async () => {
    if (!currentPrompt.trim() || isRunning) return;

    const prompt = currentPrompt.trim();
    setCurrentPrompt('');
    setIsRunning(true);
    setSessionStatus('running');

    // Add user message
    setMessages(prev => [...prev, {
      id: `${Date.now()}-user`,
      type: 'user',
      content: prompt,
      timestamp: new Date()
    }]);

    logger.info('Starting Claude Code SDK session:', { sessionId, projectPath, prompt: prompt.substring(0, 100) });

    try {
      await claudeCodeSDK.startSession(
        sessionId,
        projectPath,
        prompt,
        {
          maxTurns: 5,
          customSystemPrompt: 'You are Claude, an AI assistant helping with coding tasks.',
          allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'LS', 'Grep', 'Glob'],
          workingDirectory: projectPath
        },
        handleSDKMessage
      );
    } catch (error) {
      logger.error('SDK session failed:', error);
      setMessages(prev => [...prev, {
        id: `${Date.now()}-error`,
        type: 'result',
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date()
      }]);
      setSessionStatus('error');
      setIsRunning(false);
    }
  }, [currentPrompt, isRunning, sessionId, projectPath, handleSDKMessage]);

  const handleTerminate = useCallback(async () => {
    if (isRunning) {
      logger.info('Terminating Claude Code SDK session:', sessionId);
      await claudeCodeSDK.terminateSession(sessionId);
      setIsRunning(false);
      setSessionStatus('idle');
    }
  }, [isRunning, sessionId]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendPrompt();
    }
  }, [handleSendPrompt]);

  const getStatusColor = (status: typeof sessionStatus) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="relative h-full flex flex-col">
      <DebugLabel label="ClaudeCodeSDKSession" />
      
      {/* Header */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Claude Code SDK Session</h2>
            <Badge variant="outline" className="font-mono text-xs">
              {sessionId.split('-')[1]}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {projectPath.split('/').pop()}
            </Badge>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(sessionStatus)}`} />
            <span className="text-sm text-gray-600 capitalize">{sessionStatus}</span>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                ✕
              </Button>
            )}
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
          <span>Messages: {messages.length}</span>
          <span>Tokens: {totalTokens.input}→{totalTokens.output}</span>
          <span>Cost: ${totalCost.toFixed(4)}</span>
        </div>
      </Card>

      {/* Messages */}
      <Card className="flex-1 p-4 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Ready to start your Claude Code session. Enter a prompt below.
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`p-3 rounded-lg ${
                  message.type === 'user' ? 'bg-blue-50 border-l-4 border-blue-500' :
                  message.type === 'assistant' ? 'bg-green-50 border-l-4 border-green-500' :
                  message.type === 'system' ? 'bg-gray-50 border-l-4 border-gray-500' :
                  'bg-orange-50 border-l-4 border-orange-500'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium capitalize">
                    {message.type === 'assistant' ? 'Claude' : message.type}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{message.timestamp.toLocaleTimeString()}</span>
                    {message.tokens && (
                      <span className="bg-white px-2 py-1 rounded">
                        {message.tokens.input}→{message.tokens.output} tokens
                      </span>
                    )}
                    {message.cost && (
                      <span className="bg-white px-2 py-1 rounded">
                        ${message.cost.toFixed(4)}
                      </span>
                    )}
                    {message.duration && (
                      <span className="bg-white px-2 py-1 rounded">
                        {message.duration}ms
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={currentPrompt}
            onChange={(e) => setCurrentPrompt(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Enter your prompt... (Cmd/Ctrl+Enter to send)"
            disabled={isRunning}
            className="flex-1"
          />
          <Button 
            onClick={handleSendPrompt}
            disabled={!currentPrompt.trim() || isRunning}
            variant="default"
          >
            {isRunning ? 'Running...' : 'Send'}
          </Button>
          {isRunning && (
            <Button 
              onClick={handleTerminate}
              variant="destructive"
            >
              Stop
            </Button>
          )}
        </div>
        
        <div className="text-xs text-gray-500 mt-2">
          Press Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) to send
        </div>
      </Card>
    </div>
  );
};