// Settings management module
// CRITICAL: This is completely separate from session management
// Following the same patterns as sessions but never merging them

pub mod types;
pub mod orchestrator;
pub mod claudio_manager;
pub mod claudecode_manager;
pub mod watchers;

pub use orchestrator::*;