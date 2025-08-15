# Subagent-Todo Mapping Development Specification

**Version**: 1.0  
**Date**: August 15, 2025  
**Status**: Draft  

## Overview

This specification outlines the development of a feature to map Claude Code subagents to their corresponding todo files within Claudio's session management system. This enhancement will provide users with clear visibility into which subagents own which todo lists, improving session tracking and debugging capabilities.

## Problem Statement

Currently, Claudio tracks subagent execution and todo files separately without explicit correlation:

- **Subagents** are spawned via Claude Code's `Task` tool with unique UUIDs
- **Todo files** are created by subagents using the `TodoWrite` tool 
- **No mapping** exists between subagent instances and their todo files
- **File naming pattern** follows `{session-uuid}-agent-{agent-uuid}.json` but requires parsing to understand relationships

This lack of mapping makes it difficult for users to:
- Understand which subagent created which todo list
- Track subagent task progress visually
- Debug issues with specific subagent instances
- Manage multiple concurrent subagents effectively

## Current Architecture Analysis

### Todo File Naming Convention
```
{session-uuid}-agent-{agent-uuid}.json

Examples:
- 6d6e1d57-6f1b-4c7e-8df9-7320f5610323-agent-6d6e1d57-6f1b-4c7e-8df9-7320f5610323.json (Main Agent)
- 6d6e1d57-6f1b-4c7e-8df9-7320f5610323-agent-8979b82d-36f9-4d89-bdc2-c36eb970184f.json (Subagent)
```

**Key Insight**: When `session-uuid === agent-uuid`, it's the main Assistant agent. When different, it's a subagent.

### Session Log Structure
Claude Code session logs (`.jsonl` files) contain:
- Task tool invocations that spawn subagents
- TodoWrite tool usage that creates todo files
- Message hierarchy via `parentUuid` chains
- Subagent messages marked with `"isSidechain": true`
- Complete audit trail of agent interactions

### Current Claudio Components
- **SessionOutputViewer**: Displays session messages
- **SubAgentTaskWidget**: Renders subagent task results
- **SessionTimeline**: Shows chronological session events
- **SessionFileWatcher**: Monitors session file changes

## Proposed Solution

### Architecture Overview

```
┌─────────────────────────────────────────┐
│           Frontend Components           │
├─────────────────────────────────────────┤
│ • SubagentTodoMapper (new)             │
│ • SubagentTodoWidget (new)             │
│ • Enhanced SessionTimeline             │
│ • Enhanced SubAgentTaskWidget          │
└─────────────────────────────────────────┘
                    │
              Tauri Commands
                    │
┌─────────────────────────────────────────┐
│           Backend Services              │
├─────────────────────────────────────────┤
│ • SubagentMappingService (new)         │
│ • Enhanced SessionWatcher              │
│ • TodoFileMonitor (new)                │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│         Data Sources                    │
├─────────────────────────────────────────┤
│ • Session JSONL files                  │
│ • Todo JSON files (~/.claude/todos/)   │
│ • Real-time file watchers              │
└─────────────────────────────────────────┘
```

### Implementation Approach

**Phase 1**: Backend Service Implementation
**Phase 2**: Frontend Component Development  
**Phase 3**: Real-time Integration
**Phase 4**: UI Enhancement & Testing

## Detailed Implementation Plan

### Phase 1: Backend Service Implementation

#### 1.1 New Rust Module: `SubagentMappingService`

**File**: `src-backend/src/commands/claude/subagent_mapping.rs`

```rust
use super::types::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::command;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubagentTodoMapping {
    pub session_id: String,
    pub agent_uuid: String,
    pub subagent_type: Option<String>,
    pub task_description: Option<String>,
    pub todo_file_path: String,
    pub spawn_timestamp: String,
    pub last_updated: String,
    pub is_main_agent: bool,
    pub parent_message_uuid: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionSubagentMap {
    pub session_id: String,
    pub main_agent: SubagentTodoMapping,
    pub subagents: Vec<SubagentTodoMapping>,
    pub total_agents: usize,
}

/// Get complete subagent-todo mapping for a session
#[command]
pub async fn get_session_subagent_mapping(
    session_id: String,
    project_path: String,
) -> Result<SessionSubagentMap, String> {
    // Implementation details below
}

/// Watch for new subagent spawning in real-time
#[command] 
pub async fn watch_subagent_spawning(
    app: AppHandle,
    session_id: String,
) -> Result<(), String> {
    // Implementation details below
}
```

#### 1.2 Session Log Parser

```rust
impl SubagentMappingService {
    /// Parse session JSONL to extract subagent spawning events
    fn parse_session_log(session_file_path: &str) -> Result<Vec<SubagentSpawnEvent>, String> {
        // 1. Read JSONL file line by line
        // 2. Find Task tool invocations
        // 3. Extract subagent_type, description, and timestamps
        // 4. Build parent-child relationship via parentUuid
        // 5. Return structured spawn events
    }
    
    /// Correlate spawn events with todo files
    fn correlate_with_todo_files(
        spawn_events: Vec<SubagentSpawnEvent>,
        todo_dir: &str,
        session_id: &str,
    ) -> Result<Vec<SubagentTodoMapping>, String> {
        // 1. Scan todo directory for session files
        // 2. Parse filenames to extract agent UUIDs
        // 3. Match spawn events with todo files
        // 4. Build complete mapping
    }
}
```

#### 1.3 Todo File Monitor

```rust
/// Monitor todo directory for new file creation
pub struct TodoFileMonitor {
    watcher: RecommendedWatcher,
    session_id: String,
    app_handle: AppHandle,
}

impl TodoFileMonitor {
    pub fn new(session_id: String, app: AppHandle) -> Result<Self, String> {
        // Setup file watcher for ~/.claude/todos/
        // Filter for files matching session ID
        // Emit events when new todo files are created
    }
    
    pub fn start_monitoring(&mut self) -> Result<(), String> {
        // Start watching todo directory
        // Emit "todo-file-created" events
    }
}
```

### Phase 2: Frontend Component Development

#### 2.1 SubagentTodoMapper Hook

**File**: `src-frontend/hooks/useSubagentTodoMapping.ts`

```typescript
interface SubagentTodoMapping {
  sessionId: string;
  agentUuid: string;
  subagentType?: string;
  taskDescription?: string;
  todoFilePath: string;
  spawnTimestamp: string;
  lastUpdated: string;
  isMainAgent: boolean;
  parentMessageUuid?: string;
}

interface SessionSubagentMap {
  sessionId: string;
  mainAgent: SubagentTodoMapping;
  subagents: SubagentTodoMapping[];
  totalAgents: number;
}

export const useSubagentTodoMapping = (sessionId: string, projectPath: string) => {
  const [mapping, setMapping] = useState<SessionSubagentMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMapping = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await api.getSessionSubagentMapping(sessionId, projectPath);
      setMapping(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mapping');
    } finally {
      setLoading(false);
    }
  }, [sessionId, projectPath]);

  // Real-time updates via Tauri events
  useEffect(() => {
    const unlisten = listen('subagent-spawned', (event) => {
      // Update mapping when new subagents are spawned
      loadMapping();
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [loadMapping]);

  return {
    mapping,
    loading,
    error,
    loadMapping,
    refresh: loadMapping,
  };
};
```

#### 2.2 SubagentTodoWidget Component

**File**: `src-frontend/components/sessions/SubagentTodoWidget.tsx`

```typescript
interface SubagentTodoWidgetProps {
  sessionId: string;
  projectPath: string;
  className?: string;
}

export const SubagentTodoWidget: React.FC<SubagentTodoWidgetProps> = ({
  sessionId,
  projectPath,
  className,
}) => {
  const { mapping, loading, error, loadMapping } = useSubagentTodoMapping(sessionId, projectPath);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [todoContents, setTodoContents] = useState<Record<string, any[]>>({});

  // Load todo file contents for selected agent
  const loadTodoContent = useCallback(async (agentUuid: string, filePath: string) => {
    try {
      const content = await api.readFile(filePath);
      const todos = JSON.parse(content);
      setTodoContents(prev => ({ ...prev, [agentUuid]: todos }));
    } catch (err) {
      console.error('Failed to load todo content:', err);
    }
  }, []);

  return (
    <div className={cn("space-y-4", className)}>
      <DebugLabel label="SubagentTodoWidget" />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Subagent Todo Mapping</h3>
        <button
          onClick={loadMapping}
          disabled={loading}
          className="btn btn-sm"
        >
          {loading ? <LoadingSpinner /> : <RefreshIcon />}
          Refresh
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="alert alert-error">
          <AlertTriangleIcon />
          {error}
        </div>
      )}

      {/* Mapping Display */}
      {mapping && (
        <div className="space-y-3">
          {/* Main Agent */}
          <SubagentTodoCard
            mapping={mapping.mainAgent}
            isSelected={selectedAgent === mapping.mainAgent.agentUuid}
            onClick={() => setSelectedAgent(mapping.mainAgent.agentUuid)}
            todoContent={todoContents[mapping.mainAgent.agentUuid]}
            onLoadTodos={loadTodoContent}
          />

          {/* Subagents */}
          {mapping.subagents.map((subagent) => (
            <SubagentTodoCard
              key={subagent.agentUuid}
              mapping={subagent}
              isSelected={selectedAgent === subagent.agentUuid}
              onClick={() => setSelectedAgent(subagent.agentUuid)}
              todoContent={todoContents[subagent.agentUuid]}
              onLoadTodos={loadTodoContent}
            />
          ))}
        </div>
      )}

      {/* Summary */}
      {mapping && (
        <div className="text-sm text-muted-foreground">
          Total agents: {mapping.totalAgents} (1 main + {mapping.subagents.length} subagents)
        </div>
      )}
    </div>
  );
};
```

#### 2.3 SubagentTodoCard Component

```typescript
interface SubagentTodoCardProps {
  mapping: SubagentTodoMapping;
  isSelected: boolean;
  onClick: () => void;
  todoContent?: any[];
  onLoadTodos: (agentUuid: string, filePath: string) => void;
}

const SubagentTodoCard: React.FC<SubagentTodoCardProps> = ({
  mapping,
  isSelected,
  onClick,
  todoContent,
  onLoadTodos,
}) => {
  const [expanded, setExpanded] = useState(false);

  const handleExpand = () => {
    if (!expanded && !todoContent) {
      onLoadTodos(mapping.agentUuid, mapping.todoFilePath);
    }
    setExpanded(!expanded);
  };

  return (
    <div className={cn(
      "border rounded-lg p-4 cursor-pointer transition-colors",
      isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
      mapping.isMainAgent && "border-blue-500 bg-blue-50"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AgentIcon 
            type={mapping.isMainAgent ? "assistant" : "subagent"} 
            subagentType={mapping.subagentType}
          />
          <div>
            <div className="font-medium">
              {mapping.isMainAgent ? "Main Assistant" : `${mapping.subagentType || "Subagent"}`}
            </div>
            <div className="text-xs text-muted-foreground">
              {mapping.agentUuid.substring(0, 8)}...
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <MessageTimestamp timestamp={mapping.spawnTimestamp} />
          <button
            onClick={handleExpand}
            className="btn btn-ghost btn-sm"
          >
            <ChevronDownIcon className={cn(
              "transition-transform",
              expanded && "rotate-180"
            )} />
          </button>
        </div>
      </div>

      {/* Task Description */}
      {mapping.taskDescription && (
        <div className="mt-2 text-sm text-muted-foreground">
          {mapping.taskDescription}
        </div>
      )}

      {/* Expanded Todo Content */}
      {expanded && (
        <div className="mt-4 pt-4 border-t">
          {todoContent ? (
            <TodoList todos={todoContent} compact />
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoadingSpinner size="sm" />
              Loading todos...
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### Phase 3: Real-time Integration

#### 3.1 Enhanced Session Watcher

Extend existing `SessionFileWatcher` to emit subagent events:

```typescript
// In useSessionFileWatcher.ts
useEffect(() => {
  const unlistenSubagent = listen('subagent-spawned', (event) => {
    const data = event.payload as {
      sessionId: string;
      agentUuid: string;
      subagentType: string;
      description: string;
    };
    
    // Trigger UI updates
    onSubagentSpawned?.(data);
  });

  return () => {
    unlistenSubagent.then(fn => fn());
  };
}, [onSubagentSpawned]);
```

#### 3.2 Integration with Existing Components

**SessionTimeline Enhancement**:
```typescript
// Add subagent spawn events to timeline
const timelineEvents = [
  ...existingEvents,
  ...subagentSpawnEvents.map(event => ({
    type: 'subagent-spawn',
    timestamp: event.timestamp,
    data: event,
  })),
];
```

**SubAgentTaskWidget Enhancement**:
```typescript
// Link to corresponding todo file
const todoMapping = useSubagentTodoMapping(sessionId, projectPath);
const currentTodos = todoMapping.mapping?.subagents.find(
  s => s.agentUuid === taskResult.agentUuid
);
```

### Phase 4: UI Enhancement & Testing

#### 4.1 Visual Design

- **Agent Icons**: Distinct visual indicators for main agent vs subagents
- **Color Coding**: Consistent color scheme across timeline and widgets
- **Status Indicators**: Show active/completed status for todo lists
- **Expandable Cards**: Progressive disclosure of todo details

#### 4.2 User Experience Features

- **Quick Navigation**: Click agent in timeline to jump to corresponding todo
- **Real-time Updates**: Live updates when todos are modified
- **Search/Filter**: Find specific agents or todo items
- **Export**: Export session subagent mapping for debugging

#### 4.3 Testing Strategy

**Unit Tests**:
- Session log parsing logic
- Todo file correlation algorithms
- Component rendering with various data states

**Integration Tests**:
- End-to-end subagent spawning and tracking
- Real-time event propagation
- File system monitoring accuracy

**Performance Tests**:
- Large session files with many subagents
- Memory usage with real-time monitoring
- UI responsiveness with frequent updates

## API Reference

### Backend Commands

```rust
// Get complete mapping for a session
get_session_subagent_mapping(session_id: String, project_path: String) -> SessionSubagentMap

// Start real-time monitoring
watch_subagent_spawning(session_id: String) -> Result<(), String>

// Get specific todo file content
get_subagent_todos(agent_uuid: String, session_id: String) -> Vec<TodoItem>
```

### Frontend API

```typescript
// Hook for mapping data
useSubagentTodoMapping(sessionId: string, projectPath: string)

// Components
<SubagentTodoWidget sessionId={sessionId} projectPath={projectPath} />
<SubagentTodoCard mapping={mapping} onSelect={onSelect} />

// Events
listen('subagent-spawned', handler)
listen('todo-file-updated', handler)
```

## File Structure

```
src-backend/src/commands/claude/
├── subagent_mapping.rs          # New mapping service
├── todo_monitor.rs              # New todo file monitoring
└── types.rs                     # Enhanced with mapping types

src-frontend/hooks/
├── useSubagentTodoMapping.ts    # New hook for mapping data
└── useSessionFileWatcher.ts     # Enhanced with subagent events

src-frontend/components/sessions/
├── SubagentTodoWidget.tsx       # New main widget
├── SubagentTodoCard.tsx         # New card component
├── SessionTimeline.tsx          # Enhanced with subagent events
└── SubAgentTaskWidget.tsx       # Enhanced with todo links

docs/
└── subagent-todo-mapping-spec.md # This specification
```

## Success Criteria

### Functional Requirements
- ✅ Map subagents to their todo files with 100% accuracy
- ✅ Display real-time updates when new subagents are spawned
- ✅ Show todo progress for each subagent instance
- ✅ Handle multiple concurrent subagents gracefully
- ✅ Maintain performance with large session files

### Non-Functional Requirements
- ✅ Load mappings in <500ms for typical sessions
- ✅ Memory usage increase <50MB for monitoring
- ✅ UI updates within 100ms of file changes
- ✅ Backwards compatibility with existing sessions
- ✅ Graceful degradation when todo files are missing

### User Experience Goals
- ✅ Intuitive visual connection between agents and todos
- ✅ Quick access to todo details without leaving session view
- ✅ Clear indication of which agent created which tasks
- ✅ Helpful for debugging subagent execution issues

## Future Enhancements

### Phase 5: Advanced Features
- **Todo Aggregation**: Combined view of all subagent todos
- **Progress Analytics**: Statistics on subagent task completion
- **Todo Templates**: Predefined todo patterns for common subagent types
- **Collaborative Todos**: Shared todos between multiple subagents

### Phase 6: Developer Tools
- **Mapping Export**: JSON export of complete session mappings
- **Debug Dashboard**: Advanced debugging interface for subagent interactions
- **Performance Metrics**: Timing and resource usage tracking
- **Session Comparison**: Compare subagent usage across sessions

## Risk Assessment

### Technical Risks
- **Performance**: Large session files may impact parsing speed
- **File System**: Todo file corruption or permissions issues
- **Race Conditions**: Rapid subagent spawning may cause mapping conflicts

### Mitigation Strategies
- **Caching**: Implement intelligent caching for parsed session data
- **Error Handling**: Robust error recovery for file system issues
- **Debouncing**: Rate limit file system events to prevent conflicts

## Conclusion

This specification provides a comprehensive roadmap for implementing subagent-todo mapping in Claudio. The phased approach ensures steady progress while maintaining system stability. The proposed solution leverages Claudio's existing architecture and follows established patterns for consistency and maintainability.

The implementation will significantly enhance user visibility into subagent execution and todo management, making Claudio a more powerful tool for managing complex Claude Code sessions with multiple concurrent agents.