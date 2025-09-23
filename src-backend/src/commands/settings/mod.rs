// Settings management module
// CRITICAL: This is completely separate from session management
// Following the same patterns as sessions but never merging them

pub mod types;
pub mod claude_code_settings_manager;
pub mod claudecode_manager;
pub mod watchers;

pub use claude_code_settings_manager::*;