// This file has been refactored into multiple modules for better maintainability.
// All functionality is now organized into logical modules:
// - types: Common types, structs, and utility functions
// - projects: Project management functionality
// - sessions: Session management functionality  
// - checkpoints: Checkpoint management functionality
// - execution: Claude process execution functionality
// - filesystem: File system operations and CLAUDE.md handling
// - settings: Settings and configuration management
// - hooks: Hook configuration and validation

mod types;
mod projects;
mod sessions;
mod checkpoints;
mod execution;
mod filesystem;
mod settings;
mod hooks;

// Re-export everything from the modular structure for backward compatibility
pub use types::*;
pub use projects::*;
pub use sessions::*;
pub use checkpoints::*;
pub use execution::*;
pub use filesystem::*;
pub use settings::*;
pub use hooks::*;