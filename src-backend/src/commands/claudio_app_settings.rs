// ============================================================================
// CLAUDIO APP-ONLY SETTINGS SYSTEM
// ============================================================================
// This file handles settings that are ONLY used by our Claudio app.
// NO external tools (including Claude Code binary) read or write these files.
//
// Settings include: window position, tabs, proxy config, binary path
// File location: ~/.claudio/settings.json
//
// Simple model: load from disk when needed, save when changed
// No watchers needed since only our app accesses these files
// ============================================================================

use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use crate::commands::window::WindowState;

// Global state for save deduplication
static LAST_SAVE: std::sync::LazyLock<Arc<Mutex<Option<(Instant, String)>>>> =
    std::sync::LazyLock::new(|| Arc::new(Mutex::new(None)));

const SAVE_DEBOUNCE_MS: u64 = 500;


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProxySettings {
    pub http_proxy: Option<String>,
    pub https_proxy: Option<String>,
    pub no_proxy: Option<String>,
    pub all_proxy: Option<String>,
    pub enabled: bool,
}


/// CLAUDIO APP-ONLY SETTINGS
/// These settings are ONLY used by our Claudio app - NO external tools read/write them
/// Simple load/save model - no watchers needed since only we access this file
/// Location: ~/.claudio/settings.json
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudioAppSettings {
    #[serde(default)]
    pub proxy: ProxySettings,
    #[serde(default)]
    pub claude_binary_path: Option<String>,
    #[serde(default)]
    pub window_state: Option<WindowState>,
    #[serde(default)]
    pub tabs_session: Option<serde_json::Value>, // Tab session data as JSON (array for legacy, object for new format)
    // Future Claudio-specific settings can be added here
    // pub analytics: AnalyticsSettings,
}

impl Default for ProxySettings {
    fn default() -> Self {
        Self {
            http_proxy: None,
            https_proxy: None,
            no_proxy: None,
            all_proxy: None,
            enabled: false,
        }
    }
}


impl Default for ClaudioAppSettings {
    fn default() -> Self {
        Self {
            proxy: ProxySettings::default(),
            claude_binary_path: None,
            window_state: None,
            tabs_session: None,
        }
    }
}

/// Get proxy settings from file
#[tauri::command]
pub async fn get_proxy_settings() -> Result<ProxySettings, String> {
    let claudio_settings = load_claudio_app_settings().await?;
    Ok(claudio_settings.proxy)
}

/// Read all Claudio app settings from file
/// Load Claudio app-only settings from ~/.claudio/settings.json
/// This is ONLY for our app - window position, tabs, proxy, etc.
pub async fn load_claudio_app_settings() -> Result<ClaudioAppSettings, String> {
    use crate::commands::claudio_storage::get_claudio_settings_file;
    
    let claudio_file = get_claudio_settings_file()?;
    
    if !claudio_file.exists() {
        log::info!("Claudio settings file not found, creating empty file");
        // Create minimal empty JSON file
        fs::write(&claudio_file, "{}")
            .map_err(|e| format!("Failed to create empty settings file: {}", e))?;
        return Ok(ClaudioAppSettings::default());
    }
    
    let content = fs::read_to_string(&claudio_file)
        .map_err(|e| format!("Failed to read Claudio settings file: {}", e))?;

    if content.trim().is_empty() {
        log::warn!("Claudio settings file is empty, initializing with empty JSON");
        fs::write(&claudio_file, "{}")
            .map_err(|e| format!("Failed to initialize empty settings file: {}", e))?;
        return Ok(ClaudioAppSettings::default());
    }

    let settings: ClaudioAppSettings = serde_json::from_str(&content)
        .map_err(|e| {
            log::error!("Failed to parse Claudio settings JSON: {}", e);
            log::error!("File content: '{}'", content);
            // Backup corrupted file for debugging
            let backup_path = claudio_file.with_extension("json.corrupted");
            let _ = fs::copy(&claudio_file, &backup_path);
            log::warn!("Backed up corrupted settings to: {:?}", backup_path);
            format!("Failed to parse Claudio settings JSON: {}", e)
        })?;
    
    Ok(settings)
}

/// Save proxy settings to file immediately
#[tauri::command]
pub async fn save_proxy_settings(settings: ProxySettings) -> Result<(), String> {
    log::info!("💾 Saving proxy settings");

    // Load existing settings
    let mut claudio_settings = load_claudio_app_settings().await.unwrap_or_default();

    // Update proxy settings
    claudio_settings.proxy = settings.clone();

    // Save immediately to disk
    save_claudio_app_settings(claudio_settings).await?;

    // Apply the proxy settings immediately to the current process
    log::info!("🌐 Applying proxy settings to current process...");
    apply_proxy_settings(&settings);

    log::info!("✅ Proxy settings saved successfully");
    Ok(())
}

/// Save all Claudio app settings to file with automatic deduplication
/// Save Claudio app-only settings to ~/.claudio/settings.json
/// This is ONLY for our app - window position, tabs, proxy, etc.
/// Automatically prevents duplicate saves and provides debouncing
pub async fn save_claudio_app_settings(claudio_app_settings: ClaudioAppSettings) -> Result<(), String> {
    use crate::commands::claudio_storage::{get_claudio_settings_file, ensure_claudio_dirs};

    let json_string = serde_json::to_string_pretty(&claudio_app_settings)
        .map_err(|e| format!("Failed to serialize Claudio settings: {}", e))?;

    // Check for duplicate saves with debouncing
    {
        let mut last_save = LAST_SAVE.lock().unwrap();
        let now = Instant::now();

        if let Some((last_time, last_data)) = &*last_save {
            // If same data within debounce window, skip save
            if now.duration_since(*last_time) < Duration::from_millis(SAVE_DEBOUNCE_MS) &&
               *last_data == json_string {
                return Ok(());
            }
        }

        // Update last save tracker
        *last_save = Some((now, json_string.clone()));
    }

    ensure_claudio_dirs().await?;

    let claudio_file = get_claudio_settings_file()?;

    // Validate JSON before writing
    if json_string.trim().is_empty() {
        return Err("Generated empty JSON string".to_string());
    }

    // Double-check serialization by parsing it back
    let _validation: ClaudioAppSettings = serde_json::from_str(&json_string)
        .map_err(|e| format!("Failed to validate serialized JSON: {}", e))?;

    // Atomic write: write to temp file first, then rename
    let temp_file = claudio_file.with_extension("json.tmp");

    fs::write(&temp_file, &json_string)
        .map_err(|e| format!("Failed to write Claudio settings temp file: {}", e))?;

    // Verify temp file was written correctly
    let verify_content = fs::read_to_string(&temp_file)
        .map_err(|e| format!("Failed to verify temp file content: {}", e))?;

    if verify_content != json_string {
        return Err("Temp file content doesn't match expected JSON".to_string());
    }

    // Atomic rename - this prevents corruption if process is killed mid-write
    fs::rename(&temp_file, &claudio_file)
        .map_err(|e| format!("Failed to rename Claudio settings temp file: {}", e))?;

    log::debug!("Successfully saved Claudio app settings: {} bytes", json_string.len());
    Ok(())
}

/// Load a specific setting from file (generic key-value store)
#[tauri::command]
pub async fn load_claudio_app_setting(key: String) -> Result<Option<String>, String> {
    let settings = load_claudio_app_settings().await.unwrap_or_default();

    // Get the raw JSON value from the settings file
    let json_string = serde_json::to_string(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    let json_value: serde_json::Value = serde_json::from_str(&json_string)
        .map_err(|e| format!("Failed to parse settings JSON: {}", e))?;

    // Look up the key in the JSON object
    if let Some(value) = json_value.get(&key) {
        if value.is_null() {
            Ok(None)
        } else {
            let value_string = serde_json::to_string(value)
                .map_err(|e| format!("Failed to serialize value: {}", e))?;
            Ok(Some(value_string))
        }
    } else {
        Ok(None)
    }
}

/// Save a specific setting to file immediately (generic key-value store)
#[tauri::command]
pub async fn save_claudio_app_setting(key: String, value: String) -> Result<(), String> {
    let settings = load_claudio_app_settings().await.unwrap_or_default();

    // Get the current settings as a JSON object
    let json_string = serde_json::to_string(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    let mut json_value: serde_json::Value = serde_json::from_str(&json_string)
        .map_err(|e| format!("Failed to parse settings JSON: {}", e))?;

    // Parse the new value as JSON (or store as string if not valid JSON)
    let new_value = if value.is_empty() {
        serde_json::Value::Null
    } else {
        serde_json::from_str(&value).unwrap_or(serde_json::Value::String(value))
    };

    // Set the key-value pair
    json_value[&key] = new_value;

    // Convert back to struct and save
    let updated_settings: ClaudioAppSettings = serde_json::from_value(json_value)
        .map_err(|e| format!("Failed to convert updated JSON to settings: {}", e))?;

    save_claudio_app_settings(updated_settings).await?;
    Ok(())
}

/// Apply proxy settings as environment variables
pub fn apply_proxy_settings(settings: &ProxySettings) {
    log::info!("Applying proxy settings: enabled={}", settings.enabled);
    
    if !settings.enabled {
        // Clear proxy environment variables if disabled
        log::info!("Clearing proxy environment variables");
        std::env::remove_var("HTTP_PROXY");
        std::env::remove_var("HTTPS_PROXY");
        std::env::remove_var("NO_PROXY");
        std::env::remove_var("ALL_PROXY");
        // Also clear lowercase versions
        std::env::remove_var("http_proxy");
        std::env::remove_var("https_proxy");
        std::env::remove_var("no_proxy");
        std::env::remove_var("all_proxy");
        return;
    }
    
    // Ensure NO_PROXY includes localhost by default
    let mut no_proxy_list = vec!["localhost", "127.0.0.1", "::1", "0.0.0.0"];
    if let Some(user_no_proxy) = &settings.no_proxy {
        if !user_no_proxy.is_empty() {
            no_proxy_list.push(user_no_proxy.as_str());
        }
    }
    let no_proxy_value = no_proxy_list.join(",");
    
    // Set proxy environment variables (uppercase is standard)
    if let Some(http_proxy) = &settings.http_proxy {
        if !http_proxy.is_empty() {
            log::info!("Setting HTTP_PROXY={}", http_proxy);
            std::env::set_var("HTTP_PROXY", http_proxy);
        }
    }
    
    if let Some(https_proxy) = &settings.https_proxy {
        if !https_proxy.is_empty() {
            log::info!("Setting HTTPS_PROXY={}", https_proxy);
            std::env::set_var("HTTPS_PROXY", https_proxy);
        }
    }
    
    // Always set NO_PROXY to include localhost
    log::info!("Setting NO_PROXY={}", no_proxy_value);
    std::env::set_var("NO_PROXY", &no_proxy_value);
    
    if let Some(all_proxy) = &settings.all_proxy {
        if !all_proxy.is_empty() {
            log::info!("Setting ALL_PROXY={}", all_proxy);
            std::env::set_var("ALL_PROXY", all_proxy);
        }
    }
    
    // Log current proxy environment variables for debugging
    log::info!("Current proxy environment variables:");
    for (key, value) in std::env::vars() {
        if key.contains("PROXY") || key.contains("proxy") {
            log::info!("  {}={}", key, value);
        }
    }
}