# Claudio Development Tasks

## Current Status
✅ **Project Foundation Complete** - Tauri + React setup, git repository, basic structure

## Next Development Tasks (Priority Order)

### 🔥 **IMMEDIATE - Start Here**

#### 1. **Implement Agent File Parser** 
**File:** `src-tauri/src/commands/agents.rs`
**Priority:** CRITICAL

```rust
// Add to agents.rs
pub struct AgentParser;

impl AgentParser {
    pub fn parse_file(content: &str) -> Result<Agent, String> {
        // Parse markdown to extract:
        // - Title (first H1)
        // - Description (first paragraph)
        // - Tools (bullet list under ## Tools)
        // - System prompt (content under ## System Prompt)
    }
    
    pub fn generate_markdown(agent: &AgentData) -> String {
        // Generate properly formatted .md from AgentData
    }
}
```

**Acceptance Criteria:**
- Parse valid agent .md files correctly
- Handle malformed files gracefully
- Generate properly formatted markdown
- Include comprehensive error messages

#### 2. **Implement list_agents() Function**
**File:** `src-tauri/src/commands/agents.rs`  
**Priority:** CRITICAL

```rust
#[tauri::command]
pub async fn list_agents(project_path: String) -> Result<Vec<Agent>, String> {
    // 1. Build path to .claude/agents/
    // 2. Read directory contents
    // 3. Filter for .md files
    // 4. Parse each file using AgentParser
    // 5. Return Vec<Agent> with metadata
}
```

**Acceptance Criteria:**
- Scan `.claude/agents/*.md` files recursively
- Return complete Agent metadata
- Handle missing directories gracefully
- Include file timestamps (created_at, updated_at)

#### 3. **Create Basic Agent Studio UI**
**File:** `src/components/AgentStudio.tsx`
**Priority:** HIGH

```tsx
interface AgentStudioProps {
  projectPath: string;
  agentName?: string; // For editing existing agent
}

export function AgentStudio({ projectPath, agentName }: AgentStudioProps) {
  // Form fields for:
  // - Agent name
  // - Description
  // - Tool selection (checkboxes)
  // - System prompt (textarea)
  // - Live markdown preview
}
```

**Acceptance Criteria:**
- Form validation for required fields
- Tool selection with predefined options
- Live preview of generated markdown
- Save/cancel functionality

### 🔥 **HIGH PRIORITY - Week 1**

#### 4. **Implement create_agent() Function**
**File:** `src-tauri/src/commands/agents.rs`
**Priority:** HIGH

```rust
#[tauri::command]
pub async fn create_agent(
    project_path: String,
    agent_data: AgentData,
) -> Result<Agent, String> {
    // 1. Validate agent name (no special chars, .md extension)
    // 2. Create .claude/agents/ directory if needed
    // 3. Generate markdown using AgentParser
    // 4. Write file with error handling
    // 5. Return created Agent metadata
}
```

#### 5. **Project Discovery Implementation**
**File:** `src-tauri/src/commands/claude_integration.rs`
**Priority:** HIGH

```rust
#[tauri::command]
pub async fn get_claude_projects() -> Result<Vec<ClaudeProject>, String> {
    // Scan common directories for .claude/ folders:
    // - ~/Projects/
    // - ~/Development/
    // - ~/Code/
    // - Current working directory
}
```

#### 6. **Research Claude Code Integration** 
**Research Task**
**Priority:** HIGH

**Investigation Areas:**
- Claude Code SDK availability
- Task tool CLI interface  
- Subagent execution methods
- Error handling patterns
- Output capturing techniques

**Deliverable:** Create `CLAUDE_INTEGRATION.md` with findings

### 📋 **MEDIUM PRIORITY - Week 2**

#### 7. **Project Browser UI Component**
**File:** `src/components/ProjectBrowser.tsx`

```tsx
export function ProjectBrowser() {
  // Display discovered Claude projects
  // Show agent counts per project
  // Navigation to project-specific views
}
```

#### 8. **Implement update_agent() Function**
**File:** `src-tauri/src/commands/agents.rs`

#### 9. **Implement delete_agent() Function**  
**File:** `src-tauri/src/commands/agents.rs`

#### 10. **Basic Task Execution**
**File:** `src-tauri/src/commands/claude_integration.rs`
**Depends on:** Claude Code integration research

### 🔧 **LOWER PRIORITY - Week 3+**

#### 11. **Task Dashboard UI**
**File:** `src/components/TaskDashboard.tsx`

#### 12. **Agent Import/Export**
**Files:** Multiple

#### 13. **Error Handling & Polish**
**Files:** Various

## Development Guidelines

### **File Naming Conventions**
- Agent files: `kebab-case-name.md`
- React components: `PascalCase.tsx`
- Rust modules: `snake_case.rs`

### **Testing Strategy**
- Create sample `.claude/agents/*.md` files for testing
- Test with both valid and malformed agent files
- Verify cross-platform file path handling

### **Error Handling Requirements**
- All Rust functions return `Result<T, String>`
- Provide user-friendly error messages
- Log detailed errors for debugging
- Handle edge cases gracefully

### **UI/UX Principles**
- Follow existing Tauri app patterns
- Use Tailwind CSS for consistent styling
- Provide immediate feedback for user actions
- Keep interfaces clean and intuitive

## Sample Agent Files for Testing

Create these in `.claude/agents/` for testing:

**`.claude/agents/code-reviewer.md`:**
```markdown
# Code Reviewer

Reviews code changes for best practices, security, and performance issues.

## Tools
- Read
- Grep
- Bash

## System Prompt
You are a senior code reviewer focused on quality and security.
Review code changes and provide constructive feedback.
Always check for common security vulnerabilities.
```

**`.claude/agents/documentation-writer.md`:**
```markdown
# Documentation Writer

Creates and maintains technical documentation.

## Tools  
- Read
- Write
- Glob

## System Prompt
You are a technical writer who creates clear, comprehensive documentation.
Focus on user-friendly explanations and practical examples.
```

## Git Workflow

**Commit Message Format:**
```
type: brief description (vX.X.X)

- Bullet point describing change 1
- Bullet point describing change 2

Designed with ❤️ by oO. Coded with ✨ by Claude Sonnet 4
Co-authored-by: Claude.AI <noreply@anthropic.com>
```

**Types:** `feat:` `fix:` `docs:` `refactor:` `test:` `chore:`

## Ready to Start?

1. **Clone and setup:** `npm install && npm run tauri:dev`
2. **Start with:** `src-tauri/src/commands/agents.rs` 
3. **Create test agents:** Add sample .md files in `.claude/agents/`
4. **Build incrementally:** Test each function before moving to next
5. **Follow the design:** Reference `DESIGN.md` for architecture decisions

The foundation is ready - time to build! 🚀