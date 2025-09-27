use anyhow::Result;
use tracing::info;
use clap::{Arg, Command};

mod claude_wrapper;
mod wrapper_logger;

use claude_wrapper::ClaudeCodeWrapper;
use wrapper_logger::WrapperLogger;

#[tokio::main]
async fn main() -> Result<()> {
    // Parse command line arguments
    let matches = Command::new("claude-code-wrapper")
        .about("Claude Code Terminal Wrapper for Claudio")
        .arg(Arg::new("project-path")
            .long("project-path")
            .value_name("PATH")
            .help("Project directory path")
            .required(true))
        .arg(Arg::new("initial-prompt")
            .long("initial-prompt")
            .value_name("PROMPT")
            .help("Initial prompt to send to Claude")
            .required(false))
        .get_matches();
    
    let project_path = matches.get_one::<String>("project-path").unwrap();
    let initial_prompt = matches.get_one::<String>("initial-prompt");
    
    // Initialize wrapper logger (we'll update with real session ID from Claude)
    let logger = WrapperLogger::new("wrapper".to_string());
    
    // Also keep tracing for local debugging during development  
    tracing_subscriber::fmt()
        .with_env_filter("claude_code_wrapper=debug,expectrl=trace")
        .with_target(false)
        .with_thread_ids(false)
        .with_file(false)
        .with_line_number(false)
        .init();
    
    // Get wrapper process PID
    let wrapper_pid = std::process::id();
    
    logger.info("main", "🚀 Starting Claude Code Terminal Wrapper v0.1.0");
    logger.info("main", &format!("🔧 Wrapper PID: {}", wrapper_pid));
    logger.info("main", &format!("📁 Project path: {}", project_path));
    
    // Initialize wrapper with logger
    let mut wrapper = ClaudeCodeWrapper::new_with_logger(logger).await?;
    
    // Prepare session with project path (but don't start Claude yet)
    if let Err(e) = wrapper.prepare_session(project_path).await {
        eprintln!("Failed to prepare Claude session: {}", e);
        return Err(e);
    }
    
    // Send initial prompt if provided - this will trigger Claude startup
    if let Some(prompt) = initial_prompt {
        if !prompt.trim().is_empty() {
            info!("💬 Sending initial prompt (this will start Claude)");
            if let Err(e) = wrapper.send_command(prompt).await {
                eprintln!("Failed to send initial prompt: {}", e);
                return Err(e);
            }
        }
    }
    
    // Check if we should run in interactive mode (human) or daemon mode (automated)
    if atty::is(atty::Stream::Stdin) {
        // Interactive mode - human is running this directly
        wrapper.run_interactive().await?;
    } else {
        // Daemon mode - main app is controlling via stdin/stdout
        wrapper.run_daemon().await?;
    }
    
    info!("👋 Claude Code Wrapper session ended");
    Ok(())
}