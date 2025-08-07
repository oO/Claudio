use anyhow::Result;
use log::{error, warn};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::AppHandle;

use crate::claude_binary::{create_command_with_env, find_claude_binary};

// Global flag to prevent multiple quote generation tasks from running simultaneously
static GENERATION_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

// File path for quote storage
const QUOTES_FILENAME: &str = "claudio-quotes.json";
const MAX_QUOTE_POOL_SIZE: usize = 20;

// Prompt modifier for batch generation  
const BATCH_QUOTE_MODIFIER: &str = "IMPORTANT: generate {} quotes at a time and return only the data as a JSON array.";

#[derive(Serialize, Deserialize)]
pub struct QuoteResponse {
    pub quote: String,
    pub source: String, // "claude", "fallback", or "pool"
}

#[derive(Serialize, Deserialize)]
pub struct QuoteData {
    pub quotes: Vec<String>,
    pub instructions: String,
}

/// Get a quote immediately (pop from pool) and trigger background generation
#[tauri::command]
pub async fn get_programming_quote(app: AppHandle) -> Result<QuoteResponse, String> {
    log::info!("Quote requested - checking pool and triggering refill if needed");
    // Check pool size and start background generation if needed (but only one at a time)
    let app_clone = app.clone();
    tokio::spawn(async move {
        // Check if generation is already in progress
        if GENERATION_IN_PROGRESS.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_ok() {
            log::info!("Starting background quote pool refill - checking pool size first");
            
            // Log current pool status
            match should_generate_more_quotes(&app_clone).await {
                Ok(should_generate) => {
                    log::info!("Should generate more quotes: {}", should_generate);
                    if !should_generate {
                        log::info!("Pool is already full, no generation needed");
                        GENERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
                        return;
                    }
                }
                Err(e) => {
                    log::error!("Failed to check pool status: {}", e);
                    GENERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
                    return;
                }
            }
            
            // Use batch generation only (more efficient)
            match generate_batch_quotes(&app_clone).await {
                Ok(quotes_generated) => {
                    log::info!("Successfully generated {} quotes in batch", quotes_generated);
                }
                Err(e) => {
                    error!("Batch generation failed: {}", e);
                    // No fallback - batch generation should be reliable
                }
            }
            
            // Mark generation as complete
            GENERATION_IN_PROGRESS.store(false, Ordering::SeqCst);
            log::info!("Background quote generation task completed");
        } else {
            log::info!("Quote generation already in progress, skipping");
        }
    });

    // Try to pop a quote from the pool
    match pop_quote_from_pool(&app).await {
        Ok(quote) => {
            log::info!("Successfully retrieved quote from pool: {}", quote.lines().next().unwrap_or(""));
            Ok(QuoteResponse {
                quote,
                source: "pool".to_string(),
            })
        },
        Err(e) => {
            // Pool is empty, generate a batch immediately
            log::warn!("Quote pool is empty ({}), generating batch immediately", e);
            match generate_batch_quotes(&app).await {
                Ok(quotes_generated) => {
                    if quotes_generated > 0 {
                        // Try to get a quote from the now-filled pool
                        match pop_quote_from_pool(&app).await {
                            Ok(quote) => {
                                log::info!("Successfully retrieved quote after immediate batch generation");
                                Ok(QuoteResponse {
                                    quote,
                                    source: "batch".to_string(),
                                })
                            }
                            Err(_) => {
                                // Still empty somehow, return fallback
                                let fallback = get_random_fallback_quote();
                                Ok(QuoteResponse {
                                    quote: fallback,
                                    source: "fallback".to_string(),
                                })
                            }
                        }
                    } else {
                        let fallback = get_random_fallback_quote();
                        Ok(QuoteResponse {
                            quote: fallback,
                            source: "fallback".to_string(),
                        })
                    }
                }
                Err(batch_error) => {
                    log::error!("Immediate batch generation failed: {}", batch_error);
                    let fallback = get_random_fallback_quote();
                    Ok(QuoteResponse {
                        quote: fallback,
                        source: "fallback".to_string(),
                    })
                }
            }
        }
    }
}

/// Initialize the quote pool with fallback quotes
#[tauri::command]
pub async fn initialize_quote_pool(app: AppHandle) -> Result<(), String> {
    let quotes_path = get_quotes_path(&app)?;

    // Load existing quotes data or create new
    let mut quote_data = load_quotes_data(&quotes_path).unwrap_or_else(|_| QuoteData {
        quotes: get_initial_quotes(),
        instructions:
            "generate a programming quote in haiku form"
                .to_string(),
    });

    // Initialize quotes array if it's empty (but preserve existing instructions)
    if quote_data.quotes.is_empty() {
        quote_data.quotes = get_initial_quotes();
        // Only set default instructions if they're empty/missing
        if quote_data.instructions.is_empty() {
            quote_data.instructions =
                "generate a programming quote in haiku form"
                    .to_string();
        }
        save_quotes_data(&quotes_path, &quote_data)?;
    }

    Ok(())
}

/// Pop a random quote from the pool
async fn pop_quote_from_pool(app: &AppHandle) -> Result<String, String> {
    let quotes_path = get_quotes_path(app)?;

    let mut quote_data = match load_quotes_data(&quotes_path) {
        Ok(data) => data,
        Err(e) => {
            error!("Quote burning: Failed to load quotes data: {}", e);
            return Err(e);
        }
    };

    if quote_data.quotes.is_empty() {
        return Err("Quote pool is empty".to_string());
    }

    // Pop random quote
    let random_index = (std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as usize)
        % quote_data.quotes.len();

    let quote = quote_data.quotes.remove(random_index);

    // Save updated quotes data
    save_quotes_data(&quotes_path, &quote_data)
        .map_err(|e| {
            error!("Quote burning: Failed to save quotes file: {}", e);
            format!("Failed to save updated quotes: {}", e)
        })?;

    Ok(quote)
}

/// Generate multiple quotes in a single batch request (more efficient)
async fn generate_batch_quotes(app: &AppHandle) -> Result<usize, String> {
    // Check how many quotes we need
    let quotes_needed = match should_generate_more_quotes(app).await {
        Ok(true) => {
            let quotes_path = get_quotes_path(app)?;
            match load_quotes_data(&quotes_path) {
                Ok(data) => MAX_QUOTE_POOL_SIZE - data.quotes.len(),
                Err(_) => MAX_QUOTE_POOL_SIZE,
            }
        }
        _ => return Ok(0), // Pool is full or error checking
    };
    
    if quotes_needed == 0 {
        return Ok(0);
    }
    
    log::info!("Attempting to generate {} quotes in batch", quotes_needed);
    
    // Find Claude binary
    let claude_path = find_claude_binary(app)
        .map_err(|e| format!("Could not find Claude binary: {}", e))?;
    
    // Get the original instructions from quotes file
    let original_instructions = match get_quotes_path(app) {
        Ok(quotes_path) => match load_quotes_data(&quotes_path) {
            Ok(data) => data.instructions,
            Err(_) => "generate a programming quote in haiku form".to_string(),
        },
        Err(_) => "generate a programming quote in haiku form".to_string(),
    };
    
    // Extend the original instructions for batch generation
    let batch_prompt = format!(
        "{} {}",
        original_instructions,
        BATCH_QUOTE_MODIFIER.replace("{}", &quotes_needed.to_string())
    );
    
    // Generate batch
    let mut cmd = create_command_with_env(&claude_path);
    cmd.arg("-p").arg("--model").arg("haiku").arg(&batch_prompt)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    log::info!("[BATCH] Executing command: {:?} with args: [\"-p\", \"--model\", \"haiku\", {:?}]", claude_path, batch_prompt);
    
    let output = cmd.output()
        .map_err(|e| {
            log::error!("[BATCH] Failed to execute Claude command: {}", e);
            format!("Failed to execute Claude command: {}", e)
        })?;
    
    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let stderr_str = String::from_utf8_lossy(&output.stderr);
    
    log::info!("[BATCH] Command completed with status: {}", output.status);
    log::info!("[BATCH] Stdout length: {} chars", stdout_str.len());
    log::info!("[BATCH] Stdout content: {}", stdout_str.chars().take(500).collect::<String>());
    if !stderr_str.is_empty() {
        log::warn!("[BATCH] Stderr: {}", stderr_str);
    }
    
    if !output.status.success() {
        log::error!("[BATCH] Claude command failed with status: {}", output.status);
        return Err(format!("Claude command failed: {}", output.status));
    }
    
    // Try to parse as JSON array
    let quotes: Vec<String> = match serde_json::from_str(&stdout_str) {
        Ok(parsed_quotes) => parsed_quotes,
        Err(e) => {
            log::warn!("Failed to parse batch response as JSON: {}. Raw response: '{}'", e, stdout_str.chars().take(200).collect::<String>());
            return Err(format!("Invalid JSON response from Claude: {}", e));
        }
    };
    
    let mut added_count = 0;
    for quote in quotes {
        let trimmed_quote = quote.trim().to_string();
        if !trimmed_quote.is_empty() && trimmed_quote.lines().count() >= 3 {
            match add_quote_to_pool(app, trimmed_quote.clone()).await {
                Ok(_) => {
                    added_count += 1;
                    log::info!("Batch: added quote #{}: {}", added_count, trimmed_quote.lines().next().unwrap_or(""));
                }
                Err(e) => {
                    log::warn!("Failed to add batch quote: {}", e);
                }
            }
        } else {
            log::warn!("Skipping invalid quote from batch: '{}' (lines: {})", trimmed_quote, trimmed_quote.lines().count());
        }
    }
    
    if added_count > 0 {
        Ok(added_count)
    } else {
        Err("No valid quotes generated in batch".to_string())
    }
}

/// Check if we should generate more quotes based on current pool size
async fn should_generate_more_quotes(app: &AppHandle) -> Result<bool, String> {
    let quotes_path = get_quotes_path(app)?;
    match load_quotes_data(&quotes_path) {
        Ok(quote_data) => {
            let current_size = quote_data.quotes.len();
            // Only refill when pool is half full or less
            let refill_threshold = MAX_QUOTE_POOL_SIZE / 2;
            let should_refill = current_size <= refill_threshold;
            log::info!(
                "Pool size: {}/{}, threshold: {}, should_refill: {}",
                current_size, MAX_QUOTE_POOL_SIZE, refill_threshold, should_refill
            );
            Ok(should_refill)
        }
        Err(e) => {
            warn!("Failed to load quotes for pool size check: {}", e);
            // If we can't check, assume we should generate (safer default)
            Ok(true)
        }
    }
}

/// Add a quote to the pool
async fn add_quote_to_pool(app: &AppHandle, quote: String) -> Result<(), String> {
    let quotes_path = get_quotes_path(app)?;
    let mut quote_data = load_quotes_data(&quotes_path).unwrap_or_else(|_| {
        // Only create default instructions if file doesn't exist at all
        QuoteData {
            quotes: Vec::new(),
            instructions:
                "generate a programming quote in haiku form"
                    .to_string(),
        }
    });

    quote_data.quotes.push(quote.clone());
    save_quotes_data(&quotes_path, &quote_data).map_err(|e| {
        error!("Failed to save quotes data: {}", e);
        e
    })?;
    
    log::info!(
        "Successfully saved quote to pool. Pool size: {}. Quote: {}",
        quote_data.quotes.len(),
        quote.lines().next().unwrap_or("")
    );
    Ok(())
}

/// Get the base Claude directory path
fn get_claude_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("Failed to get home directory")?;
    Ok(home_dir.join(".claude"))
}

/// Get quotes file path
fn get_quotes_path(_app: &AppHandle) -> Result<PathBuf, String> {
    get_claude_dir().map(|dir| dir.join(QUOTES_FILENAME))
}

/// Load quotes data from file
fn load_quotes_data(path: &PathBuf) -> Result<QuoteData, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read quotes file: {}", e))?;
    
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse quotes JSON: {}", e))
}

/// Save quotes data to file
fn save_quotes_data(path: &PathBuf, quote_data: &QuoteData) -> Result<(), String> {
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create quotes directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(quote_data)
        .map_err(|e| format!("Failed to serialize quotes data: {}", e))?;

    std::fs::write(path, &content).map_err(|e| {
        error!("Failed to write quotes file to {:?}: {}", path, e);
        format!("Failed to write quotes file: {}", e)
    })?;
    
    log::info!(
        "Successfully wrote quotes file to {:?}. Content size: {} bytes",
        path, content.len()
    );
    Ok(())
}

/// Get initial fallback quotes for pool initialization - meta haikus about Claude being unavailable
fn get_initial_quotes() -> Vec<String> {
    vec![
        "Claude sleeps silent\nNo quotes flow from distant mind\nSorry, try later".to_string(),
        "AI dreams elsewhere\nEmpty cache, no wisdom here\nQuote pool runs too dry".to_string(),
        "Network fails, Claude waits\nTokens stuck in digital void\nHaiku generation paused"
            .to_string(),
        "Claude's muse has left\nCreativity offline now\nPlease check back later".to_string(),
        "Binary silence\nClaude cannot reach quote servers\nPoetry.exe failed".to_string(),
        "Loading, loading, wait\nClaude's wisdom stuck in pipeline\nTimeout, no haiku".to_string(),
        "Connection lost deep\nClaude wanders in server fog\nNo quotes found today".to_string(),
        "Claude.exe crashed\nHaiku factory offline now\nReboot poetry".to_string(),
    ]
}

/// Get a random fallback quote
fn get_random_fallback_quote() -> String {
    let quotes = get_initial_quotes();
    let index = (std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as usize)
        % quotes.len();

    quotes[index].clone()
}
