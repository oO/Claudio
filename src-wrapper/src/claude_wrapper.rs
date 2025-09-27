use anyhow::Result;
use expectrl::Session;
use std::time::Duration;
use tracing::{info, debug, warn, error, trace};
use std::io::{self, Write};
use tokio::io::AsyncBufReadExt;
use crate::wrapper_logger::WrapperLogger;

pub struct ClaudeCodeWrapper {
    session: Option<Session>,
    logger: Option<WrapperLogger>,
    project_path: Option<String>,
}

impl ClaudeCodeWrapper {
    #[allow(dead_code)]
    pub async fn new() -> Result<Self> {
        Ok(Self {
            session: None,
            logger: None,
            project_path: None,
        })
    }
    
    pub async fn new_with_logger(logger: WrapperLogger) -> Result<Self> {
        Ok(Self {
            session: None,
            logger: Some(logger),
            project_path: None,
        })
    }
    
    // Helper method for logging
    fn log(&self, level: &str, component: &str, message: &str) {
        if let Some(logger) = &self.logger {
            match level {
                "info" => logger.info(component, message),
                "warn" => logger.warn(component, message),
                "error" => logger.error(component, message),
                "debug" => logger.debug(component, message),
                _ => logger.info(component, message),
            }
        }
        // Also log to tracing for development
        match level {
            "info" => info!("[{}] {}", component, message),
            "warn" => warn!("[{}] {}", component, message),
            "error" => error!("[{}] {}", component, message),
            "debug" => debug!("[{}] {}", component, message),
            _ => info!("[{}] {}", component, message),
        }
    }
    
    pub async fn prepare_session(&mut self, project_path: &str) -> Result<()> {
        self.log("info", "session", &format!("📝 Preparing Claude Code session for: {}", project_path));
        
        // Check if Claude Code is available
        if !self.is_claude_available().await {
            self.log("error", "session", "❌ Claude Code binary not found");
            return Err(anyhow::anyhow!("Claude Code binary not found. Please install Claude Code CLI first."));
        }
        
        // Store project path but don't start Claude yet - wait for first command
        self.project_path = Some(project_path.to_string());
        
        self.log("info", "session", "✅ Session prepared - Claude will start on first command");
        
        Ok(())
    }
    
    async fn start_claude_with_status(&mut self) -> Result<String> {
        let project_path = self.project_path.as_ref()
            .ok_or_else(|| anyhow::anyhow!("No project path set - call prepare_session first"))?;
            
        self.log("info", "session", &format!("🚀 Starting Claude Code in streaming mode at: {}", project_path));
        
        // Use Claude Code in non-interactive streaming mode instead of PTY
        // This avoids TTY issues when launched as child process
        self.log("info", "session", "🔄 Using Claude Code in streaming JSON mode (no PTY)");
        
        let mut cmd = std::process::Command::new("claude");
        cmd.current_dir(project_path)
           .arg("--print")
           .arg("--output-format")
           .arg("stream-json")
           .stdin(std::process::Stdio::piped())
           .stdout(std::process::Stdio::piped())
           .stderr(std::process::Stdio::piped());
        
        // Spawn as regular process, not PTY session
        let claude_process = cmd.spawn()?;
        
        // Get the process ID and log it
        let process_id = claude_process.id();
        self.log("info", "session", &format!("📡 Spawned Claude process with PID: {}", process_id));
        
        // VERIFY: Check if this process is actually Claude
        match std::process::Command::new("ps")
            .arg("-p")
            .arg(process_id.to_string())
            .arg("-o")
            .arg("comm=")
            .output()
        {
            Ok(output) => {
                let process_name = String::from_utf8_lossy(&output.stdout).trim().to_string();
                self.log("info", "session", &format!("🔍 Process {} is: '{}'", process_id, process_name));
            },
            Err(e) => {
                self.log("warn", "session", &format!("⚠️ Failed to check process name: {}", e));
            }
        }
        
        // Wait for Claude welcome screen to be ready
        self.log("info", "session", "📥 Waiting for Claude to be ready...");
        let welcome_output = Self::wait_for_ready_state_static(&mut session).await?;
        
        // Skip /status command for now since autocomplete is interfering
        // Generate a fake session ID for testing purposes
        self.log("info", "session", "🔄 Skipping /status command due to autocomplete interference");
        
        // Wait a moment for Claude to be fully ready  
        tokio::time::sleep(Duration::from_millis(500)).await;
        
        // Claude should now be ready for user commands
        self.log("info", "session", "✅ Claude ready for user commands");
        
        // Generate a fake session ID for now - we'll figure out real session ID extraction later
        let session_id = {
            use uuid::Uuid;
            let fake_id = Uuid::new_v4().to_string();
            self.log("info", "session", &format!("🆔 Generated fake session ID for testing: {}", fake_id));
            fake_id
        };
        
        // Store the session
        self.session = Some(session);
        self.log("info", "session", "✅ Claude Code session active and in interactive mode");
        
        Ok(session_id)
    }
    
    pub async fn send_command(&mut self, command: &str) -> Result<String> {
        // If no session exists yet, this is the first command - start Claude now!
        if self.session.is_none() {
            if self.project_path.is_some() {
                self.log("info", "session", "🎯 First command received - initializing Claude Code session!");
                
                // Start Claude with /status, capture session ID, then escape to interactive mode
                let _session_id = self.start_claude_with_status().await?;
                
                self.log("info", "session", "✅ Claude Code session initialized and ready for commands");
            } else {
                return Err(anyhow::anyhow!("No project path set - call prepare_session first"));
            }
        }
        
        // Check if session is still alive
        if !self.is_session_active() {
            // Session exists but Claude process died
            self.session = None; // Clean up dead session
            self.log("error", "session", "❌ Claude Code process died, session terminated");
            return Err(anyhow::anyhow!("Claude session died and needs to be restarted"));
        }
        
        self.log("info", "command", &format!("📤 Sending command to Claude: '{}'", command));
        info!("📤 Sending command to Claude: '{}'", command);
        
        let response = if let Some(session) = &mut self.session {
            // Send the command
            trace!("🔌 Writing command to PTY session");
            // Send command normally - slash commands will show autocomplete but that's ok for now
            session.send_line(command)?;
            debug!("✅ Command sent successfully");
            
            // Try sending an additional ENTER to ensure execution
            trace!("📤 Sending additional ENTER to ensure execution");
            session.send_line("")?;
            
            // Read the complete response until we get back to a prompt
            Self::read_until_ready_static(session).await?
        } else {
            return Err(anyhow::anyhow!("Session lost during command execution"));
        };
        
        if !response.is_empty() {
            self.log("info", "response", &format!("📝 Claude response received ({} chars)", response.len()));
            self.log("info", "response", "─── START CLAUDE RESPONSE ───");
            for (i, line) in response.lines().enumerate() {
                self.log("info", "response", &format!("│{:3}: {}", i + 1, line));
            }
            self.log("info", "response", "─── END CLAUDE RESPONSE ───");
            
            // Also keep the tracing logs for development
            info!("📝 Claude response received ({} chars):", response.len());
            trace!("🔍 Raw response: {:?}", response);
        } else {
            self.log("info", "response", "📝 Command completed (no visible output)");
            info!("📝 Command completed (no visible output)");
        }
        
        Ok(response)
    }
    
    pub async fn run_interactive(&mut self) -> Result<()> {
        info!("Starting interactive wrapper mode");
        
        println!("🚀 Claude Code Wrapper - Interactive Mode");
        
        // Project path should be set by now
        if self.project_path.is_none() {
            return Err(anyhow::anyhow!("No project path set - call prepare_session() first"));
        }
        
        println!("✅ Claude Code session prepared - will start on first command!");
        println!("Type 'exit' to quit the wrapper");
        println!();
                
        // Simple interactive loop
        self.interactive_loop().await?;
        
        Ok(())
    }
    
    pub async fn run_daemon(&mut self) -> Result<()> {
        info!("Starting daemon wrapper mode - reading commands from stdin");
        
        // Project path should be set by now
        if self.project_path.is_none() {
            return Err(anyhow::anyhow!("No project path set - call prepare_session() first"));
        }
        
        self.log("info", "daemon", "🤖 Daemon mode started - ready for commands");
        
        // Read commands from stdin line by line
        let stdin = tokio::io::stdin();
        let mut lines = tokio::io::BufReader::new(stdin).lines();
        
        while let Ok(Some(line)) = lines.next_line().await {
            let command = line.trim();
            
            if command.is_empty() {
                continue;
            }
            
            // HANDSHAKE: Immediately acknowledge command receipt
            println!("WRAPPER_ACK:COMMAND_RECEIVED:{}", command);
            std::io::stdout().flush().unwrap();
            
            self.log("info", "daemon", &format!("📥 Received command: {}", command));
            
            // Handle special daemon commands
            match command {
                "/exit" | "/quit" | "/stop" => {
                    self.log("info", "daemon", "🚪 Daemon exit requested");
                    break;
                },
                "/health" => {
                    if self.is_session_active() {
                        self.log("info", "daemon", "✅ Session healthy");
                        if let Some(session) = &self.session {
                            let pid = session.get_process().pid();
                            self.log("info", "daemon", &format!("🔍 Claude PID: {}", pid));
                        }
                    } else {
                        self.log("error", "daemon", "❌ Session not healthy");
                    }
                },
                _ => {
                    // Send regular command to Claude
                    println!("WRAPPER_ACK:PROCESSING_COMMAND:{}", command);
                    std::io::stdout().flush().unwrap();
                    
                    match self.send_command(command).await {
                        Ok(response) => {
                            println!("WRAPPER_ACK:COMMAND_COMPLETED:{}:{}", command, response.len());
                            std::io::stdout().flush().unwrap();
                            self.log("info", "daemon", &format!("✅ Command processed, response: {} chars", response.len()));
                        },
                        Err(e) => {
                            println!("WRAPPER_ACK:COMMAND_FAILED:{}:{}", command, e);
                            std::io::stdout().flush().unwrap();
                            self.log("error", "daemon", &format!("❌ Command failed: {}", e));
                        }
                    }
                }
            }
        }
        
        self.log("info", "daemon", "🔄 Daemon mode ended");
        Ok(())
    }
    
    async fn interactive_loop(&mut self) -> Result<()> {
        info!("🔄 Starting persistent interactive loop");
        
        loop {
            print!("wrapper> ");
            io::stdout().flush()?;
            
            let mut input = String::new();
            if io::stdin().read_line(&mut input)? == 0 {
                info!("📝 EOF received, ending session");
                break; // EOF
            }
            
            let input = input.trim();
            
            match input {
                "exit" | "quit" => {
                    info!("👋 User requested exit");
                    println!("Bye! 👋");
                    break;
                },
                "status" => {
                    self.print_status();
                },
                "health" => {
                    if self.is_session_active() {
                        println!("✅ Claude Code session is healthy and running");
                        if let Some(session) = &self.session {
                            let pid = session.get_process().pid();
                            println!("🔍 Claude Code PID: {}", pid);
                        }
                    } else {
                        println!("❌ Claude Code session is not running or has died");
                    }
                },
                "test" => {
                    if let Err(e) = self.send_test_command().await {
                        println!("Test failed: {}", e);
                        error!("❌ Test command failed: {}", e);
                    }
                },
                "/exit" => {
                    info!("🚪 Sending /exit command to terminate Claude session");
                    match self.send_command("/exit").await {
                        Ok(response) => {
                            if !response.is_empty() {
                                println!("👋 Claude exit response: {}", response.trim());
                            }
                            println!("✅ Claude session terminated by /exit command");
                            // Mark session as no longer available
                            self.session = None;
                            info!("🚪 Claude session cleaned up");
                        },
                        Err(e) => {
                            println!("❌ Failed to send /exit command: {}", e);
                            error!("❌ /exit command failed: {}", e);
                        }
                    }
                },
                cmd if cmd.starts_with("/") => {
                    // Handle other Claude Code slash commands
                    debug!("📤 Processing Claude slash command: '{}'", cmd);
                    match self.send_command(cmd).await {
                        Ok(response) => {
                            if !response.is_empty() {
                                println!("📦 Claude response: {}", response.trim());
                            } else {
                                println!("✅ Command completed");
                            }
                        },
                        Err(e) => {
                            println!("Error: {}", e);
                            error!("❌ Slash command '{}' failed: {}", cmd, e);
                        }
                    }
                },
                cmd if !cmd.is_empty() => {
                    debug!("📤 Processing user command: '{}'", cmd);
                    match self.send_command(cmd).await {
                        Ok(response) => {
                            if !response.is_empty() {
                                println!("Response: {}", response.trim());
                            } else {
                                println!("✅ Command completed");
                            }
                        },
                        Err(e) => {
                            println!("Error: {}", e);
                            error!("❌ Command '{}' failed: {}", cmd, e);
                            
                            // Try to recover session state
                            warn!("🔄 Attempting to recover session state");
                        }
                    }
                },
                _ => {
                    // Empty input, just continue
                }
            }
        }
        
        // Clean shutdown
        if let Some(_session) = &self.session {
            info!("🧹 Cleaning up active Claude session");
            // Session will be dropped automatically
        }
        
        info!("🔄 Interactive loop ended");
        Ok(())
    }
    
    fn print_status(&self) {
        println!("📊 Status:");
        println!("  Session active: {}", self.session.is_some());
        
        if self.session.is_some() {
            info!("✅ Claude session is active and persistent");
            println!("ℹ️ To terminate Claude session, use '/exit' command");
        } else {
            warn!("❌ No active Claude session");
            println!("ℹ️ Claude session has been terminated");
        }
    }
    
    pub fn is_session_active(&self) -> bool {
        if let Some(session) = &self.session {
            // Check if the Claude Code process is still running
            let process = session.get_process();
            let pid = process.pid();
            
            // Check if process with this PID is still alive
            match std::process::Command::new("kill")
                .arg("-0")  // Signal 0 just checks if process exists
                .arg(pid.to_string())
                .output()
            {
                Ok(output) => {
                    let is_alive = output.status.success();
                    if !is_alive {
                        self.log("warn", "session", &format!("⚠️ Claude Code process {} is no longer running", pid));
                    }
                    is_alive
                },
                Err(_) => {
                    self.log("error", "session", &format!("❌ Failed to check if Claude Code process {} is running", pid));
                    false
                }
            }
        } else {
            false
        }
    }
    
    #[allow(dead_code)]
    pub async fn terminate_session(&mut self) -> Result<()> {
        if self.session.is_some() {
            info!("🚪 Terminating Claude session");
            
            // Try to send /exit command first
            if let Err(e) = self.send_command("/exit").await {
                warn!("⚠️ Failed to send /exit command: {}", e);
            }
            
            // Clean up session state
            self.session = None;
            
            info!("✅ Claude session terminated and cleaned up");
        } else {
            warn!("⚠️ No active session to terminate");
        }
        
        Ok(())
    }
    
    async fn send_test_command(&mut self) -> Result<()> {
        info!("🧪 Executing test command sequence");
        
        // Send a simple command to test interaction
        let response = self.send_command("pwd").await?;
        if !response.is_empty() {
            println!("🎯 Test response captured: {}", response.trim());
        } else {
            println!("🎯 Test completed (no visible output)");
        }
        
        // Session should still be active
        info!("✅ Session ready for next command");
        
        Ok(())
    }
    
    fn extract_session_id_from_status_output(&self, output: &str) -> Option<String> {
        self.log("debug", "session_id", "🔍 Searching for session ID patterns in /status output");
        
        // Real session ID patterns that Claude Code uses in /status output
        let patterns = [
            "Session ID: ",
            "session_id: ", 
            "Session: ",
            "Current session: ",
            "Session Id: ",
            "sessionId: ",
            // Look for UUID-like patterns in the output
        ];
        
        // First, try pattern matching
        for line in output.lines() {
            let clean_line = line.trim();
            for pattern in &patterns {
                if let Some(session_start) = clean_line.find(pattern) {
                    let session_id_part = &clean_line[session_start + pattern.len()..];
                    // Extract just the session ID (stop at whitespace or special chars)
                    let session_id = session_id_part
                        .split_whitespace()
                        .next()
                        .unwrap_or("")
                        .trim_matches(|c: char| !c.is_alphanumeric() && c != '-' && c != '_');
                    
                    if !session_id.is_empty() && session_id.len() >= 8 { // Minimum reasonable session ID length
                        self.log("info", "session_id", &format!("🆔 Extracted session ID: {}", session_id));
                        return Some(session_id.to_string());
                    }
                }
            }
        }
        
        // Fallback: Look for UUID-like patterns anywhere in the output
        use regex::Regex;
        if let Ok(uuid_regex) = Regex::new(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}") {
            for line in output.lines() {
                if let Some(matched) = uuid_regex.find(line) {
                    let session_id = matched.as_str();
                    self.log("info", "session_id", &format!("🆔 Found UUID-like session ID: {}", session_id));
                    return Some(session_id.to_string());
                }
            }
        }
        
        self.log("warn", "session_id", "⚠️ No session ID found in /status output");
        self.log("debug", "session_id", "📋 Complete /status output for analysis:");
        for (i, line) in output.lines().enumerate() {
            self.log("debug", "session_id", &format!("│{:3}: {}", i + 1, line));
        }
        
        None
    }
    
    async fn is_claude_available(&self) -> bool {
        debug!("🔍 Checking Claude Code availability...");
        
        match tokio::process::Command::new("which")
            .arg("claude")
            .output()
            .await
        {
            Ok(output) => {
                if output.status.success() {
                    let path_output = String::from_utf8_lossy(&output.stdout);
                    let path = path_output.trim();
                    info!("✅ Found Claude Code binary at: {}", path);
                    true
                } else {
                    debug!("❌ 'which claude' failed, trying direct version check");
                    false
                }
            },
            Err(e) => {
                debug!("❌ 'which' command failed: {}, trying direct version check", e);
                // Try alternative check
                match tokio::process::Command::new("claude")
                    .arg("--version")
                    .output()
                    .await
                {
                    Ok(output) => {
                        if output.status.success() {
                            let version_output = String::from_utf8_lossy(&output.stdout);
                            info!("✅ Claude Code available, version: {}", version_output.trim());
                            true
                        } else {
                            warn!("❌ Claude version check failed with status: {}", output.status);
                            false
                        }
                    },
                    Err(e) => {
                        error!("❌ Claude Code not available: {}", e);
                        false
                    }
                }
            }
        }
    }
    
    async fn wait_for_ready_state_static(session: &mut Session) -> Result<String> {
        info!("⏳ Waiting for Claude to be ready and capturing welcome message...");
        
        let mut welcome_output = String::new();
        let mut buffer = [0u8; 4096];
        let start_time = std::time::Instant::now();
        let max_wait = Duration::from_secs(10); // Wait up to 10 seconds for welcome message
        let mut consecutive_empty_reads = 0;
        
        // Give Claude a moment to start outputting
        tokio::time::sleep(Duration::from_millis(500)).await;
        
        loop {
            // Check for overall timeout
            if start_time.elapsed() > max_wait {
                info!("⏰ Timeout waiting for Claude welcome message");
                break;
            }
            
            // Try to read available data
            match session.try_read(&mut buffer) {
                Ok(bytes_read) => {
                    if bytes_read > 0 {
                        consecutive_empty_reads = 0;
                        let data = String::from_utf8_lossy(&buffer[..bytes_read]);
                        welcome_output.push_str(&data);
                        
                        // RAW DEBUG: Log exactly what Claude outputs, byte by byte
                        info!("🔍 RAW BYTES ({}): {:?}", bytes_read, &buffer[..bytes_read]);
                        info!("🔍 RAW STRING: {:?}", data);
                        info!("🔍 RAW CONTENT: {}", data);
                        
                        // Check if we've got the full welcome message (look for the bottom border)
                        if data.contains("╰") || data.contains("└") {
                            info!("✅ Claude welcome message complete");
                            // Give a bit more time to ensure we got everything
                            tokio::time::sleep(Duration::from_millis(200)).await;
                            
                            // Final check for any remaining data
                            match session.try_read(&mut buffer) {
                                Ok(final_bytes) => {
                                    if final_bytes > 0 {
                                        let final_data = String::from_utf8_lossy(&buffer[..final_bytes]);
                                        welcome_output.push_str(&final_data);
                                    }
                                },
                                Err(_) => {}
                            }
                            break;
                        }
                    } else {
                        consecutive_empty_reads += 1;
                        
                        // If we've got some output but now seeing empty reads, Claude might be done
                        if !welcome_output.is_empty() && consecutive_empty_reads >= 5 {
                            info!("✅ No more welcome data, assuming complete");
                            break;
                        }
                        
                        // Wait between empty reads
                        tokio::time::sleep(Duration::from_millis(100)).await;
                    }
                },
                Err(_) => {
                    consecutive_empty_reads += 1;
                    
                    // If we've collected some output and now hitting read errors, Claude might be ready
                    if !welcome_output.is_empty() && consecutive_empty_reads >= 10 {
                        info!("✅ Read errors after collecting output, assuming ready");
                        break;
                    }
                    
                    // Wait between read attempts
                    tokio::time::sleep(Duration::from_millis(150)).await;
                }
            }
        }
        
        info!("📊 Welcome message capture complete: {} chars", welcome_output.len());
        Ok(welcome_output)
    }
    
    async fn read_until_ready_static(session: &mut Session) -> Result<String> {
        info!("👂 Reading Claude response until fully complete and ready...");
        let mut response = String::new();
        let mut buffer = [0u8; 4096];
        let mut total_bytes = 0;
        let start_time = std::time::Instant::now();
        let max_wait = Duration::from_secs(60); // Extended timeout for complex operations
        let mut consecutive_empty_reads = 0;
        let mut last_activity = std::time::Instant::now();
        
        loop {
            // Check for overall timeout
            if start_time.elapsed() > max_wait {
                warn!("⏰ Overall timeout waiting for Claude response completion");
                break;
            }
            
            // Try to read available data
            match session.try_read(&mut buffer) {
                Ok(bytes_read) => {
                    if bytes_read > 0 {
                        total_bytes += bytes_read;
                        consecutive_empty_reads = 0;
                        last_activity = std::time::Instant::now();
                        
                        let data = String::from_utf8_lossy(&buffer[..bytes_read]);
                        response.push_str(&data);
                        trace!("📥 Read {} bytes (total: {})", bytes_read, total_bytes);
                        
                        // Log the actual content for debugging
                        for line in data.lines() {
                            if !line.trim().is_empty() {
                                trace!("📄 Content: {}", line);
                            }
                        }
                        
                        // Check if this chunk indicates Claude is ready
                        if Self::looks_like_completion_signal(&data) {
                            debug!("✅ Detected Claude completion signal");
                            // Give a bit more time to ensure no trailing output
                            tokio::time::sleep(Duration::from_millis(300)).await;
                            
                            // Final check for any remaining data
                            match session.try_read(&mut buffer) {
                                Ok(final_bytes) => {
                                    if final_bytes > 0 {
                                        total_bytes += final_bytes;
                                        let final_data = String::from_utf8_lossy(&buffer[..final_bytes]);
                                        response.push_str(&final_data);
                                        trace!("📥 Final chunk: {} bytes", final_bytes);
                                    }
                                },
                                Err(_) => {}
                            }
                            break;
                        }
                    } else {
                        consecutive_empty_reads += 1;
                        
                        // If we've had some output but now seeing empty reads,
                        // Claude might be done
                        if total_bytes > 0 && consecutive_empty_reads >= 3 {
                            let idle_time = last_activity.elapsed();
                            if idle_time > Duration::from_millis(1000) {
                                debug!("✅ No activity for {}ms, assuming completion", idle_time.as_millis());
                                break;
                            }
                        }
                        
                        // Wait between empty reads
                        tokio::time::sleep(Duration::from_millis(150)).await;
                    }
                },
                Err(_) => {
                    consecutive_empty_reads += 1;
                    
                    // If we've collected some output and now hitting read errors,
                    // Claude might be ready
                    if total_bytes > 0 && consecutive_empty_reads >= 5 {
                        let idle_time = last_activity.elapsed();
                        if idle_time > Duration::from_millis(2000) {
                            debug!("✅ Extended idle period, assuming Claude ready");
                            break;
                        }
                    }
                    
                    // Wait between read attempts
                    tokio::time::sleep(Duration::from_millis(200)).await;
                }
            }
            
            // Safety check: if we haven't seen any output for too long, break
            if total_bytes == 0 && start_time.elapsed() > Duration::from_secs(5) {
                warn!("⚠️ No output after 5 seconds, Claude might not be responding");
                break;
            }
        }
        
        info!("📊 Response complete: {} bytes total, {} consecutive empty reads", total_bytes, consecutive_empty_reads);
        Ok(response)
    }
    
    fn looks_like_completion_signal(data: &str) -> bool {
        // More sophisticated completion detection
        // Claude Code shows specific patterns when ready for next input:
        
        // Terminal control sequences indicating readiness
        let has_cursor_control = data.contains("\x1b[?25h") ||  // Show cursor
                                data.contains("\x1b[?2004h"); // Bracketed paste mode
        
        // UI completion indicators
        let has_ui_completion = data.contains("╰") ||          // Bottom of box drawing
                               data.contains("? for shortcuts") || // Help hint
                               data.contains("> \x1b[7m");      // Prompt with highlighting
        
        // Input readiness patterns
        let has_input_ready = data.contains("\x1b[7m \x1b[27m") || // Cursor in input area
                             data.ends_with("\x1b[22m");        // End of dim text
        
        // Processing completion indicators
        let has_completion_marker = data.contains("\x1b[2K") &&   // Clear line
                                   data.contains("\x1b[1A");     // Move up (redraw)
        
        let is_complete = has_cursor_control || has_ui_completion || has_input_ready || has_completion_marker;
        
        if is_complete {
            trace!("🔍 Completion detected: cursor={}, ui={}, input={}, marker={}", 
                  has_cursor_control, has_ui_completion, has_input_ready, has_completion_marker);
        }
        
        is_complete
    }
}