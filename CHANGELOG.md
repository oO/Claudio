# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2025-01-04

### Fixed
- Window title now displays version dynamically using Tauri API
- TypeScript build errors resolved (duplicate getSetting, unused parameters)

### Added
- Tauri capability configuration for window title permissions

## [0.2.1] - 2025-01-04

### Fixed
- CLAUDE.md file editing error caused by interface mismatch (pre-existing bug in original Claudia)
- Settings save errors by completing migration from SQLite to file-based storage
- Claude binary path functions now use file-based storage instead of SQLite
- Hidden directories (starting with .) no longer appear in projects list

### Changed
- Consolidated all Claudio-specific settings into single claudio-settings.json file
- Updated terminology from "CC Projects" to "Projects" throughout UI
- Removed problematic Storage tab from Settings UI

## [0.2.0] - 2025-01-04

### Added
- Native Claude Code agent support with file-based storage in ~/.claude/agents/
- Comprehensive agent editor with color picker, tool selection, and model choice
- Dynamic version display in window title
- Personal/Project agent terminology matching Claude Code
- Smart save button that activates only when changes are detected
- Auto-expanding description textarea
- Name conflict validation for agent creation/editing

### Changed
- Replaced SQLite-based custom agents with Claude Code native agents
- Agent storage now uses YAML frontmatter format (.md files)
- Agent management UI redesigned to match Claude Code interface
- Updated all terminology from "Global" to "Personal" agents

### Removed
- SQLite database dependency for agent storage
- Analytics consent popup (temporarily disabled)
- Default task field (not supported by Claude Code native agents)

## [0.1.0] - Initial Baseline from Claudia (https://github.com/getAsterisk/claudia)

### Added
- Initial Claudio project setup
- Basic agent management interface
- Tauri + React + TypeScript foundation
- AGPL-3.0 license
