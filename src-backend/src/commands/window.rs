use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{command, AppHandle, Manager, PhysicalPosition, PhysicalSize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            x: 100,
            y: 100,
            width: 1200,
            height: 800,
            maximized: false,
        }
    }
}

fn get_window_state_path() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let claude_dir = home_dir.join(".claude");
    
    // Ensure the directory exists
    if let Err(e) = fs::create_dir_all(&claude_dir) {
        return Err(format!("Failed to create .claude directory: {}", e));
    }
    
    Ok(claude_dir.join("claudio-window-state.json"))
}

#[command]
pub async fn save_window_state(_app_handle: AppHandle, state: WindowState) -> Result<(), String> {
    let path = get_window_state_path()?;
    
    let json = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("Failed to serialize window state: {}", e))?;
    
    fs::write(&path, json)
        .map_err(|e| format!("Failed to save window state: {}", e))?;
    
    log::info!("Window state saved: {:?}", state);
    Ok(())
}

#[command]
pub async fn load_window_state() -> Result<WindowState, String> {
    let path = get_window_state_path()?;
    
    if !path.exists() {
        log::info!("No window state file found, using defaults");
        return Ok(WindowState::default());
    }
    
    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read window state file: {}", e))?;
    
    let state: WindowState = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse window state: {}", e))?;
    
    log::info!("Window state loaded: {:?}", state);
    Ok(state)
}

#[command]
pub async fn get_current_window_state(app_handle: AppHandle) -> Result<WindowState, String> {
    let window = app_handle.get_webview_window("main")
        .ok_or("Main window not found")?;
    
    let position = window.outer_position()
        .map_err(|e| format!("Failed to get window position: {}", e))?;
    
    let size = window.outer_size()
        .map_err(|e| format!("Failed to get window size: {}", e))?;
    
    let maximized = window.is_maximized()
        .map_err(|e| format!("Failed to get maximized state: {}", e))?;
    
    let state = WindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized,
    };
    
    Ok(state)
}

#[command]
pub async fn restore_window_state(app_handle: AppHandle) -> Result<(), String> {
    let state = load_window_state().await?;
    
    let window = app_handle.get_webview_window("main")
        .ok_or("Main window not found")?;
    
    // Restore position
    let position = PhysicalPosition::new(state.x, state.y);
    window.set_position(position)
        .map_err(|e| format!("Failed to set window position: {}", e))?;
    
    // Restore size
    let size = PhysicalSize::new(state.width, state.height);
    window.set_size(size)
        .map_err(|e| format!("Failed to set window size: {}", e))?;
    
    // Restore maximized state
    if state.maximized {
        window.maximize()
            .map_err(|e| format!("Failed to maximize window: {}", e))?;
    }
    
    log::info!("Window state restored: {:?}", state);
    Ok(())
}

/// Auto-save window state when it changes
pub fn setup_window_state_tracking(app_handle: AppHandle) -> Result<(), String> {
    let window = app_handle.get_webview_window("main")
        .ok_or("Main window not found")?;
    
    let app_handle_clone = app_handle.clone();
    
    // Save state when window is moved or resized
    window.on_window_event(move |event| {
        match event {
            tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                let app_handle = app_handle_clone.clone();
                tauri::async_runtime::spawn(async move {
                    if let Ok(state) = get_current_window_state(app_handle.clone()).await {
                        let _ = save_window_state(app_handle, state).await;
                    }
                });
            }
            _ => {}
        }
    });
    
    Ok(())
}