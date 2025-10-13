// ============================================================================
// CLAUDIO APP-ONLY SETTINGS SYSTEM - IN-MEMORY CACHE
// ============================================================================
// This file handles settings that are ONLY used by our Claudio app.
// NO external tools (including Claude Code binary) read or write these files.
//
// Architecture:
// - Load entire settings.json into memory cache on first access
// - All reads come from memory (fast API calls)
// - Writes update memory cache + schedule disk flush
// - Periodic flush to disk + flush on app quit
//
// File location: ~/.claudio/settings.json
// ============================================================================

use serde::{Deserialize, Serialize};
use std::fs;
use tokio::fs as tokio_fs;
use std::sync::{Arc, RwLock};
use std::collections::HashMap;
use once_cell::sync::Lazy;
use std::time::{Duration, Instant};
use tokio::time::interval;



// ============================================================================
// IN-MEMORY CACHE SYSTEM
// ============================================================================

#[derive(Debug, Clone)]
struct SettingsCache {
    data: HashMap<String, serde_json::Value>,
    last_modified: Instant,
    needs_flush: bool,
}

impl Default for SettingsCache {
    fn default() -> Self {
        Self {
            data: HashMap::new(),
            last_modified: Instant::now(),
            needs_flush: false,
        }
    }
}

// Global in-memory cache - single source of truth
static SETTINGS_CACHE: Lazy<Arc<RwLock<Option<SettingsCache>>>> =
    Lazy::new(|| Arc::new(RwLock::new(None)));

// Load settings from disk into memory cache
async fn load_settings_into_cache() -> Result<(), String> {
    use crate::commands::claudio_storage::get_claudio_settings_file;

    let claudio_file = get_claudio_settings_file()?;

    let content = if claudio_file.exists() {
        fs::read_to_string(&claudio_file)
            .map_err(|e| format!("Failed to read settings file: {}", e))?
    } else {
        log::info!("Settings file not found, creating empty file and cache");

        // Ensure directory exists
        use crate::commands::claudio_storage::ensure_claudio_dirs;
        if let Err(e) = ensure_claudio_dirs().await {
            log::warn!("Failed to create claudio dirs: {}", e);
        }

        // Create empty settings file
        let empty_content = "{}";
        if let Err(e) = fs::write(&claudio_file, empty_content) {
            log::warn!("Failed to create empty settings file: {}", e);
        } else {
            log::info!("Created empty settings file: {:?}", claudio_file);
        }

        empty_content.to_string()
    };

    let json_data: HashMap<String, serde_json::Value> = serde_json::from_str(&content)
        .unwrap_or_else(|e| {
            log::warn!("Failed to parse settings JSON, using empty cache: {}", e);
            HashMap::new()
        });

    let mut cache_guard = SETTINGS_CACHE.write().unwrap();
    *cache_guard = Some(SettingsCache {
        data: json_data,
        last_modified: Instant::now(),
        needs_flush: false,
    });

    log::debug!("Loaded settings into memory cache");
    Ok(())
}

// Ensure cache is initialized
async fn ensure_cache_loaded() -> Result<(), String> {
    let cache_exists = {
        let cache_guard = SETTINGS_CACHE.read().unwrap();
        cache_guard.is_some()
    };

    if !cache_exists {
        load_settings_into_cache().await?;
    }
    Ok(())
}

// Flush cache to disk
async fn flush_cache_to_disk() -> Result<(), String> {
    use crate::commands::claudio_storage::{get_claudio_settings_file, ensure_claudio_dirs};

    let cache_data = {
        let mut cache_guard = SETTINGS_CACHE.write().unwrap();
        if let Some(ref mut cache) = *cache_guard {
            if !cache.needs_flush {
                return Ok(()); // No changes to flush
            }
            cache.needs_flush = false;
            cache.data.clone()
        } else {
            return Ok(()); // No cache to flush
        }
    };

    ensure_claudio_dirs().await?;
    let claudio_file = get_claudio_settings_file()?;

    let json_content = serde_json::to_string_pretty(&cache_data)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    tokio_fs::write(&claudio_file, json_content).await
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    log::debug!("Flushed settings cache to disk");
    Ok(())
}

// Start background flush task (must be called after Tauri runtime is ready)
pub fn start_settings_flush_task() {
    tauri::async_runtime::spawn(async {
        let mut flush_interval = interval(Duration::from_secs(30)); // Flush every 30 seconds

        loop {
            flush_interval.tick().await;
            if let Err(e) = flush_cache_to_disk().await {
                log::error!("Failed to flush settings cache: {}", e);
            }
        }
    });
    log::info!("Started settings cache flush task (30s interval)");
}

// Force flush on app shutdown
pub async fn shutdown_flush_settings() {
    if let Err(e) = flush_cache_to_disk().await {
        log::error!("Failed to flush settings on shutdown: {}", e);
    }
}

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
        Ok(Some(value)) => {
            // Try to deserialize the stored JSON value
            serde_json::from_value(value)
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

    // Convert ProxySettings directly to serde_json::Value
    let proxy_json_value = serde_json::to_value(&settings)
        .map_err(|e| format!("Failed to convert proxy settings to JSON: {}", e))?;
    save_claudio_app_setting("proxySettings".to_string(), proxy_json_value).await?;

    // Apply the proxy settings immediately to the current process
    log::info!("Applying proxy settings to current process");
    apply_proxy_settings(&settings);

    log::info!("Proxy settings saved successfully");
    Ok(())
}


/// Load a setting from memory cache (fast!)
#[tauri::command]
pub async fn load_claudio_app_setting(key: String) -> Result<Option<serde_json::Value>, String> {
    ensure_cache_loaded().await?;

    let cache_guard = SETTINGS_CACHE.read().unwrap();
    if let Some(ref cache) = *cache_guard {
        if let Some(value) = cache.data.get(&key) {
            if value.is_null() {
                Ok(None)
            } else {
                // Return the actual value - let Tauri handle serialization
                Ok(Some(value.clone()))
            }
        } else {
            Ok(None)
        }
    } else {
        Ok(None)
    }
}

/// Save a setting to memory cache (updates cache + schedules flush)
#[tauri::command]
pub async fn save_claudio_app_setting(key: String, value: serde_json::Value) -> Result<(), String> {
    ensure_cache_loaded().await?;

    // Value is already a proper JSON value from frontend
    let new_value = value;

    // Update memory cache
    {
        let mut cache_guard = SETTINGS_CACHE.write().unwrap();
        if let Some(ref mut cache) = *cache_guard {
            cache.data.insert(key.clone(), new_value);
            cache.last_modified = Instant::now();
            cache.needs_flush = true;
        }
    }

    log::debug!("Updated \"{}\" setting in cache", key);
    Ok(())
}

// ============================================================================
// SYNCHRONOUS HELPERS
// ============================================================================

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