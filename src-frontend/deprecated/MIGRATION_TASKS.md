# Legacy Session System Migration Tasks

This folder contains deprecated session system components and hooks that were replaced by the modern `SessionHandleView`/`SessionHandle` streaming architecture.

## Files Moved to Deprecated

### Core Files
- `useSessionState.ts` - Legacy session state management hook
- `ClaudeCodeSession.tsx` - Legacy main session component
- `SessionMessageHandler.tsx` - Legacy message handling component

## Migration Status: Phase 1 Complete ✅

### ✅ **Already Migrated to New System:**
1. **Message Processing Pipeline**
   - Message filtering (meta, sidechain, empty messages)
   - Command bundling (commands + stdout output)
   - Tool result filtering (widgets hide tool results)
   - Message renumbering for display
   - Contributing UUIDs tracking

2. **Subagent Attribution** 
   - Fixed via `messageProcessor.ts`
   - Properly detects Task tool calls
   - Maps `isSidechain: true` messages to subagent types
   - Adds `agentType`, `agentName`, `subagentType` properties

3. **Basic Session Features**
   - Real-time streaming messages
   - Session state management
   - Token calculation
   - Project path handling

## Migration Tasks for Future Implementation

### ✅ **Intentionally Removed**

#### Chat Tab Functionality
**Status**: Removed - functionality replaced by "Start New Session" button
**Location**: Moved to `/deprecated/ChatTabWrapper.tsx`
**Rationale**: Redundant with Projects tab "Start New Session" button
**Impact**: Users should use Projects tab to create new sessions

### 🔥 **High Priority - Missing Core Features**

#### 1. Session Metrics & Analytics
**Location in old code**: `useSessionState.ts` lines 388-453
```typescript
// Track tool execution, file operations, errors
sessionMetrics.current.toolsExecuted += 1;
sessionMetrics.current.filesCreated += 1;
sessionMetrics.current.errorsEncountered += 1;

// Analytics integration
trackEvent.enhancedError({ ... });
workflowTracking.trackStep(toolUse.name);
```
**Action needed**: Port to `SessionHandleView.tsx`

#### 2. Error Tracking & Reporting
**Location**: `useSessionState.ts` lines 416-431
- Tool execution failures
- System error tracking
- Enhanced error reporting to analytics
**Action needed**: Implement in message processing pipeline

### 📋 **Medium Priority - UI Features**

#### 3. Timeline Feature
**Current status**: Placeholder exists (`onToggleTimeline={() => logger.info('Toggle timeline (not implemented yet)')}`)
**Location in old code**: `useSessionState.ts` timeline state management
**Decision needed**: Implement or remove entirely?

#### 4. Preview Pane System
**Location**: `useSessionState.ts` lines 44-48
```typescript
const [showPreview, setShowPreview] = useState(false);
const [previewUrl, setPreviewUrl] = useState("");
const [splitPosition, setSplitPosition] = useState(50);
```
**Decision needed**: Was this feature used? Implement or remove?

#### 5. Fork & Checkpoint Management  
**Location**: `useSessionState.ts` lines 51-53
```typescript
const [showForkDialog, setShowForkDialog] = useState(false);
const [forkCheckpointId, setForkCheckpointId] = useState<string | null>(null);
```
**Decision needed**: Core feature or can be removed?

### ⚡ **Lower Priority - Nice to Have**

#### 6. Queued Prompts System
**Location**: `useSessionState.ts` lines 56-58
```typescript
const [queuedPrompts, setQueuedPrompts] = useState<QueuedPrompt[]>([]);
export interface QueuedPrompt {
  id: string;
  prompt: string;
  model: "sonnet" | "opus";
}
```
**Decision needed**: Is this still needed in new architecture?

#### 7. Enhanced Session State Tracking
**Location**: `useSessionState.ts` lines 68-83
```typescript
sessionMetrics.current = {
  checkpointCount: 0,
  wasResumed: !!session,
  modelChanges: [] as Array<{ from: string; to: string; timestamp: number }>,
  // ... more metrics
};
```

## Implementation Guidelines

### For Session Metrics (High Priority)
1. Create `useSessionMetrics.ts` hook
2. Integrate with existing analytics system
3. Track same metrics as old system:
   - Tool execution counts
   - File operation counts  
   - Error frequencies
   - Code generation metrics

### For UI Features (Medium Priority)
1. **Research First**: Check if features are actually used
2. **User Feedback**: Ask users about timeline/preview/fork features
3. **Progressive Enhancement**: Implement one feature at a time
4. **Modern Patterns**: Use newer React patterns (not legacy class-based approach)

### Code Organization
- Keep new implementations in main components folder
- Use modern React hooks and patterns
- Follow existing `SessionHandleView.tsx` architecture
- Maintain KISS+DRY principles

## Decision Points Needed

1. **Timeline Feature**: Implement, redesign, or remove?
2. **Preview Pane**: Was this actively used? Worth porting?
3. **Fork/Checkpoint**: Core feature or legacy cruft?
4. **Queued Prompts**: Needed in streaming architecture?

## Testing Strategy

When implementing migration tasks:
1. Test with existing session files (especially subagent sessions)
2. Verify analytics data flows correctly
3. Ensure no performance regressions
4. Test both new and resumed sessions

## Success Criteria

Migration complete when:
- [ ] All analytics/metrics are tracked properly
- [ ] No loss of functionality users depend on  
- [ ] Performance equals or exceeds old system
- [ ] All legacy files can be safely deleted

---

**Last Updated**: August 2025  
**Status**: Phase 1 (Core functionality) complete, Phase 2 (Features) pending decisions