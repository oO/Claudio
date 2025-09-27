use serde::{Deserialize, Serialize};
use std::fs;
use crate::commands::window::WindowState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProxySettings {
    pub http_proxy: Option<String>,
    pub https_proxy: Option<String>,
    pub no_proxy: Option<String>,
    pub all_proxy: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ThemeSettings {
    pub theme_mode: Option<String>,
    pub custom_colors: Option<String>, // JSON string of custom colors
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudioSettings {
    #[serde(default)]
    pub proxy: ProxySettings,
    #[serde(default)]
    pub claude_binary_path: Option<String>,
    #[serde(default)]
    pub theme: ThemeSettings,
    #[serde(default)]
    pub window_state: Option<WindowState>,
    #[serde(default)]
    pub tabs_session: Option<Vec<serde_json::Value>>, // Tab session data as proper JSON array
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

impl Default for ThemeSettings {
    fn default() -> Self {
        Self {
            theme_mode: None,
            custom_colors: None,
        }
    }
}

impl Default for ClaudioSettings {
    fn default() -> Self {
        Self {
            proxy: ProxySettings::default(),
            claude_binary_path: None,
            theme: ThemeSettings::default(),
            window_state: None,
            tabs_session: None,
        }
    }
}

/// Get proxy settings from the consolidated Claudio settings file
#[tauri::command]
pub async fn get_proxy_settings() -> Result<ProxySettings, String> {
    let claudio_settings = get_claudio_settings().await?;
    Ok(claudio_settings.proxy)
}

/// Get all Claudio settings from the file
pub async fn get_claudio_settings() -> Result<ClaudioSettings, String> {
    use crate::commands::claudio_storage::get_claudio_settings_file;
    
    let claudio_file = get_claudio_settings_file()?;
    
    if !claudio_file.exists() {
        log::info!("Claudio settings file not found, returning default settings");
        return Ok(ClaudioSettings::default());
    }
    
    let content = fs::read_to_string(&claudio_file)
        .map_err(|e| format!("Failed to read Claudio settings file: {}", e))?;
    
    let settings: ClaudioSettings = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse Claudio settings JSON: {}", e))?;
    
    Ok(settings)
}

/// Save proxy settings to the consolidated Claudio settings file
#[tauri::command]
pub async fn save_proxy_settings(settings: ProxySettings) -> Result<(), String> {
    log::info!("=== SAVE PROXY SETTINGS DEBUG START ===");
    log::info!("Received proxy settings for save");
    
    // Load existing Claudio settings
    log::info!("Loading existing Claudio settings...");
    let mut claudio_settings = match get_claudio_settings().await {
        Ok(s) => {
            log::info!("Successfully loaded existing claudio settings");
            s
        }
        Err(e) => {
            log::warn!("Failed to load existing settings, using default: {}", e);
            ClaudioSettings::default()
        }
    };
    
    // Update proxy settings
    log::info!("Updating proxy settings in consolidated settings...");
    claudio_settings.proxy = settings.clone();
    
    // Save the consolidated settings
    log::info!("Saving consolidated settings...");
    match save_claudio_settings(claudio_settings).await {
        Ok(_) => log::info!("Successfully saved consolidated settings"),
        Err(e) => {
            log::error!("Failed to save consolidated settings: {}", e);
            return Err(format!("Failed to save settings: {}", e));
        }
    }
    
    // Apply the proxy settings immediately to the current process
    log::info!("Applying proxy settings to current process...");
    apply_proxy_settings(&settings);
    
    log::info!("=== SAVE PROXY SETTINGS DEBUG END ===");
    Ok(())
}

/// Save all Claudio settings to the file
pub async fn save_claudio_settings(settings: ClaudioSettings) -> Result<(), String> {
    use crate::commands::claudio_storage::{get_claudio_settings_file, ensure_claudio_dirs};
    
    log::info!("Ensuring claudio directories exist...");
    ensure_claudio_dirs().await?;
    
    log::info!("Getting claudio settings file path...");
    let claudio_file = get_claudio_settings_file()?;
    log::info!("Target file path: {:?}", claudio_file);
    
    // Pretty print the JSON with 2-space indentation
    log::info!("Serializing settings to JSON...");
    let json_string = match serde_json::to_string_pretty(&settings) {
        Ok(json) => {
            log::info!("JSON serialized successfully, length: {}", json.len());
            json
        }
        Err(e) => {
            log::error!("Failed to serialize settings: {}", e);
            return Err(format!("Failed to serialize Claudio settings: {}", e));
        }
    };
    
    log::info!("Writing file to disk...");
    match fs::write(&claudio_file, &json_string) {
        Ok(_) => {
            log::info!("File written successfully");
        }
        Err(e) => {
            log::error!("Failed to write file: {}", e);
            return Err(format!("Failed to write Claudio settings file: {}", e));
        }
    }
    
    log::info!("Claudio settings saved to {:?}", claudio_file);
    Ok(())
}

/// Get a specific setting from Claudio settings
#[tauri::command]
pub async fn get_setting(key: String) -> Result<Option<String>, String> {
    let settings = get_claudio_settings().await.unwrap_or_default();
    
    match key.as_str() {
        "theme_preference" => Ok(settings.theme.theme_mode),
        "theme_custom_colors" => Ok(settings.theme.custom_colors),
        "tabs_session" => {
            match &settings.tabs_session {
                Some(tabs_array) => {
                    let json_string = serde_json::to_string(tabs_array)
                        .map_err(|e| format!("Failed to serialize tabs_session: {}", e))?;
                    log::info!("Retrieved tabs_session setting: {} chars", json_string.len());
                    Ok(Some(json_string))
                }
                None => {
                    log::info!("No tabs_session setting found");
                    Ok(None)
                }
            }
        }
        _ => Ok(None)
    }
}

/// Save a specific setting to Claudio settings
#[tauri::command]
pub async fn save_setting(key: String, value: String) -> Result<(), String> {
    let mut settings = get_claudio_settings().await.unwrap_or_default();
    
    match key.as_str() {
        "theme_preference" => {
            settings.theme.theme_mode = Some(value);
        }
        "theme_custom_colors" => {
            settings.theme.custom_colors = Some(value);
        }
        "tabs_session" => {
            // Handle empty string as None to clear the setting
            settings.tabs_session = if value.is_empty() {
                None
            } else {
                // Parse the JSON string into a proper array
                match serde_json::from_str::<Vec<serde_json::Value>>(&value) {
                    Ok(tabs_array) => {
                        log::info!("Updated tabs_session setting: {} tabs", tabs_array.len());
                        Some(tabs_array)
                    }
                    Err(e) => {
                        return Err(format!("Failed to parse tabs_session JSON: {}", e));
                    }
                }
            };
        }
        _ => {
            return Err(format!("Unknown setting key: {}", key));
        }
    }
    
    save_claudio_settings(settings).await?;
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