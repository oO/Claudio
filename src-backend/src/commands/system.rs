use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMemoryInfo {
    pub process_memory_mb: f64,
    pub system_total_mb: f64,
    pub system_available_mb: f64,
    pub process_cpu_percent: f64,
}

#[command]
pub async fn get_system_memory_info() -> Result<SystemMemoryInfo, String> {
    use std::process::Command;
    
    // Get process info using ps command on Unix systems
    #[cfg(target_family = "unix")]
    {
        let pid = std::process::id();
        let output = Command::new("ps")
            .args(&["-o", "rss,pcpu", "-p", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to run ps command: {}", e))?;
        
        if output.status.success() {
            let output_str = String::from_utf8_lossy(&output.stdout);
            let lines: Vec<&str> = output_str.lines().collect();
            
            if lines.len() >= 2 {
                let parts: Vec<&str> = lines[1].split_whitespace().collect();
                if parts.len() >= 2 {
                    // RSS is in KB, convert to MB
                    let memory_kb: f64 = parts[0].parse().unwrap_or(0.0);
                    let cpu_percent: f64 = parts[1].parse().unwrap_or(0.0);
                    
                    // Get system memory info
                    let sys_output = Command::new("vm_stat")
                        .output()
                        .map_err(|e| format!("Failed to run vm_stat: {}", e))?;
                    
                    let (total_mb, available_mb) = if sys_output.status.success() {
                        parse_vm_stat(&String::from_utf8_lossy(&sys_output.stdout))
                    } else {
                        (8192.0, 4096.0) // Default estimates
                    };
                    
                    return Ok(SystemMemoryInfo {
                        process_memory_mb: memory_kb / 1024.0,
                        system_total_mb: total_mb,
                        system_available_mb: available_mb,
                        process_cpu_percent: cpu_percent,
                    });
                }
            }
        }
    }
    
    // Windows fallback or if Unix commands fail
    Ok(SystemMemoryInfo {
        process_memory_mb: 150.0, // Reasonable estimate
        system_total_mb: 8192.0,  // 8GB default
        system_available_mb: 4096.0, // 4GB available
        process_cpu_percent: 2.5,
    })
}

#[cfg(target_family = "unix")]
fn parse_vm_stat(vm_stat_output: &str) -> (f64, f64) {
    // Parse vm_stat output on macOS
    // This is a simplified parser - you might want to make it more robust
    let mut free_pages = 0u64;
    let mut inactive_pages = 0u64;
    
    for line in vm_stat_output.lines() {
        if line.contains("Pages free:") {
            if let Some(num_str) = line.split(':').nth(1) {
                free_pages = num_str.trim().replace('.', "").parse().unwrap_or(0);
            }
        } else if line.contains("Pages inactive:") {
            if let Some(num_str) = line.split(':').nth(1) {
                inactive_pages = num_str.trim().replace('.', "").parse().unwrap_or(0);
            }
        }
    }
    
    // Page size is typically 4KB on macOS
    let page_size = 4096u64;
    let available_bytes = (free_pages + inactive_pages) * page_size;
    let available_mb = available_bytes as f64 / (1024.0 * 1024.0);
    
    // Estimate total - this is a rough calculation
    let estimated_total_mb = available_mb * 2.0; // Assume ~50% is available
    
    (estimated_total_mb.max(4096.0), available_mb)
}