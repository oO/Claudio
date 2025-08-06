# Component Organization Refactoring Plan

## Executive Summary

This document outlines a comprehensive refactoring plan to reorganize the React component structure in Claudio from its current mixed organization to a clean, entity-based architecture with clear separation of concerns.

## Current State Analysis

### Problems Identified
1. **Inconsistent Organization**: Components are scattered across root `/components`, `/ui`, `/widgets`, and `/tabs` folders
2. **No Clear Entity Grouping**: Related components for Projects, Sessions, Agents are mixed together
3. **Duplicate/Obsolete Files**: Multiple versions (`.optimized.tsx`, `.refactored.tsx`, `.cleaned.tsx`)
4. **Unclear Naming**: Mix of naming conventions and unclear component purposes
5. **Generic Components Mixed with Domain**: UI primitives mixed with business logic components

### Current Structure Overview
```
src/components/
├── *.tsx (62 files - mixed concerns)
├── claude-code-session/ (7 files)
├── tabs/ (7 files)
├── ui/ (20 files - primitives)
└── widgets/ (4 files - tool widgets)
```

## Proposed New Structure

### Core Principles
1. **Entity-Based Organization**: Group components by domain entity
2. **Clear Separation**: Separate domain components from generic UI
3. **Consistent Naming**: Follow clear naming conventions
4. **Single Responsibility**: Each folder has a clear purpose
5. **Scalability**: Structure supports future growth
6. **Flat Hierarchy**: Component structure doesn't imply entity relationships

### Folder Structure

```
src/components/
├── agents/                 # Agent-related components
│   ├── AgentCard.tsx
│   ├── AgentsList.tsx
│   ├── AgentsModal.tsx
│   ├── AgentsContent.tsx
│   ├── AgentsTab.tsx      # Agent-specific tab view
│   ├── CreateAgent.tsx
│   ├── AgentExecution.tsx
│   ├── AgentExecutionDemo.tsx
│   ├── AgentRunView.tsx
│   ├── AgentRunsList.tsx
│   ├── AgentRunOutputViewer.tsx
│   ├── GitHubAgentBrowser.tsx
│   └── index.ts
│
├── projects/              # Project-related components
│   ├── ProjectList.tsx
│   ├── ProjectCard.tsx
│   ├── ProjectSettings.tsx
│   ├── ProjectAgentsDropdown.tsx
│   ├── ProjectsTab.tsx    # Project-specific tab view
│   └── index.ts
│
├── sessions/              # Session-related components
│   ├── SessionList.tsx
│   ├── SessionCard.tsx
│   ├── SessionHeader.tsx
│   ├── ClaudeCodeSession.tsx
│   ├── RunningClaudeSessions.tsx
│   ├── ExecutionControlBar.tsx
│   ├── TimelineNavigator.tsx
│   ├── CheckpointSettings.tsx
│   ├── MessageList.tsx
│   ├── MessageItem.tsx
│   ├── FloatingPromptInput.tsx
│   ├── PromptQueue.tsx
│   └── index.ts
│
├── claude/                # Claude-specific components
│   ├── ClaudeMemoriesDropdown.tsx
│   ├── ClaudeFileEditor.tsx
│   ├── ClaudeVersionSelector.tsx
│   ├── ClaudeBinaryDialog.tsx
│   ├── ClaudeMdTab.tsx    # Claude.md tab view
│   └── index.ts
│
├── mcp/                   # MCP (Model Context Protocol) components
│   ├── MCPManager.tsx
│   ├── MCPServerList.tsx
│   ├── MCPAddServer.tsx
│   ├── MCPImportExport.tsx
│   ├── MCPTab.tsx         # MCP tab view
│   └── index.ts
│
├── settings/              # Settings-related components
│   ├── Settings.tsx
│   ├── SettingsTab.tsx    # Settings tab view
│   ├── HooksEditor.tsx
│   ├── AnalyticsConsent.tsx
│   └── index.ts
│
├── dashboard/             # Dashboard & monitoring
│   ├── UsageDashboard.tsx
│   ├── UsageChart.tsx
│   ├── UsageTab.tsx       # Dashboard tab view
│   └── index.ts
│
├── tools/                 # Tool execution & output widgets
│   ├── BashWidget.tsx
│   ├── LSWidget.tsx
│   ├── TodoWidget.tsx
│   ├── ToolWidgets.tsx
│   └── index.ts
│
├── common/                # Shared/common components
│   ├── ErrorBoundary.tsx
│   ├── AnalyticsErrorBoundary.tsx
│   ├── NFOCredits.tsx
│   ├── IconPicker.tsx
│   ├── ImagePreview.tsx
│   ├── FilePicker.tsx
│   ├── SlashCommandPicker.tsx
│   ├── Topbar.tsx         # Layout components
│   ├── TabManager.tsx
│   ├── TabContent.tsx
│   ├── TabPageLayout.tsx
│   ├── MarkdownEditor.tsx # Editor components
│   ├── ExampleEditor.tsx
│   ├── PreviewPromptDialog.tsx
│   └── index.ts
│
└── ui/                    # Pure UI primitives (unchanged)
    ├── button.tsx
    ├── card.tsx
    ├── dialog.tsx
    ├── input.tsx
    ├── select.tsx
    ├── textarea.tsx
    ├── toast.tsx
    ├── tooltip.tsx
    ├── badge.tsx
    ├── dropdown-menu.tsx
    ├── label.tsx
    ├── pagination.tsx
    ├── popover.tsx
    ├── radio-group.tsx
    ├── scroll-area.tsx
    ├── split-pane.tsx
    ├── switch.tsx
    ├── tabs.tsx
    └── index.ts
```

## Naming Conventions

### Component Files
- **PascalCase** for all component files: `ProjectCard.tsx`
- **Descriptive names**: Prefer `ProjectSettingsDialog.tsx` over `ProjSettings.tsx`
- **Entity prefix**: Components should be prefixed with their entity when ambiguous

### Folders
- **lowercase** for all folder names: `agents/`, `projects/`
- **Plural for entities**: `agents/` not `agent/`
- **Singular for concepts**: `layout/`, `editor/`

### Index Files
- Each folder should have an `index.ts` that exports public components
- Keep internal components unexported

### Component Types
- **Container**: Smart components with logic (e.g., `ProjectListContainer.tsx`)
- **View**: Presentation components (e.g., `ProjectCard.tsx`)
- **Modal/Dialog**: Overlay components (e.g., `CreateProjectDialog.tsx`)
- **Form**: Form components (e.g., `ProjectSettingsForm.tsx`)

## Migration Strategy

### Detailed Implementation Plan

**Phase 1: Preparation**
1. Create all new folder structures with index.ts files
2. Verify current build status (baseline)
3. Test that build still works after folder creation

**Phase 2: UI Primitives (No-Risk)**
1. Verify ui/ folder is already correctly structured
2. Update ui/index.ts to export all components
3. Test build

**Phase 3: Tools Entity (Low Risk - 4 components)**
1. Move widgets/ folder to tools/
2. Update tools/index.ts exports
3. Update imports to tools
4. Test build

**Phase 4: Projects Entity (5 components)**
1. Move ProjectList.tsx, ProjectSettings.tsx, ProjectAgentsDropdown.tsx
2. Move tabs/ProjectsTab.tsx to projects/
3. Update projects/index.ts
4. Update imports
5. Test build

**Phase 5: Sessions Entity (14 components)**
1. Move session-related components from root
2. Move claude-code-session/ contents to sessions/
3. Move message-related components flat to sessions/
4. Update sessions/index.ts
5. Update imports
6. Test build

**Phase 6: Agents Entity (12 components)**
1. Move all Agent* components to agents/
2. Move CCAgents.tsx, CreateAgent.tsx, GitHubAgentBrowser.tsx
3. Move tabs/AgentsTab.tsx to agents/
4. Update agents/index.ts
5. Update imports
6. Test build

**Phase 7: Claude Entity (5 components)**
1. Move Claude* components to claude/
2. Move tabs/ClaudeMdTab.tsx to claude/
3. Update claude/index.ts
4. Update imports
5. Test build

**Phase 8: MCP Entity (5 components)**
1. Move MCP* components to mcp/
2. Move tabs/MCPTab.tsx to mcp/
3. Update mcp/index.ts
4. Update imports
5. Test build

**Phase 9: Settings Entity (4 components)**
1. Move Settings.tsx, HooksEditor.tsx, AnalyticsConsent.tsx
2. Move tabs/SettingsTab.tsx to settings/
3. Update settings/index.ts
4. Update imports
5. Test build

**Phase 10: Dashboard Entity (3 components)**
1. Move UsageDashboard.tsx to dashboard/
2. Move tabs/UsageTab.tsx to dashboard/
3. Update dashboard/index.ts
4. Update imports
5. Test build

**Phase 11: Common Components (14 components)**
1. Move layout components (Topbar, TabManager, TabContent, TabPageLayout)
2. Move editor components (MarkdownEditor, ExampleEditor, PreviewPromptDialog)
3. Move utility components (ErrorBoundary, FilePicker, IconPicker, etc.)
4. Update common/index.ts
5. Update imports
6. Test build

**Phase 12: Import Updates & Testing**
1. Search for any remaining old import paths
2. Update all missed imports
3. Full build test
4. Runtime test of key functionality

**Phase 13: Cleanup**
1. Remove old empty folders
2. Remove duplicate/obsolete files (.optimized, .refactored, .cleaned)
3. Final build test

## Import Path Strategy

### Before
```typescript
import { ProjectList } from '@/components/ProjectList';
import { Button } from '@/components/ui/button';
import { BashWidget } from '@/components/widgets/BashWidget';
```

### After
```typescript
import { ProjectList } from '@/components/projects';
import { Button } from '@/components/ui';
import { BashWidget } from '@/components/tools';
```

## Benefits of New Structure

1. **Improved Maintainability**: Clear separation of concerns
2. **Better Discoverability**: Easy to find related components
3. **Reduced Coupling**: Entity isolation promotes modularity
4. **Scalability**: Clear patterns for adding new features
5. **Team Collaboration**: Clear ownership boundaries
6. **Testing**: Easier to test entity-specific logic
7. **Code Reuse**: Common components clearly identified

## Risk Mitigation

1. **Import Updates**: Use TypeScript compiler to catch all import errors
2. **Git History**: Preserve history with `git mv` commands
3. **Gradual Migration**: Move one entity at a time
4. **Testing**: Run full test suite after each migration phase
5. **Rollback Plan**: Tag current state before migration

## Success Metrics

- [ ] All components organized by entity
- [ ] No duplicate/obsolete files
- [ ] All imports updated and working
- [ ] Tests passing
- [ ] Build successful
- [ ] No runtime errors
- [ ] Improved build times (fewer circular dependencies)

## Next Steps

1. **Review & Approval**: Team review of this plan
2. **Create Migration Branch**: `feature/component-refactoring`
3. **Execute Phase 1**: Set up folder structure
4. **Begin Entity Migration**: Start with Projects
5. **Continuous Testing**: Test after each migration
6. **Documentation Update**: Update component documentation

## Design Rationale: Key Decisions

### Decision 1: Tab Components in Entity Folders
**Choice**: Each entity owns its tab view component (e.g., `AgentsTab.tsx` in `agents/`)

**Pros**:
- **Cohesion**: All entity-related code in one place
- **Ownership**: Clear responsibility boundaries
- **Discoverability**: Looking for agent components? Check agents/
- **Refactoring**: Moving an entity is simpler (one folder)

**Cons**:
- Tab views share common patterns (could argue for grouping)
- TabManager needs to import from multiple folders

**Alternative Considered**: Keeping all tabs in `common/tabs/`
- Would separate view from logic
- But creates artificial distance between related components

### Decision 2: Messages at Session Level (Not Nested)
**Choice**: Message components are flat in `sessions/` folder

**Pros**:
- **No False Hierarchy**: Doesn't imply projects→sessions→messages ownership
- **Flexibility**: Messages could theoretically be used elsewhere
- **Simpler Imports**: Avoid deep nesting like `sessions/messages/MessageList`
- **Flat is Better**: Follows Python's Zen - "Flat is better than nested"

**Cons**:
- Less visual grouping in file explorer
- More files in sessions/ folder

### Decision 3: Tools as Separate Entity
**Choice**: Tool widgets get their own `tools/` folder, not nested in `common/`

**Pros**:
- **Clear Purpose**: Tools are about execution & output rendering
- **Domain Specific**: Widgets handle specific tool outputs (bash, ls, todo)
- **Future Growth**: Could expand with more tool integrations
- **Better Semantics**: Tools ≠ common UI components

**Cons**:
- One more top-level folder
- Small number of components (4 currently)

**Alternative Considered**: Keep widgets in `common/widgets/`
- Would mix domain-specific with truly generic components
- Tools have specialized behavior, not generic reusability

### Decision 4: Layout/Editor in Common (Not Separate Folders)
**Choice**: Layout and editor components live directly in `common/`

**Pros**:
- **Simplicity**: Fewer top-level folders
- **Clear Purpose**: Common = shared across entities
- **Avoid Over-Organization**: 3-4 components don't need own folder
- **Easy Refactoring**: If they grow, can split later

**Cons**:
- `common/` folder has more files
- Less categorical organization

**Alternative Considered**: Separate `layout/` and `editor/` folders
- Would create too many top-level folders for current scale

## Appendix: Component Inventory

### Entity Mapping

**Projects (5 components)**
- ProjectList.tsx
- ProjectSettings.tsx
- ProjectAgentsDropdown.tsx
- ProjectsTab.tsx ← Tab view stays with entity

**Sessions (14 components)**
- SessionList.tsx
- ClaudeCodeSession.tsx
- RunningClaudeSessions.tsx
- ExecutionControlBar.tsx
- TimelineNavigator.tsx
- CheckpointSettings.tsx
- SessionHeader.tsx
- MessageList.tsx ← At session level, not nested
- MessageItem.tsx ← At session level, not nested
- FloatingPromptInput.tsx ← At session level, not nested
- PromptQueue.tsx ← At session level, not nested

**Agents (12 components)**
- AgentCard.tsx
- AgentsList.tsx
- AgentsModal.tsx
- AgentsContent.tsx
- AgentsTab.tsx ← Tab view stays with entity
- CreateAgent.tsx
- AgentExecution.tsx
- AgentExecutionDemo.tsx
- AgentRunView.tsx
- AgentRunsList.tsx
- AgentRunOutputViewer.tsx
- GitHubAgentBrowser.tsx

**Claude (5 components)**
- ClaudeMemoriesDropdown.tsx
- ClaudeFileEditor.tsx
- ClaudeVersionSelector.tsx
- ClaudeBinaryDialog.tsx
- ClaudeMdTab.tsx ← Tab view stays with entity

**MCP (5 components)**
- MCPManager.tsx
- MCPServerList.tsx
- MCPAddServer.tsx
- MCPImportExport.tsx
- MCPTab.tsx ← Tab view stays with entity

**Settings (4 components)**
- Settings.tsx
- SettingsTab.tsx ← Tab view stays with entity
- HooksEditor.tsx
- AnalyticsConsent.tsx

**Dashboard (3 components)**
- UsageDashboard.tsx
- UsageChart.tsx
- UsageTab.tsx ← Tab view stays with entity

**Tools (4 components)**
- BashWidget.tsx
- LSWidget.tsx
- TodoWidget.tsx
- ToolWidgets.tsx

**Common (14 components)**
- ErrorBoundary.tsx
- AnalyticsErrorBoundary.tsx
- NFOCredits.tsx
- IconPicker.tsx
- ImagePreview.tsx
- FilePicker.tsx
- SlashCommandPicker.tsx
- Topbar.tsx ← Layout components
- TabManager.tsx ← Layout components
- TabContent.tsx ← Layout components
- TabPageLayout.tsx ← Layout components
- MarkdownEditor.tsx ← Editor components
- ExampleEditor.tsx ← Editor components
- PreviewPromptDialog.tsx ← Editor components

**UI Primitives (20 components)**
- All existing ui/ components (unchanged)

Total: 96 components (matching current count)

---

*Document Version: 1.0*  
*Date: August 2025*  
*Author: Claude Sonnet with oO*