// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod checkpoint;
mod claude_binary;
mod commands;
mod process;

use checkpoint::state::CheckpointState;
use commands::agents::{
    cleanup_finished_processes, create_agent, delete_agent, execute_agent, export_agent,
    export_agent_to_file, fetch_github_agent_content, fetch_github_agents, get_agent,
    get_agent_run, get_agent_run_with_real_time_metrics, get_claude_binary_path,
    get_live_session_output, get_session_output, get_session_status, import_agent,
    import_agent_from_file, import_agent_from_github, init_database, kill_agent_session,
    list_agent_runs, list_agent_runs_with_metrics, list_agents, list_claude_installations,
    list_running_sessions, load_agent_session_history, set_claude_binary_path, stream_session_output, update_agent, AgentDb,
};
use commands::claude::{
    cancel_claude_execution, check_auto_checkpoint, check_claude_version, cleanup_old_checkpoints,
    clear_checkpoint_manager, continue_claude_code, create_checkpoint, execute_claude_code,
    find_claude_md_files, fork_from_checkpoint, get_checkpoint_diff, get_checkpoint_settings,
    get_checkpoint_state_stats, get_claude_session_output, get_claude_settings, get_project_sessions,
    get_recently_modified_files, get_session_timeline, get_system_prompt, list_checkpoints,
    list_directory_contents, list_projects, list_running_claude_sessions, load_session_history,
    open_new_session, read_claude_md_file, restore_checkpoint, resume_claude_code,
    save_claude_md_file, save_claude_settings, save_system_prompt, search_files, start_settings_watcher, delete_file,
    track_checkpoint_message, track_session_messages, update_checkpoint_settings,
    get_hooks_config, update_hooks_config, validate_hook_command,
    delete_claude_project, delete_session, prune_old_sessions, check_project_settings,
    preview_session_deletion_by_age, delete_sessions_by_age, get_session_age_range,
    ClaudeProcessState,
    // Session watcher functionality
    init_session_watcher, start_session_watching, stop_session_watching, 
    stop_all_session_watching, get_session_watching_status,
    // Frontend debug logging
    log_frontend_debug,
};
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
use commands::system::{get_system_memory_info};
use process::ProcessRegistryState;
use std::sync::Mutex;
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
                    let proxy_settings = match commands::proxy::get_proxy_settings().await {
                        Ok(settings) => {
                            log::info!("Loaded proxy settings from claudio-settings.json: enabled={}", settings.enabled);
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

            // Initialize checkpoint state
            let checkpoint_state = CheckpointState::new();

            // Set the Claude directory path
            if let Ok(claude_dir) = dirs::home_dir()
                .ok_or_else(|| "Could not find home directory")
                .and_then(|home| {
                    let claude_path = home.join(".claude");
                    claude_path
                        .canonicalize()
                        .map_err(|_| "Could not find ~/.claude directory")
                })
            {
                let state_clone = checkpoint_state.clone();
                tauri::async_runtime::spawn(async move {
                    state_clone.set_claude_dir(claude_dir).await;
                });
            }

            app.manage(checkpoint_state);

            // Initialize process registry
            app.manage(ProcessRegistryState::default());

            // Initialize Claude process state
            app.manage(ClaudeProcessState::default());

            // Initialize session file watcher
            let session_watcher_state = init_session_watcher(app.handle().clone());
            app.manage(session_watcher_state);

            // Setup window state tracking
            if let Err(e) = setup_window_state_tracking(app.handle().clone()) {
                log::warn!("Failed to setup window state tracking: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Claude & Project Management
            list_projects,
            get_project_sessions,
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
            get_recently_modified_files,
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
            
            // Checkpoint Management
            create_checkpoint,
            restore_checkpoint,
            list_checkpoints,
            fork_from_checkpoint,
            get_session_timeline,
            update_checkpoint_settings,
            get_checkpoint_diff,
            track_checkpoint_message,
            track_session_messages,
            check_auto_checkpoint,
            cleanup_old_checkpoints,
            get_checkpoint_settings,
            clear_checkpoint_manager,
            get_checkpoint_state_stats,
            
            // Agent Management
            list_agents,
            create_agent,
            update_agent,
            delete_agent,
            get_agent,
            execute_agent,
            list_agent_runs,
            get_agent_run,
            list_agent_runs_with_metrics,
            get_agent_run_with_real_time_metrics,
            list_running_sessions,
            kill_agent_session,
            get_session_status,
            cleanup_finished_processes,
            get_session_output,
            get_live_session_output,
            stream_session_output,
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
            
            // System Information
            get_system_memory_info,
            
            // Session File Watching
            start_session_watching,
            stop_session_watching,
            stop_all_session_watching,
            get_session_watching_status,
            
            // Frontend Debug Logging
            log_frontend_debug,
            
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
