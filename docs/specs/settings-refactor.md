# Settings Architecture Refactor

## Executive Summary

### Problem Statement
The current settings management in Claudio suffers from several architectural issues:

- **Fragmented State**: Settings are fetched ad-hoc by components without a central source of truth
- **Manual Save UX**: Users must explicitly save settings, which is outdated and error-prone
- **Naming Confusion**: "Claude" vs "Claudio" naming causes developer confusion
- **No Multi-Project Support**: Settings system doesn't handle multiple project tabs efficiently
- **Hardcoded Paths**: File paths are scattered as strings throughout the codebase
- **Inconsistent Patterns**: Settings management doesn't follow the proven session management patterns

### Solution Overview
Complete refactor to create a unified, modern settings architecture that:

1. **Unified Orchestration**: Single source of truth for both ClaudioSettings (app) and ClaudeCodeSettings (CLI)
2. **Multi-Project Support**: Handle multiple project tabs with efficient ref-counted watchers
3. **Auto-Save UX**: Modern interface with instant persistence and optimistic updates
4. **Clear Naming**: Distinct ClaudioSettings vs ClaudeCodeSettings to eliminate confusion
5. **Path Constants**: All file paths centralized in constants modules
6. **Convergent Architecture**: Follow the same proven patterns as session management

### Expected Outcomes
- **90% Code Reduction**: Eliminate redundant settings management code
- **Zero Save Buttons**: Modern auto-save UX throughout the application
- **Sub-50ms Performance**: Settings load and update in under 50ms
- **Multi-Project Efficiency**: Support unlimited project tabs without performance degradation
- **Developer Clarity**: Clear separation between app and CLI settings

## Architecture Design

### System Overview

```
┌─────────────────────────────────────────────────┐
│                Frontend (React)                  │
├─────────────────────────────────────────────────┤
│  MultiProjectProvider                           │
│  ├── ClaudioSettingsProvider    (app settings)  │
│  └── ClaudeCodeSettingsProvider (CLI settings)  │
│              │                                  │
│  useClaudioSettings()    useClaudeCodeSettings()│
│              │                                  │
│  Auto-save Components (no save buttons)        │
└─────────────────────────────────────────────────┘
                    ↕ Handle-based Events
┌─────────────────────────────────────────────────┐
│                Backend (Rust)                    │
├─────────────────────────────────────────────────┤
│  MultiProjectOrchestrator                       │
│  ├── ClaudioSettingsManager     (single file)   │
│  └── ClaudeCodeSettingsManager  (multi-level)   │
│              │                                  │
│  Coordinated File Watchers + Ref Counting      │
└─────────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────────┐
│                File System                       │
├─────────────────────────────────────────────────┤
│  ~/.claudio/settings.json       (app settings)  │
│  ~/.claude/settings.json        (CLI global)    │
│  <project>/.claude/settings.json     (CLI proj) │
│  <project>/.claude/settings.local.json (CLI loc)│
└─────────────────────────────────────────────────┘
```

### Multi-Project Architecture

**Parallel Project Support:**
- User can have tabs for ProjectA, ProjectB, ProjectC simultaneously
- Each project maintains its own ClaudeCodeSettings context
- Watchers are ref-counted: start on first tab, stop when last tab closes
- ClaudioSettings are global and shared across all tabs

**Example Scenario:**
```
Tab 1: /Users/me/project-alpha
  - ClaudeCodeSettings: model="opus" (from project settings)
  - 2 active sessions
  - Custom permissions

Tab 2: /Users/me/project-beta
  - ClaudeCodeSettings: model="sonnet" (from global settings)
  - 1 active session
  - Default permissions

Tab 3: /Users/me/project-alpha (same project as Tab 1)
  - Shares the same ClaudeCodeSettings instance
  - Ref count = 2 for project-alpha watchers
  - Ref count = 1 for project-beta watchers
```

### Handle-Based Subscription Model

Following the exact same pattern as session management:

```rust
// Project subscription creates handles
let handle_id = "settings-{uuid}"

// Handles track which project + what type of settings
struct ProjectHandle {
    handle_id: String,
    project_path: Option<String>,
    settings_type: SettingsType, // Claudio | ClaudeCode
}

// Events are routed to specific handles
emit_event("settings-stream-{handle_id}", settings_update)
```

## Critical Architecture Principle: SEPARATION OF CONCERNS

⚠️ **NEVER MERGE SESSION AND SETTINGS ORCHESTRATION** ⚠️

The session management system (`SessionOrchestrator`) is a mature, working system that handles complex session lifecycle, streaming, and state management. It MUST remain completely separate from settings management.

**Key Learnings from Failed Integration Attempt:**
1. **Session Structure is Sacred**: The `SessionState` with direct `session_type` field works perfectly - never change it
2. **Two Separate Systems**: `SessionOrchestrator` (handles sessions) + `SettingsOrchestrator` (handles settings)
3. **No Unified Orchestrator**: MultiProjectOrchestrator coordinates both, but doesn't merge their data structures
4. **Frontend Separation**: `useSessionHandle` and `useSettingsHandle` remain completely independent
5. **Backend Isolation**: Session commands and Settings commands never share data structures

**Additional Critical Rules:**
6. **Never Touch Working Code**: If session handling works 100%, don't refactor it "for consistency"
7. **Test Before Merge**: Any data structure change must be tested across ALL consumers
8. **Revert Fast**: When you break working functionality, git restore immediately
9. **Separate Concerns**: Settings management has nothing to do with session lifecycle
10. **Follow Working Patterns**: Copy the SessionOrchestrator pattern exactly for SettingsOrchestrator

**Correct Architecture:**
```
MultiProjectOrchestrator {
  session_orchestrator: SessionOrchestrator,    // Existing, untouched
  settings_orchestrator: SettingsOrchestrator,  // New, separate
}
```

**Wrong Architecture (What Broke Everything):**
```
UnifiedOrchestrator {
  handle_type: HandleType::Session | HandleType::Settings  // ❌ NEVER DO THIS
}
```

## Development Workflow (MANDATORY)

**Phase 1: Design Validation**
1. ✅ Read this spec completely
2. ✅ Confirm you understand "NEVER MERGE" principle
3. ✅ Design SettingsOrchestrator as separate system
4. ✅ Get explicit approval before ANY session code changes

**Phase 2: Implementation (Settings Only)**
1. ✅ Create SettingsOrchestrator following SessionOrchestrator pattern EXACTLY
2. ✅ Implement settings-specific commands (separate from session commands)
3. ✅ Create `useSettingsHandle` hook (separate from `useSessionHandle`)
4. ✅ Test settings system in isolation

**Phase 3: Integration (Coordination Only)**
1. ✅ Create MultiProjectCoordinator that holds BOTH orchestrators
2. ✅ Update main.rs to initialize BOTH systems
3. ✅ Route commands to appropriate orchestrator
4. ✅ NEVER change existing session command signatures

**Phase 4: Validation**
1. ✅ Verify ALL existing session functionality still works 100%
2. ✅ Test settings functionality independently
3. ✅ Confirm no regression in session handling
4. ✅ Build passes, no TypeScript errors

**Red Flags (STOP IMMEDIATELY):**
- ❌ Changing `SessionState` structure
- ❌ Modifying `useSessionHandle` for settings
- ❌ Adding settings fields to session types
- ❌ Unified handle types or orchestrators
- ❌ Session functionality regressions

## System Components

### 1. ClaudioSettings (App-Level Settings)

**Purpose**: Application-specific preferences and configuration
**File**: `~/.claudio/settings.json` (single level)
**Examples**: theme, telemetry, auto-update preferences, window state

```rust
#[derive(Serialize, Deserialize)]
pub struct ClaudioSettings {
    pub theme: Option<String>,           // "light", "dark", "system"
    pub telemetry: Option<bool>,         // Analytics opt-out
    pub auto_update: Option<bool>,       // Auto update Claudio
    pub default_project_path: Option<String>,
    pub window_state: Option<WindowState>,
    pub debug_mode: Option<bool>,
}
```

**Management**:
- Single file watcher
- Global state (not project-specific)
- Auto-save on change
- Simple cache (no precedence logic)

### 2. ClaudeCodeSettings (CLI Configuration)

**Purpose**: Claude Code CLI settings with multi-level precedence
**Files**: Multiple levels with precedence (ENV > local > project > global)
**Examples**: model selection, permissions, hooks

```rust
#[derive(Serialize, Deserialize)]
pub struct ClaudeCodeSettings {
    pub effective: ClaudeCodeConfig,    // Computed final settings
    pub layers: ClaudeCodeLayers,       // Individual layer values
    pub last_computed: SystemTime,      // Cache timestamp
}

#[derive(Serialize, Deserialize)]
pub struct ClaudeCodeConfig {
    pub model: Option<String>,          // "auto", "default", "opus", "sonnet", "opusplan"
    pub permissions: Option<Permissions>,
    pub hooks: Option<HookConfig>,
    pub system_prompt: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ClaudeCodeLayers {
    pub env: Option<ClaudeCodeConfig>,     // ANTHROPIC_MODEL, etc.
    pub local: Option<ClaudeCodeConfig>,   // .claude/settings.local.json
    pub project: Option<ClaudeCodeConfig>, // .claude/settings.json
    pub global: Option<ClaudeCodeConfig>,  // ~/.claude/settings.json
}
```

**Precedence Logic**:
1. **Environment Variables** (highest priority)
   - `ANTHROPIC_MODEL=opus`
   - `ANTHROPIC_API_KEY=...`

2. **Local Project Settings**
   - `<project>/.claude/settings.local.json`
   - Git-ignored, developer-specific

3. **Shared Project Settings**
   - `<project>/.claude/settings.json`
   - Git-tracked, team settings

4. **Global User Settings** (lowest priority)
   - `~/.claude/settings.json`
   - User defaults

### 3. Path Constants System

**No Hardcoded Strings Policy**: All file paths must use constants

```rust
// src-backend/src/paths.rs
pub mod paths {
    // Claudio app paths
    pub const CLAUDIO_DIR_NAME: &str = ".claudio";
    pub const CLAUDIO_SETTINGS_FILE: &str = "settings.json";

    pub fn claudio_settings_path() -> Result<PathBuf> {
        dirs::home_dir()
            .ok_or("No home directory")?
            .join(CLAUDIO_DIR_NAME)
            .join(CLAUDIO_SETTINGS_FILE)
    }

    // Claude Code CLI paths
    pub const CLAUDE_DIR_NAME: &str = ".claude";
    pub const CLAUDE_SETTINGS_FILE: &str = "settings.json";
    pub const CLAUDE_SETTINGS_LOCAL_FILE: &str = "settings.local.json";

    pub fn claude_project_settings_path(project_path: &Path) -> PathBuf {
        project_path.join(CLAUDE_DIR_NAME).join(CLAUDE_SETTINGS_FILE)
    }

    pub fn claude_project_settings_local_path(project_path: &Path) -> PathBuf {
        project_path.join(CLAUDE_DIR_NAME).join(CLAUDE_SETTINGS_LOCAL_FILE)
    }
}
```

```typescript
// src-frontend/lib/paths.ts
export const PATHS = {
    CLAUDIO: {
        DIR_NAME: '.claudio',
        SETTINGS_FILE: 'settings.json',
    },
    CLAUDE_CODE: {
        DIR_NAME: '.claude',
        SETTINGS_FILE: 'settings.json',
        SETTINGS_LOCAL_FILE: 'settings.local.json',
    }
} as const;
```

### 4. Frontend Hook Architecture

**Settings Handle System** (separate from session handles):

```typescript
// src-frontend/hooks/useSettingsHandle.ts
export const useSettingsHandle = (
  settingsType: 'ClaudioSettings' | 'ClaudeCodeSettings',
  projectPath?: string
) => {
  // Similar to useSessionHandle but for settings only
  // Returns: settingsHandle, settingsState, updateSetting, etc.
};
```

**Legacy Type Compatibility**:

```typescript
// src-frontend/hooks/legacySettingsTypes.ts
// Maintains compatibility with old settings structure
// During migration period only - delete after full migration
export interface LegacyClaudeSettings {
  // Old structure for backward compatibility
}

export const convertLegacySettings = (legacy: LegacyClaudeSettings): ClaudeCodeSettings => {
  // Convert old format to new multi-level format
};
```

**Settings Library Structure**:

```typescript
// src-frontend/lib/settings/
├── index.ts              // Main exports
├── claudioSettings.ts    // App-level settings logic
├── claudeCodeSettings.ts // CLI settings with precedence
├── validation.ts         // Settings validation
└── migration.ts          // Legacy migration helpers
```

## Implementation Details

### Backend Orchestrator

```rust
// src-backend/src/commands/settings/orchestrator.rs
pub struct SettingsOrchestrator {
    // SEPARATE from SessionOrchestrator - never merge!

    // Multiple projects can be active simultaneously
    active_projects: HashMap<String, SettingsProjectContext>,

    // Settings-specific managers (NOT session managers)
    claudio_manager: ClaudioSettingsManager,
    claudecode_manager: ClaudeCodeSettingsManager,

    // Settings-specific watchers
    watcher_coordinator: SettingsWatcherCoordinator,
}

// Coordination layer (NOT a unified system)
pub struct MultiProjectCoordinator {
    // Keep existing systems separate
    session_orchestrator: Arc<SessionOrchestrator>,  // DON'T TOUCH THIS
    settings_orchestrator: Arc<SettingsOrchestrator>, // NEW SEPARATE SYSTEM
}

impl SettingsOrchestrator {
    // Create subscription handle for project
    #[tauri::command]
    pub async fn create_project_handle(
        project_path: Option<String>
    ) -> Result<String, String> {
        let handle_id = format!("project-{}", Uuid::new_v4());

        // Start watchers if first subscriber to this project
        if let Some(path) = &project_path {
            self.watcher_coordinator
                .start_project_watchers_if_needed(path)
                .await?;
        }

        // Create handle
        let handle = ProjectHandle {
            handle_id: handle_id.clone(),
            project_path,
            created_at: Instant::now(),
        };

        self.active_handles.insert(handle_id.clone(), handle);
        Ok(handle_id)
    }

    // Update setting with auto-save
    #[tauri::command]
    pub async fn update_setting(
        handle_id: String,
        key: String,
        value: serde_json::Value,
        settings_type: SettingsType, // Claudio | ClaudeCode
        level: Option<SettingsLevel>, // For ClaudeCode only
    ) -> Result<(), String> {
        match settings_type {
            SettingsType::Claudio => {
                self.claudio_manager.update_setting(key, value).await?;
            },
            SettingsType::ClaudeCode => {
                let handle = self.active_handles.get(&handle_id)
                    .ok_or("Handle not found")?;

                self.claudecode_manager.update_project_setting(
                    handle.project_path.as_deref(),
                    key,
                    value,
                    level.unwrap_or(SettingsLevel::Project)
                ).await?;
            }
        }

        Ok(())
    }
}
```

### Frontend Context Architecture

```tsx
// src-frontend/contexts/MultiProjectContext.tsx
interface MultiProjectState {
  // Claudio app settings (global)
  claudioSettings: ClaudioSettings | null;
  updateClaudioSetting: (key: string, value: any) => Promise<void>;

  // ClaudeCode settings per project
  projects: Map<string, ClaudeCodeSettings>;
  updateClaudeCodeSetting: (
    projectPath: string,
    key: string,
    value: any,
    level?: 'local' | 'project' | 'global'
  ) => Promise<void>;

  // Project management
  subscribeToProject: (projectPath: string, tabId: string) => Promise<void>;
  unsubscribeFromProject: (tabId: string) => Promise<void>;
}

export function MultiProjectProvider({ children }) {
  const [state, setState] = useState<MultiProjectState>();
  const [handles, setHandles] = useState<Map<string, string>>();

  // Auto-save with optimistic updates
  const updateClaudioSetting = async (key: string, value: any) => {
    // 1. Optimistic update
    setState(prev => ({
      ...prev,
      claudioSettings: { ...prev.claudioSettings, [key]: value }
    }));

    // 2. Persist to backend
    try {
      await invoke('update_setting', {
        handleId: 'claudio-global',
        key,
        value,
        settingsType: 'Claudio'
      });
      // Success - real update comes via event
    } catch (error) {
      // 3. Rollback on error
      const current = await invoke('get_claudio_settings');
      setState(prev => ({
        ...prev,
        claudioSettings: current
      }));
      throw error;
    }
  };

  return (
    <MultiProjectContext.Provider value={state}>
      {children}
    </MultiProjectContext.Provider>
  );
}
```

### Auto-Save UI Pattern

```tsx
// src-frontend/components/common/AutoSaveInput.tsx
interface AutoSaveInputProps {
  value: any;
  onChange: (value: any) => Promise<void>;
  type: 'text' | 'boolean' | 'select';
  options?: Array<{label: string, value: any}>;
  debounceMs?: number;
}

export function AutoSaveInput({
  value,
  onChange,
  type,
  debounceMs = 500
}: AutoSaveInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Debounced save for text inputs
  const debouncedSave = useDebouncedCallback(async (newValue: any) => {
    setSaveState('saving');
    try {
      await onChange(newValue);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1000);
    } catch (error) {
      setSaveState('error');
      // Rollback
      setLocalValue(value);
      setTimeout(() => setSaveState('idle'), 2000);
    }
  }, debounceMs);

  const handleChange = (newValue: any) => {
    setLocalValue(newValue);

    if (type === 'text') {
      debouncedSave(newValue);
    } else {
      // Immediate save for boolean/select
      debouncedSave(newValue);
    }
  };

  return (
    <div className="relative">
      {type === 'text' && (
        <input
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          className={cn(
            "input",
            saveState === 'error' && "border-red-500"
          )}
        />
      )}

      {type === 'boolean' && (
        <Switch
          checked={localValue}
          onCheckedChange={handleChange}
        />
      )}

      {/* Save state indicator */}
      <SaveIndicator state={saveState} />
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <AnimatePresence>
      {state !== 'idle' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            "absolute -right-8 top-1/2 -translate-y-1/2 text-xs",
            state === 'saving' && "text-blue-500",
            state === 'saved' && "text-green-500",
            state === 'error' && "text-red-500"
          )}
        >
          {state === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
          {state === 'saved' && <Check className="w-4 h-4" />}
          {state === 'error' && <X className="w-4 h-4" />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

## Impact Analysis

### Affected Components

**ClaudioSettings (App Settings):**
- `src-frontend/components/settings/GeneralSettings.tsx` ❌ Remove save button
- `src-frontend/components/settings/AppearanceSettings.tsx` ❌ Remove save button
- `src-frontend/components/settings/TelemetrySettings.tsx` ❌ Remove save button
- `src-frontend/components/dashboard/DashboardSettings.tsx` ❌ Remove save button

**ClaudeCodeSettings (CLI Settings):**
- `src-frontend/components/settings/AdvancedSettings.tsx` ❌ Remove save button
- `src-frontend/components/settings/HooksSettings.tsx` ❌ Remove save button
- `src-frontend/components/common/TriLevelPermissionsManager.tsx` 🗑️ **DELETE** (replace)
- `src-frontend/components/projects/ProjectSettings.tsx` ❌ Remove save button
- `src-frontend/components/sessions/ModelSelector.tsx` ✅ Show actual model from settings

**New Files Created:**
- `src-backend/src/paths.rs` ✨ **NEW** - Centralized path constants (replaces hardcoded strings)
- `src-frontend/lib/paths.ts` ✨ **NEW** - Frontend path constants
- `src-frontend/hooks/useSettingsHandle.ts` ✨ **NEW** - Settings handle hook (mirrors useSessionHandle)
- `src-frontend/hooks/legacySettingsTypes.ts` ✨ **NEW** - Migration compatibility types
- `src-frontend/lib/settings/` ✨ **NEW** - Settings library with validation, migration, etc.

**Hooks to Delete:**
- `src-frontend/hooks/useTriLevelSettings.ts` 🗑️ **DELETE**
- `src-frontend/hooks/useLocalProjectSettings.ts` 🗑️ **DELETE**
- `src-frontend/hooks/useSettingsState.ts` 🗑️ **DELETE**

**Backend Commands to Update:**
- `src-backend/src/commands/claude/settings.rs` → Refactor into new system
- All hardcoded path strings → Replace with constants

### UI/UX Changes

**Before (Manual Save Pattern):**
```tsx
function SettingsPanel() {
  const [settings, setSettings] = useState();
  const [hasChanges, setHasChanges] = useState(false);

  const handleSave = async () => {
    await api.saveSettings(settings);
    setHasChanges(false);
    toast.success('Settings saved!');
  };

  return (
    <>
      <Input onChange={(v) => {
        setSettings({...settings, model: v});
        setHasChanges(true);
      }} />

      <Button onClick={handleSave} disabled={!hasChanges}>
        Save Settings
      </Button>
    </>
  );
}
```

**After (Auto-Save Pattern):**
```tsx
function SettingsPanel() {
  const { settings, updateSetting } = useClaudeCodeSettings();

  return (
    <AutoSaveInput
      value={settings?.effective.model}
      onChange={(v) => updateSetting('model', v)}
      type="select"
      options={[
        { label: 'Auto', value: 'auto' },
        { label: 'Claude 4 Opus', value: 'opus' },
        { label: 'Claude 4 Sonnet', value: 'sonnet' }
      ]}
    />
    // No save button!
  );
}
```

### Project/Session Management Updates

**Project Discovery Enhancement:**
```rust
// Before: Simple directory scan
fn discover_projects() -> Vec<Project> {
    scan_directory("~/.claude/projects/")
}

// After: Settings-aware discovery
fn discover_projects() -> Vec<ProjectWithSettings> {
    let projects = scan_directory("~/.claude/projects/");

    projects.into_iter().map(|project| {
        let has_local_settings = paths::claude_project_settings_local_path(&project.path).exists();
        let has_project_settings = paths::claude_project_settings_path(&project.path).exists();
        let effective_settings = compute_effective_settings(&project.path);

        ProjectWithSettings {
            ...project,
            has_local_settings,
            has_project_settings,
            effective_settings,
        }
    }).collect()
}
```

**Session Creation with Settings Context:**
```rust
// Before: Default settings
fn create_session(project_path: Option<String>) -> Result<Session> {
    let session = Session::new();
    // Uses default model
    Ok(session)
}

// After: Settings-aware creation
fn create_session_with_settings(
    project_path: Option<String>,
    orchestrator: &MultiProjectOrchestrator
) -> Result<Session> {
    let settings = orchestrator.get_effective_settings(&project_path)?;

    let session = Session::with_config(SessionConfig {
        model: settings.effective.model.unwrap_or("auto"),
        permissions: settings.effective.permissions.clone(),
    });

    Ok(session)
}
```

## Migration Plan

### Phase 1: Foundation
1. **Path Constants Module**
   - Create `src-backend/src/paths.rs`
   - Create `src-frontend/lib/paths.ts`
   - Migrate all hardcoded paths

2. **Design Document & Architecture**
   - Complete this specification
   - Review with stakeholders
   - Set up feature flags

### Phase 2: Backend Infrastructure
1. **Shared Utilities**
   - `src-backend/src/commands/settings/shared.rs`
   - `SettingsManager` trait
   - Handle management utilities

2. **ClaudioSettingsManager**
   - Single file management
   - Auto-save on change
   - Global watcher

3. **ClaudeCodeSettingsManager**
   - Multi-level precedence
   - Project-aware watchers
   - Ref-counted subscriptions

4. **MultiProjectOrchestrator**
   - Coordinate both managers
   - Handle lifecycle management
   - Event routing

### Phase 3: Frontend Implementation
1. **Context Providers**
   - `MultiProjectProvider`
   - `ClaudioSettingsProvider`
   - `ClaudeCodeSettingsProvider`

2. **Hooks**
   - `useClaudioSettings()`
   - `useClaudeCodeSettings()`
   - `useProjectContext()`

3. **Auto-Save Components**
   - `AutoSaveInput`
   - `SaveIndicator`
   - Form validation helpers

### Phase 4: UI Migration
1. **Delete Old Code**
   - Remove `useTriLevelSettings`
   - Remove `TriLevelPermissionsManager`
   - Remove all save buttons

2. **Convert Components**
   - Update all settings components
   - Add auto-save pattern
   - Test user experience

### Phase 5: Testing & Polish
1. **Comprehensive Testing**
   - Unit tests for precedence logic
   - Integration tests for multi-project
   - E2E tests for auto-save UX

2. **Performance Optimization**
   - Optimize watcher performance
   - Cache efficiency improvements
   - Memory usage optimization

3. **Documentation & Cleanup**
   - Update developer documentation
   - Clean up unused code
   - Final review

## Testing Strategy

### Unit Tests
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_settings_precedence() {
        let temp = TempDir::new().unwrap();

        // Create test settings files
        create_test_settings(&temp, SettingsLevel::Global, json!({
            "model": "sonnet"
        }));

        create_test_settings(&temp, SettingsLevel::Project, json!({
            "model": "opus"
        }));

        // Test precedence
        let manager = ClaudeCodeSettingsManager::new(temp.path());
        let settings = manager.get_effective_settings(Some("project")).await.unwrap();

        assert_eq!(settings.effective.model, Some("opus".to_string()));
        assert_eq!(settings.layers.project.as_ref().unwrap().model, Some("opus".to_string()));
        assert_eq!(settings.layers.global.as_ref().unwrap().model, Some("sonnet".to_string()));
    }

    #[tokio::test]
    async fn test_multi_project_ref_counting() {
        let orchestrator = MultiProjectOrchestrator::new();

        // Subscribe to project A twice
        let handle1 = orchestrator.subscribe_to_project("project-a", "tab1").await.unwrap();
        let handle2 = orchestrator.subscribe_to_project("project-a", "tab2").await.unwrap();

        // Verify watcher ref count = 2
        assert_eq!(orchestrator.get_ref_count("project-a"), 2);

        // Unsubscribe one
        orchestrator.unsubscribe_from_project("project-a", "tab1").await.unwrap();

        // Verify watcher still active (ref count = 1)
        assert_eq!(orchestrator.get_ref_count("project-a"), 1);

        // Unsubscribe last one
        orchestrator.unsubscribe_from_project("project-a", "tab2").await.unwrap();

        // Verify watchers stopped (ref count = 0)
        assert_eq!(orchestrator.get_ref_count("project-a"), 0);
    }
}
```

### Integration Tests
```typescript
// src-frontend/__tests__/settings-integration.test.ts
describe('Settings Integration', () => {
  test('auto-save with optimistic updates', async () => {
    const { result } = renderHook(() => useClaudeCodeSettings(), {
      wrapper: TestProjectProvider
    });

    // Initial state
    expect(result.current.settings?.effective.model).toBe('auto');

    // Change setting
    act(() => {
      result.current.updateSetting('model', 'opus');
    });

    // Immediate optimistic update
    expect(result.current.settings?.effective.model).toBe('opus');

    // Wait for persistence
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update_setting', {
        key: 'model',
        value: 'opus'
      });
    });
  });

  test('multi-project isolation', async () => {
    const projectA = renderProjectHook('project-a');
    const projectB = renderProjectHook('project-b');

    // Change setting in project A
    act(() => {
      projectA.result.current.updateSetting('model', 'opus');
    });

    // Verify project B unaffected
    expect(projectB.result.current.settings?.effective.model).toBe('auto');
  });
});
```

### E2E Tests
```typescript
// e2e/settings-auto-save.test.ts
test('settings auto-save user experience', async ({ page }) => {
  await page.goto('/settings');

  // Change theme setting
  await page.selectOption('[data-testid=theme-select]', 'dark');

  // Verify immediate UI update
  await expect(page.locator('body')).toHaveClass(/dark/);

  // Verify save indicator appears
  await expect(page.locator('[data-testid=save-indicator]')).toBeVisible();

  // Verify save indicator disappears
  await expect(page.locator('[data-testid=save-indicator]')).not.toBeVisible();

  // Refresh page and verify persistence
  await page.reload();
  await expect(page.locator('body')).toHaveClass(/dark/);
});
```

## Rollback Plan

### Feature Flag Protection
```rust
// Environment variable to enable/disable new settings
const USE_NEW_SETTINGS: bool = env::var("CLAUDIO_NEW_SETTINGS")
    .map(|v| v == "true")
    .unwrap_or(false);

if USE_NEW_SETTINGS {
    // Use new settings system
    commands.push(get_effective_settings);
} else {
    // Use legacy system
    commands.push(get_claude_settings);
}
```

### Gradual Migration
1. **Parallel Systems**: Run both old and new systems initially
2. **Component-by-Component**: Migrate UI components one at a time
3. **Data Migration**: Preserve all existing settings data
4. **Quick Disable**: Single environment variable to rollback

### Rollback Procedure
1. Set `CLAUDIO_NEW_SETTINGS=false`
2. Restart application
3. Verify legacy system works
4. Investigate issues in new system
5. Fix and re-enable when ready

## Success Metrics

### Performance Targets
- **Settings Load Time**: < 50ms for any project
- **Auto-Save Latency**: < 100ms from change to persistence
- **Memory Usage**: < 10MB per active project
- **Watcher Efficiency**: < 5ms file change detection

### Code Quality Metrics
- **Code Reduction**: 90% reduction in settings-related code
- **Zero Hardcoded Paths**: All paths use constants
- **Zero Save Buttons**: Complete auto-save UX
- **Test Coverage**: > 95% coverage for settings code

### User Experience Metrics
- **Zero Data Loss**: No settings lost during migration
- **Instant Feedback**: All changes reflected immediately
- **Multi-Project Support**: Unlimited project tabs without performance degradation
- **Developer Experience**: Clear separation of concerns between app and CLI settings

---

This refactor represents a fundamental improvement to Claudio's architecture, bringing modern UX patterns, clear code organization, and efficient multi-project support. The investment will pay dividends in maintainability, user experience, and developer productivity.