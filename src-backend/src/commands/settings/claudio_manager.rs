use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::AppHandle;
use serde_json;
use std::fs;

use crate::paths::{claudio_settings_path, ensure_parent_dir_exists};
use super::types::ClaudioSettings;

/// Manager for Claudio app-level settings
/// Handles single file with simple auto-save
pub struct ClaudioSettingsManager {
    settings_cache: Arc<RwLock<Option<ClaudioSettings>>>,
}

impl ClaudioSettingsManager {
    pub fn new(_app_handle: AppHandle) -> Self {
        Self {
            settings_cache: Arc::new(RwLock::new(None)),
        }
    }

    /// Get current Claudio settings with caching
    pub async fn get_settings(&self) -> Result<serde_json::Value, String> {
        // Check cache first
        {
            let cache_guard = self.settings_cache.read().await;
            if let Some(cached_settings) = cache_guard.as_ref() {
                return serde_json::to_value(cached_settings)
                    .map_err(|e| format!("Failed to serialize cached settings: {}", e));
            }
        }

        // Load from file if not cached
        let settings = self.load_from_file().await?;

        // Update cache
        {
            let mut cache_guard = self.settings_cache.write().await;
            *cache_guard = Some(settings.clone());
        }

        serde_json::to_value(settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))
    }

    /// Update a specific setting with auto-save
    pub async fn update_setting(&self, key: String, value: serde_json::Value) -> Result<(), String> {
        log::debug!("ClaudioSettingsManager: updating setting {} = {:?}", key, value);

        // Load current settings
        let mut current_settings = self.load_from_file().await?;

        // Update the specific field
        match key.as_str() {
            "theme" => {
                current_settings.theme = serde_json::from_value(value)
                    .map_err(|e| format!("Invalid theme value: {}", e))?;
            },
            "telemetry" => {
                current_settings.telemetry = serde_json::from_value(value)
                    .map_err(|e| format!("Invalid telemetry value: {}", e))?;
            },
            "auto_update" => {
                current_settings.auto_update = serde_json::from_value(value)
                    .map_err(|e| format!("Invalid auto_update value: {}", e))?;
            },
            "default_project_path" => {
                current_settings.default_project_path = serde_json::from_value(value)
                    .map_err(|e| format!("Invalid default_project_path value: {}", e))?;
            },
            "debug_mode" => {
                current_settings.debug_mode = serde_json::from_value(value)
                    .map_err(|e| format!("Invalid debug_mode value: {}", e))?;
            },
            "window_state" => {
                current_settings.window_state = serde_json::from_value(value)
                    .map_err(|e| format!("Invalid window_state value: {}", e))?;
            },
            "proxy_settings" => {
                current_settings.proxy_settings = serde_json::from_value(value)
                    .map_err(|e| format!("Invalid proxy_settings value: {}", e))?;
            },
            _ => {
                return Err(format!("Unknown Claudio setting key: {}", key));
            }
        }

        // Save to file (auto-save)
        self.save_to_file(&current_settings).await?;

        // Update cache
        {
            let mut cache_guard = self.settings_cache.write().await;
            *cache_guard = Some(current_settings);
        }

        log::debug!("ClaudioSettingsManager: successfully updated setting {}", key);
        Ok(())
    }

    /// Load settings from file
    async fn load_from_file(&self) -> Result<ClaudioSettings, String> {
        let settings_path = claudio_settings_path()
            .map_err(|e| format!("Failed to get settings path: {}", e))?;

        if !settings_path.exists() {
            log::debug!("Claudio settings file not found, using defaults");
            return Ok(ClaudioSettings::default());
        }

        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read Claudio settings file: {}", e))?;

        if content.trim().is_empty() {
            log::debug!("Claudio settings file is empty, using defaults");
            return Ok(ClaudioSettings::default());
        }

        // Parse JSON with validation
        let settings: ClaudioSettings = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse Claudio settings JSON: {}", e))?;

        log::debug!("Successfully loaded Claudio settings from file");
        Ok(settings)
    }

    /// Save settings to file with atomic write
    async fn save_to_file(&self, settings: &ClaudioSettings) -> Result<(), String> {
        let settings_path = claudio_settings_path()
            .map_err(|e| format!("Failed to get settings path: {}", e))?;

        // Ensure parent directory exists
        ensure_parent_dir_exists(&settings_path)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;

        // Serialize with pretty printing
        let json_content = serde_json::to_string_pretty(settings)
            .map_err(|e| format!("Failed to serialize Claudio settings: {}", e))?;

        // Atomic write (write to temp file, then rename)
        let temp_path = settings_path.with_extension("tmp");

        fs::write(&temp_path, &json_content)
            .map_err(|e| format!("Failed to write temp Claudio settings file: {}", e))?;

        fs::rename(&temp_path, &settings_path)
            .map_err(|e| format!("Failed to commit Claudio settings file: {}", e))?;

        log::debug!("Successfully saved Claudio settings to file");
        Ok(())
    }

}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use tauri::test::{MockApp, mock_context};

    #[tokio::test]
    async fn test_claudio_settings_manager() {
        let app = MockApp::new(mock_context());
        let manager = ClaudioSettingsManager::new(app.handle().clone());

        // Test default settings
        let settings = manager.get_settings().await.unwrap();
        assert!(settings.is_object());

        // Test update setting
        manager.update_setting(
            "theme".to_string(),
            serde_json::Value::String("dark".to_string())
        ).await.unwrap();

        // Verify update
        let updated_settings = manager.get_settings().await.unwrap();
        assert_eq!(updated_settings["theme"], "dark");
    }

}