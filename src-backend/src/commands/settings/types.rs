use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

/// Types of settings that can be managed - SEPARATE from session types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SettingsType {
    /// App-level Claudio settings (single file, global)
    #[serde(rename = "claudio")]
    Claudio,
    /// CLI Claude Code settings (multi-level precedence)
    #[serde(rename = "claudecode")]
    ClaudeCode,
}

/// Settings levels for Claude Code precedence (highest to lowest)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SettingsLevel {
    #[serde(rename = "env")]
    Environment,   // Highest priority
    #[serde(rename = "local")]
    Local,         // Project local (.claude/settings.local.json)
    #[serde(rename = "project")]
    Project,       // Project shared (.claude/settings.json)
    #[serde(rename = "global")]
    Global,        // Lowest priority (~/.claude/settings.json)
}

/// Current state of a settings handle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsState {
    pub handle_id: String,
    pub settings_type: SettingsType,
    pub project_path: Option<String>,  // None for global Claudio settings
    pub effective_settings: serde_json::Value,
    pub last_updated: i64,
}

/// Claudio app-level settings structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudioSettings {
    pub theme: Option<String>,           // "light", "dark", "system"
    pub telemetry: Option<bool>,         // Analytics opt-out
    pub auto_update: Option<bool>,       // Auto update Claudio
    pub default_project_path: Option<String>,
    pub window_state: Option<WindowState>,
    pub debug_mode: Option<bool>,
    pub proxy_settings: Option<ProxySettings>,
}

impl Default for ClaudioSettings {
    fn default() -> Self {
        Self {
            theme: Some("system".to_string()),
            telemetry: Some(true),
            auto_update: Some(true),
            default_project_path: None,
            window_state: None,
            debug_mode: Some(false),
            proxy_settings: None,
        }
    }
}

/// Window state for Claudio app
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub width: f64,
    pub height: f64,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub maximized: bool,
    pub fullscreen: bool,
}

/// Proxy settings for Claudio
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxySettings {
    pub enabled: bool,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub password: Option<String>,
}

/// Claude Code CLI configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCodeConfig {
    pub model: Option<String>,          // "auto", "default", "opus", "sonnet", "opusplan"
    pub permissions: Option<Permissions>,
    pub hooks: Option<HookConfig>,
    pub system_prompt: Option<String>,
    pub max_turns: Option<u32>,
    pub auto_save: Option<bool>,
}

impl Default for ClaudeCodeConfig {
    fn default() -> Self {
        Self {
            model: Some("auto".to_string()),
            permissions: None,
            hooks: None,
            system_prompt: None,
            max_turns: None,
            auto_save: Some(true),
        }
    }
}

/// Claude Code settings with multi-level precedence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCodeSettings {
    pub effective: ClaudeCodeConfig,    // Computed final settings
    pub layers: ClaudeCodeLayers,       // Individual layer values
    pub last_computed: i64,             // Cache timestamp
}

/// Individual settings layers for precedence computation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCodeLayers {
    pub env: Option<ClaudeCodeConfig>,     // Environment variables
    pub local: Option<ClaudeCodeConfig>,   // .claude/settings.local.json
    pub project: Option<ClaudeCodeConfig>, // .claude/settings.json
    pub global: Option<ClaudeCodeConfig>,  // ~/.claude/settings.json
}

impl Default for ClaudeCodeLayers {
    fn default() -> Self {
        Self {
            env: None,
            local: None,
            project: None,
            global: Some(ClaudeCodeConfig::default()),
        }
    }
}

/// Permissions configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Permissions {
    pub allowed_tools: Option<Vec<String>>,
    pub denied_tools: Option<Vec<String>>,
    pub auto_approve: Option<bool>,
    pub dangerous_commands: Option<bool>,
}

/// Hook configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookConfig {
    pub session_start: Option<String>,
    pub session_end: Option<String>,
    pub user_prompt_submit: Option<String>,
    pub tool_use: Option<String>,
    pub stop: Option<String>,
    pub subagent_stop: Option<String>,
    pub pre_compact: Option<String>,
}

/// Settings handle for frontend communication
pub struct SettingsHandle {
    pub settings_type: SettingsType,
    pub project_path: Option<String>,
    pub last_updated: std::sync::Arc<RwLock<i64>>,
}


/// Events emitted for settings changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsUpdateEvent {
    pub handle_id: String,
    pub settings_type: SettingsType,
    pub project_path: Option<String>,
    pub updated_settings: serde_json::Value,
    pub timestamp: String,
}


/// Settings orchestrator error types
#[derive(Debug)]
pub enum SettingsError {
    FileError(String),
    SerializationError(String),
}

impl std::fmt::Display for SettingsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SettingsError::FileError(msg) => write!(f, "File error: {}", msg),
            SettingsError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
        }
    }
}

impl std::error::Error for SettingsError {}

impl From<std::io::Error> for SettingsError {
    fn from(err: std::io::Error) -> Self {
        SettingsError::FileError(err.to_string())
    }
}

impl From<serde_json::Error> for SettingsError {
    fn from(err: serde_json::Error) -> Self {
        SettingsError::SerializationError(err.to_string())
    }
}