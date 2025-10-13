use anyhow::Result;
use chrono;
use dirs;
use log::warn;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Represents a Claude Code Output Style stored as a file
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OutputStyle {
    pub name: String,
    pub description: Option<String>,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub file_path: Option<String>, // Absolute file path
}

/// Output style metadata from YAML frontmatter
#[derive(Debug, Serialize, Deserialize, Clone)]
struct OutputStyleFrontmatter {
    pub name: String,
    pub description: Option<String>,
}

/// Output style parser for markdown-based output style definitions
pub struct OutputStyleParser;

impl OutputStyleParser {
    /// Preprocess YAML content to handle unquoted special characters
    fn preprocess_yaml(yaml_content: &str) -> String {
        let lines: Vec<&str> = yaml_content.lines().collect();
        let mut fixed_lines = Vec::new();

        for line in lines {
            let trimmed = line.trim();

            // Handle description field with unquoted special characters
            if trimmed.starts_with("description:") {
                let desc_start = line.find("description:").unwrap() + 12;
                let desc_value = line[desc_start..].trim();

                // Check if already quoted
                if !desc_value.starts_with('"') && !desc_value.starts_with('\'') && !desc_value.is_empty() {
                    // Check for special characters that need quoting
                    if desc_value.contains('<') || desc_value.contains('>') ||
                       desc_value.contains(':') || desc_value.contains('{') || desc_value.contains('}') {
                        let indent = line.len() - line.trim_start().len();
                        let fixed_line = format!("{}description: \"{}\"", " ".repeat(indent), desc_value);
                        fixed_lines.push(fixed_line);
                        continue;
                    }
                }
            }

            fixed_lines.push(line.to_string());
        }

        fixed_lines.join("\n")
    }

    /// Parse an output style file and extract metadata
    pub fn parse_file(content: &str) -> Result<OutputStyle, String> {
        // Split content into frontmatter and style content
        let parts: Vec<&str> = content.splitn(3, "---").collect();

        if parts.len() < 3 {
            return Err("Invalid output style file format: missing YAML frontmatter".to_string());
        }

        // Preprocess and parse YAML frontmatter
        let yaml_content = parts[1].trim();
        let preprocessed_yaml = Self::preprocess_yaml(yaml_content);
        let frontmatter: OutputStyleFrontmatter = serde_yaml::from_str(&preprocessed_yaml)
            .map_err(|e| format!("Failed to parse YAML frontmatter: {}", e))?;

        // Extract style content (everything after the second ---)
        let style_content = parts[2].trim().to_string();

        if style_content.is_empty() {
            return Err("Output style file must contain content after the frontmatter".to_string());
        }

        // Get current timestamp
        let now = chrono::Utc::now().to_rfc3339();

        Ok(OutputStyle {
            name: frontmatter.name,
            description: frontmatter.description,
            content: style_content,
            created_at: now.clone(),
            updated_at: now,
            file_path: None, // Will be set by list_output_styles when reading from disk
        })
    }

    /// Generate markdown content from OutputStyle
    pub fn generate_markdown(style: &OutputStyle) -> String {
        let mut yaml_content = String::new();
        yaml_content.push_str("---\n");
        yaml_content.push_str(&format!("name: {}\n", style.name));

        if let Some(ref desc) = style.description {
            yaml_content.push_str(&format!("description: {}\n", desc));
        }

        yaml_content.push_str("---\n\n");

        // Add style content
        yaml_content.push_str(&style.content);

        yaml_content
    }

    /// Get the .claude/output-styles directory path
    fn get_output_styles_directory(project_path: Option<&str>) -> Result<PathBuf, String> {
        let styles_dir = if let Some(project_path) = project_path {
            // Use project-specific output-styles directory
            let project_dir = PathBuf::from(project_path);
            let styles_dir = project_dir.join(".claude").join("output-styles");
            styles_dir
        } else {
            // Use global output-styles directory
            let home_dir = dirs::home_dir()
                .ok_or_else(|| "Failed to get home directory".to_string())?;
            let styles_dir = home_dir.join(".claude").join("output-styles");
            styles_dir
        };

        // Create directory if it doesn't exist
        if !styles_dir.exists() {
            fs::create_dir_all(&styles_dir)
                .map_err(|e| format!("Failed to create output-styles directory: {}", e))?;
        }

        Ok(styles_dir)
    }

    /// Convert style name to safe filename (enforces kebab-case)
    fn name_to_filename(name: &str) -> String {
        // The name should already be in kebab-case format from frontend validation
        // Just ensure it's clean and add .md extension
        let cleaned = name.to_lowercase()
            .replace(' ', "-")
            .replace('_', "-")
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
            .collect::<String>();

        format!("{}.md", cleaned)
    }

    /// Validate that a name is in proper kebab-case format
    fn is_valid_kebab_case(name: &str) -> bool {
        // Must be lowercase alphanumeric with dashes, no leading/trailing dashes
        let re = regex::Regex::new(r"^[a-z0-9]+(-[a-z0-9]+)*$").unwrap();
        re.is_match(name)
    }
}

/// List all output styles from .claude/output-styles/*.md files
#[tauri::command]
pub async fn list_output_styles(project_path: String) -> Result<Vec<OutputStyle>, String> {
    // Convert empty string to None for get_output_styles_directory
    let project_path_opt = if project_path.is_empty() { None } else { Some(project_path.as_str()) };
    let styles_dir = OutputStyleParser::get_output_styles_directory(project_path_opt)?;

    let mut styles = Vec::new();

    if styles_dir.exists() {
        let entries = fs::read_dir(&styles_dir)
            .map_err(|e| format!("Failed to read output-styles directory: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                match fs::read_to_string(&path) {
                    Ok(content) => {
                        match OutputStyleParser::parse_file(&content) {
                            Ok(mut style) => {
                                // Set the absolute file path
                                style.file_path = path.to_str().map(|s| s.to_string());

                                // Get file metadata for timestamps
                                if let Ok(metadata) = fs::metadata(&path) {
                                    if let Ok(created) = metadata.created() {
                                        let created_dt = chrono::DateTime::<chrono::Utc>::from(created);
                                        style.created_at = created_dt.to_rfc3339();
                                    }
                                    if let Ok(modified) = metadata.modified() {
                                        let modified_dt = chrono::DateTime::<chrono::Utc>::from(modified);
                                        style.updated_at = modified_dt.to_rfc3339();
                                    }
                                }
                                styles.push(style);
                            }
                            Err(e) => {
                                warn!("Failed to parse output style file {}: {}", path.display(), e);
                            }
                        }
                    }
                    Err(e) => {
                        warn!("Failed to read output style file {}: {}", path.display(), e);
                    }
                }
            }
        }
    }

    // Sort by name
    styles.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(styles)
}

/// Create a new output style file
#[tauri::command]
pub async fn create_output_style(
    project_path: Option<String>,
    name: String,
    description: Option<String>,
    content: String,
) -> Result<OutputStyle, String> {
    // Validate kebab-case format
    if !OutputStyleParser::is_valid_kebab_case(&name) {
        return Err("Style name must be in kebab-case format (lowercase with dashes, e.g., my-custom-style)".to_string());
    }

    let styles_dir = OutputStyleParser::get_output_styles_directory(project_path.as_deref())?;
    let filename = OutputStyleParser::name_to_filename(&name);
    let file_path = styles_dir.join(&filename);

    // Check if output style already exists
    if file_path.exists() {
        return Err(format!("Output style '{}' already exists", name));
    }

    let now = chrono::Utc::now().to_rfc3339();

    let style = OutputStyle {
        name: name.clone(),
        description,
        content,
        created_at: now.clone(),
        updated_at: now,
        file_path: Some(file_path.to_string_lossy().to_string()),
    };

    let markdown_content = OutputStyleParser::generate_markdown(&style);

    fs::write(&file_path, markdown_content)
        .map_err(|e| format!("Failed to write output style file: {}", e))?;

    Ok(style)
}

/// Update an existing output style file
#[tauri::command]
pub async fn update_output_style(
    project_path: Option<String>,
    name: String,
    description: Option<String>,
    content: String,
) -> Result<OutputStyle, String> {
    // Validate kebab-case format
    if !OutputStyleParser::is_valid_kebab_case(&name) {
        return Err("Style name must be in kebab-case format (lowercase with dashes, e.g., my-custom-style)".to_string());
    }

    let styles_dir = OutputStyleParser::get_output_styles_directory(project_path.as_deref())?;
    let filename = OutputStyleParser::name_to_filename(&name);
    let file_path = styles_dir.join(&filename);

    if !file_path.exists() {
        return Err(format!("Output style '{}' not found", name));
    }

    // Get original creation time
    let created_at = if let Ok(content) = fs::read_to_string(&file_path) {
        if let Ok(original_style) = OutputStyleParser::parse_file(&content) {
            original_style.created_at
        } else {
            chrono::Utc::now().to_rfc3339()
        }
    } else {
        chrono::Utc::now().to_rfc3339()
    };

    let style = OutputStyle {
        name: name.clone(),
        description,
        content,
        created_at,
        updated_at: chrono::Utc::now().to_rfc3339(),
        file_path: Some(file_path.to_string_lossy().to_string()),
    };

    let markdown_content = OutputStyleParser::generate_markdown(&style);

    fs::write(&file_path, markdown_content)
        .map_err(|e| format!("Failed to update output style file: {}", e))?;

    Ok(style)
}

/// Delete an output style file
#[tauri::command]
pub async fn delete_output_style(project_path: Option<String>, name: String) -> Result<(), String> {
    let styles_dir = OutputStyleParser::get_output_styles_directory(project_path.as_deref())?;
    let filename = OutputStyleParser::name_to_filename(&name);
    let file_path = styles_dir.join(&filename);

    if !file_path.exists() {
        return Err(format!("Output style '{}' not found", name));
    }

    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete output style file: {}", e))?;

    Ok(())
}

/// Move an output style from project level to user level
#[tauri::command]
pub async fn move_output_style_to_user_level(style_name: String, project_path: String, overwrite: bool) -> Result<(), String> {
    // Get the project-level output style file path
    let project_styles_dir = OutputStyleParser::get_output_styles_directory(Some(&project_path))?;
    let filename = OutputStyleParser::name_to_filename(&style_name);
    let source_path = project_styles_dir.join(&filename);

    if !source_path.exists() {
        return Err(format!("Output style '{}' not found in project", style_name));
    }

    // Get the user-level output-styles directory
    let user_styles_dir = OutputStyleParser::get_output_styles_directory(None)?;
    let dest_path = user_styles_dir.join(&filename);

    // Check if output style already exists at user level
    if dest_path.exists() && !overwrite {
        return Err(format!("STYLE_EXISTS:Output style '{}' already exists at user level", style_name));
    }

    // Copy the file to user level (will overwrite if exists and overwrite=true)
    fs::copy(&source_path, &dest_path)
        .map_err(|e| format!("Failed to copy output style file: {}", e))?;

    // Delete the project-level file
    fs::remove_file(&source_path)
        .map_err(|e| format!("Failed to remove project-level output style file: {}", e))?;

    log::info!("Moved output style '{}' from project to user level{}", style_name, if overwrite { " (overwrote existing)" } else { "" });
    Ok(())
}

/// Get a single output style by name
#[tauri::command]
pub async fn get_output_style(project_path: Option<String>, name: String) -> Result<OutputStyle, String> {
    let styles_dir = OutputStyleParser::get_output_styles_directory(project_path.as_deref())?;
    let filename = OutputStyleParser::name_to_filename(&name);
    let file_path = styles_dir.join(&filename);

    if !file_path.exists() {
        return Err(format!("Output style '{}' not found", name));
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read output style file: {}", e))?;

    let mut style = OutputStyleParser::parse_file(&content)?;

    // Get file metadata for timestamps
    if let Ok(metadata) = fs::metadata(&file_path) {
        if let Ok(created) = metadata.created() {
            let created_dt = chrono::DateTime::<chrono::Utc>::from(created);
            style.created_at = created_dt.to_rfc3339();
        }
        if let Ok(modified) = metadata.modified() {
            let modified_dt = chrono::DateTime::<chrono::Utc>::from(modified);
            style.updated_at = modified_dt.to_rfc3339();
        }
    }

    Ok(style)
}

/// Export an output style to a file
#[tauri::command]
pub async fn export_output_style_to_file(
    project_path: Option<String>,
    name: String,
    file_path: String,
) -> Result<(), String> {
    // Get the source output style file path
    let styles_dir = OutputStyleParser::get_output_styles_directory(project_path.as_deref())?;
    let filename = OutputStyleParser::name_to_filename(&name);
    let source_path = styles_dir.join(&filename);

    if !source_path.exists() {
        return Err(format!("Output style '{}' not found", name));
    }

    // Copy the .md file directly
    fs::copy(&source_path, &file_path)
        .map_err(|e| format!("Failed to copy output style file: {}", e))?;

    Ok(())
}
