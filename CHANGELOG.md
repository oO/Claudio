# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.6] - 2025-08-09

### Fixed
- Agent card icon background transparency - replaced modern CSS syntax with browser-compatible rgba() format
- Increased agent background opacity from 0.1 to 0.2 for better visibility of colored circular backgrounds

## [0.3.5] - 2025-08-08

### Fixed
- Simplified theme system by removing complex luminosity calculations
- Fixed Tailwind v4 JIT compilation issues with comprehensive manual utility overrides
- Resolved transparent card backgrounds - now properly display RGBA optical mixing
- Fixed select menu hardcoded colors to use dynamic theme-aware backgrounds
- Added proper hover states to select menu items for better UX
- Removed bleeding-edge CSS syntax for better browser compatibility

### Changed
- Enhanced theme definitions with simple `isDark` boolean flags
- Preserved RGBA optical mixing design for progressive card stacking
- Improved theme switching reliability across all preset themes
- Reduced CSS complexity from 946 to 927 lines

## [0.3.4] - 2025-08-07

### Added
- Comprehensive project deletion dialog with granular options
- Conditional display of deletion categories based on project contents
- Real-time count display (sessions, todos, agents, memories)
- Detailed deletion feedback with size and file count reporting

### Fixed
- ActionButton ref forwarding for proper Radix UI dropdown integration
- Project deletion dropdown menu functionality

### Removed
- Non-functional "Hooks" menu item

## [0.3.3] - 2025-08-06

### Changed
- Split large claude.rs (2500+ lines) into 8 focused modules for better maintainability
- Fix project sorting to use last activity time instead of creation time
- Clean up project card UI and move management actions to detail view
- Remove agent count from project list for improved performance

## [0.3.2] - 2025-01-06

### Added
- Animated "Hello, I'm Claudio" welcome message on app startup
- Startup delay before opening default tab

### Removed
- About button from TopBar (legacy Claudia feature)
- Analytics tab from Settings (legacy Claudia feature)

## [0.3.1] - 2025-01-06

### Added
- Comprehensive Atomic Design system with 50+ components (19 atoms, 15 molecules, 16 organisms)
- Complete component documentation system with guides and patterns
- Individual widget components (24 total) replacing monolithic AllToolWidgets.tsx
- Custom hooks for complex state management (useSessionState, useAgentExecution, usePromptInput)
- Domain-specific component organization (agents/, sessions/, settings/, etc.)
- Atomic Design documentation with creation guides and best practices
- Component composition patterns and performance optimizations
- Tree-shaking optimized exports for minimal bundle size

### Changed
- Project tab behavior: topbar Projects button now creates multiple tabs (not singleton)
- Refactored all large components (700-1713 lines) using Atomic Design principles
- Harmonized UI patterns across all components (buttons, menus, actions)
- Migrated components to organized folder structure by domain
- Applied single responsibility principle throughout component architecture
- Improved component reusability through atomic composition

### Fixed
- Circular dependency warnings in build process
- Import path issues after component refactoring
- TypeScript compilation errors from component moves

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
