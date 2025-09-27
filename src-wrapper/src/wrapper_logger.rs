use serde_json::json;
use std::io::{self, Write};

/// Wrapper logger that sends structured logs to stdout for main process to capture
pub struct WrapperLogger {
    session_id: String,
}

impl WrapperLogger {
    pub fn new(session_id: String) -> Self {
        Self { session_id }
    }
    
    pub fn info(&self, component: &str, message: &str) {
        self.log("INFO", component, message);
    }
    
    pub fn warn(&self, component: &str, message: &str) {
        self.log("WARN", component, message);
    }
    
    pub fn error(&self, component: &str, message: &str) {
        self.log("ERROR", component, message);
    }
    
    pub fn debug(&self, component: &str, message: &str) {
        self.log("DEBUG", component, message);
    }
    
    fn log(&self, level: &str, component: &str, message: &str) {
        // Create structured log message
        let log_entry = json!({
            "type": "wrapper_log",
            "session_id": self.session_id,
            "level": level,
            "component": component,
            "message": message,
            "timestamp": chrono::Utc::now().to_rfc3339()
        });
        
        // Output to stdout as JSON line for main process to capture
        if let Ok(log_str) = serde_json::to_string(&log_entry) {
            println!("WRAPPER_LOG:{}", log_str);
            let _ = io::stdout().flush();
        }
    }
}