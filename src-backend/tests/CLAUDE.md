# Backend Testing Guidelines for Claudio

## 🚨 CRITICAL: Testing Rules You MUST Follow

### 1. **NEVER MODIFY SOURCE FILES**
- ❌ **DO NOT** add `#[cfg(test)]` modules to any file in `src/`
- ❌ **DO NOT** add test functions to existing source files
- ✅ **ONLY** create NEW test files in `src-backend/tests/` directory
- ✅ **ONLY** create helper files in `src-backend/tests/` directory

### 2. **File Naming Convention**
- Test files: `{module_name}_test.rs` (e.g., `agents_test.rs`, `settings_test.rs`)
- Integration tests: `integration_{feature}_test.rs`
- Helper modules: `test_helpers.rs`, `test_utils.rs`

### 3. **Required Test Structure**
```rust
// At the top of EVERY test file
use std::path::PathBuf;
use tempfile::TempDir;
use tokio::test as tokio_test;

// Mock ALL external dependencies
#[tokio_test]
async fn test_function_name() {
    // Use TempDir for file operations
    let temp_dir = TempDir::new().unwrap();
    let test_path = temp_dir.path();

    // Your test implementation
    // NEVER touch real filesystem outside temp_dir
}
```

### 4. **Mocking Requirements**
- **File System**: Use `tempfile::TempDir` for ALL file operations
- **Tauri App Handle**: Use `tauri::test::mock_app()` ONLY if absolutely necessary
- **Network Calls**: Mock ALL HTTP/network requests
- **Process Execution**: Mock ALL external process calls (Claude binary, etc.)
- **Database**: Use in-memory or temp databases only

## Test Organization by Module

### **Agent Management Tests** (`agents_test.rs`)
Test scope: `src/commands/agents.rs`
- Agent CRUD operations (create, read, update, delete)
- YAML frontmatter parsing and validation
- Agent file discovery (user-level and project-level)
- Agent validation and error handling
- File format conversion (markdown generation)

### **Session Logic Tests** (`session_watcher_test.rs`, `sessions_test.rs`)
Test scope: `src/commands/claude/session_watcher.rs`, `src/commands/claude/sessions.rs`
- JSONL parsing and message streaming
- UUID-based deduplication logic
- Session state management and lifecycle
- Resume flow handling and cleanup operations

### **Project Discovery Tests** (`projects_test.rs`)
Test scope: `src/commands/claude/projects.rs`
- Project scanning and detection
- Claude Code project configuration loading
- Project path validation and canonicalization
- Project metadata extraction

### **Execution Tests** (`execution_test.rs`)
Test scope: `src/commands/claude/execution.rs`
- Claude binary execution with arguments
- Process spawning and management (MOCKED)
- Command line argument construction
- Output streaming and capture (MOCKED)

### **Settings Tests** (`settings_test.rs`)
Test scope: `src/commands/settings/` directory
- Multi-layer settings precedence (global, project shared, project local)
- Settings validation and merging logic
- File watcher integration (MOCKED)
- External change detection and synchronization

### **Usage Analytics Tests** (`usage_test.rs`)
Test scope: `src/commands/usage.rs`
- Session statistics collection and aggregation
- Usage metrics calculation
- Data persistence and retrieval (temp database)

### **MCP Tests** (`mcp_test.rs`)
Test scope: `src/commands/mcp.rs`
- MCP server discovery and configuration
- Server lifecycle management (MOCKED)
- Protocol integration and message handling (MOCKED)

### **App Settings Tests** (`claudio_app_settings_test.rs`)
Test scope: `src/commands/claudio_app_settings.rs`
- Simple cache-based settings management
- In-memory settings storage and persistence
- Settings serialization and validation

## Test Requirements Checklist

### For EVERY test function:
- [ ] Uses `#[tokio_test]` for async functions
- [ ] Uses `TempDir` for any file operations
- [ ] Mocks ALL external dependencies
- [ ] Tests both success AND error paths
- [ ] Includes edge cases and boundary conditions
- [ ] Has clear, descriptive test name
- [ ] Documents what exactly is being tested

### For EVERY test module:
- [ ] Has comprehensive test coverage (aim for 70%+)
- [ ] Tests are isolated and don't depend on each other
- [ ] Includes helper functions for common test setup
- [ ] Has realistic test data and fixtures
- [ ] Tests concurrent scenarios where applicable

## Example Test Template

```rust
use tempfile::TempDir;
use tokio::test as tokio_test;
use std::fs;

// Import the module you're testing
// Use relative imports, not absolute paths

#[tokio_test]
async fn test_agent_creation_with_valid_data() {
    // Arrange
    let temp_dir = TempDir::new().unwrap();
    let agent_dir = temp_dir.path().join(".claude").join("agents");
    fs::create_dir_all(&agent_dir).unwrap();

    let agent_content = r#"---
name: "Test Agent"
description: "Test description"
subagent_type: "specialized-agent"
tools: ["tool1", "tool2"]
---
Agent prompt content here..."#;

    // Act
    let result = create_agent(&agent_dir, "test-agent", agent_content).await;

    // Assert
    assert!(result.is_ok());
    let agent_file = agent_dir.join("test-agent.md");
    assert!(agent_file.exists());

    let file_content = fs::read_to_string(&agent_file).unwrap();
    assert!(file_content.contains("Test Agent"));
}

#[tokio_test]
async fn test_agent_creation_with_invalid_yaml() {
    // Test error handling
    let temp_dir = TempDir::new().unwrap();
    let agent_dir = temp_dir.path().join(".claude").join("agents");
    fs::create_dir_all(&agent_dir).unwrap();

    let invalid_content = "invalid yaml content without frontmatter";

    let result = create_agent(&agent_dir, "invalid-agent", invalid_content).await;

    assert!(result.is_err());
    assert!(result.err().unwrap().contains("Invalid YAML"));
}
```

## What NOT to Test
- Don't test external dependencies (Tauri framework itself, file system APIs)
- Don't test third-party crates (serde, tokio, etc.)
- Don't test trivial getters/setters without logic
- Don't test private implementation details that may change

## Performance Testing
- Test with realistic data sizes (large session files, many agents)
- Test concurrent operations (multiple settings updates)
- Test memory usage patterns (cleanup, resource disposal)
- Test timeout scenarios and cancellation

## Compilation Requirements
- ALL tests must compile with `cargo test --no-run`
- Run `cargo check` before submitting ANY test files
- No warnings allowed in test code
- Use `#[allow(dead_code)]` sparingly and only when justified

## Final Verification
Before submitting your tests:

1. **Run the build**: `cargo check` - MUST pass
2. **Run the tests**: `cargo test` - ALL tests MUST pass
3. **Check coverage**: Aim for 70%+ coverage of the module you're testing
4. **Review code**: Ensure tests are readable and maintainable
5. **Verify isolation**: Tests can run in any order and don't interfere

## Common Mistakes to Avoid

❌ **Adding tests to source files in `src/`**
❌ **Using real file paths outside TempDir**
❌ **Making actual network requests**
❌ **Depending on external services**
❌ **Testing implementation details instead of behavior**
❌ **Creating tests that depend on each other**
❌ **Using hardcoded paths or values**
❌ **Forgetting to test error cases**

Remember: Your tests should be reliable, fast, and isolated. They should test the behavior of the code, not its implementation details, and they should never modify the actual source files or depend on external resources.