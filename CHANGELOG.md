# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.10] - 2025-08-11

### Added
- Comprehensive session deletion system with age-based filtering for bulk cleanup
- Dynamic session age range detection replacing hardcoded deletion presets
- Real-time preview of sessions to be deleted before confirmation
- Granular project deletion options (agents, memories, settings) with selective cleanup
- New "Delete Sessions" feature for targeted cleanup of old sessions based on actual project data
- Session dependency tracking for todos and timelines during deletion
- Enhanced project settings detection for more accurate deletion feedback

### Changed
- Project deletion modal now dynamically detects available deletion categories
- Delete Project Data dialog logic improved for better detection of deletable content
- Session deletion UI adapts to actual project session age ranges instead of fixed presets
- Consistent semantic color usage for hover states throughout deletion interfaces
- Improved deletion feedback with detailed counts for all affected file types

### Fixed
- Project deletion now properly handles granular settings deletion (only settings files, not entire .claude directory)
- Session deletion dependencies correctly clean up associated todos and timeline files
- Enhanced error handling for deletion operations with proper logging
- Fixed modal detection logic for project deletion dialogs

## [0.3.8] - 2025-08-10

### Added
- Unified FileWidget component merging ReadWidget and WriteWidget functionality
- Consistent expand/collapse patterns across all tool widgets (BashWidget, EditWidget, WriteWidget)
- Loading spinners for expand functionality on large files
- Enhanced theme compatibility with CSS custom properties throughout all widgets

### Changed
- **BREAKING**: Removed ReadWidget and WriteWidget in favor of unified FileWidget approach
- All file operations now use identical syntax highlighting and line numbering
- Standardized widget layouts following GlobWidget reference pattern
- Improved visual consistency across all tool result displays
- Enhanced EditWidget with proper expand/collapse functionality for large diffs

### Fixed
- Theme-safe color usage across all widgets (replaced hardcoded colors with semantic classes)
- Proper diff visualization with distinct colors for additions/deletions
- Grep output parsing to handle complex format with context lines and separators
- Command styling in BashWidget using appropriate semantic colors (text-info for commands)

### Technical
- Reduced bundle size by eliminating duplicate file handling code
- Single maintenance point for file-related widget functionality
- Improved code reuse with unified language mapping and syntax themes

## [0.3.7] - 2025-08-10

### Added
- Debug mode system with persistent localStorage toggle for component identification
- Debug mode toggle in Settings → Advanced section for easy UI access
- DebugLabel atomic component with dedicated CSS class styling
- Debug labels for all major session and tool widgets (AssistantMessage, UserMessage, GrepWidget, etc.)

### Changed
- Renamed TaskWidget → SubAgentTaskWidget for clearer distinction from task lists
- Replaced TodoWidget with TasksWidget using clean bullet list format instead of table rows
- Improved markdown spacing in message cards with tighter prose styling
- Optimized collapsible widget performance by limiting rendered content vs CSS overflow

### Fixed
- Theme compatibility issues across multiple tool widgets (hardcoded colors → theme-aware)
- Syntax highlighting theme detection for better contrast in both light/dark modes
- Icon weight consistency between user (CircleUser) and assistant (Bot) message icons

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
