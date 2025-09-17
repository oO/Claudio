use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::AppHandle;
use serde_json;
use std::fs;
use std::path::Path;

use crate::paths::{
    claude_global_settings_path,
    claude_project_settings_path,
    claude_project_local_settings_path,
    ensure_parent_dir_exists,
    env_vars
};
use super::types::{ClaudeCodeSettings, ClaudeCodeConfig, ClaudeCodeLayers, SettingsLevel};

/// Manager for Claude Code CLI settings with multi-level precedence
/// Handles global, project, local, and environment variable layers
pub struct ClaudeCodeSettingsManager {
    settings_cache: Arc<RwLock<HashMap<String, ClaudeCodeSettings>>>, // Key: project_path or "global"
}

impl ClaudeCodeSettingsManager {
    pub fn new(_app_handle: AppHandle) -> Self {
        Self {
            settings_cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Get effective settings with precedence resolution
    pub async fn get_effective_settings(&self, project_path: Option<&str>) -> Result<serde_json::Value, String> {
        let cache_key = project_path.unwrap_or("global").to_string();

        // Check cache first
        {
            let cache_guard = self.settings_cache.read().await;
            if let Some(cached_settings) = cache_guard.get(&cache_key) {
                // Check if cache is still fresh (within 5 seconds)
                let cache_age = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as i64 - cached_settings.last_computed;

                if cache_age < 5000 {
                    return serde_json::to_value(cached_settings)
                        .map_err(|e| format!("Failed to serialize cached settings: {}", e));
                }
            }
        }

        // Compute fresh settings
        let settings = self.compute_effective_settings(project_path).await?;

        // Update cache
        {
            let mut cache_guard = self.settings_cache.write().await;
            cache_guard.insert(cache_key, settings.clone());
        }

        serde_json::to_value(settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))
    }

    /// Update a setting at a specific level with auto-save
    pub async fn update_project_setting(
        &self,
        project_path: Option<&str>,
        key: String,
        value: serde_json::Value,
        level: SettingsLevel,
    ) -> Result<(), String> {
        log::debug!("ClaudeCodeSettingsManager: updating setting {} = {:?} at level {:?} for project {:?}",
                   key, value, level, project_path);

        match level {
            SettingsLevel::Environment => {
                return Err("Cannot update environment variables through settings API".to_string());
            },
            SettingsLevel::Global => {
                self.update_global_setting(key.clone(), value).await?;
            },
            SettingsLevel::Project => {
                if let Some(path) = project_path {
                    self.update_project_file_setting(path, key.clone(), value, false).await?;
                } else {
                    return Err("Project path required for project-level settings".to_string());
                }
            },
            SettingsLevel::Local => {
                if let Some(path) = project_path {
                    self.update_project_file_setting(path, key.clone(), value, true).await?;
                } else {
                    return Err("Project path required for local settings".to_string());
                }
            },
        }

        // Invalidate cache for this project
        self.invalidate_cache(project_path).await;

        log::debug!("ClaudeCodeSettingsManager: successfully updated setting {}", key);
        Ok(())
    }

    /// Compute effective settings by applying precedence rules
    async fn compute_effective_settings(&self, project_path: Option<&str>) -> Result<ClaudeCodeSettings, String> {
        log::debug!("Computing effective settings for project: {:?}", project_path);

        // Load all layers
        let env_layer = self.load_env_layer().await;
        let global_layer = self.load_global_layer().await?;
        let (project_layer, local_layer) = if let Some(path) = project_path {
            (
                self.load_project_layer(path).await?,
                self.load_local_layer(path).await?
            )
        } else {
            (None, None)
        };

        let layers = ClaudeCodeLayers {
            env: env_layer,
            local: local_layer,
            project: project_layer,
            global: global_layer,
        };

        // Apply precedence (env > local > project > global)
        let effective = self.merge_configs(&layers);

        Ok(ClaudeCodeSettings {
            effective,
            layers,
            last_computed: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64,
        })
    }

    /// Load environment variables layer
    async fn load_env_layer(&self) -> Option<ClaudeCodeConfig> {
        let mut config = ClaudeCodeConfig::default();
        let mut has_any = false;

        // Check for model environment variable
        if let Some(model) = env_vars::get_model_from_env() {
            config.model = Some(model);
            has_any = true;
        }

        // TODO: Add other environment variables as needed
        // ANTHROPIC_API_KEY, etc.

        if has_any {
            Some(config)
        } else {
            None
        }
    }

    /// Load global settings layer
    async fn load_global_layer(&self) -> Result<Option<ClaudeCodeConfig>, String> {
        let global_path = claude_global_settings_path()
            .map_err(|e| format!("Failed to get global settings path: {}", e))?;

        if !global_path.exists() {
            return Ok(Some(ClaudeCodeConfig::default()));
        }

        self.load_config_from_file(&global_path).await
    }

    /// Load project settings layer
    async fn load_project_layer(&self, project_path: &str) -> Result<Option<ClaudeCodeConfig>, String> {
        let project_settings_path = claude_project_settings_path(Path::new(project_path));

        if !project_settings_path.exists() {
            return Ok(None);
        }

        self.load_config_from_file(&project_settings_path).await
    }

    /// Load local settings layer
    async fn load_local_layer(&self, project_path: &str) -> Result<Option<ClaudeCodeConfig>, String> {
        let local_settings_path = claude_project_local_settings_path(Path::new(project_path));

        if !local_settings_path.exists() {
            return Ok(None);
        }

        self.load_config_from_file(&local_settings_path).await
    }

    /// Load config from a specific file
    async fn load_config_from_file(&self, file_path: &Path) -> Result<Option<ClaudeCodeConfig>, String> {
        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("Failed to read settings file {:?}: {}", file_path, e))?;

        if content.trim().is_empty() {
            return Ok(None);
        }

        // Parse JSON
        let config: ClaudeCodeConfig = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse settings JSON from {:?}: {}", file_path, e))?;

        Ok(Some(config))
    }

    /// Merge configs according to precedence rules
    fn merge_configs(&self, layers: &ClaudeCodeLayers) -> ClaudeCodeConfig {
        let mut effective = ClaudeCodeConfig::default();

        // Apply in reverse precedence order (lowest to highest)
        // Global layer (lowest precedence)
        if let Some(global) = &layers.global {
            self.apply_config(&mut effective, global);
        }

        // Project layer
        if let Some(project) = &layers.project {
            self.apply_config(&mut effective, project);
        }

        // Local layer
        if let Some(local) = &layers.local {
            self.apply_config(&mut effective, local);
        }

        // Environment layer (highest precedence)
        if let Some(env) = &layers.env {
            self.apply_config(&mut effective, env);
        }

        effective
    }

    /// Apply one config over another (higher precedence overwrites)
    fn apply_config(&self, target: &mut ClaudeCodeConfig, source: &ClaudeCodeConfig) {
        if source.model.is_some() {
            target.model = source.model.clone();
        }
        if source.permissions.is_some() {
            target.permissions = source.permissions.clone();
        }
        if source.hooks.is_some() {
            target.hooks = source.hooks.clone();
        }
        if source.system_prompt.is_some() {
            target.system_prompt = source.system_prompt.clone();
        }
        if source.max_turns.is_some() {
            target.max_turns = source.max_turns;
        }
        if source.auto_save.is_some() {
            target.auto_save = source.auto_save;
        }
    }

    /// Update global settings file
    async fn update_global_setting(&self, key: String, value: serde_json::Value) -> Result<(), String> {
        let global_path = claude_global_settings_path()
            .map_err(|e| format!("Failed to get global settings path: {}", e))?;

        let mut config = self.load_config_from_file(&global_path).await?
            .unwrap_or_default();

        self.update_config_field(&mut config, key, value)?;
        self.save_config_to_file(&config, &global_path).await
    }

    /// Update project or local settings file
    async fn update_project_file_setting(
        &self,
        project_path: &str,
        key: String,
        value: serde_json::Value,
        is_local: bool,
    ) -> Result<(), String> {
        let settings_path = if is_local {
            claude_project_local_settings_path(Path::new(project_path))
        } else {
            claude_project_settings_path(Path::new(project_path))
        };

        let mut config = self.load_config_from_file(&settings_path).await?
            .unwrap_or_default();

        self.update_config_field(&mut config, key, value)?;
        self.save_config_to_file(&config, &settings_path).await
    }

    /// Update a specific field in config
    fn update_config_field(
        &self,
        config: &mut ClaudeCodeConfig,
        key: String,
        value: serde_json::Value,
    ) -> Result<(), String> {
        match key.as_str() {
            "model" => {
                config.model = serde_json::from_value(value)
                    .map_err(|e| format!("Invalid model value: {}", e))?;
            },
            "permissions" => {
                config.permissions = serde_json::from_value(value)
                    .map_err(|e| format!("Invalid permissions value: {}", e))?;
            },
            "hooks" => {
                config.hooks = serde_json::from_value(value)
                    .map_err(|e| format!("Invalid hooks value: {}", e))?;
            },
            "system_prompt" => {
                config.system_prompt = serde_json::from_value(value)
                    .map_err(|e| format!("Invalid system_prompt value: {}", e))?;
            },
            "max_turns" => {
                config.max_turns = serde_json::from_value(value)
                    .map_err(|e| format!("Invalid max_turns value: {}", e))?;
            },
            "auto_save" => {
                config.auto_save = serde_json::from_value(value)
                    .map_err(|e| format!("Invalid auto_save value: {}", e))?;
            },
            _ => {
                return Err(format!("Unknown Claude Code setting key: {}", key));
            }
        }

        Ok(())
    }

    /// Save config to file with atomic write
    async fn save_config_to_file(&self, config: &ClaudeCodeConfig, file_path: &Path) -> Result<(), String> {
        // Ensure parent directory exists
        ensure_parent_dir_exists(file_path)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;

        // Serialize with pretty printing
        let json_content = serde_json::to_string_pretty(config)
            .map_err(|e| format!("Failed to serialize Claude Code settings: {}", e))?;

        // Atomic write
        let temp_path = file_path.with_extension("tmp");

        fs::write(&temp_path, &json_content)
            .map_err(|e| format!("Failed to write temp settings file: {}", e))?;

        fs::rename(&temp_path, file_path)
            .map_err(|e| format!("Failed to commit settings file: {}", e))?;

        log::debug!("Successfully saved Claude Code settings to {:?}", file_path);
        Ok(())
    }

    /// Invalidate cache for a project
    async fn invalidate_cache(&self, project_path: Option<&str>) {
        let cache_key = project_path.unwrap_or("global").to_string();
        let mut cache_guard = self.settings_cache.write().await;
        cache_guard.remove(&cache_key);
        log::debug!("Invalidated settings cache for: {}", cache_key);
    }

}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use tauri::test::{MockApp, mock_context};

    #[tokio::test]
    async fn test_precedence_resolution() {
        let app = MockApp::new(mock_context());
        let manager = ClaudeCodeSettingsManager::new(app.handle().clone());

        // Create temp project
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path().to_str().unwrap();

        // Set different models at different levels
        manager.update_project_setting(
            None,
            "model".to_string(),
            serde_json::Value::String("sonnet".to_string()),
            SettingsLevel::Global
        ).await.unwrap();

        manager.update_project_setting(
            Some(project_path),
            "model".to_string(),
            serde_json::Value::String("opus".to_string()),
            SettingsLevel::Project
        ).await.unwrap();

        // Project should override global
        let settings = manager.get_effective_settings(Some(project_path)).await.unwrap();
        assert_eq!(settings["effective"]["model"], "opus");
    }

    #[tokio::test]
    async fn test_local_override() {
        let app = MockApp::new(mock_context());
        let manager = ClaudeCodeSettingsManager::new(app.handle().clone());

        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path().to_str().unwrap();

        // Set project and local settings
        manager.update_project_setting(
            Some(project_path),
            "model".to_string(),
            serde_json::Value::String("sonnet".to_string()),
            SettingsLevel::Project
        ).await.unwrap();

        manager.update_project_setting(
            Some(project_path),
            "model".to_string(),
            serde_json::Value::String("opus".to_string()),
            SettingsLevel::Local
        ).await.unwrap();

        // Local should override project
        let settings = manager.get_effective_settings(Some(project_path)).await.unwrap();
        assert_eq!(settings["effective"]["model"], "opus");
    }
}