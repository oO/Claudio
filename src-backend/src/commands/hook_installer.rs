use serde_json::{json, Value};
use std::path::Path;
use tauri::command;
use tokio::fs;
use crate::paths::{claude_home_dir, CLAUDE_SETTINGS_FILE, CLAUDE_HOOKS_DIR, HOOK_SESSION_START, HOOK_SESSION_ACTIVE, HOOK_SESSION_IDLE, HOOK_SESSION_END, HOOK_PRE_COMPACT, HOOK_NOTIFICATION};

/// Install Claude Code hooks for native session tracking
#[command]
pub async fn install_claude_session_hooks() -> Result<String, String> {
    log::info!("Installing Claude Code session tracking hooks");
    
    let claude_dir = claude_home_dir().map_err(|e| format!("Cannot find Claude directory: {}", e))?;
    let hooks_dir = claude_dir.join(CLAUDE_HOOKS_DIR);
    let settings_file = claude_dir.join(CLAUDE_SETTINGS_FILE);
    
    // Create directories if they don't exist
    fs::create_dir_all(&claude_dir).await
        .map_err(|e| format!("Failed to create ~/.claude directory: {}", e))?;
    fs::create_dir_all(&hooks_dir).await
        .map_err(|e| format!("Failed to create ~/.claude/hooks directory: {}", e))?;
    
    // Install hook scripts
    install_hook_script(&hooks_dir, HOOK_SESSION_START).await?;
    install_hook_script(&hooks_dir, HOOK_SESSION_ACTIVE).await?;
    install_hook_script(&hooks_dir, HOOK_SESSION_IDLE).await?;
    install_hook_script(&hooks_dir, HOOK_SESSION_END).await?;
    install_hook_script(&hooks_dir, HOOK_PRE_COMPACT).await?;
    install_hook_script(&hooks_dir, HOOK_NOTIFICATION).await?;
    
    // Update settings.json with hook configuration
    update_claude_settings(&settings_file).await?;
    
    log::info!("Claude Code session tracking hooks installed successfully");
    Ok("Hooks installed successfully".to_string())
}

/// Check if Claude Code hooks are already installed
#[command]
pub async fn check_hooks_installed() -> Result<bool, String> {
    let claude_dir = claude_home_dir().map_err(|e| format!("Cannot find Claude directory: {}", e))?;
    let hooks_dir = claude_dir.join(CLAUDE_HOOKS_DIR);
    let settings_file = claude_dir.join(CLAUDE_SETTINGS_FILE);
    
    // Check if hook scripts exist
    let scripts = [HOOK_SESSION_START, HOOK_SESSION_ACTIVE, HOOK_SESSION_IDLE, HOOK_SESSION_END, HOOK_PRE_COMPACT, HOOK_NOTIFICATION];
    for script in &scripts {
        if !hooks_dir.join(script).exists() {
            return Ok(false);
        }
    }
    
    // Check if settings.json has hook configuration
    if !settings_file.exists() {
        return Ok(false);
    }
    
    let content = fs::read_to_string(&settings_file).await
        .map_err(|e| format!("Failed to read settings file: {}", e))?;
    let settings: Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings file: {}", e))?;
    
    // Check if hooks section exists and has our hooks in the new format
    if let Some(hooks) = settings.get("hooks").and_then(|h| h.as_object()) {
        let required_hooks = ["SessionStart", "UserPromptSubmit", "Stop", "SessionEnd", "PreCompact", "Notification"];
        for hook_name in &required_hooks {
            // Check if the hook exists and has the new matcher-based format
            if let Some(hook_configs) = hooks.get(*hook_name).and_then(|h| h.as_array()) {
                // Verify it's not empty and has the expected structure
                if hook_configs.is_empty() {
                    return Ok(false);
                }
                // Check first config has the new format with matcher property
                if let Some(first_config) = hook_configs.get(0).and_then(|c| c.as_object()) {
                    if !first_config.contains_key("matcher") {
                        return Ok(false);
                    }
                } else {
                    return Ok(false);
                }
            } else {
                return Ok(false);
            }
        }
        return Ok(true);
    }

    Ok(false)
}

/// Uninstall Claude Code hooks
#[command]
pub async fn uninstall_claude_session_hooks() -> Result<String, String> {
    log::info!("Uninstalling Claude Code session tracking hooks");
    
    let claude_dir = claude_home_dir().map_err(|e| format!("Cannot find Claude directory: {}", e))?;
    let hooks_dir = claude_dir.join(CLAUDE_HOOKS_DIR);
    let settings_file = claude_dir.join(CLAUDE_SETTINGS_FILE);
    
    // Remove hook scripts
    let scripts = [HOOK_SESSION_START, HOOK_SESSION_ACTIVE, HOOK_SESSION_IDLE, HOOK_SESSION_END, HOOK_PRE_COMPACT, HOOK_NOTIFICATION];
    for script in &scripts {
        let script_path = hooks_dir.join(script);
        if script_path.exists() {
            fs::remove_file(&script_path).await
                .map_err(|e| format!("Failed to remove {}: {}", script, e))?;
            log::debug!("Removed hook script: {}", script);
        }
    }
    
    // Remove hooks from settings.json
    if settings_file.exists() {
        let content = fs::read_to_string(&settings_file).await
            .map_err(|e| format!("Failed to read settings file: {}", e))?;
        let mut settings: Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse settings file: {}", e))?;
        
        // Remove our hooks from the settings
        if let Some(hooks) = settings.get_mut("hooks").and_then(|h| h.as_object_mut()) {
            hooks.remove("SessionStart");
            hooks.remove("UserPromptSubmit");
            hooks.remove("Stop");
            hooks.remove("SessionEnd");
            hooks.remove("PreCompact");
            hooks.remove("Notification");

            // If hooks section is now empty, remove it entirely
            if hooks.is_empty() {
                settings.as_object_mut().unwrap().remove("hooks");
            }
        }
        
        // Write back the updated settings
        let pretty_json = serde_json::to_string_pretty(&settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;
        fs::write(&settings_file, pretty_json).await
            .map_err(|e| format!("Failed to write settings: {}", e))?;
    }
    
    log::info!("Claude Code session tracking hooks uninstalled successfully");
    Ok("Hooks uninstalled successfully".to_string())
}

// Helper functions

/// Install a single hook script from embedded resource
async fn install_hook_script(hooks_dir: &Path, script_name: &str) -> Result<(), String> {
    let script_content = match script_name {
        HOOK_SESSION_START => include_str!("../../../hook_scripts/claudio-session-start.sh"),
        HOOK_SESSION_ACTIVE => include_str!("../../../hook_scripts/claudio-session-active.sh"),
        HOOK_SESSION_IDLE => include_str!("../../../hook_scripts/claudio-session-idle.sh"),
        HOOK_SESSION_END => include_str!("../../../hook_scripts/claudio-session-end.sh"),
        HOOK_PRE_COMPACT => include_str!("../../../hook_scripts/claudio-pre-compact.sh"),
        HOOK_NOTIFICATION => include_str!("../../../hook_scripts/claudio-notification.sh"),
        _ => return Err(format!("Unknown hook script: {}", script_name)),
    };
    
    let script_path = hooks_dir.join(script_name);
    fs::write(&script_path, script_content).await
        .map_err(|e| format!("Failed to write {}: {}", script_name, e))?;
    
    // Make executable on Unix systems
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&script_path).await
            .map_err(|e| format!("Failed to get metadata for {}: {}", script_name, e))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&script_path, perms).await
            .map_err(|e| format!("Failed to set permissions for {}: {}", script_name, e))?;
    }
    
    log::debug!("Installed hook script: {}", script_name);
    Ok(())
}

/// Update ~/.claude/settings.json with hook configuration
async fn update_claude_settings(settings_file: &Path) -> Result<(), String> {
    // Read existing settings or create new ones
    let mut settings = if settings_file.exists() {
        let content = fs::read_to_string(settings_file).await
            .map_err(|e| format!("Failed to read settings file: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse settings file: {}", e))?
    } else {
        json!({})
    };
    
    // Add/update hooks configuration
    settings["hooks"] = json!({
        "SessionStart": [
            {
                "matcher": "*",
                "hooks": [
                    {
                        "type": "command",
                        "command": "~/.claude/hooks/claudio-session-start.sh"
                    }
                ]
            }
        ],
        "UserPromptSubmit": [
            {
                "matcher": "",
                "hooks": [
                    {
                        "type": "command",
                        "command": "~/.claude/hooks/claudio-session-active.sh"
                    }
                ]
            }
        ],
        "Stop": [
            {
                "matcher": "",
                "hooks": [
                    {
                        "type": "command",
                        "command": "~/.claude/hooks/claudio-session-idle.sh"
                    }
                ]
            }
        ],
        "SessionEnd": [
            {
                "matcher": "*",
                "hooks": [
                    {
                        "type": "command",
                        "command": "~/.claude/hooks/claudio-session-end.sh"
                    }
                ]
            }
        ],
        "PreCompact": [
            {
                "matcher": "*",
                "hooks": [
                    {
                        "type": "command",
                        "command": "~/.claude/hooks/claudio-pre-compact.sh"
                    }
                ]
            }
        ],
        "Notification": [
            {
                "matcher": "*",
                "hooks": [
                    {
                        "type": "command",
                        "command": "~/.claude/hooks/claudio-notification.sh"
                    }
                ]
            }
        ]
    });
    
    // Write back the updated settings
    let pretty_json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(settings_file, pretty_json).await
        .map_err(|e| format!("Failed to write settings: {}", e))?;
    
    log::debug!("Updated ~/.claude/settings.json with hook configuration");
    Ok(())
}