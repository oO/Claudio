use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

/// Types of settings that can be managed - CLAUDE CODE SETTINGS ONLY
/// Claudio app settings handled separately via claudio_app_settings module
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type")]
pub enum SettingsType {
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
    pub project_path: Option<String>,  // Required for Claude Code settings
    pub effective_settings: serde_json::Value,
    pub last_updated: i64,
}

// Claudio app settings removed - handled by claudio_app_settings module
// Only Claude Code settings remain in the orchestrator system

/// Claude Code CLI configuration - KISS JSON wrapper approach
/// This preserves ALL fields from Claude Code's settings.json including unknown ones
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCodeConfig {
    #[serde(flatten)]
    pub json: serde_json::Value,
}

impl ClaudeCodeConfig {
    /// Create from raw JSON value
    pub fn from_json(json: serde_json::Value) -> Self {
        Self { json }
    }

    /// Create empty config
    pub fn empty() -> Self {
        Self {
            json: serde_json::json!({}),
        }
    }

    /// Get model setting
    pub fn model(&self) -> Option<String> {
        self.json.get("model")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }

    /// Set model setting
    pub fn set_model(&mut self, model: Option<String>) {
        if let Some(model_val) = model {
            self.json["model"] = serde_json::Value::String(model_val);
        } else {
            if let Some(obj) = self.json.as_object_mut() {
                obj.remove("model");
            }
        }
    }




    /// Merge another config into this one (other overwrites this)
    pub fn merge(&mut self, other: &ClaudeCodeConfig) {
        if let (Some(this_obj), Some(other_obj)) = (self.json.as_object_mut(), other.json.as_object()) {
            for (key, value) in other_obj {
                this_obj.insert(key.clone(), value.clone());
            }
        }
    }

    /// Convert to pretty JSON string
    pub fn to_pretty_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(&self.json)
    }
}

impl Default for ClaudeCodeConfig {
    fn default() -> Self {
        Self {
            json: serde_json::json!({
                "model": "auto",
                "auto_save": true
            }),
        }
    }
}

/// CLAUDE CODE SETTINGS (SHARED WITH ANTHROPIC'S CLAUDE CODE BINARY)
/// ⚠️  CRITICAL: These settings are SHARED between our app and Claude Code binary
/// Both applications can read/write these files simultaneously
/// Requires watchers and orchestration to handle concurrent access
/// Files: ~/.claude/settings.json, project/.claude/settings.json, project/.claude/settings.local.json
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

/// Legacy permissions/hooks structs removed - we handle these as raw JSON now
/// This preserves Claude Code's actual format without trying to force it into our structures

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