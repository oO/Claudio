use super::types::*;
use std::fs;
use std::path::Path;
use std::time::SystemTime;
use tauri::command;

/// Lists directory contents with metadata
#[command]
pub async fn list_directory_contents(directory_path: String) -> Result<Vec<FileEntry>, String> {
    log::info!("Listing directory contents for: {}", directory_path);
    
    let path = std::path::Path::new(&directory_path);
    if !path.exists() {
        return Err(format!("Directory does not exist: {}", directory_path));
    }
    
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", directory_path));
    }
    
    let mut entries = Vec::new();
    
    let dir_entries = fs::read_dir(path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    for entry in dir_entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        let metadata = entry.metadata().ok();
        
        let file_entry = FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: path.to_string_lossy().to_string(),
            is_directory: path.is_dir(),
            size: metadata.as_ref().map(|m| m.len()).unwrap_or(0),
            extension: path.extension().and_then(|s| s.to_str()).map(|s| s.to_string()),
        };
        
        entries.push(file_entry);
    }
    
    // Sort: directories first, then by name
    entries.sort_by(|a, b| {
        if a.is_directory && !b.is_directory {
            std::cmp::Ordering::Less
        } else if !a.is_directory && b.is_directory {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });
    
    Ok(entries)
}

/// Searches for files matching a query
#[command]
pub async fn search_files(base_path: String, query: String) -> Result<Vec<FileEntry>, String> {
    log::info!("Searching files in {} for query: {}", base_path, query);
    
    let base = std::path::PathBuf::from(&base_path);
    if !base.exists() {
        return Err(format!("Base path does not exist: {}", base_path));
    }
    
    let mut results = Vec::new();
    search_files_recursive(&base, &query, &mut results)?;
    
    // Limit results to prevent UI overload
    results.truncate(100);
    
    Ok(results)
}

/// Recursively finds all CLAUDE.md files in a project directory
#[command]
pub async fn find_claude_md_files(project_path: String) -> Result<Vec<ClaudeMdFile>, String> {
    log::info!("Finding CLAUDE.md files in project: {}", project_path);
    
    let project_path_buf = std::path::PathBuf::from(&project_path);
    if !project_path_buf.exists() {
        return Err(format!("Project path does not exist: {}", project_path));
    }
    
    let mut files = Vec::new();
    find_claude_md_recursive(&project_path_buf, &project_path_buf, &mut files)?;
    
    Ok(files)
}

/// Reads a text file
#[command]
pub async fn read_text_file(file_path: String) -> Result<String, String> {
    log::info!("Reading text file: {}", file_path);
    
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file {}: {}", file_path, e))
}

/// Saves content to a text file
#[command]
pub async fn write_text_file(file_path: String, content: String) -> Result<String, String> {
    log::info!("Writing text file: {}", file_path);
    
    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write file {}: {}", file_path, e))?;
    
    Ok("File saved successfully".to_string())
}



/// Deletes a file from the filesystem
#[command]
pub async fn delete_file(file_path: String) -> Result<String, String> {
    log::info!("Deleting file: {}", file_path);
    
    let path = Path::new(&file_path);
    
    // Security check: ensure the file exists and is actually a file (not a directory)
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }
    
    if !path.is_file() {
        return Err(format!("Path is not a file: {}", file_path));
    }
    
    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete file {}: {}", file_path, e))?;
    
    Ok("File deleted successfully".to_string())
}

// Helper functions

fn search_files_recursive(
    current_path: &std::path::PathBuf,
    query: &str,
    results: &mut Vec<FileEntry>,
) -> Result<(), String> {
    if results.len() >= 100 {
        return Ok(()); // Stop searching if we have enough results
    }

    let entries = fs::read_dir(current_path)
        .map_err(|e| format!("Failed to read directory {}: {}", current_path.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_lowercase();

        // Skip hidden files and directories
        if file_name.starts_with('.') {
            continue;
        }

        // Check if filename matches query
        if file_name.contains(&query.to_lowercase()) {
            let metadata = entry.metadata().ok();
            let file_entry = FileEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                is_directory: path.is_dir(),
                size: metadata.as_ref().map(|m| m.len()).unwrap_or(0),
                extension: path.extension().and_then(|s| s.to_str()).map(|s| s.to_string()),
            };
            results.push(file_entry);
        }

        // Recurse into subdirectories
        if path.is_dir() && results.len() < 100 {
            let path_buf = std::path::PathBuf::from(path);
            let _ = search_files_recursive(&path_buf, query, results);
        }
    }

    Ok(())
}

fn find_claude_md_recursive(
    current_path: &std::path::PathBuf,
    project_root: &std::path::PathBuf,
    files: &mut Vec<ClaudeMdFile>,
) -> Result<(), String> {
    let entries = fs::read_dir(current_path)
        .map_err(|e| format!("Failed to read directory {}: {}", current_path.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() {
            if let Some(file_name) = path.file_name() {
                if file_name.to_string_lossy().to_lowercase() == "claude.md" {
                    let metadata = fs::metadata(&path)
                        .map_err(|e| format!("Failed to read metadata for {}: {}", path.display(), e))?;

                    let relative_path = path
                        .strip_prefix(project_root)
                        .unwrap_or(&path)
                        .to_string_lossy()
                        .to_string();

                    files.push(ClaudeMdFile {
                        relative_path,
                        absolute_path: path.to_string_lossy().to_string(),
                        size: metadata.len(),
                        modified: metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH).duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default().as_secs(),
                    });
                }
            }
        } else if path.is_dir() {
            // Skip hidden directories and common ignore patterns
            if let Some(dir_name) = path.file_name() {
                let dir_name = dir_name.to_string_lossy();
                if !dir_name.starts_with('.') 
                    && dir_name != "node_modules" 
                    && dir_name != "target"
                    && dir_name != "__pycache__" {
                    let path_buf = std::path::PathBuf::from(path);
                    find_claude_md_recursive(&path_buf, project_root, files)?;
                }
            }
        }
    }

    Ok(())
}