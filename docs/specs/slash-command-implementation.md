# Slash Command Implementation Specification

**Status:** ✅ **FULLY IMPLEMENTED**
**Created:** 2025-01-15
**Version:** 1.0.0

## Overview

Claudio provides a **complete implementation** of Claude Code's slash command system with an enhanced visual management layer. This spec documents the existing architecture that extends Claude Code's native file-based slash commands with a GUI for creation, editing, and organization.

### Key Features
- ✅ File-based storage compatible with Claude Code native format
- ✅ Dual-level support (user `~/.claude/commands/` + project `.claude/commands/`)
- ✅ Visual management interface with no-code editing
- ✅ Full CRUD operations via Tauri backend
- ✅ Namespace organization for command grouping
- ✅ YAML frontmatter support for metadata
- ✅ Integration with PromptInput for live command selection

## Architecture Overview

```
┌─────────────────────────────────────────┐
│           Frontend Components           │
├─────────────────────────────────────────┤
│ • SlashCommandsManager (visual editor)  │
│ • SlashCommandPicker (inline selection) │
│ • CommandsSettings (global management)  │
│ • Project integration tabs             │
└─────────────────────────────────────────┘
                    │
              Tauri API Bridge
                    │
┌─────────────────────────────────────────┐
│      Backend (src/commands/slash_       │
│              commands.rs)                │
├─────────────────────────────────────────┤
│ • SlashCommand struct with metadata     │
│ • YAML frontmatter parsing             │
│ • Recursive .md file discovery         │
│ • Command validation & CRUD ops        │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│         File Storage Structure          │
├─────────────────────────────────────────┤
│ ~/.claude/commands/*.md (user)          │
│ <project>/.claude/commands/*.md (proj)  │
│ • Filename = command name               │
│ • YAML frontmatter + markdown content   │
└─────────────────────────────────────────┘
```

## Backend Implementation

### Core Data Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlashCommand {
    pub id: String,                    // Unique identifier
    pub name: String,                  // Command name (without /)
    pub full_command: String,          // Full command (e.g., "/review")
    pub scope: String,                 // "project" | "user" | "default"
    pub namespace: Option<String>,     // Organization namespace
    pub file_path: String,            // Path to .md file
    pub content: String,              // Markdown body
    pub description: Option<String>,   // From frontmatter
    pub allowed_tools: Vec<String>,   // Tool permissions
    pub has_bash_commands: bool,      // Contains ! prefix
    pub has_file_references: bool,    // Contains @ references
    pub accepts_arguments: bool,      // Uses $ARGUMENTS
}
```

### File Format Specification

Commands are stored as markdown files with optional YAML frontmatter:

```markdown
---
description: "Review code for best practices and security issues"
allowed-tools:
  - "Read"
  - "Grep"
  - "Edit"
---

Review the following code for best practices, potential security issues, and improvements:

@$ARGUMENTS

Focus on:
- Code quality and maintainability
- Security vulnerabilities
- Performance optimizations
- Best practices compliance
```

### Directory Structure & Discovery

```
~/.claude/commands/          # User-level commands
├── review.md               # /review command
├── frontend/
│   ├── component.md       # /component (frontend namespace)
│   └── optimize.md        # /optimize (frontend namespace)
└── backend/
    └── migrate.md         # /migrate (backend namespace)

<project>/.claude/commands/ # Project-specific commands
├── deploy.md              # /deploy (project scope)
└── test.md                # /test (project scope)
```

**Important:** Subdirectories provide **organization only** - they show in command descriptions but don't create actual namespaces in the command names. All commands exist in a single flat namespace.

### Backend API Commands

```rust
// Discovery & listing
#[tauri::command]
pub async fn slash_commands_list(project_path: Option<String>) -> Result<Vec<SlashCommand>, String>

// Individual command access
#[tauri::command]
pub async fn slash_command_get(command_id: String) -> Result<SlashCommand, String>

// CRUD operations
#[tauri::command]
pub async fn slash_command_save(/* params */) -> Result<SlashCommand, String>

#[tauri::command]
pub async fn slash_command_delete(command_id: String, project_path: Option<String>) -> Result<String, String>
```

### File Processing Logic

1. **Discovery**: Recursively scan `.claude/commands/` directories
2. **Parsing**: Extract YAML frontmatter and markdown content
3. **Validation**: Check for special markers (`$ARGUMENTS`, `!`, `@`)
4. **ID Generation**: Create unique IDs from scope + file path
5. **Command Building**: Construct full command names and metadata

## Frontend Implementation

### Component Architecture

#### SlashCommandsManager
- **Location**: `src-frontend/components/common/SlashCommandsManager.tsx`
- **Purpose**: Visual command management interface
- **Features**:
  - Create/edit/delete commands
  - Namespace organization
  - Template examples for common patterns
  - Tool permission configuration
  - Scope filtering (project/user/all)

#### SlashCommandPicker
- **Location**: `src-frontend/components/common/SlashCommandPicker.tsx`
- **Purpose**: Inline command selection during prompt input
- **Features**:
  - Real-time command filtering
  - Keyboard navigation
  - Argument placeholder detection
  - Context-aware suggestions

### Integration Points

1. **Settings Tab**: Global user command management
   ```tsx
   // src-frontend/components/settings/Settings.tsx
   <CommandsSettings /> // Wraps SlashCommandsManager
   ```

2. **Project Details**: Project-specific command management
   ```tsx
   // src-frontend/components/projects/ProjectDetail.tsx
   <SlashCommandsManager projectPath={projectPath} />
   ```

3. **PromptInput Integration**: Live command selection
   ```tsx
   // src-frontend/components/sessions/PromptInput.tsx
   <SlashCommandPicker
     projectPath={projectPath}
     onSelect={handleSlashCommandSelect}
     initialQuery={slashCommandQuery}
   />
   ```

### API Layer

```typescript
// src-frontend/lib/api.ts
export interface SlashCommand {
  id: string;
  name: string;
  full_command: string;
  scope: string;
  namespace?: string;
  file_path: string;
  content: string;
  description?: string;
  allowed_tools: string[];
  has_bash_commands: boolean;
  has_file_references: boolean;
  accepts_arguments: boolean;
}

// API methods
async slashCommandsList(projectPath?: string): Promise<SlashCommand[]>
async slashCommandGet(commandId: string): Promise<SlashCommand>
async slashCommandSave(/* params */): Promise<SlashCommand>
async slashCommandDelete(commandId: string, projectPath?: string): Promise<string>
```

## Command Features & Special Syntax

### Argument Handling
- `$ARGUMENTS` - Capture all arguments after command
- `$1`, `$2`, `$3` - Access individual positional arguments
- Example: `/deploy staging feature-x` → `$1="staging"`, `$2="feature-x"`

### File References
- `@filename` - Reference files in command content
- Integrated with FilePicker component
- Supports project-relative paths

### Bash Integration
- `!command` prefix - Execute bash commands within slash commands
- Requires `allowed-tools: ["Bash"]` in frontmatter
- Output included in command context

### Tool Permissions
Commands can specify allowed Claude Code tools in frontmatter:
```yaml
allowed-tools:
  - "Read"
  - "Edit"
  - "Bash"
  - "WebSearch"
```

## Default Commands

The system includes built-in commands for common workflows:

```typescript
const DEFAULT_COMMANDS = [
  { name: "add-dir", description: "Add additional working directories" },
  { name: "init", description: "Initialize project with CLAUDE.md guide" },
  { name: "review", description: "Request code review" }
];
```

## Data Flow

### Command Discovery Flow
```
1. Frontend requests commands → API.slashCommandsList()
2. Backend scans file directories → find_markdown_files()
3. Parse each .md file → load_command_from_file()
4. Extract metadata → parse_markdown_with_frontmatter()
5. Build command objects → SlashCommand struct
6. Return to frontend → Display in UI components
```

### Command Execution Flow
```
1. User types "/" in PromptInput → SlashCommandPicker opens
2. User selects command → Arguments replaced in prompt
3. Prompt sent to Claude Code → Native execution
4. Commands executed by Claude Code CLI → Results streamed back
```

### Command Management Flow
```
1. User opens SlashCommandsManager → Load existing commands
2. Create/Edit command → Form validation
3. Save command → Write .md file with frontmatter
4. Refresh UI → Re-scan filesystem
```

## File System Operations

### Command Creation
1. Validate command name (no conflicts)
2. Sanitize filename (kebab-case.md)
3. Build directory structure if namespaced
4. Generate frontmatter + content
5. Write file atomically

### Command Deletion
1. Find command by ID
2. Delete .md file
3. Clean up empty directories
4. Update UI state

### Namespace Handling
- Subdirectories used for organization
- Show in command descriptions: "(project:frontend)"
- Don't affect actual command names
- Multiple commands can have same base name if different scopes

## Performance Considerations

### File System Scanning
- Recursive directory traversal
- Markdown file filtering (.md extension)
- Skip hidden files/directories (starting with .)
- Cache results during single session

### Memory Management
- Commands loaded on-demand
- Frontend state management via React hooks
- Backend uses temporary IDs for compatibility

### Scalability
- Efficient file I/O operations
- Lazy loading of command content
- Minimal memory footprint

## Error Handling

### Backend Error Cases
- Invalid YAML frontmatter → Fallback to plain content
- Missing command files → Skip gracefully
- Permission issues → Return error messages
- Malformed markdown → Log warnings, continue

### Frontend Error Cases
- API failures → Show error states
- Invalid command data → Form validation
- Network issues → Retry mechanisms

## Security Considerations

### File System Access
- Commands restricted to `.claude/commands/` directories
- Path traversal prevention
- Safe filename sanitization

### Tool Permissions
- Explicit allow-lists in frontmatter
- No implicit tool access
- User must explicitly grant permissions

### Content Validation
- Sanitize command names
- Validate frontmatter structure
- Prevent malicious command content

## Integration with Claude Code

### Native Compatibility
- File format matches Claude Code specifications
- Commands discoverable by Claude Code CLI
- Arguments passed through correctly
- Tool permissions respected

### Enhanced Features
- Visual management interface (beyond native Claude Code)
- Command organization and search
- Template system for common patterns
- Analytics and usage tracking

## Testing Strategy

### Backend Tests
- File parsing validation
- CRUD operation testing
- Error condition handling
- Cross-platform compatibility

### Frontend Tests
- Component rendering
- User interaction flows
- API integration
- Error state handling

## Future Enhancements

### Planned Features
- [ ] Command templates and snippets
- [ ] Usage analytics and metrics
- [ ] Command sharing and export
- [ ] Advanced search and filtering
- [ ] Command versioning

### Integration Opportunities
- Enhanced Claude Code Task tool integration
- Advanced argument validation
- Command composition and chaining
- Real-time collaboration features

## Development Guidelines

### Code Standards
- Use `SlashCommand` prefix for types and components
- Follow existing Tauri command patterns
- Maintain compatibility with Claude Code format
- Use centralized logger system (`logger.info()`)

### File Organization
```
Backend:  src-backend/src/commands/slash_commands.rs
Frontend: src-frontend/components/common/SlashCommands*.tsx
API:      src-frontend/lib/api.ts (slashCommand* methods)
Types:    src-frontend/lib/api.ts (SlashCommand interface)
Hooks:    src-frontend/hooks/useSlashCommands.ts
```

### Documentation
- Keep this spec updated with changes
- Document new command features
- Maintain API compatibility notes
- Include migration guides for breaking changes

---

**Last Updated:** 2025-01-15
**Authors:** CloCo (Claudio AI Assistant)
**Reviewers:** oO

This implementation provides a complete slash command system that enhances Claude Code's native capabilities while maintaining full compatibility with the underlying file-based architecture.