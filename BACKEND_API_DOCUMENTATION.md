# Claudio Backend API Documentation

This comprehensive technical reference documents all 85+ exposed Tauri commands in the Claudio backend, organized by functional category. Each command includes its purpose, parameters, return values, error conditions, and side effects.

## Executive Summary

Claudio exposes 85+ Tauri commands across 11 functional categories:
- **Claude & Project Management**: 28 commands for project discovery, session management, and Claude Code integration
- **Checkpoint Management**: 13 commands for session branching, timeline management, and state restoration
- **Agent Management**: 24 commands for file-based agent CRUD operations and execution (transitioning to Claude Code Task tool)
- **Usage & Analytics**: 4 commands for token usage tracking and cost analysis
- **MCP (Model Context Protocol)**: 12 commands for server configuration and management
- **Storage Management**: 7 commands for SQLite database operations
- **Slash Commands**: 4 commands for custom command discovery and management
- **Proxy Settings**: 2 commands for network proxy configuration
- **General Settings**: 2 commands for application configuration
- **Window Management**: 4 commands for window state persistence
- **System Information**: 1 command for memory and CPU monitoring
- **Session File Watching**: 4 commands for real-time session file monitoring

## API Categories Overview

### Data Types Reference

#### Common Types
```rust
// Project identification and metadata
struct Project {
    id: String,                    // Encoded project directory name
    path: String,                  // Actual filesystem path
    sessions: Vec<String>,         // List of session IDs
    created_at: u64,              // Unix timestamp
    last_active: Option<u64>,     // Last activity timestamp
    total_size_bytes: Option<u64>, // Total size of all sessions
    total_tokens: Option<u64>,     // Aggregate token usage
    total_cost_usd: Option<f64>,   // Aggregate cost
    agent_count: Option<u32>,      // Number of project-specific agents
}

// Session information and analytics
struct Session {
    id: String,                    // Session UUID
    project_id: String,           // Parent project ID
    project_path: String,         // Project filesystem path
    created_at: u64,              // Creation timestamp
    modified_at: u64,             // Last modification timestamp
    first_message: Option<String>, // First user message
    message_timestamp: Option<u64>, // First message timestamp
    size_bytes: Option<u64>,       // Session file size
    token_count: Option<u64>,      // Total tokens used
    cost_usd: Option<f64>,         // Session cost
    message_count: Option<i64>,    // Number of messages
    todo_data: Option<Value>,      // Associated todo data
    todo_counts: TodoCounts,       // Aggregated todo statistics
}

// Agent definition (file-based storage)
struct Agent {
    id: Option<i64>,               // Compatibility ID (not used)
    name: String,                  // Agent name
    icon: String,                  // UI icon (compatibility)
    system_prompt: String,         // Agent instructions
    default_task: Option<String>,  // Default task template
    model: String,                 // Model preference
    enable_file_read: bool,        // File read permissions
    enable_file_write: bool,       // File write permissions
    enable_network: bool,          // Network access permissions
    hooks: Option<String>,         // Hooks configuration JSON
    created_at: String,            // Creation timestamp (RFC3339)
    updated_at: String,            // Update timestamp (RFC3339)
    description: Option<String>,   // Agent description
    tools: Option<String>,         // Comma-separated tools list
    color: Option<String>,         // UI color theme
}
```

---

## 1. Claude & Project Management (28 commands)

### Project Discovery

#### `list_projects() -> Result<Vec<Project>, String>`
Lists all Claude projects from `~/.claude/projects` directory.

**Parameters**: None

**Returns**: Array of Project objects with metadata including session counts, token usage, costs, and agent counts.

**Side Effects**: Scans filesystem, calculates aggregated analytics from JSONL files.

**Error Conditions**: 
- Failed to read projects directory
- Permission denied accessing project files

#### `get_project_sessions(project_id: String) -> Result<Vec<Session>, String>`
Gets all sessions for a specific project with comprehensive metadata.

**Parameters**:
- `project_id` (String): Encoded project directory name

**Returns**: Array of Session objects sorted by modification time (newest first).

**Side Effects**: Parses JSONL files for analytics, reads todo files, calculates aggregated statistics.

**Error Conditions**:
- Project directory not found
- Failed to parse session files
- Invalid project ID format

#### `delete_claude_project(project_id: String, options: Option<ProjectDeletionOptions>) -> Result<Value, String>`
Deletes an entire Claude project and associated data with configurable options.

**Parameters**:
- `project_id` (String): Project to delete
- `options` (Optional): Deletion options for agents, memories, settings

**Returns**: Deletion summary with counts and size freed.

**Side Effects**: 
- Removes all session JSONL files
- Optionally deletes project agents, CLAUDE.md files, settings
- Cleans up associated todos and timelines
- Frees disk space

**Error Conditions**:
- Project not found
- Permission denied
- Filesystem errors during deletion

### Session Management

#### `load_session_history(session_id: String, project_id: String) -> Result<SessionWithContent, String>`
Loads complete JSONL history for a specific session.

**Parameters**:
- `session_id` (String): Session UUID
- `project_id` (String): Parent project ID

**Returns**: SessionWithContent object with metadata and parsed JSONL messages.

**Side Effects**: Reads and parses potentially large JSONL files.

**Error Conditions**:
- Session file not found
- Invalid JSONL format
- File read permissions

#### `delete_session(project_id: String, session_id: String) -> Result<Value, String>`
Deletes a specific session and all associated data.

**Parameters**:
- `project_id` (String): Parent project
- `session_id` (String): Session to delete

**Returns**: Deletion summary with cleanup statistics.

**Side Effects**:
- Removes session JSONL file
- Deletes associated todo files
- Cleans up timeline directories

#### `track_session_messages(session_id: String, project_id: String, project_path: String, messages: Vec<String>) -> Result<(), String>`
Tracks session messages for checkpoint management.

**Parameters**:
- `session_id` (String): Target session
- `project_id` (String): Project context
- `project_path` (String): Project filesystem path
- `messages` (Vec<String>): JSONL message lines to track

**Returns**: Success confirmation.

**Side Effects**: Updates checkpoint manager state for auto-checkpointing.

### Session Cleanup and Maintenance

#### `prune_old_sessions(project_id: Option<String>, days_old: u32, keep_min: usize) -> Result<Value, String>`
Prunes old sessions based on age while maintaining minimum count.

**Parameters**:
- `project_id` (Optional): Specific project or all projects
- `days_old` (u32): Age threshold in days
- `keep_min` (usize): Minimum sessions to preserve

**Returns**: Cleanup summary with sessions deleted and space freed.

**Side Effects**:
- Removes old session files
- Cleans up associated todo files
- Frees significant disk space

#### `preview_session_deletion_by_age(project_id: String, days_old: u64) -> Result<SessionDeletionPreview, String>`
Previews which sessions would be deleted by age threshold.

**Parameters**:
- `project_id` (String): Target project
- `days_old` (u64): Age threshold in days

**Returns**: Preview with sessions to delete/keep and size calculations.

#### `delete_sessions_by_age(project_id: String, days_old: u64) -> Result<Value, String>`
Deletes sessions older than specified threshold.

**Parameters**:
- `project_id` (String): Target project  
- `days_old` (u64): Age threshold in days

**Returns**: Deletion summary with cleanup statistics.

#### `get_session_age_range(project_id: String) -> Result<SessionAgeRange, String>`
Gets age range of sessions in a project for UI guidance.

**Parameters**:
- `project_id` (String): Target project

**Returns**: Age range from newest to oldest in days.

### Claude Code Integration

#### `check_claude_version(app: AppHandle) -> Result<ClaudeVersionStatus, String>`
Checks Claude Code installation and version information.

**Parameters**:
- `app` (AppHandle): Application context for binary discovery

**Returns**: Installation status with version details.

**Side Effects**: Executes Claude binary to check version (debug builds only).

**Error Conditions**:
- Claude Code not found in PATH
- Binary execution fails
- Version parsing errors

#### `execute_claude_code(app: AppHandle, project_path: String, prompt: String, model: String) -> Result<(), String>`
Executes new interactive Claude Code conversation with streaming output.

**Parameters**:
- `app` (AppHandle): Application context
- `project_path` (String): Working directory
- `prompt` (String): Initial prompt
- `model` (String): Model to use

**Returns**: Immediate success (process runs async).

**Side Effects**:
- Spawns Claude Code process
- Streams stdout/stderr to frontend
- Updates process state management

#### `continue_claude_code(app: AppHandle, project_path: String, prompt: String, model: String) -> Result<(), String>`
Continues existing Claude Code conversation.

**Parameters**: Same as execute_claude_code

**Returns**: Immediate success (process runs async).

**Side Effects**: Same as execute_claude_code with --continue flag.

#### `resume_claude_code(app: AppHandle, project_path: String, session_id: String, prompt: String, model: String) -> Result<(), String>`
Resumes specific Claude Code session by ID.

**Parameters**:
- Same as execute_claude_code plus:
- `session_id` (String): Session to resume

**Returns**: Immediate success (process runs async).

**Side Effects**: Same as execute_claude_code with --resume flag.

#### `cancel_claude_execution(app: AppHandle, session_id: Option<String>) -> Result<(), String>`
Cancels currently running Claude Code execution.

**Parameters**:
- `app` (AppHandle): Application context
- `session_id` (Optional): Session to cancel

**Returns**: Success confirmation.

**Side Effects**:
- Terminates running Claude process
- Cleans up process state
- Emits cancellation event to frontend

#### `list_running_claude_sessions(registry: State<ProcessRegistryState>) -> Result<Vec<ProcessInfo>, String>`
Lists all currently running Claude sessions.

**Parameters**:
- `registry` (State): Process registry

**Returns**: Array of active process information.

#### `get_claude_session_output(registry: State<ProcessRegistryState>, session_id: String) -> Result<String, String>`
Gets output for a specific Claude session.

**Parameters**:
- `registry` (State): Process registry
- `session_id` (String): Target session

**Returns**: Session output content.

### Settings and Configuration

#### `get_claude_settings() -> Result<ClaudeSettings, String>`
Reads Claude settings from `~/.claude/settings.json`.

**Returns**: Claude settings object or empty if file doesn't exist.

**Error Conditions**:
- Settings file read errors
- JSON parsing failures

#### `save_claude_settings(settings: Value) -> Result<String, String>`
Saves Claude settings with pretty-printed JSON.

**Parameters**:
- `settings` (Value): Settings object to save

**Returns**: Success message.

**Side Effects**: Writes to `~/.claude/settings.json` with proper formatting.

#### `start_settings_watcher(app: AppHandle) -> Result<String, String>`
Starts file watcher for settings changes.

**Parameters**:
- `app` (AppHandle): Application context for events

**Returns**: Success message.

**Side Effects**:
- Creates file watcher on settings file
- Emits events on settings changes
- Manages watcher lifecycle

### System Prompts

#### `get_system_prompt() -> Result<String, String>`
Reads the CLAUDE.md system prompt file.

**Returns**: System prompt content or empty string.

#### `save_system_prompt(content: String) -> Result<String, String>`
Saves content to CLAUDE.md system prompt file.

**Parameters**:
- `content` (String): New system prompt content

**Returns**: Success message.

**Side Effects**: Writes to `~/.claude/CLAUDE.md`.

### File System Operations

#### `list_directory_contents(directory_path: String) -> Result<Vec<FileEntry>, String>`
Lists directory contents with metadata, sorted with directories first.

**Parameters**:
- `directory_path` (String): Path to list

**Returns**: Array of file entries with size and type information.

#### `search_files(base_path: String, query: String) -> Result<Vec<FileEntry>, String>`
Recursively searches files matching query (limited to 100 results).

**Parameters**:
- `base_path` (String): Search root directory
- `query` (String): Search term

**Returns**: Array of matching file entries.

**Side Effects**: Traverses directory tree recursively.

#### `find_claude_md_files(project_path: String) -> Result<Vec<ClaudeMdFile>, String>`
Finds all CLAUDE.md files in project directory.

**Parameters**:
- `project_path` (String): Project root to search

**Returns**: Array of CLAUDE.md file locations with metadata.

#### `read_claude_md_file(file_path: String) -> Result<String, String>`
Reads content from a CLAUDE.md file.

**Parameters**:
- `file_path` (String): Absolute path to file

**Returns**: File content.

#### `save_claude_md_file(file_path: String, content: String) -> Result<String, String>`
Saves content to CLAUDE.md file.

**Parameters**:
- `file_path` (String): Target file path
- `content` (String): Content to save

**Returns**: Success message.

#### `delete_file(file_path: String) -> Result<String, String>`
Deletes a file with safety checks.

**Parameters**:
- `file_path` (String): File to delete

**Returns**: Success message.

**Side Effects**: Permanently removes file from filesystem.

**Error Conditions**:
- File doesn't exist
- Path is not a file (directory)
- Permission denied

#### `get_recently_modified_files(session_id: String, project_id: String, project_path: String, minutes: u32) -> Result<Vec<String>, String>`
Gets files modified in the last N minutes (placeholder implementation).

**Parameters**:
- `session_id` (String): Context session
- `project_id` (String): Project context
- `project_path` (String): Project path
- `minutes` (u32): Time window

**Returns**: Array of modified file paths (currently empty).

### Hooks and Project Settings

#### `get_hooks_config(scope: String, project_path: Option<String>) -> Result<Value, String>`
Gets hooks configuration at specified scope (global or project).

**Parameters**:
- `scope` (String): "global" or "project"
- `project_path` (Optional): Required for project scope

**Returns**: Hooks configuration object.

#### `update_hooks_config(scope: String, project_path: Option<String>, config: Value) -> Result<String, String>`
Updates hooks configuration at specified scope.

**Parameters**:
- `scope` (String): Configuration scope
- `project_path` (Optional): Project path if needed
- `config` (Value): New hooks configuration

**Returns**: Success message.

**Side Effects**: Creates hooks.json file at appropriate location.

#### `validate_hook_command(command: String) -> Result<Value, String>`
Validates a hook command for security and safety.

**Parameters**:
- `command` (String): Command to validate

**Returns**: Validation result with issues and warnings.

#### `check_project_settings(project_path: String) -> Result<u32, String>`
Checks if project has settings files.

**Parameters**:
- `project_path` (String): Project to check

**Returns**: Count of settings files found.

### Session Management Tools

#### `open_new_session(app: AppHandle, path: Option<String>) -> Result<String, String>`
Opens new Claude Code session (development only).

**Parameters**:
- `app` (AppHandle): Application context
- `path` (Optional): Working directory

**Returns**: New session ID.

**Error Conditions**: Production builds return error.

---

## 2. Checkpoint Management (13 commands)

The checkpoint system provides session branching, timeline management, and state restoration capabilities.

#### `create_checkpoint(session_id: String, project_id: String, project_path: String, message_index: Option<usize>, description: Option<String>) -> Result<CheckpointResult, String>`
Creates a checkpoint for current session state.

**Parameters**:
- `session_id` (String): Target session
- `project_id` (String): Project context
- `project_path` (String): Project filesystem path
- `message_index` (Optional): Stop at specific message
- `description` (Optional): Checkpoint description

**Returns**: Checkpoint creation result with metadata.

**Side Effects**:
- Reads session JSONL file up to message index
- Creates checkpoint storage entry
- Updates checkpoint manager state

#### `restore_checkpoint(checkpoint_id: String, session_id: String, project_id: String, project_path: String) -> Result<CheckpointResult, String>`
Restores session to specific checkpoint state.

**Parameters**:
- `checkpoint_id` (String): Checkpoint to restore
- `session_id` (String): Target session
- `project_id` (String): Project context
- `project_path` (String): Project path

**Returns**: Restoration result.

**Side Effects**:
- Updates session JSONL file with checkpoint state
- Resets session timeline to checkpoint point

#### `list_checkpoints(session_id: String, project_id: String, project_path: String) -> Result<Vec<Checkpoint>, String>`
Lists all checkpoints for a session.

**Parameters**:
- `session_id` (String): Target session
- `project_id` (String): Project context
- `project_path` (String): Project path

**Returns**: Array of checkpoint objects.

#### `fork_from_checkpoint(checkpoint_id: String, session_id: String, project_id: String, project_path: String, new_session_id: String, description: Option<String>) -> Result<CheckpointResult, String>`
Creates new session branch from checkpoint.

**Parameters**:
- `checkpoint_id` (String): Source checkpoint
- `session_id` (String): Source session
- `project_id` (String): Project context
- `project_path` (String): Project path
- `new_session_id` (String): New session ID for fork
- `description` (Optional): Fork description

**Returns**: Fork operation result.

**Side Effects**:
- Copies session file to new session
- Creates checkpoint manager for new session
- Establishes fork relationship

#### `get_session_timeline(session_id: String, project_id: String, project_path: String) -> Result<SessionTimeline, String>`
Gets timeline visualization for session.

**Parameters**:
- `session_id` (String): Target session
- `project_id` (String): Project context
- `project_path` (String): Project path

**Returns**: Timeline object with checkpoints and branches.

#### `update_checkpoint_settings(session_id: String, project_id: String, project_path: String, auto_checkpoint_enabled: bool, checkpoint_strategy: String) -> Result<(), String>`
Updates checkpoint automation settings.

**Parameters**:
- `session_id` (String): Target session
- `project_id` (String): Project context
- `project_path` (String): Project path
- `auto_checkpoint_enabled` (bool): Enable auto-checkpointing
- `checkpoint_strategy` (String): "manual", "per_prompt", "per_tool_use", "smart"

**Returns**: Success confirmation.

#### `get_checkpoint_diff(from_checkpoint_id: String, to_checkpoint_id: String, session_id: String, project_id: String) -> Result<CheckpointDiff, String>`
Gets differences between two checkpoints.

**Parameters**:
- `from_checkpoint_id` (String): Source checkpoint
- `to_checkpoint_id` (String): Target checkpoint
- `session_id` (String): Session context
- `project_id` (String): Project context

**Returns**: Diff object with file changes and token delta.

#### `track_checkpoint_message(session_id: String, project_id: String, project_path: String, message: String) -> Result<(), String>`
Tracks a message for checkpointing decisions.

**Parameters**:
- `session_id` (String): Target session
- `project_id` (String): Project context
- `project_path` (String): Project path
- `message` (String): JSONL message to track

**Returns**: Success confirmation.

#### `check_auto_checkpoint(session_id: String, project_id: String, project_path: String, message: String) -> Result<bool, String>`
Checks if auto-checkpoint should be triggered.

**Parameters**:
- `session_id` (String): Target session
- `project_id` (String): Project context
- `project_path` (String): Project path
- `message` (String): New message to evaluate

**Returns**: Boolean indicating if checkpoint should be created.

#### `cleanup_old_checkpoints(session_id: String, project_id: String, project_path: String, keep_count: usize) -> Result<usize, String>`
Cleans up old checkpoints keeping specified count.

**Parameters**:
- `session_id` (String): Target session
- `project_id` (String): Project context
- `project_path` (String): Project path
- `keep_count` (usize): Number of checkpoints to preserve

**Returns**: Number of checkpoints deleted.

#### `get_checkpoint_settings(session_id: String, project_id: String, project_path: String) -> Result<Value, String>`
Gets current checkpoint settings for session.

**Parameters**:
- `session_id` (String): Target session
- `project_id` (String): Project context
- `project_path` (String): Project path

**Returns**: Settings object with auto-checkpoint configuration.

#### `clear_checkpoint_manager(session_id: String) -> Result<(), String>`
Clears checkpoint manager for session cleanup.

**Parameters**:
- `session_id` (String): Session to cleanup

**Returns**: Success confirmation.

**Side Effects**: Removes session from checkpoint manager memory.

#### `get_checkpoint_state_stats() -> Result<Value, String>`
Gets checkpoint system statistics for monitoring.

**Returns**: Statistics object with active managers and sessions.

---

## 3. Agent Management (24 commands)

Agent management uses file-based storage with .md files containing YAML frontmatter. The system is transitioning to integrate with Claude Code's native Task tool.

#### `list_agents(project_path: String) -> Result<Vec<Agent>, String>`
Lists all agents from .claude/agents/*.md files.

**Parameters**:
- `project_path` (String): Project path for project agents, empty for global

**Returns**: Array of Agent objects sorted by name with temporary IDs.

**Side Effects**:
- Scans .claude/agents directory
- Parses YAML frontmatter and markdown content
- Assigns temporary IDs for frontend compatibility

**Error Conditions**:
- Directory read permissions
- Invalid markdown format
- YAML parsing errors

#### `create_agent(project_path: Option<String>, name: String, icon: String, system_prompt: String, default_task: Option<String>, model: Option<String>, enable_file_read: Option<bool>, enable_file_write: Option<bool>, enable_network: Option<bool>, hooks: Option<String>, description: Option<String>, tools: Option<String>, color: Option<String>) -> Result<Agent, String>`
Creates new agent file with YAML frontmatter.

**Parameters**:
- `project_path` (Optional): Project path for project-scoped agents
- `name` (String): Agent name (becomes filename)
- `icon` (String): UI icon (compatibility)
- `system_prompt` (String): Agent instructions
- `default_task` (Optional): Default task template
- `model` (Optional): Preferred model ("sonnet" default)
- `enable_file_read` (Optional): File read permissions (true default)
- `enable_file_write` (Optional): File write permissions (true default)
- `enable_network` (Optional): Network permissions (false default)
- `hooks` (Optional): Hooks configuration JSON
- `description` (Optional): Agent description
- `tools` (Optional): Comma-separated tools list
- `color` (Optional): UI color theme

**Returns**: Created Agent object.

**Side Effects**:
- Creates .claude/agents directory if needed
- Writes markdown file with YAML frontmatter
- Normalizes agent name to filename

**Error Conditions**:
- Agent already exists
- Directory creation fails
- File write permissions

#### `update_agent(/* same parameters as create_agent */) -> Result<Agent, String>`
Updates existing agent file preserving creation timestamp.

**Returns**: Updated Agent object.

**Side Effects**: Overwrites existing agent file with new content.

**Error Conditions**: Agent not found, file write errors.

#### `delete_agent(project_path: Option<String>, name: String) -> Result<(), String>`
Deletes agent file from filesystem.

**Parameters**:
- `project_path` (Optional): Project scope
- `name` (String): Agent name to delete

**Returns**: Success confirmation.

**Side Effects**: Permanently removes agent .md file.

**Error Conditions**: Agent not found, file deletion permissions.

#### `get_agent(project_path: Option<String>, name: String) -> Result<Agent, String>`
Gets single agent by name with file metadata.

**Parameters**:
- `project_path` (Optional): Project scope
- `name` (String): Agent name

**Returns**: Agent object with timestamps from file metadata.

**Error Conditions**: Agent not found, file read errors.

### Agent Execution (Transitioning)

The following commands are placeholders as the system transitions to Claude Code Task tool integration:

#### `execute_agent(app: AppHandle, agent_name: String, project_path: String, task: String, model: Option<String>) -> Result<i64, String>`
**Status**: Not implemented - will use Claude Code Task tool.

**Returns**: Error indicating Task tool integration needed.

#### `list_agent_runs(agent_name: Option<String>) -> Result<Vec<AgentRun>, String>`
**Status**: Placeholder - needs file-based run tracking implementation.

**Returns**: Empty array with warning.

#### `get_agent_run(run_id: i64) -> Result<AgentRun, String>`
**Status**: Not implemented.

**Returns**: Error indicating not implemented.

#### `list_agent_runs_with_metrics(agent_name: Option<String>) -> Result<Vec<AgentRunWithMetrics>, String>`
**Status**: Placeholder.

**Returns**: Empty array with warning.

#### `get_agent_run_with_real_time_metrics(run_id: i64) -> Result<AgentRunWithMetrics, String>`
**Status**: Not implemented.

**Returns**: Error indicating not implemented.

#### `list_running_sessions() -> Result<Vec<AgentRun>, String>`
**Status**: Placeholder.

**Returns**: Empty array.

#### `kill_agent_session(app: AppHandle, run_id: i64) -> Result<bool, String>`
**Status**: Not implemented.

#### `get_session_status(run_id: i64) -> Result<Option<String>, String>`
**Status**: Not implemented.

#### `cleanup_finished_processes() -> Result<Vec<i64>, String>`
**Status**: Placeholder.

**Returns**: Empty array.

#### `get_live_session_output(run_id: i64) -> Result<String, String>`
**Status**: Not implemented.

#### `get_session_output(run_id: i64) -> Result<String, String>`
**Status**: Not implemented.

#### `stream_session_output(app: AppHandle, run_id: i64) -> Result<(), String>`
**Status**: Not implemented.

### Agent Import/Export

#### `export_agent(project_path: Option<String>, name: String) -> Result<String, String>`
Exports agent as JSON string.

**Parameters**:
- `project_path` (Optional): Project scope
- `name` (String): Agent to export

**Returns**: JSON representation of agent.

#### `export_agent_to_file(project_path: Option<String>, name: String, file_path: String) -> Result<(), String>`
Exports agent markdown file directly to specified path.

**Parameters**:
- `project_path` (Optional): Project scope
- `name` (String): Agent to export
- `file_path` (String): Destination path

**Returns**: Success confirmation.

**Side Effects**: Copies .md file to destination.

#### `import_agent(project_path: Option<String>, json_data: String) -> Result<Agent, String>`
Imports agent from JSON data.

**Parameters**:
- `project_path` (Optional): Destination scope
- `json_data` (String): Agent JSON data

**Returns**: Imported Agent object.

**Side Effects**: Creates new agent file, handles name conflicts.

#### `import_agent_from_file(project_path: Option<String>, file_path: String) -> Result<Agent, String>`
Imports agent from JSON file.

**Parameters**:
- `project_path` (Optional): Destination scope
- `file_path` (String): Source JSON file

**Returns**: Imported Agent object.

### Claude Binary Management

#### `get_claude_binary_path() -> Result<Option<String>, String>`
Gets configured Claude binary path from settings.

**Returns**: Binary path or None if not configured.

#### `set_claude_binary_path(path: String) -> Result<(), String>`
Sets Claude binary path in settings.

**Parameters**:
- `path` (String): Path to Claude binary

**Returns**: Success confirmation.

**Side Effects**: Updates claudio-settings.json file.

#### `list_claude_installations(app: AppHandle) -> Result<Vec<ClaudeInstallation>, String>`
Discovers Claude Code installations on system.

**Parameters**:
- `app` (AppHandle): Application context

**Returns**: Array of found Claude installations.

**Error Conditions**: No installations found on system.

### GitHub Integration (Disabled)

#### `fetch_github_agents() -> Result<Vec<String>, String>`
**Status**: Not yet adapted for new file format.

**Returns**: Empty array with warning.

#### `fetch_github_agent_content(download_url: String) -> Result<AgentExport, String>`
**Status**: Not implemented.

#### `import_agent_from_github(project_path: Option<String>, download_url: String) -> Result<Agent, String>`
**Status**: Not implemented.

### Session History

#### `load_agent_session_history(session_id: String) -> Result<Vec<Value>, String>`
Loads Claude Code session history for agent execution.

**Parameters**:
- `session_id` (String): Session UUID

**Returns**: Array of JSONL messages.

**Side Effects**: Searches all project directories for session file.

---

## 4. Usage & Analytics (4 commands)

Provides comprehensive token usage tracking and cost analysis across all Claude Code sessions.

#### `get_usage_stats(days: Option<u32>) -> Result<UsageStats, String>`
Gets comprehensive usage statistics with optional date filtering.

**Parameters**:
- `days` (Optional): Limit to last N days

**Returns**: UsageStats object with totals and breakdowns by model, date, and project.

**Side Effects**:
- Scans all JSONL files across projects
- Calculates costs using Claude 4 pricing
- Performs deduplication based on message/request IDs

#### `get_usage_by_date_range(start_date: String, end_date: String) -> Result<UsageStats, String>`
Gets usage statistics for specific date range.

**Parameters**:
- `start_date` (String): Start date (YYYY-MM-DD or ISO format)
- `end_date` (String): End date (YYYY-MM-DD or ISO format)

**Returns**: UsageStats for specified period.

#### `get_usage_details(project_path: Option<String>, date: Option<String>) -> Result<Vec<UsageEntry>, String>`
Gets detailed usage entries with optional filtering.

**Parameters**:
- `project_path` (Optional): Filter by project
- `date` (Optional): Filter by date

**Returns**: Array of individual usage entries.

#### `get_session_stats(since: Option<String>, until: Option<String>, order: Option<String>) -> Result<Vec<ProjectUsage>, String>`
Gets per-session statistics with date filtering.

**Parameters**:
- `since` (Optional): Start date (YYYYMMDD)
- `until` (Optional): End date (YYYYMMDD)
- `order` (Optional): Sort order ("asc" or "desc")

**Returns**: Array of session usage statistics.

### Pricing Information

The system uses current Claude 4 pricing (per million tokens):

**Opus 4**:
- Input: $15.00
- Output: $75.00
- Cache Write: $18.75
- Cache Read: $1.50

**Sonnet 4**:
- Input: $3.00
- Output: $15.00
- Cache Write: $3.75
- Cache Read: $0.30

---

## 5. MCP (Model Context Protocol) (12 commands)

Manages MCP server configuration and integration with Claude Desktop compatibility.

#### `mcp_add(app: AppHandle, name: String, transport: String, command: Option<String>, args: Vec<String>, env: HashMap<String, String>, url: Option<String>, scope: String) -> Result<AddServerResult, String>`
Adds new MCP server with specified configuration.

**Parameters**:
- `app` (AppHandle): Application context
- `name` (String): Server identifier
- `transport` (String): "stdio" or "sse"
- `command` (Optional): Command for stdio transport
- `args` (Vec<String>): Command arguments
- `env` (HashMap): Environment variables
- `url` (Optional): URL for SSE transport
- `scope` (String): Configuration scope

**Returns**: AddServerResult with success status and message.

**Side Effects**: Executes `claude mcp add` command with parameters.

#### `mcp_list(app: AppHandle) -> Result<Vec<MCPServer>, String>`
Lists all configured MCP servers with parsing of multi-line commands.

**Parameters**:
- `app` (AppHandle): Application context

**Returns**: Array of MCPServer objects with parsed configuration.

**Side Effects**: Executes `claude mcp list` and parses text output.

#### `mcp_get(app: AppHandle, name: String) -> Result<MCPServer, String>`
Gets detailed configuration for specific MCP server.

**Parameters**:
- `app` (AppHandle): Application context
- `name` (String): Server name

**Returns**: MCPServer object with full configuration.

#### `mcp_remove(app: AppHandle, name: String) -> Result<String, String>`
Removes MCP server from configuration.

**Parameters**:
- `app` (AppHandle): Application context
- `name` (String): Server to remove

**Returns**: Success message.

**Side Effects**: Executes `claude mcp remove` command.

#### `mcp_add_json(app: AppHandle, name: String, json_config: String, scope: String) -> Result<AddServerResult, String>`
Adds MCP server from JSON configuration.

**Parameters**:
- `app` (AppHandle): Application context
- `name` (String): Server name
- `json_config` (String): JSON configuration
- `scope` (String): Configuration scope

**Returns**: AddServerResult with operation status.

#### `mcp_add_from_claude_desktop(app: AppHandle, scope: String) -> Result<ImportResult, String>`
Imports MCP servers from Claude Desktop configuration.

**Parameters**:
- `app` (AppHandle): Application context
- `scope` (String): Target scope for imported servers

**Returns**: ImportResult with success/failure counts per server.

**Side Effects**:
- Reads Claude Desktop config file
- Imports each server using mcp_add_json
- Provides detailed import results

**Error Conditions**:
- Claude Desktop not installed
- Config file not found or invalid
- Platform not supported (Windows)

#### `mcp_serve(app: AppHandle) -> Result<String, String>`
Starts Claude Code as MCP server.

**Parameters**:
- `app` (AppHandle): Application context

**Returns**: Success message.

**Side Effects**: Spawns `claude mcp serve` process.

#### `mcp_test_connection(app: AppHandle, name: String) -> Result<String, String>`
Tests connection to MCP server.

**Parameters**:
- `app` (AppHandle): Application context
- `name` (String): Server to test

**Returns**: Connection test result.

#### `mcp_reset_project_choices(app: AppHandle) -> Result<String, String>`
Resets project-scoped server approval choices.

**Parameters**:
- `app` (AppHandle): Application context

**Returns**: Success message.

#### `mcp_get_server_status() -> Result<HashMap<String, ServerStatus>, String>`
Gets status of MCP servers (placeholder).

**Returns**: Empty status map (not yet implemented).

#### `mcp_read_project_config(project_path: String) -> Result<MCPProjectConfig, String>`
Reads .mcp.json from project directory.

**Parameters**:
- `project_path` (String): Project root directory

**Returns**: MCPProjectConfig or empty if file doesn't exist.

#### `mcp_save_project_config(project_path: String, config: MCPProjectConfig) -> Result<String, String>`
Saves .mcp.json to project directory.

**Parameters**:
- `project_path` (String): Project root directory
- `config` (MCPProjectConfig): Configuration to save

**Returns**: Success message.

**Side Effects**: Writes pretty-printed JSON to .mcp.json file.

---

## 6. Storage Management (7 commands)

Provides SQLite database operations for the agents database and application data.

#### `storage_list_tables(db: State<AgentDb>) -> Result<Vec<TableInfo>, String>`
Lists all tables in database with metadata.

**Parameters**:
- `db` (State): Database connection state

**Returns**: Array of TableInfo with columns and row counts.

#### `storage_read_table(db: State<AgentDb>, tableName: String, page: i64, pageSize: i64, searchQuery: Option<String>) -> Result<TableData, String>`
Reads table data with pagination and search.

**Parameters**:
- `db` (State): Database connection
- `tableName` (String): Table to read
- `page` (i64): Page number (1-based)
- `pageSize` (i64): Rows per page
- `searchQuery` (Optional): Text search across string columns

**Returns**: TableData with rows, pagination info, and metadata.

**Side Effects**: Executes SQL queries with proper parameterization.

**Error Conditions**:
- Invalid table name
- SQL execution errors

#### `storage_update_row(db: State<AgentDb>, tableName: String, primaryKeyValues: HashMap<String, JsonValue>, updates: HashMap<String, JsonValue>) -> Result<(), String>`
Updates table row by primary key.

**Parameters**:
- `db` (State): Database connection
- `tableName` (String): Target table
- `primaryKeyValues` (HashMap): Primary key values for WHERE clause
- `updates` (HashMap): Column values to update

**Returns**: Success confirmation.

**Side Effects**: Executes UPDATE SQL with proper parameterization.

#### `storage_delete_row(db: State<AgentDb>, tableName: String, primaryKeyValues: HashMap<String, JsonValue>) -> Result<(), String>`
Deletes table row by primary key.

**Parameters**:
- `db` (State): Database connection
- `tableName` (String): Target table
- `primaryKeyValues` (HashMap): Primary key for row identification

**Returns**: Success confirmation.

**Side Effects**: Permanently removes row from database.

#### `storage_insert_row(db: State<AgentDb>, tableName: String, values: HashMap<String, JsonValue>) -> Result<i64, String>`
Inserts new row into table.

**Parameters**:
- `db` (State): Database connection
- `tableName` (String): Target table
- `values` (HashMap): Column values for new row

**Returns**: New row ID (last_insert_rowid).

**Side Effects**: Adds new row to database.

#### `storage_execute_sql(db: State<AgentDb>, query: String) -> Result<QueryResult, String>`
Executes raw SQL query with safety checks.

**Parameters**:
- `db` (State): Database connection
- `query` (String): SQL query to execute

**Returns**: QueryResult with columns, rows, and metadata.

**Side Effects**: Executes arbitrary SQL (SELECT or DML operations).

**Error Conditions**:
- SQL syntax errors
- Constraint violations
- Permission issues

#### `storage_reset_database(app: AppHandle) -> Result<(), String>`
Resets entire database to empty state.

**Parameters**:
- `app` (AppHandle): Application context

**Returns**: Success confirmation.

**Side Effects**:
- Drops all tables
- Re-initializes empty schema
- Runs VACUUM optimization

**Warning**: Permanently destroys all database content.

---

## 7. Slash Commands (4 commands)

Manages custom slash commands from markdown files with YAML frontmatter.

#### `slash_commands_list(project_path: Option<String>) -> Result<Vec<SlashCommand>, String>`
Discovers all slash commands from user and project directories.

**Parameters**:
- `project_path` (Optional): Project path for project-scoped commands

**Returns**: Array of SlashCommand objects including built-in defaults.

**Side Effects**:
- Scans `~/.claude/commands/` for user commands
- Scans `<project>/.claude/commands/` for project commands
- Parses YAML frontmatter and markdown content

#### `slash_command_get(command_id: String) -> Result<SlashCommand, String>`
Gets single slash command by ID.

**Parameters**:
- `command_id` (String): Unique command identifier

**Returns**: SlashCommand object.

**Implementation**: Currently lists all and filters by ID.

#### `slash_command_save(scope: String, name: String, namespace: Option<String>, content: String, description: Option<String>, allowed_tools: Vec<String>, project_path: Option<String>) -> Result<SlashCommand, String>`
Creates or updates slash command.

**Parameters**:
- `scope` (String): "project" or "user"
- `name` (String): Command name
- `namespace` (Optional): Command namespace for organization
- `content` (String): Markdown content
- `description` (Optional): Command description
- `allowed_tools` (Vec<String>): Tools this command can use
- `project_path` (Optional): Required for project scope

**Returns**: Created/updated SlashCommand object.

**Side Effects**:
- Creates directory structure if needed
- Writes markdown file with YAML frontmatter
- Handles namespace-based file organization

#### `slash_command_delete(command_id: String, project_path: Option<String>) -> Result<String, String>`
Deletes slash command file.

**Parameters**:
- `command_id` (String): Command to delete
- `project_path` (Optional): Project path for project commands

**Returns**: Success message.

**Side Effects**:
- Removes markdown file
- Cleans up empty directories

### Command File Format

Slash commands are stored as markdown files with YAML frontmatter:

```markdown
---
description: Command description
allowed-tools:
  - Read
  - Write
---

Command content with $ARGUMENTS placeholder support.

Can include:
- Bash commands with !`command`
- File references with @filename
- Dynamic arguments via $ARGUMENTS
```

---

## 8. Proxy Settings (2 commands)

Manages network proxy configuration for Claude Code integration.

#### `get_proxy_settings() -> Result<ProxySettings, String>`
Gets current proxy settings from claudio-settings.json.

**Returns**: ProxySettings object with HTTP/HTTPS proxy configuration.

#### `save_proxy_settings(settings: ProxySettings) -> Result<(), String>`
Saves proxy settings and applies them to current process.

**Parameters**:
- `settings` (ProxySettings): New proxy configuration

**Returns**: Success confirmation.

**Side Effects**:
- Updates claudio-settings.json
- Sets environment variables (HTTP_PROXY, HTTPS_PROXY, NO_PROXY)
- Automatically includes localhost in NO_PROXY list

### ProxySettings Structure

```rust
struct ProxySettings {
    http_proxy: Option<String>,      // HTTP proxy URL
    https_proxy: Option<String>,     // HTTPS proxy URL  
    no_proxy: Option<String>,        // Bypass list
    all_proxy: Option<String>,       // Catch-all proxy
    enabled: bool,                   // Master enable/disable
}
```

---

## 9. General Settings (2 commands)

Manages application-wide settings in the consolidated claudio-settings.json file.

#### `get_setting(key: String) -> Result<Option<String>, String>`
Gets specific setting value by key.

**Parameters**:
- `key` (String): Setting key ("theme_preference", "theme_custom_colors")

**Returns**: Setting value or None if not found.

#### `save_setting(key: String, value: String) -> Result<(), String>`
Saves specific setting value.

**Parameters**:
- `key` (String): Setting key
- `value` (String): New value

**Returns**: Success confirmation.

**Side Effects**: Updates claudio-settings.json file with new value.

### Supported Settings

- `theme_preference`: UI theme mode
- `theme_custom_colors`: Custom color configuration JSON

---

## 10. Window Management (4 commands)

Manages window position, size, and state persistence.

#### `save_window_state(app_handle: AppHandle, state: WindowState) -> Result<(), String>`
Saves current window state to file.

**Parameters**:
- `app_handle` (AppHandle): Application context
- `state` (WindowState): Window position and size data

**Returns**: Success confirmation.

**Side Effects**: Writes to `~/.claude/claudio-window-state.json`.

#### `load_window_state() -> Result<WindowState, String>`
Loads saved window state from file.

**Returns**: WindowState object or defaults if file doesn't exist.

#### `get_current_window_state(app_handle: AppHandle) -> Result<WindowState, String>`
Gets current window position and size.

**Parameters**:
- `app_handle` (AppHandle): Application context

**Returns**: Current WindowState.

#### `restore_window_state(app_handle: AppHandle) -> Result<(), String>`
Restores window to saved state.

**Parameters**:
- `app_handle` (AppHandle): Application context

**Returns**: Success confirmation.

**Side Effects**: Updates window position, size, and maximized state.

### Window State Management

The system automatically tracks window changes and saves state using event handlers. Window state includes:

```rust
struct WindowState {
    x: i32,           // X position
    y: i32,           // Y position  
    width: u32,       // Window width
    height: u32,      // Window height
    maximized: bool,  // Maximized state
}
```

---

## 11. System Information (1 command)

#### `get_system_memory_info() -> Result<SystemMemoryInfo, String>`
Gets system memory and CPU usage information.

**Returns**: SystemMemoryInfo with process and system metrics.

**Implementation**:
- Unix: Uses `ps` and `vm_stat` commands
- Windows: Returns estimated values
- Includes process memory, system total/available memory, CPU percentage

---

## 12. Session File Watching (4 commands)

Provides real-time monitoring of Claude Code session files with events.

#### `start_session_watching(project_id: String, state: State<SessionWatcherState>) -> Result<(), String>`
Starts watching session files for a project.

**Parameters**:
- `project_id` (String): Project to monitor
- `state` (State): Session watcher state

**Returns**: Success confirmation.

**Side Effects**:
- Creates file system watcher on project sessions directory
- Emits events to frontend on file changes
- Handles create, modify, remove events for .jsonl files

#### `stop_session_watching(project_id: String, state: State<SessionWatcherState>) -> Result<(), String>`
Stops watching session files for specific project.

**Parameters**:
- `project_id` (String): Project to stop monitoring
- `state` (State): Session watcher state

**Returns**: Success confirmation.

#### `stop_all_session_watching(state: State<SessionWatcherState>) -> Result<(), String>`
Stops all session file watchers.

**Parameters**:
- `state` (State): Session watcher state

**Returns**: Success confirmation.

**Side Effects**: Cleans up all active file watchers.

#### `get_session_watching_status(state: State<SessionWatcherState>) -> Result<Vec<String>, String>`
Gets list of projects currently being watched.

**Parameters**:
- `state` (State): Session watcher state

**Returns**: Array of project IDs being monitored.

### Session File Events

The watcher emits `SessionFileEvent` objects to the frontend:

```rust
enum SessionFileEvent {
    Modified { session_id: String, project_id: String, file_path: String, modified_at: u64 },
    Created { session_id: String, project_id: String, file_path: String, created_at: u64 },
    Removed { session_id: String, project_id: String, file_path: String },
}
```

---

## Error Handling Patterns

### Common Error Categories

1. **Filesystem Errors**
   - File not found
   - Permission denied
   - Directory creation failures
   - Invalid paths

2. **JSON/YAML Parsing Errors**
   - Invalid JSON format
   - YAML frontmatter parsing failures
   - Serialization errors

3. **Database Errors**
   - SQLite connection failures
   - SQL execution errors
   - Constraint violations

4. **Process Management Errors**
   - Binary not found
   - Process spawn failures
   - Command execution timeouts

5. **State Management Errors**
   - Lock acquisition failures
   - State initialization errors
   - Concurrent access issues

### Error Response Format

All commands return `Result<T, String>` where the error String provides descriptive error messages suitable for user display.

### Security Considerations

1. **SQL Injection Prevention**: All database operations use parameterized queries
2. **Path Traversal Protection**: File operations validate paths and restrict access
3. **Command Injection Prevention**: Slash command validation checks for dangerous operations
4. **Environment Variable Isolation**: Proxy settings automatically include localhost exclusions

---

## Performance Considerations

### Caching and Optimization

1. **File System Caching**: Project and session lists are computed on-demand but could benefit from caching
2. **Database Connection Pooling**: Single connection with mutex protection may become bottleneck
3. **JSONL Parsing**: Large session files are parsed completely; streaming could improve memory usage
4. **File Watching**: Efficient event-driven updates reduce polling overhead

### Memory Management

1. **Process State**: Limited concurrent process tracking prevents memory leaks
2. **Checkpoint Storage**: Automatic cleanup maintains bounded storage usage
3. **Session Content**: Large JSONL files loaded into memory for analysis

### Scalability Limits

1. **Project Count**: Filesystem scanning scales linearly with project count
2. **Session Size**: Large sessions (>100MB) may impact performance
3. **Concurrent Operations**: Mutex-based synchronization limits parallelism

---

## Summary of Changes

This comprehensive API documentation provides:

1. **Complete Command Coverage**: All 85+ Tauri commands documented with parameters, returns, and side effects
2. **Functional Organization**: Commands grouped by logical categories for easy navigation
3. **Implementation Status**: Clear indication of implemented vs placeholder functionality
4. **Error Handling**: Common error patterns and security considerations
5. **Data Type Reference**: Complete type definitions for complex parameters and returns
6. **Performance Notes**: Scalability considerations and optimization opportunities

## Key Documentation Deliverables

- **Primary File**: `/Users/olivier/Projects/claudio/BACKEND_API_DOCUMENTATION.md`
- **Content**: 85+ command definitions across 12 categories
- **Structure**: Executive summary → Category overviews → Detailed API reference → Error patterns → Performance notes

## Content Metrics

- **Comprehensive Coverage**: All exposed Tauri commands documented
- **Structured Organization**: Commands grouped by functionality
- **Technical Depth**: Parameters, returns, side effects, and error conditions for each command
- **Implementation Clarity**: Clear indication of working vs transitioning features

This documentation serves as the definitive technical reference for frontend developers integrating with the Claudio backend, providing all necessary information to understand and utilize the complete API surface.