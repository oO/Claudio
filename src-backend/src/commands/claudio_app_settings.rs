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
use tokio::fs as tokio_fs;



#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ProxySettings {
    pub http_proxy: Option<String>,
    pub https_proxy: Option<String>,
    pub no_proxy: Option<String>,
    pub all_proxy: Option<String>,
    pub enabled: bool,
}

/// Get proxy settings from file
#[tauri::command]
pub async fn get_proxy_settings() -> Result<ProxySettings, String> {
    // Load the entire ProxySettings as JSON or return defaults
    match load_claudio_app_setting("proxySettings".to_string()).await {
        Ok(Some(json_str)) => {
            // Try to deserialize the stored JSON
            serde_json::from_str(&json_str)
                .map_err(|e| format!("Failed to parse proxy settings JSON: {}", e))
        }
        Ok(None) => {
            // No stored settings, return defaults
            Ok(ProxySettings {
                http_proxy: None,
                https_proxy: None,
                no_proxy: None,
                all_proxy: None,
                enabled: false,
            })
        }
        Err(e) => {
            log::warn!("Failed to load proxy settings, using defaults: {}", e);
            Ok(ProxySettings {
                http_proxy: None,
                https_proxy: None,
                no_proxy: None,
                all_proxy: None,
                enabled: false,
            })
        }
    }
}


/// Save proxy settings to file immediately
#[tauri::command]
pub async fn save_proxy_settings(settings: ProxySettings) -> Result<(), String> {
    log::info!("💾 Saving proxy settings");

    // Serialize the entire ProxySettings as JSON and save in one call
    let json_value = serde_json::to_string(&settings)
        .map_err(|e| format!("Failed to serialize proxy settings: {}", e))?;

    save_claudio_app_setting("proxySettings".to_string(), json_value).await?;

    // Apply the proxy settings immediately to the current process
    log::info!("🌐 Applying proxy settings to current process...");
    apply_proxy_settings(&settings);

    log::info!("✅ Proxy settings saved successfully");
    Ok(())
}


/// Load a specific setting from file (generic key-value store)
#[tauri::command]
pub async fn load_claudio_app_setting(key: String) -> Result<Option<String>, String> {
    use crate::commands::claudio_storage::get_claudio_settings_file;

    let claudio_file = get_claudio_settings_file()?;

    if !claudio_file.exists() {
        log::info!("Claudio settings file not found, creating empty file");
        // Create empty JSON file
        fs::write(&claudio_file, "{}")
            .map_err(|e| format!("Failed to create empty settings file: {}", e))?;
        return Ok(None);
    }

    // Read the raw JSON from file
    let content = fs::read_to_string(&claudio_file)
        .map_err(|e| format!("Failed to read Claudio settings: {}", e))?;

    let json_value: serde_json::Value = serde_json::from_str(&content)
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
    use crate::commands::claudio_storage::{get_claudio_settings_file, ensure_claudio_dirs};

    let claudio_file = get_claudio_settings_file()?;

    // Load existing JSON or create empty object
    let mut json_value: serde_json::Value = if claudio_file.exists() {
        let content = fs::read_to_string(&claudio_file)
            .map_err(|e| format!("Failed to read Claudio settings: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse settings JSON: {}", e))?
    } else {
        serde_json::json!({})
    };

    // Parse the new value as JSON (or store as string if not valid JSON)
    let new_value = if value.is_empty() {
        serde_json::Value::Null
    } else {
        serde_json::from_str(&value).unwrap_or(serde_json::Value::String(value))
    };

    // Set the key-value pair
    json_value[&key] = new_value;

    // Save the JSON directly to file
    ensure_claudio_dirs().await?;

    let json_string = serde_json::to_string_pretty(&json_value)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    // Atomic write: write to temp file first, then rename
    let temp_file = claudio_file.with_extension("json.tmp");

    tokio_fs::write(&temp_file, &json_string).await
        .map_err(|e| format!("Failed to write Claudio settings temp file: {}", e))?;

    // Atomic rename
    tokio_fs::rename(&temp_file, &claudio_file).await
        .map_err(|e| format!("Failed to rename Claudio settings temp file: {}", e))?;

    log::debug!("Successfully saved setting {} to Claudio app settings", key);
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