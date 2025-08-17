use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{command, AppHandle, Manager, PhysicalPosition, PhysicalSize};
use tokio::time::sleep;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

#[derive(Debug)]
struct DebounceState {
    last_change: Instant,
    is_pending: bool,
}

impl Default for DebounceState {
    fn default() -> Self {
        Self {
            last_change: Instant::now(),
            is_pending: false,
        }
    }
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

/// Auto-save window state when it changes with debouncing
pub fn setup_window_state_tracking(app_handle: AppHandle) -> Result<(), String> {
    let window = app_handle.get_webview_window("main")
        .ok_or("Main window not found")?;
    
    let app_handle_clone = app_handle.clone();
    let debounce_state = Arc::new(Mutex::new(DebounceState::default()));
    
    // Save state when window is moved or resized (with debouncing)
    window.on_window_event(move |event| {
        match event {
            tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                let app_handle = app_handle_clone.clone();
                let debounce_state = debounce_state.clone();
                
                tauri::async_runtime::spawn(async move {
                    debounced_save_window_state(app_handle, debounce_state).await;
                });
            }
            _ => {}
        }
    });
    
    Ok(())
}

/// Debounced window state saving - only saves after 500ms of no changes
async fn debounced_save_window_state(app_handle: AppHandle, debounce_state: Arc<Mutex<DebounceState>>) {
    const DEBOUNCE_DELAY_MS: u64 = 500;
    
    // Update the last change time and check if a save is already pending
    let should_start_timer = {
        let mut state = debounce_state.lock().unwrap();
        state.last_change = Instant::now();
        
        if state.is_pending {
            // A save is already pending, just update the timestamp
            false
        } else {
            // No save pending, start a new timer
            state.is_pending = true;
            true
        }
    };
    
    if !should_start_timer {
        return;
    }
    
    // Wait for the debounce delay and keep checking if more changes come in
    loop {
        sleep(Duration::from_millis(DEBOUNCE_DELAY_MS)).await;
        
        // Check if enough time has passed since the last change
        let should_save = {
            let mut state = debounce_state.lock().unwrap();
            let time_since_last_change = state.last_change.elapsed();
            
            if time_since_last_change >= Duration::from_millis(DEBOUNCE_DELAY_MS) {
                // Enough time has passed, clear pending flag and save
                state.is_pending = false;
                true
            } else {
                // More changes happened, continue waiting
                false
            }
        };
        
        if should_save {
            // Actually save the window state
            if let Ok(state) = get_current_window_state(app_handle.clone()).await {
                if let Err(e) = save_window_state(app_handle, state).await {
                    log::warn!("Failed to save debounced window state: {}", e);
                }
            }
            break;
        }
        // Continue loop to wait more
    }
}