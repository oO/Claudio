# Claudio Project & Session Management Design

## Overview

Claude Code lacks built-in CLI commands for managing projects and sessions, creating a significant gap that Claudio can fill. This document outlines a comprehensive solution for visual project and session management, building upon the existing foundation already present in Claudio.

## Problem Statement

### Current Claude Code Limitations
- ❌ No `claude list-projects` command
- ❌ No `claude delete-project` command  
- ❌ No `claude list-sessions` command
- ❌ No `claude prune-sessions` command
- ❌ Manual file deletion required for cleanup
- ❌ No usage analytics or storage insights

### Storage Patterns Discovered
```
~/.claude/
├── projects/
│   └── -Users-olivier-Projects-myapp/    # Encoded project paths
│       ├── abc123.jsonl                  # Session files (UUID.jsonl)
│       └── summary-xyz789.jsonl          # Compact summaries
└── settings.json                         # Global settings
```

## Current Implementation Status

### ✅ Already Implemented in Claudio

#### 1. **Project Discovery & Display** (`ProjectList.tsx`)
- Automatic scanning of `~/.claude/projects` directory
- Path decoding from encoded directory names
- Session count visualization with badges
- Responsive grid layout with pagination (12 per page)
- Project settings dropdown for hooks configuration
- Creation timestamp display with relative formatting

#### 2. **Session Management** (`SessionList.tsx`, `SessionOutputViewer.tsx`)
- Session listing per project with pagination (5 per page)
- First message preview (truncated to 100 chars)
- Live session streaming with real-time updates
- Historical session replay from JSONL files
- CLAUDE.md file discovery and editing integration
- Todo system integration with visual indicators
- Export to raw JSONL or formatted Markdown

#### 3. **Backend Infrastructure** (`claude.rs`)
- `list_projects()` - Returns structured project data
- `get_project_sessions()` - Lists sessions for a project
- `load_session_history()` - Loads JSONL for replay
- `find_claude_md_files()` - Discovers project documentation
- Robust path encoding/decoding utilities
- Session metadata extraction (timestamps, first message)

#### 4. **UI/UX Features**
- Tab-based interface with project/session navigation
- Smooth animations and transitions
- Breadcrumb navigation with back buttons
- Fullscreen mode for session viewing
- Copy functionality with format options
- Performance optimization with output caching

### ❌ Missing Features to Implement

#### 1. **Project Management Actions**
- ❌ Delete/archive projects
- ❌ Rename projects or edit metadata
- ❌ Bulk project operations
- ❌ Project favorites/bookmarking

#### 2. **Advanced Session Management**
- ❌ Delete individual or multiple sessions
- ❌ Session search and filtering
- ❌ Prune old sessions by age/size
- ❌ Session tagging/categorization
- ❌ Export sessions to multiple formats (HTML, PDF)

#### 3. **Storage Analytics**
- ❌ Total storage usage visualization
- ❌ Cost breakdown by model/project
- ❌ Usage trends over time
- ❌ Automated cleanup policies
- ❌ Storage recommendations

#### 4. **Enhanced Discovery**
- ❌ Recent projects prioritization
- ❌ Project activity heatmap
- ❌ Quick project switching
- ❌ Project templates/scaffolding

## Proposed Enhancements

### Phase 1: Enhance Project Management

#### 1.1 Add Missing Project Metadata
**Enhance existing `list_projects()` to include:**
```rust
// Extend existing Project struct with:
pub struct EnhancedProject {
    // ... existing fields ...
    pub total_size_mb: f64,        // NEW: Calculate project size
    pub last_active: String,       // NEW: Most recent session timestamp
    pub has_mcp_config: bool,      // NEW: Check for .mcp.json
    pub agent_count: usize,        // NEW: Count .claude/agents/*.md
    pub total_tokens: usize,       // NEW: Sum from all sessions
    pub total_cost_usd: f64,       // NEW: Calculate from sessions
}
```

#### 1.2 Project Deletion & Cleanup
```rust
#[tauri::command]
pub async fn delete_claude_project(encoded_path: String) -> Result<(), String> {
    // 1. Confirm project directory exists
    // 2. Delete ~/.claude/projects/{encoded_path}
    // 3. Optionally clean project's .claude/ directory
    // 4. Return deletion summary
}
```

### Phase 2: Enhance Session Management

#### 2.1 Add Session Actions to Existing Infrastructure
**New commands to complement existing `get_project_sessions()`:**

#### 2.2 Session Deletion & Cleanup
```rust
#[tauri::command]
pub async fn delete_session(project_path: String, session_id: String) -> Result<(), String> {
    // Delete specific session file
}

#[tauri::command]
pub async fn prune_old_sessions(
    project_path: Option<String>,  // None = all projects
    days_old: u32,
    keep_min: usize,              // Keep at least N sessions
) -> Result<PruneResult, String> {
    // 1. Find sessions older than days_old
    // 2. Keep minimum number of recent sessions
    // 3. Delete old sessions
    // 4. Return summary of deleted items
}

#[tauri::command]
pub async fn export_session(
    project_path: String,
    session_id: String,
    format: ExportFormat,  // JSON, Markdown, HTML
) -> Result<String, String> {
    // Export session in requested format
}
```

### Phase 3: Storage Analytics

#### 3.1 Usage Insights
```rust
#[derive(Serialize, Deserialize)]
pub struct StorageAnalytics {
    pub total_projects: usize,
    pub total_sessions: usize,
    pub total_size_mb: f64,
    pub total_tokens: usize,
    pub total_cost_usd: f64,
    pub projects_by_activity: Vec<ProjectActivity>,
    pub storage_by_project: Vec<ProjectStorage>,
    pub cost_by_model: HashMap<String, f64>,
}

#[tauri::command]
pub async fn get_storage_analytics() -> Result<StorageAnalytics, String> {
    // Comprehensive analytics across all projects
}
```

#### 3.2 Session Search
```rust
#[tauri::command]
pub async fn search_sessions(
    query: String,
    project_path: Option<String>,
    date_range: Option<DateRange>,
) -> Result<Vec<SessionSearchResult>, String> {
    // Search through session content
}
```

## UI Component Enhancements

### 1. Enhance Existing ProjectList Component
```tsx
// Add to existing ProjectList.tsx:
// - Delete button with confirmation dialog
// - Storage size display (MB/GB)
// - Token/cost display per project
// - Sort options dropdown
// - Multi-select mode for bulk operations
// - Activity indicator (active in last 24h)
```

### 2. Enhance Existing SessionList Component
```tsx
// Add to existing SessionList.tsx:
// - Delete button per session
// - Token count and cost display
// - Session size indicator
// - Date range filter
// - Bulk selection checkboxes
// - Export dropdown (JSON/MD/HTML)
// - Search bar for content search
```

### 3. New Storage Dashboard Component
```tsx
interface StorageDashboardProps {
  analytics: StorageAnalytics;
  onPrune: (settings: PruneSettings) => void;
}

// Features:
// - Total storage usage charts
// - Cost breakdown by model
// - Project activity heatmap
// - Automated cleanup settings
// - Export usage reports
```

## Implementation Priority

### Phase 1: Core Missing Functions (High Priority)
1. **Project deletion** - `delete_claude_project()` command
2. **Session deletion** - `delete_session()` command
3. **Size calculations** - Add to existing project/session queries
4. **Cost/token extraction** - Parse from JSONL files

### Phase 2: UI Enhancements (Medium Priority)
1. **Add delete buttons** to ProjectList and SessionList
2. **Confirmation dialogs** for destructive actions
3. **Storage indicators** (size, tokens, cost)
4. **Sort/filter controls** in existing components

### Phase 3: Advanced Features (Lower Priority)
1. **Storage Dashboard** - New component for analytics
2. **Bulk operations** - Multi-select in existing lists
3. **Session search** - Content search across JSONL
4. **Export formats** - HTML, PDF generation
5. **Automated cleanup** - Scheduled pruning

## Security Considerations

1. **Deletion Safety**
   - Always confirm before deletion
   - No recursive deletion of actual project directories
   - Only delete Claude metadata, not source code

2. **Path Validation**
   - Validate all paths to prevent directory traversal
   - Restrict operations to ~/.claude/ directory

3. **Export Privacy**
   - Sanitize exported data
   - Option to exclude sensitive information

## Key Differentiators from Current Implementation

While Claudio already provides excellent project and session visualization, the proposed enhancements add critical **management capabilities** that Claude Code CLI lacks:

1. **Deletion & Cleanup**: Currently users must manually navigate to `~/.claude/projects/` and delete files
2. **Storage Management**: No way to see total usage or clean up old sessions systematically  
3. **Cost Analytics**: Token usage and costs are buried in JSONL files
4. **Bulk Operations**: Managing multiple projects/sessions requires individual actions
5. **Search & Filter**: Finding specific sessions across projects is difficult

## Summary

Claudio has a **strong foundation** for project and session management with excellent visualization and navigation features already implemented. The proposed enhancements focus on adding the **critical management actions** that are completely missing from Claude Code's CLI, transforming Claudio from a viewer into a comprehensive management tool.

The existing codebase provides:
- ✅ Robust project/session discovery and display
- ✅ Live streaming and historical replay
- ✅ Well-architected backend with proper abstractions
- ✅ Polished UI with animations and responsive design

The enhancements will add:
- 🎯 Project and session deletion capabilities
- 🎯 Storage analytics and cost tracking
- 🎯 Bulk operations and cleanup tools
- 🎯 Advanced search and filtering
- 🎯 Export to multiple formats

This positions Claudio as the **essential companion tool** for Claude Code power users who need better control over their project and session data.