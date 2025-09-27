use std::path::{Path, PathBuf};
use dirs;

/// Path constants and utilities for Claudio
///
/// This module provides centralized path management based on ACTUAL hardcoded paths found in the codebase.
/// All file paths in the codebase should use these constants and functions.

// ===== Directory Names =====
pub const CLAUDE_DIR_NAME: &str = ".claude";
pub const CLAUDIO_DIR_NAME: &str = ".claudio";
pub const PROJECTS_DIR: &str = "projects";
pub const AGENTS_DIR: &str = "agents";
pub const HOOKS_DIR: &str = "hooks";

// ===== Legacy/Alias Constants =====
pub const CLAUDE_PROJECTS_DIR: &str = PROJECTS_DIR;
pub const CLAUDE_HOOKS_DIR: &str = HOOKS_DIR;

// ===== File Names =====
pub const CLAUDE_SETTINGS_FILE: &str = "settings.json";
pub const CLAUDE_SETTINGS_LOCAL_FILE: &str = "settings.local.json";
pub const CLAUDIO_SETTINGS_FILE: &str = "settings.json";
pub const CLAUDE_MD_FILE: &str = "CLAUDE.md";
pub const CLAUDE_HOOKS_FILE: &str = "hooks.json";

// ===== File Extensions =====
pub const JSON_EXTENSION: &str = ".json";
pub const AGENT_FILE_EXTENSION: &str = "md";
pub const SESSION_FILE_EXTENSION: &str = "jsonl";

// ===== Hook Script Names =====
pub const HOOK_SESSION_START: &str = "claudio-session-start.sh";
pub const HOOK_SESSION_ACTIVE: &str = "claudio-session-active.sh";
pub const HOOK_SESSION_IDLE: &str = "claudio-session-idle.sh";
pub const HOOK_SESSION_END: &str = "claudio-session-end.sh";

// ===== Session Prefixes =====
pub const CLAUDE_SESSION_PREFIX: &str = "claude-";
pub const CLAUDIO_SESSION_PREFIX: &str = "claudio-";

// ===== Path Construction Functions =====

/// Get Claude Code home directory
pub fn claude_home_dir() -> Result<PathBuf, String> {
    dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())
        .map(|p| p.join(CLAUDE_DIR_NAME))
}

/// Get Claudio app home directory
pub fn claudio_home_dir() -> Result<PathBuf, String> {
    dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())
        .map(|p| p.join(CLAUDIO_DIR_NAME))
}

/// Get Claude Code project settings path
pub fn claude_project_settings_path(project_path: &Path) -> PathBuf {
    project_path.join(CLAUDE_DIR_NAME).join(CLAUDE_SETTINGS_FILE)
}

/// Get Claude Code project local settings path
pub fn claude_project_local_settings_path(project_path: &Path) -> PathBuf {
    project_path.join(CLAUDE_DIR_NAME).join(CLAUDE_SETTINGS_LOCAL_FILE)
}

/// Get Claude Code project agents directory
pub fn claude_project_agents_dir(project_path: &Path) -> PathBuf {
    project_path.join(CLAUDE_DIR_NAME).join(AGENTS_DIR)
}

/// Get Claude Code global settings path
pub fn claude_global_settings_path() -> Result<PathBuf, String> {
    claude_home_dir().map(|p| p.join(CLAUDE_SETTINGS_FILE))
}

/// Get Claudio app settings path
pub fn claudio_settings_path() -> Result<PathBuf, String> {
    claudio_home_dir().map(|p| p.join(CLAUDIO_SETTINGS_FILE))
}

// ===== Utility Functions =====

/// Ensure a directory exists, creating it if necessary
pub fn ensure_dir_exists(path: &Path) -> Result<(), String> {
    if !path.exists() {
        std::fs::create_dir_all(path)
            .map_err(|e| format!("Failed to create directory '{}': {}", path.display(), e))?;
    }
    Ok(())
}

/// Ensure the parent directory of a file path exists, creating it if necessary
pub fn ensure_parent_dir_exists(file_path: &Path) -> Result<(), String> {
    if let Some(parent) = file_path.parent() {
        ensure_dir_exists(parent)?;
    }
    Ok(())
}

/// Get Claude Code project directory: <project>/.claude
pub fn claude_project_dir(project_path: &Path) -> PathBuf {
    project_path.join(CLAUDE_DIR_NAME)
}

// ===== Environment Variables Module =====
pub mod env_vars {
    /// Get model from environment variable
    pub fn get_model_from_env() -> Option<String> {
        std::env::var("CLAUDE_MODEL").ok()
            .or_else(|| std::env::var("ANTHROPIC_MODEL").ok())
    }
}