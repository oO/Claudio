# TODO Integration UI Specification

## Overview

This specification defines the UI implementation for integrating Claude Code's TODO files into the Claudio application. The backend infrastructure is complete - this document focuses on frontend implementation requirements.

## Context & Background

Claude Code creates TODO files when using the TodoWrite tool during sessions:
- **File Location**: `~/.claude/todos/{session_id}-agent-{agent_id}.json`
- **File Format**: JSON array of todo objects with `content`, `status`, `activeForm` fields
- **Status Values**: `"pending"`, `"in_progress"`, `"completed"`
- **Real-time**: Files are created/updated dynamically as agents work

### Problem Solved
Previously, TODO files existed but weren't surfaced in the Claudio UI. Users had no visibility into agent task progress during sessions.

### Backend Infrastructure (✅ Complete)
- Fixed critical orphan cleanup bugs preventing data loss
- File watcher monitoring `~/.claude/todos/` directory  
- Real-time events: `TodoCreated`, `TodoModified`, `TodoRemoved`
- API endpoint: `get_session_todos(session_id)` returning structured data
- Agent-specific grouping with aggregated counts

---

## API Reference

### Backend Endpoints

#### `get_session_todos(session_id: string)`
**Returns**: Structured todo data for a session
```typescript
{
  session_id: string;
  agent_todos: Array<{
    agent_id: string;
    file_path: string;
    todos: Array<{
      content: string;
      status: "pending" | "in_progress" | "completed";
      activeForm: string;
    }>;
    counts: {
      open: number;      // pending + in_progress
      completed: number;
      total: number;
    };
  }>;
  total_counts: {
    open: number;
    completed: number; 
    total: number;
  };
  agent_count: number;
}
```

### Real-time Events

#### `TodoCreated` / `TodoModified` / `TodoRemoved`
**Event Structure**:
```typescript
{
  type: "TodoCreated" | "TodoModified" | "TodoRemoved";
  data: {
    session_id: string;
    agent_id: string;
    file_path: string;
    todo_counts?: TodoCounts;  // not present in TodoRemoved
    created_at?: number;       // TodoCreated only
    modified_at?: number;      // TodoModified only  
  };
}
```

---

## UI Component Requirements

### 1. Session List Integration

**Location**: Session cards in project view
**Requirement**: Add todo indicators to show when sessions have active todos

**Visual Design**:
- Small badge showing open todo count (e.g., "3 tasks")
- Different colors for status: 
  - Blue: has pending todos
  - Orange: has in-progress todos  
  - Green: all todos completed
  - Gray: no todos
- Badge only appears if `total_counts.total > 0`

**Implementation**:
```typescript
// Add to session card component
const { data: todoData } = useTodoData(session.id);
const hasActiveTodos = todoData?.total_counts.open > 0;
const hasCompletedTodos = todoData?.total_counts.completed > 0;
```

### 2. SessionTodoPanel Component

**Location**: New collapsible section in `SessionHandleView` 
**Purpose**: Display todos for active session with real-time updates

**Layout Structure**:
```
┌─────────────────────────────────────────────┐
│ 📝 Session Tasks (3 open, 2 completed) ▼   │
├─────────────────────────────────────────────┤
│ 🤖 Agent: general-purpose                   │
│   ⭕ Fix critical bug                       │
│   🔄 Add API endpoint (in progress)        │
│   ✅ Test compilation                       │
│                                             │
│ 🤖 Agent: react-ui-engineer               │ 
│   ⭕ Create todo panel component           │
│   ⭕ Style todo indicators                  │
└─────────────────────────────────────────────┘
```

**Features**:
- Collapsible with open/close state persistence
- Real-time updates via event subscription
- Agent grouping with agent type display
- Status icons: ⭕ pending, 🔄 in-progress, ✅ completed
- Empty state when no todos exist
- Loading state during initial fetch

**Component Props**:
```typescript
interface SessionTodoPanelProps {
  sessionId: string;
  isCollapsed?: boolean;
  onToggleCollapsed?: (collapsed: boolean) => void;
}
```

### 3. TasksWidget Enhancement

**Current State**: Exists for TodoWrite tool calls in messages
**Enhancement**: Reuse for persistent session todos display

**Modifications**:
- Accept optional `agentId` prop for agent identification
- Add timestamp display for when todos were last updated
- Support read-only mode (no interaction, just display)

---

## User Experience Flows

### Flow 1: New Session with Todos
1. User starts new session
2. Agent uses TodoWrite tool → todo file created
3. `TodoCreated` event fired → UI updates in real-time
4. Session card shows todo badge: "3 tasks"
5. SessionHandleView shows expanded todo panel
6. User sees live task progress as agent works

### Flow 2: Resuming Session with Existing Todos  
1. User resumes session from session list
2. UI fetches existing todos via `get_session_todos()`
3. SessionHandleView loads with todo panel populated
4. Real-time updates continue as session progresses

### Flow 3: Multiple Agents in Session
1. Primary agent creates initial todos
2. Sub-agent spawned → creates additional todos  
3. UI groups todos by agent in todo panel
4. Aggregate counts shown in session card badge
5. User can see which agent is working on what

### Flow 4: Session Completion
1. Agent marks all todos as completed
2. `TodoModified` events update UI
3. Session card badge turns green: "5 completed"  
4. Todo panel shows all tasks with checkmarks
5. Panel auto-collapses after brief delay

---

## Implementation Guidelines

### State Management
```typescript
// Custom hook for todo data with real-time updates
function useTodoData(sessionId: string) {
  const [todoData, setTodoData] = useState<TodoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    fetchSessionTodos(sessionId).then(setTodoData);
    
    // Subscribe to real-time events
    const unsubscribe = subscribeTodoEvents(sessionId, (event) => {
      // Update local state based on event type
      handleTodoEvent(event, setTodoData);
    });

    return unsubscribe;
  }, [sessionId]);

  return { data: todoData, loading };
}
```

### Event Handling
```typescript
function handleTodoEvent(
  event: TodoEvent, 
  updateTodos: (updater: (prev: TodoData) => TodoData) => void
) {
  switch (event.type) {
    case 'TodoCreated':
    case 'TodoModified':
      // Refetch or update specific agent's todos
      updateTodos(prev => updateAgentTodos(prev, event.data));
      break;
    case 'TodoRemoved': 
      // Remove agent's todos
      updateTodos(prev => removeAgentTodos(prev, event.data.agent_id));
      break;
  }
}
```

### Performance Considerations
- Cache todo data per session to avoid refetching
- Debounce rapid todo updates (agent making many quick changes)
- Only subscribe to events for visible/active sessions
- Lazy load todo panel content until expanded

### Accessibility
- Screen reader support for todo status changes
- Keyboard navigation within todo panel
- Proper ARIA labels for status icons and counts
- Focus management when panel expands/collapses

---

## Testing Requirements

### Unit Tests
- `useTodoData` hook with mock events
- Todo event handling logic
- Todo data transformation functions
- SessionTodoPanel component rendering

### Integration Tests  
- Real-time event subscription/unsubscription
- API endpoint integration 
- Session list todo indicators
- Panel expand/collapse behavior

### Manual Testing Scenarios
1. Start session, verify todos appear in real-time
2. Resume session, verify existing todos load
3. Multiple agents in session, verify grouping
4. Network disconnect/reconnect, verify state sync
5. Large number of todos, verify performance

---

## Future Enhancements (Not in Scope)

- Todo editing/interaction (currently read-only)
- Todo filtering by status or agent
- Todo export to markdown/text
- Todo history/timeline view
- Todo search across sessions
- Todo notifications/alerts

---

## Files to Create/Modify

### New Components
- `src-frontend/components/sessions/SessionTodoPanel.tsx`
- `src-frontend/components/sessions/TodoIndicator.tsx` 
- `src-frontend/hooks/useTodoData.ts`

### Existing Components to Modify
- `src-frontend/components/sessions/SessionHandleView.tsx` (add todo panel)
- `src-frontend/components/sessions/SessionCard.tsx` (add todo indicator)
- `src-frontend/components/tools/TasksWidget.tsx` (enhance for session todos)

### API Integration
- `src-frontend/lib/api.ts` (add todo endpoints)
- `src-frontend/lib/TauriEventManager.ts` (add todo event types)

---

*Last Updated: September 2024*
*Backend Status: ✅ Complete*
*UI Status: 📋 Pending Implementation*