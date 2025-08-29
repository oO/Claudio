---
name: Claude Session Thinking Frontend Integration
description: Instructions for implementing native Claude session thinking status in the Claudio frontend
version: 1.0
date_created: 2025-08-27
type: integration-guide
tags: [frontend, claude-sessions, thinking-status, real-time]
---

# Claude Session Thinking Status - Frontend Integration Guide

This document provides complete instructions for integrating native Claude session thinking status into the Claudio frontend.

## Overview

The backend now provides real-time thinking status for native Claude Code sessions (not Claudio-managed). This allows the UI to show "Claude is thinking..." indicators with beautiful titles and haikus, just like Claudio-managed sessions.

## Architecture

### File Structure
- **Claudio sessions**: `~/.claudio/projects/<project_id>/claudio-<claudio_id>.json`
- **Native Claude sessions**: `~/.claudio/projects/<project_id>/claude-<session_id>.json`

### Hook Lifecycle
1. **SessionStart** → Creates `claude-<session_id>.json` with `status: "idle"`
2. **UserPromptSubmit** → Updates status to `"thinking"` + API call for real-time events
3. **Stop** → Updates status to `"idle"` + API call to end thinking
4. **SessionEnd** → Deletes `claude-<session_id>.json`

## Backend API Integration

### Available Tauri Commands

```typescript
// Get all live native Claude sessions
await invoke<LiveClaudeSession[]>('get_live_claude_sessions');

// Get status for specific session
await invoke<LiveClaudeSession | null>('get_claude_session_status', { sessionId: 'abc123' });

// These are called by hooks automatically:
// await invoke('start_claude_thinking', { sessionId, projectDir });
// await invoke('end_claude_thinking', { sessionId });
```

### Data Types

Add these TypeScript types to your frontend:

```typescript
// src-frontend/types/claude-sessions.ts
export interface LiveClaudeSession {
  session_id: string;
  project_dir: string;
  started_at: string;
  transcript_path: string;
  source: string;
  status: 'idle' | 'thinking';
  last_activity?: string;
  thinking_title?: string;
  thinking_message?: string;
  type: 'claude_session';
}

export interface ClaudeThinkingEvent {
  session_id: string;
  project_dir: string;
  status: 'thinking' | 'idle';
  title?: string;
  message?: string;
}
```

## Event System Integration

### 1. Listen for Real-Time Thinking Events

Add this to your project components or session management:

```typescript
// In a React component or hook
import { listen } from '@tauri-apps/api/event';
import type { ClaudeThinkingEvent } from '@/types/claude-sessions';

useEffect(() => {
  const setupClaudeThinkingListener = async () => {
    const unlisten = await listen<ClaudeThinkingEvent>('claude-session-thinking', (event) => {
      const { session_id, status, title, message } = event.payload;
      
      if (status === 'thinking') {
        // Show thinking status in UI
        setActiveThinkingSessions(prev => ({
          ...prev,
          [session_id]: { title, message, isThinking: true }
        }));
      } else {
        // Remove thinking status
        setActiveThinkingSessions(prev => {
          const updated = { ...prev };
          delete updated[session_id];
          return updated;
        });
      }
    });
    
    return unlisten;
  };
  
  const cleanup = setupClaudeThinkingListener();
  return () => cleanup.then(fn => fn());
}, []);
```

### 2. State Management

Create a hook for managing Claude session state:

```typescript
// src-frontend/hooks/useClaudeSessionTracking.ts
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { LiveClaudeSession, ClaudeThinkingEvent } from '@/types/claude-sessions';
import { logger } from '@/lib/logger';

interface ClaudeThinkingState {
  [sessionId: string]: {
    title: string;
    message: string;
    isThinking: boolean;
  };
}

export const useClaudeSessionTracking = () => {
  const [liveSessions, setLiveSessions] = useState<LiveClaudeSession[]>([]);
  const [thinkingSessions, setThinkingSessions] = useState<ClaudeThinkingState>({});
  
  // Load initial live sessions
  const refreshLiveSessions = async () => {
    try {
      const sessions = await invoke<LiveClaudeSession[]>('get_live_claude_sessions');
      setLiveSessions(sessions);
      logger.info(`Loaded ${sessions.length} live Claude sessions`);
    } catch (error) {
      logger.error('Failed to load live Claude sessions:', error);
    }
  };
  
  // Listen for real-time thinking updates
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<ClaudeThinkingEvent>('claude-session-thinking', (event) => {
        const { session_id, status, title, message } = event.payload;
        
        logger.debug(`Claude thinking event: ${session_id} → ${status}`);
        
        if (status === 'thinking' && title && message) {
          setThinkingSessions(prev => ({
            ...prev,
            [session_id]: { title, message, isThinking: true }
          }));
        } else {
          setThinkingSessions(prev => {
            const updated = { ...prev };
            delete updated[session_id];
            return updated;
          });
        }
      });
      
      return unlisten;
    };
    
    const cleanup = setupListener();
    return () => cleanup.then(fn => fn());
  }, []);
  
  // Initial load
  useEffect(() => {
    refreshLiveSessions();
  }, []);
  
  return {
    liveSessions,
    thinkingSessions,
    refreshLiveSessions,
  };
};
```

## UI Components

### 1. Enhanced Project Session Display

Update `ProjectSessionTab.tsx` to show live Claude sessions:

```typescript
// In ProjectSessionTab.tsx
import { useClaudeSessionTracking } from '@/hooks/useClaudeSessionTracking';
import { LiveSessionIndicator } from '@/components/sessions/LiveSessionIndicator';

export const ProjectSessionTab: React.FC<ProjectSessionTabProps> = ({ project }) => {
  const { liveSessions, thinkingSessions } = useClaudeSessionTracking();
  
  // Filter sessions for this project
  const projectLiveSessions = liveSessions.filter(session => 
    session.project_dir === project.path
  );
  
  return (
    <div className="relative">
      <DebugLabel label="ProjectSessionTab" />
      
      {/* Existing Claudio sessions */}
      {sessions.map(session => (
        <SessionCard key={session.id} session={session} />
      ))}
      
      {/* Live Claude sessions */}
      {projectLiveSessions.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Live Claude Sessions
          </h3>
          {projectLiveSessions.map(session => (
            <LiveSessionCard 
              key={session.session_id}
              session={session}
              thinkingState={thinkingSessions[session.session_id]}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

### 2. Live Session Card Component

Create a new component for displaying live Claude sessions:

```typescript
// src-frontend/components/sessions/LiveSessionCard.tsx
import React from 'react';
import { Loader2, Terminal } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DebugLabel } from '@/components/ui/atoms';
import type { LiveClaudeSession } from '@/types/claude-sessions';

interface LiveSessionCardProps {
  session: LiveClaudeSession;
  thinkingState?: {
    title: string;
    message: string;
    isThinking: boolean;
  };
}

export const LiveSessionCard: React.FC<LiveSessionCardProps> = ({ 
  session, 
  thinkingState 
}) => {
  return (
    <Card className="relative p-4 hover:shadow-md transition-shadow">
      <DebugLabel label="LiveSessionCard" />
      
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-blue-500" />
          <div>
            <div className="font-medium text-sm">
              Native Claude Session
            </div>
            <div className="text-xs text-muted-foreground">
              Started {new Date(session.started_at).toLocaleTimeString()}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Live
          </Badge>
          
          {thinkingState?.isThinking && (
            <div className="flex items-center gap-2 text-purple-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs font-medium">
                {thinkingState.title}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {thinkingState?.isThinking && (
        <div className="mt-3 p-3 bg-purple-50 rounded-md border-l-4 border-purple-500">
          <div className="text-xs italic text-purple-700 font-serif text-center">
            {thinkingState.message}
          </div>
        </div>
      )}
      
      <div className="mt-2 text-xs text-muted-foreground">
        Session ID: {session.session_id.slice(0, 8)}...
      </div>
    </Card>
  );
};
```

### 3. Status Message Integration

Reuse existing `StatusMessage` component for consistent theming:

```typescript
// In your session display logic
import { StatusMessage } from '@/components/messages/StatusMessage';

// Create a status message object for live Claude sessions
const createThinkingMessage = (thinkingState: any) => ({
  type: "status" as const,
  uuid: `live-claude-${Date.now()}`,
  message: { 
    content: [{ type: "text", text: thinkingState.message }] 
  },
  title: thinkingState.title,
  timestamp: new Date().toISOString(),
  isTemporary: true,
});

// Use in your component
{thinkingState?.isThinking && (
  <StatusMessage message={createThinkingMessage(thinkingState)} />
)}
```

## Integration Points

### 1. Add to API Layer

Update `src-frontend/lib/api.ts`:

```typescript
// Add these methods to your API class
async getLiveClaudeSessions(): Promise<LiveClaudeSession[]> {
  try {
    return await invoke<LiveClaudeSession[]>('get_live_claude_sessions');
  } catch (error) {
    logger.error("Failed to get live Claude sessions:", error);
    throw error;
  }
}

async getClaudeSessionStatus(sessionId: string): Promise<LiveClaudeSession | null> {
  try {
    return await invoke<LiveClaudeSession | null>('get_claude_session_status', { sessionId });
  } catch (error) {
    logger.error("Failed to get Claude session status:", error);
    throw error;
  }
}
```

### 2. Update Project Detail View

In `ProjectDetail.tsx`, add live session tracking:

```typescript
// Add the hook
const { liveSessions, thinkingSessions, refreshLiveSessions } = useClaudeSessionTracking();

// Filter for current project
const projectLiveSessions = liveSessions.filter(session => 
  session.project_dir === project.path
);

// Show count in project header
<div className="flex items-center gap-2">
  <h1>{project.name}</h1>
  {projectLiveSessions.length > 0 && (
    <Badge variant="secondary">
      {projectLiveSessions.length} Live Session{projectLiveSessions.length !== 1 ? 's' : ''}
    </Badge>
  )}
</div>
```

## Testing

### Manual Testing Steps

1. **Start Claudio** in development mode
2. **Open a terminal** in a project directory
3. **Run `claude`** to start a native Claude session
4. **Check Claudio UI** - should show "Live Claude Session" 
5. **Type a prompt in Claude** - should show thinking status with title/haiku
6. **Wait for Claude to respond** - thinking status should disappear
7. **Exit Claude** - live session should be removed from UI

### Debugging

Enable debug logging for Claude session hooks:

```bash
# Uncomment the debug logging lines in the hook scripts
sed -i 's/# echo "\[/echo "[/' ~/.claude/hooks/session-start.sh
sed -i 's/# echo "\[/echo "[/' ~/.claude/hooks/user-prompt-submit.sh
sed -i 's/# echo "\[/echo "[/' ~/.claude/hooks/stop.sh
sed -i 's/# echo "\[/echo "[/' ~/.claude/hooks/session-end.sh

# Check the log file
tail -f ~/.claudio/session-hooks.log
```

## Performance Notes

- Live session scanning is optimized with async file operations
- Real-time events use Tauri's efficient event system
- Session files are small JSON objects (< 1KB each)
- File operations are batched and cached appropriately

## Future Enhancements

1. **Session Actions**: Add buttons to "attach" to live Claude sessions
2. **Session History**: Show recent activity from native sessions
3. **Notifications**: Desktop notifications when thinking starts/ends
4. **Session Analytics**: Track native session usage and patterns
5. **Integration**: Open native Claude sessions in Claudio UI

---

## Summary

This integration provides seamless detection and beautiful status display for native Claude Code sessions, making them feel as polished as Claudio-managed sessions. The real-time thinking status with titles and haikus creates a consistent and delightful user experience across all Claude interactions.

The implementation leverages the existing status message system and event architecture, ensuring minimal code duplication and consistent theming throughout the application.