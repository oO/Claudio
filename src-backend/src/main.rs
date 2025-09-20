// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod claude_binary;
mod commands;
mod process;
mod paths;

use std::sync::{Arc, Mutex};
use commands::agents::{
    create_agent, delete_agent, export_agent,
    export_agent_to_file, fetch_github_agent_content, fetch_github_agents, get_agent,
    get_claude_binary_path, import_agent,
    import_agent_from_file, import_agent_from_github, init_database,
    list_agents, list_claude_installations,
    load_agent_session_history, set_claude_binary_path, update_agent, AgentDb,
};
use commands::claude::{
    cancel_claude_execution, check_claude_version, continue_claude_code, execute_claude_code,
    find_claude_md_files, get_claude_session_output, get_claude_settings, get_project_sessions,
    get_session_todos,
    get_system_prompt,
    list_directory_contents, list_projects, list_running_claude_sessions, load_session_history,
    open_new_session, read_claude_md_file, resume_claude_code,
    save_claude_md_file, save_claude_settings, save_system_prompt, search_files, start_settings_watcher, delete_file,
    get_hooks_config, update_hooks_config, validate_hook_command,
    delete_claude_project, delete_session, prune_old_sessions, check_project_settings,
    preview_session_deletion_by_age, delete_sessions_by_age, get_session_age_range,
    ClaudeProcessState,
    // Session watcher functionality
    init_session_watcher, start_session_watching, stop_session_watching, 
    stop_all_session_watching, get_session_watching_status,
    // Todo watcher functionality
    init_todo_watcher, start_todo_watching, stop_todo_watching,
    get_todo_watching_status,
    // Project watcher functionality
    start_project_watching, stop_project_watching, ProjectWatcherState,
};
use commands::logger::log_frontend_debug;
use commands::mcp::{
    mcp_add, mcp_add_from_claude_desktop, mcp_add_json, mcp_get, mcp_get_server_status, mcp_list,
    mcp_read_project_config, mcp_remove, mcp_reset_project_choices, mcp_save_project_config,
    mcp_serve, mcp_test_connection,
};

use commands::usage::{
    get_session_stats, get_usage_by_date_range, get_usage_details, get_usage_stats,
};
use commands::storage::{
    storage_list_tables, storage_read_table, storage_update_row, storage_delete_row,
    storage_insert_row, storage_execute_sql, storage_reset_database,
};
use commands::proxy::{get_proxy_settings, save_proxy_settings, apply_proxy_settings, get_setting, save_setting};
use commands::window::{save_window_state, load_window_state, get_current_window_state, restore_window_state, setup_window_state_tracking};
use commands::claude_sdk_simple::{start_claude_sdk_session, continue_claude_sdk_session, resume_claude_sdk_session, terminate_claude_sdk_session};
use commands::claude_direct::{start_claude_direct_session};
use commands::claudio_storage::{
    create_claudio_session, update_claudio_session, get_claudio_session,
    list_claudio_sessions, delete_claudio_session, cleanup_orphaned_files,
};
use commands::claude_session_tracking::{
    start_claude_thinking, end_claude_thinking, get_live_claude_sessions,
    get_claude_session_status, get_random_thinking_content,
};
use commands::hook_installer::{
    install_claude_session_hooks, check_hooks_installed, uninstall_claude_session_hooks,
};
use commands::settings::{
    create_settings_handle, get_settings_for_handle, update_setting_for_handle, destroy_settings_handle,
    initialize_settings_orchestrator,
};
use process::ProcessRegistryState;
use tauri::Manager;
use std::io::Write;

fn setup_logging() {
    use env_logger::{Builder, Target};
    use std::fs::OpenOptions;
    
    let mut builder = Builder::from_default_env();
    
    // Check if we should log to file
    if std::env::var("CLAUDIO_LOG_FILE").is_ok() {
        // Create logs directory in home/.claude/
        if let Some(home_dir) = dirs::home_dir() {
            let log_dir = home_dir.join(".claude").join("logs");
            if let Err(e) = std::fs::create_dir_all(&log_dir) {
                eprintln!("Failed to create log directory: {}", e);
                env_logger::init();
                return;
            }
            
            let log_file_path = log_dir.join("claudio.log");
            
            match OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_file_path)
            {
                Ok(file) => {
                    println!("Logging to: {:?}", log_file_path);
                    builder.target(Target::Pipe(Box::new(file)));
                    builder.format(|buf, record| {
                        writeln!(buf, "{} [{}] {} - {}", 
                            chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
                            record.level(),
                            record.target(),
                            record.args()
                        )
                    });
                }
                Err(e) => {
                    eprintln!("Failed to open log file: {}", e);
                    env_logger::init();
                    return;
                }
            }
        } else {
            eprintln!("Could not find home directory for logging");
            env_logger::init();
            return;
        }
    }
    
    builder.init();
}

fn main() {
    // Initialize logger with file output support
    setup_logging();


    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize agents database
            let _conn = init_database(&app.handle()).expect("Failed to initialize agents database");
            
            // Load and apply proxy settings from consolidated Claudio settings file
            {
                use std::sync::mpsc;
                let (tx, rx) = mpsc::channel();
                
                // Use async runtime to load proxy settings
                let runtime = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
                let tx_clone = tx.clone();
                
                runtime.spawn(async move {
                    // Initialize Claudio session cache
                    if let Err(e) = commands::claudio_storage::initialize_claudio_cache().await {
                        log::error!("Failed to initialize Claudio session cache: {}", e);
                    }

                    let proxy_settings = match commands::proxy::get_proxy_settings().await {
                        Ok(settings) => {
                            log::info!("Loaded proxy settings: enabled={}", settings.enabled);
                            settings
                        }
                        Err(e) => {
                            log::warn!("Failed to load proxy settings: {}", e);
                            commands::proxy::ProxySettings::default()
                        }
                    };
                    let _ = tx_clone.send(proxy_settings);
                });
                
                // Wait for the result
                if let Ok(proxy_settings) = rx.recv() {
                    apply_proxy_settings(&proxy_settings);
                }
            }
            
            // Re-open the connection for the app to manage
            let conn = init_database(&app.handle()).expect("Failed to initialize agents database");
            app.manage(AgentDb(Mutex::new(conn)));


            // Initialize process registry
            app.manage(ProcessRegistryState::default());

            // Initialize Claude process state
            app.manage(ClaudeProcessState::default());

            // Initialize session file watcher
            let session_watcher_state = init_session_watcher(app.handle().clone());
            app.manage(session_watcher_state.clone());

            // Initialize global todo watcher
            let todo_watcher_state = init_todo_watcher(app.handle().clone());
            app.manage(todo_watcher_state);

            // Initialize project watcher
            app.manage(Arc::new(Mutex::new(None)) as ProjectWatcherState);

            // Initialize SessionOrchestrator (new architecture)
            commands::session_orchestrator::initialize_orchestrator(app.handle().clone(), session_watcher_state);

            // Initialize SettingsOrchestrator (SEPARATE from sessions - never merge!)
            initialize_settings_orchestrator(app.handle().clone());

            // Setup window state tracking
            if let Err(e) = setup_window_state_tracking(app.handle().clone()) {
                log::warn!("Failed to setup window state tracking: {}", e);
            }

            // Run orphan cleanup on startup to ensure data integrity
            tauri::async_runtime::spawn(async move {
                match cleanup_orphaned_files().await {
                    Ok(result) => {
                        log::info!("Startup cleanup completed: {}", 
                                   result.get("message").and_then(|m| m.as_str()).unwrap_or("unknown"));
                    }
                    Err(e) => {
                        log::warn!("Failed to run startup cleanup: {}", e);
                    }
                }
            });

            // Auto-install Claude Code hooks for session tracking if not already installed
            tauri::async_runtime::spawn(async move {
                match commands::hook_installer::check_hooks_installed().await {
                    Ok(false) => {
                        log::info!("Claude Code hooks not detected, auto-installing...");
                        match commands::hook_installer::install_claude_session_hooks().await {
                            Ok(_) => {
                                log::info!("Claude Code session tracking hooks auto-installed successfully");
                            }
                            Err(e) => {
                                log::warn!("Failed to auto-install Claude Code hooks: {}", e);
                                log::warn!("   Native Claude sessions won't be tracked in Claudio UI");
                                log::warn!("   You can manually install hooks later via the settings");
                            }
                        }
                    }
                    Ok(true) => {
                        // Hooks already installed, no action needed
                    }
                    Err(e) => {
                        log::warn!("Failed to check hook installation status: {}", e);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Claude & Project Management
            list_projects,
            get_project_sessions,
            get_session_todos,
            get_claude_settings,
            open_new_session,
            get_system_prompt,
            check_claude_version,
            save_system_prompt,
            save_claude_settings,
            start_settings_watcher,
            find_claude_md_files,
            read_claude_md_file,
            save_claude_md_file,
            delete_file,
            load_session_history,
            execute_claude_code,
            continue_claude_code,
            resume_claude_code,
            cancel_claude_execution,
            list_running_claude_sessions,
            get_claude_session_output,
            list_directory_contents,
            search_files,
            get_hooks_config,
            update_hooks_config,
            validate_hook_command,
            delete_claude_project,
            delete_session,
            prune_old_sessions,
            check_project_settings,
            preview_session_deletion_by_age,
            delete_sessions_by_age,
            get_session_age_range,
            
            
            // Agent Management
            list_agents,
            create_agent,
            update_agent,
            delete_agent,
            get_agent,
            load_agent_session_history,
            get_claude_binary_path,
            set_claude_binary_path,
            list_claude_installations,
            export_agent,
            export_agent_to_file,
            import_agent,
            import_agent_from_file,
            fetch_github_agents,
            fetch_github_agent_content,
            import_agent_from_github,
            
            // Usage & Analytics
            get_usage_stats,
            get_usage_by_date_range,
            get_usage_details,
            get_session_stats,
            
            // MCP (Model Context Protocol)
            mcp_add,
            mcp_list,
            mcp_get,
            mcp_remove,
            mcp_add_json,
            mcp_add_from_claude_desktop,
            mcp_serve,
            mcp_test_connection,
            mcp_reset_project_choices,
            mcp_get_server_status,
            mcp_read_project_config,
            mcp_save_project_config,
            
            // Storage Management
            storage_list_tables,
            storage_read_table,
            storage_update_row,
            storage_delete_row,
            storage_insert_row,
            storage_execute_sql,
            storage_reset_database,
            
            // Slash Commands
            commands::slash_commands::slash_commands_list,
            commands::slash_commands::slash_command_get,
            commands::slash_commands::slash_command_save,
            commands::slash_commands::slash_command_delete,
            
            // Proxy Settings
            get_proxy_settings,
            save_proxy_settings,
            
            // General Settings
            get_setting,
            save_setting,
            
            // Window Management
            save_window_state,
            load_window_state,
            get_current_window_state,
            restore_window_state,
            
            
            // Claude SDK Integration  
            start_claude_sdk_session,
            continue_claude_sdk_session,
            resume_claude_sdk_session,
            terminate_claude_sdk_session,
            
            // Claude CLI Direct Integration
            start_claude_direct_session,
            
            // Claudio Session Storage
            create_claudio_session,
            update_claudio_session,
            get_claudio_session,
            list_claudio_sessions,
            delete_claudio_session,
            cleanup_orphaned_files,
            
            // Session File Watching
            start_session_watching,
            stop_session_watching,
            stop_all_session_watching,
            get_session_watching_status,

            // Project File Watching  
            start_project_watching,
            stop_project_watching,

            // Todo File Watching
            start_todo_watching,
            stop_todo_watching,
            get_todo_watching_status,
            
            // Frontend Debug Logging
            log_frontend_debug,
            
            // Session Orchestrator (New Architecture)
            commands::session_orchestrator::get_session_handle,
            commands::session_orchestrator::send_session_prompt,
            commands::session_orchestrator::get_session_messages,

            // Settings Management (Unified Orchestrator)
            create_settings_handle,
            get_settings_for_handle,
            update_setting_for_handle,
            destroy_settings_handle,
            
            // Claude Session Tracking (Native Sessions)
            start_claude_thinking,
            end_claude_thinking,
            get_live_claude_sessions,
            get_claude_session_status,
            get_random_thinking_content,
            
            // Hook Installation
            install_claude_session_hooks,
            check_hooks_installed,
            uninstall_claude_session_hooks,
            
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
