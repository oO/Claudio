use anyhow::Result;
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Instant;
use tauri::AppHandle;

use crate::claude_binary::{create_command_with_env, find_claude_binary};

// File path for quote storage
const QUOTES_FILENAME: &str = "claudio-quotes.json";
const MAX_QUOTE_POOL_SIZE: usize = 20;

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
    // Try to pop a quote from the pool
    match pop_quote_from_pool(&app).await {
        Ok(quote) => {
            info!("Popped quote from pool: \"{}\"", quote.lines().next().unwrap_or(""));
            
            // Check pool size before triggering background generation
            let app_clone = app.clone();
            tauri::async_runtime::spawn(async move {
                match should_generate_more_quotes(&app_clone).await {
                    Ok(should_generate) => {
                        if should_generate {
                            info!("Pool size below threshold, starting background quote generation");
                            if let Err(e) = generate_and_store_quote(app_clone).await {
                                error!("Background quote generation failed: {}", e);
                            } else {
                                info!("Background quote generation completed successfully");
                            }
                        } else {
                            info!("Pool has sufficient quotes (>={}), skipping background generation", MAX_QUOTE_POOL_SIZE);
                        }
                    }
                    Err(e) => {
                        warn!("Failed to check pool size, skipping background generation: {}", e);
                    }
                }
            });
            
            Ok(QuoteResponse {
                quote,
                source: "pool".to_string(),
            })
        }
        Err(_) => {
            // Pool is empty, generate one immediately and initialize pool
            warn!("Quote pool empty, generating immediately");
            generate_quote_immediately(&app).await
        }
    }
}

/// Initialize the quote pool with fallback quotes
#[tauri::command]
pub async fn initialize_quote_pool(app: AppHandle) -> Result<(), String> {
    let quotes_path = get_quotes_path(&app)?;
    
    // Load existing quotes data or create new
    let mut quote_data = load_quotes_data(&quotes_path).unwrap_or_else(|_| {
        QuoteData {
            quotes: get_initial_quotes(),
            instructions: "generate a programming quote in haiku form. IMPORTANT: only return the quote".to_string(),
        }
    });
    
    // Initialize quotes array if it's empty (but preserve existing instructions)
    if quote_data.quotes.is_empty() {
        quote_data.quotes = get_initial_quotes();
        // Only set default instructions if they're empty/missing
        if quote_data.instructions.is_empty() {
            quote_data.instructions = "generate a programming quote in haiku form. IMPORTANT: only return the quote".to_string();
        }
        save_quotes_data(&quotes_path, &quote_data)?;
        info!("Initialized quote pool with {} fallback quotes, instructions: {:?}", quote_data.quotes.len(), quote_data.instructions);
    }
    
    Ok(())
}

/// Pop a random quote from the pool
async fn pop_quote_from_pool(app: &AppHandle) -> Result<String, String> {
    let quotes_path = get_quotes_path(app)?;
    info!("Quote burning: Loading quotes from {:?}", quotes_path);
    
    let mut quote_data = match load_quotes_data(&quotes_path) {
        Ok(data) => {
            info!("Quote burning: Successfully loaded quotes data");
            data
        },
        Err(e) => {
            error!("Quote burning: Failed to load quotes data: {}", e);
            return Err(e);
        }
    };
    
    let initial_count = quote_data.quotes.len();
    info!("Quote burning: Found {} quotes in pool", initial_count);
    
    if quote_data.quotes.is_empty() {
        return Err("Quote pool is empty".to_string());
    }
    
    // Pop random quote
    let random_index = (std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as usize) % quote_data.quotes.len();
    
    info!("Quote burning: Removing quote at index {} of {}", random_index, quote_data.quotes.len());
    info!("Quote burning: Quote being removed: {:?}", &quote_data.quotes[random_index]);
    
    let quote = quote_data.quotes.remove(random_index);
    
    let final_count = quote_data.quotes.len();
    info!("Quote burning: After removal, {} quotes remain (was {})", final_count, initial_count);
    
    // Save updated quotes data
    match save_quotes_data(&quotes_path, &quote_data) {
        Ok(()) => {
            info!("Quote burning: Successfully saved quotes file with {} quotes", final_count);
        }
        Err(e) => {
            error!("Quote burning: Failed to save quotes file: {}", e);
            return Err(format!("Failed to save updated quotes: {}", e));
        }
    }
    
    Ok(quote)
}

/// Generate a quote in the background and add to pool
async fn generate_and_store_quote(app: AppHandle) -> Result<(), String> {
    info!("Starting background quote generation");
    let start_time = Instant::now();
    
    // Find Claude binary
    let claude_path = match find_claude_binary(&app) {
        Ok(path) => path,
        Err(e) => {
            warn!("Could not find Claude binary for background generation: {}", e);
            return Ok(()); // Fail silently for background generation
        }
    };

    // Get instructions from quotes file
    let instructions = match get_quotes_path(&app) {
        Ok(quotes_path) => {
            info!("Background generation: Loading instructions from {:?}", quotes_path);
            match load_quotes_data(&quotes_path) {
                Ok(data) => {
                    info!("Background generation: Loaded instructions: {:?}", data.instructions);
                    data.instructions
                }
                Err(e) => {
                    warn!("Background generation: Failed to load quotes file, using default instructions: {}", e);
                    "generate a programming quote in haiku form. IMPORTANT: only return the quote".to_string()
                }
            }
        }
        Err(e) => {
            warn!("Background generation: Failed to get quotes path, using default instructions: {}", e);
            "generate a programming quote in haiku form. IMPORTANT: only return the quote".to_string()
        },
    };

    // Generate quote
    let mut cmd = create_command_with_env(&claude_path);
    cmd.arg("-p")
       .arg("--model")
       .arg("haiku")
       .arg(&instructions);
    cmd.stdin(Stdio::null())
       .stdout(Stdio::piped())
       .stderr(Stdio::piped());

    info!("Background generation: Executing command: {:?} with args: [\"-p\", \"--model\", \"haiku\", {:?}]", claude_path, &instructions);

    match cmd.output() {
        Ok(output) => {
            let elapsed = start_time.elapsed().as_millis() as u64;
            let stdout_str = String::from_utf8_lossy(&output.stdout);
            let stderr_str = String::from_utf8_lossy(&output.stderr);
            
            info!("Background generation: Command completed in {}ms", elapsed);
            info!("Background generation: Exit status: {}", output.status);
            info!("Background generation: Stdout: {:?}", stdout_str);
            if !stderr_str.is_empty() {
                info!("Background generation: Stderr: {:?}", stderr_str);
            }
            
            if output.status.success() {
                let haiku = stdout_str.trim().to_string();
                info!("Background generation: Raw quote result: {:?}", haiku);
                info!("Background generation: Quote is empty: {}", haiku.is_empty());
                info!("Background generation: Quote line count: {}", haiku.lines().count());
                
                if !haiku.is_empty() && haiku.lines().count() >= 3 {
                    info!("Background generation: Quote meets criteria, adding to pool");
                    // Add to pool
                    if let Err(e) = add_quote_to_pool(&app, haiku.clone()).await {
                        error!("Failed to add generated quote to pool: {}", e);
                    } else {
                        info!("Generated and stored new quote in {}ms: \"{}\"", elapsed, haiku.lines().next().unwrap_or(""));
                    }
                } else {
                    warn!("Background generation: Quote doesn't meet criteria (empty: {}, lines: {})", haiku.is_empty(), haiku.lines().count());
                }
            }
        }
        Err(e) => {
            warn!("Background quote generation command failed: {}", e);
        }
    }
    
    Ok(())
}

/// Generate a quote immediately when pool is empty
async fn generate_quote_immediately(app: &AppHandle) -> Result<QuoteResponse, String> {
    // Find Claude binary
    let claude_path = match find_claude_binary(app) {
        Ok(path) => path,
        Err(e) => {
            warn!("Could not find Claude binary: {}", e);
            let fallback = get_random_fallback_quote();
            // Add fallback to pool for future use
            let _ = add_quote_to_pool(app, fallback.clone()).await;
            return Ok(QuoteResponse {
                quote: fallback,
                source: "fallback".to_string(),
            });
        }
    };

    // Get instructions from quotes file
    let instructions = match get_quotes_path(app) {
        Ok(quotes_path) => {
            info!("Immediate generation: Loading instructions from {:?}", quotes_path);
            match load_quotes_data(&quotes_path) {
                Ok(data) => {
                    info!("Immediate generation: Loaded instructions: {:?}", data.instructions);
                    data.instructions
                }
                Err(e) => {
                    warn!("Immediate generation: Failed to load quotes file, using default instructions: {}", e);
                    "generate a programming quote in haiku form. IMPORTANT: only return the quote".to_string()
                }
            }
        }
        Err(e) => {
            warn!("Immediate generation: Failed to get quotes path, using default instructions: {}", e);
            "generate a programming quote in haiku form. IMPORTANT: only return the quote".to_string()
        },
    };

    // Generate quote
    let mut cmd = create_command_with_env(&claude_path);
    cmd.arg("-p")
       .arg("--model")
       .arg("haiku")
       .arg(&instructions);
    cmd.stdin(Stdio::null())
       .stdout(Stdio::piped())
       .stderr(Stdio::piped());

    info!("Immediate generation: Executing command: {:?} with args: [\"-p\", \"--model\", \"haiku\", {:?}]", claude_path, &instructions);

    match cmd.output() {
        Ok(output) => {
            let stdout_str = String::from_utf8_lossy(&output.stdout);
            let stderr_str = String::from_utf8_lossy(&output.stderr);
            
            info!("Immediate generation: Command completed");
            info!("Immediate generation: Exit status: {}", output.status);
            info!("Immediate generation: Stdout: {:?}", stdout_str);
            if !stderr_str.is_empty() {
                info!("Immediate generation: Stderr: {:?}", stderr_str);
            }
            
            if output.status.success() {
                let quote = stdout_str.trim().to_string();
                if !quote.is_empty() && quote.lines().count() >= 3 {
                    info!("Generated immediate quote successfully");
                    // Add additional quotes to pool in background (respecting max pool size)
                    let app_clone = app.clone();
                    let quote_clone = quote.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = add_quote_to_pool(&app_clone, quote_clone).await;
                        // Generate a few more for the pool, but check size first
                        for i in 0..3 {
                            match should_generate_more_quotes(&app_clone).await {
                                Ok(should_generate) => {
                                    if should_generate {
                                        let _ = generate_and_store_quote(app_clone.clone()).await;
                                    } else {
                                        info!("Immediate generation: Pool full, stopping bulk generation at iteration {}", i);
                                        break;
                                    }
                                }
                                Err(_) => {
                                    // If can't check, be conservative and stop
                                    break;
                                }
                            }
                        }
                    });
                    
                    return Ok(QuoteResponse {
                        quote,
                        source: "claude".to_string(),
                    });
                }
            }
            
            // Fallback if generation failed
            let fallback = get_random_fallback_quote();
            let _ = add_quote_to_pool(app, fallback.clone()).await;
            Ok(QuoteResponse {
                quote: fallback,
                source: "fallback".to_string(),
            })
        }
        Err(e) => {
            error!("Failed to execute Claude command: {}", e);
            let fallback = get_random_fallback_quote();
            let _ = add_quote_to_pool(app, fallback.clone()).await;
            Ok(QuoteResponse {
                quote: fallback,
                source: "fallback".to_string(),
            })
        }
    }
}

/// Check if we should generate more quotes based on current pool size
async fn should_generate_more_quotes(app: &AppHandle) -> Result<bool, String> {
    let quotes_path = get_quotes_path(app)?;
    match load_quotes_data(&quotes_path) {
        Ok(quote_data) => {
            let current_size = quote_data.quotes.len();
            info!("Current pool size: {}, max threshold: {}", current_size, MAX_QUOTE_POOL_SIZE);
            Ok(current_size < MAX_QUOTE_POOL_SIZE)
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
        info!("Creating new quotes file with default instructions");
        QuoteData {
            quotes: Vec::new(),
            instructions: "generate a programming quote in haiku form. IMPORTANT: only return the quote".to_string(),
        }
    });
    
    quote_data.quotes.push(quote);
    info!("Added quote to pool, now has {} quotes with instructions: {:?}", quote_data.quotes.len(), quote_data.instructions);
    save_quotes_data(&quotes_path, &quote_data)?;
    Ok(())
}

/// Get the base Claude directory path
fn get_claude_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or("Failed to get home directory")?;
    Ok(home_dir.join(".claude"))
}

/// Get quotes file path
fn get_quotes_path(_app: &AppHandle) -> Result<PathBuf, String> {
    Ok(get_claude_dir()?.join(QUOTES_FILENAME))
}

/// Load quotes data from file
fn load_quotes_data(path: &PathBuf) -> Result<QuoteData, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read quotes file: {}", e))?;
    
    serde_json::from_str::<QuoteData>(&content)
        .map_err(|e| format!("Failed to parse quotes JSON: {}", e))
}

/// Save quotes data to file
fn save_quotes_data(path: &PathBuf, quote_data: &QuoteData) -> Result<(), String> {
    info!("save_quotes_data: Writing to {:?}", path);
    
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        info!("save_quotes_data: Creating directory {:?}", parent);
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create quotes directory: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(quote_data)
        .map_err(|e| format!("Failed to serialize quotes data: {}", e))?;
    
    info!("save_quotes_data: Serialized JSON contains {} quotes", quote_data.quotes.len());
    info!("save_quotes_data: Writing {} bytes to file", content.len());
    
    std::fs::write(path, content)
        .map_err(|e| format!("Failed to write quotes file: {}", e))?;
    
    info!("save_quotes_data: File write completed successfully");
    Ok(())
}

/// Get initial fallback quotes for pool initialization - meta haikus about Claude being unavailable
fn get_initial_quotes() -> Vec<String> {
    vec![
        "Claude sleeps silent\nNo quotes flow from distant mind\nSorry, try later".to_string(),
        "AI dreams elsewhere\nEmpty cache, no wisdom here\nQuote pool runs too dry".to_string(),
        "Network fails, Claude waits\nTokens stuck in digital void\nHaiku generation paused".to_string(),
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
        .as_nanos() as usize) % quotes.len();
    
    quotes[index].clone()
}