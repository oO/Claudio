# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.39] - 2025-08-29

### Removed
- Major codebase cleanup removing 5,300+ lines of dead/legacy code
- Deleted 34+ unused files including legacy CCAgents system components
- Removed 5 unused hooks (recreated 2 essential ones as minimal stubs)
- Eliminated deprecated components folder with 5 obsolete files
- Removed 2 legacy backup files and test/demo components
- Cleaned up 12+ CCAgents system files made obsolete by Claude Code native agents

### Fixed
- Resolved circular dependency warnings in build system
- Cleaned up import statements to use direct file imports where needed
- Streamlined index.ts export files across multiple directories

### Changed
- Significantly reduced bundle size through dead code elimination
- Improved build performance with cleaner dependency graph
- Preserved all native agent functionality while removing legacy systems

## [0.3.38] - 2025-08-29

### Added
- Advanced streaming session architecture with real-time message handling
- Session orchestrator with enhanced state management and cleanup logic
- SessionHandleView component with improved UI/UX for session interactions
- Session handle API with comprehensive streaming and resume capabilities
- Claude session tracking module for native integration
- Hook installer system for Claude Code integration
- Enhanced Claudio storage with session state persistence
- Session-aware command widgets with improved execution feedback
- Tab state management improvements for better session navigation

### Enhanced
- React Virtuoso implementation optimizations for chat message display
- Session message streaming with UUID-based deduplication
- Backend session watcher with improved file monitoring
- Frontend session management with better error handling
- Command widget UX with enhanced tool execution feedback
- Claude Code integration with native session hooks

## [0.3.35] - 2025-08-28

### Fixed
- Session message display with React Virtuoso implementation
- Chat-style bottom-pinned scrolling behavior for session viewing
- Visual gap issue between first and last messages in session timeline
- Native session display UX with proper virtualization for large conversations

## [0.3.33] - 2025-08-26

### Added
- Automatic session cleanup system with UUID-based detection
- Backend-driven session file management with intelligent watcher architecture
- Session history preservation across multi-turn conversations
- File system monitoring for automatic cleanup when old UUIDs detected
- Complete frontend/backend separation of concerns for session management
- Race condition elimination between frontend and backend UUID handling
- Clean disk usage while preserving full conversation timeline records

## [0.3.32] - 2025-08-25

### Improved
- Fixed resume flickering with UUID-based session detection  
- Added immediate UI feedback for prompt submission
- Implemented status messages with action verbs and haikus
- Simplified prompt components (removed FloatingPromptInput)
- Fixed auto-scroll behavior for status messages
- Cleaned up excessive debug logging for better performance

## [0.3.28] - 2025-08-17

### Performance
- Added window state debouncing with 500ms delay to reduce unnecessary file I/O
- Optimized window state saving during move/resize operations
- Removed redundant periodic saves from frontend hook

## [0.3.24] - 2025-08-16

### Fixed
- MessageFooter clipboard functionality now works correctly
- Added SessionProvider context to SessionMessages component  
- Eliminated prop drilling for session data through MessageRouter and SummaryWidget
- Components now use useSessionContext() instead of receiving session props

## [0.3.23] - 2025-08-15

### Refactored
- Comprehensive message component architecture overhaul
- Implemented template-based architecture for Messages and ToolWidgets
- Refactored all message types to use new MessageTemplate.tsx
- Standardized message and tool widget components for better maintainability
- Enhanced SessionMessages, SessionHeader, and ClaudeCodeSession components
- Updated context providers and hooks for improved type safety

### Removed
- Obsolete components: LSResultWidget, TodoReadWidget, MessageRoleIcon, MessageHeader
- Cleaned up unnecessary imports and type declarations

### Added
- New SummaryMessage component
- ToolWidgetTemplate.tsx for consistent tool widget design
- Enhanced type safety and component organization

### Technical
- Improved frontend component architecture following Atomic Design principles
- Updated file exports and component composition
- Removed circular dependencies and improved import structure

## [0.3.21] - 2025-08-13

### Added
- Unified accent color theme with orange highlights for enhanced visual hierarchy and brand consistency
- Dynamic session list height calculation that adapts to actual viewport space
- Memory optimization with increased Node.js heap allocation from 8GB to 16GB for large projects
- Project-specific loading states with enhanced messaging and accent styling
- Accent button component with elegant hover inversion styling

### Changed
- Applied consistent accent color (#FF9500) across all project headers and key UI elements
- Enhanced session list with compact card design and improved spacing efficiency
- Implemented flex-based responsive layouts for better content overflow handling
- Updated tab system to use flex column layouts for optimal space utilization
- Improved virtual scrolling performance with reduced item heights and better viewport usage
- Enhanced color theme with proper light/dark mode accent color variations

### Fixed
- Resolved tab content overflow issues by switching from overflow-hidden to overflow-auto
- Fixed session list height calculation to utilize full available viewport space
- Improved session card visual hierarchy with better spacing and typography
- Enhanced hover states with consistent accent color theming throughout interface

### Technical
- Increased Node.js memory allocation across all npm scripts (dev, build, preview, check)
- Updated Rust backend version synchronization to 0.3.21
- Enhanced CSS custom properties for accent color theming in both light and dark modes
- Improved component layout architecture with flex-based responsive design patterns

## [0.3.20] - 2025-08-13

### Added
- Virtualized session list in ProjectSessionTab with dynamic scrolling and performance optimization
- Enhanced session display with virtualization support using react-virtual
- Sophisticated scroll position tracking and scroll-to-top button
- New `modified_at` timestamp for session tracking in both frontend and backend
- File size and time ago formatting utilities in date-utils
- Dynamic session rendering with multi-line title support and improved information density

### Changed
- Completely refactored ProjectSessionTab to use virtualization for large session lists
- Replaced static pagination with infinite scrolling and virtual rendering
- Updated session management in frontend and backend to include `modified_at` timestamp
- Improved session list performance for projects with many sessions
- Enhanced session information display with more compact and informative layout

### Fixed
- Eliminated rendering performance bottlenecks in session lists with large number of sessions
- Improved scrolling and rendering efficiency in ProjectSessionTab
- Added proper line truncation for session titles to prevent layout breaks
- Enhanced timestamp and file size display formatting

### Technical
- Integrated `@tanstack/react-virtual` for efficient list rendering
- Optimized memory usage in session list component
- Added sophisticated scroll tracking and positioning logic
- Improved type definitions for session management

## [0.3.19] - 2025-08-13

### Added
- Comprehensive unsaved changes architecture with new useUnsavedChanges hook for automatic tab-level change tracking
- Custom ConfirmationDialog components replacing all native confirm dialogs throughout the application  
- Unified unsaved changes protection system across all editor components (Settings, ClaudeMdTab, ProjectToolsTab, ClaudeFileEditor, CreateAgent)
- Enhanced TabContext and TabManager with unsaved changes handling and custom dialog support
- Smart save button states that disable when no changes are present across all components

### Changed
- All editor components now use useUnsavedChanges hook for consistent change tracking behavior
- TabManager now displays custom confirmation dialogs instead of native browser prompts
- Settings component with useSettingsState hook now properly tracks hasChanges state
- Agent color system updated to use lowercase color names (red, blue, green) instead of capitalized versions
- Improved tools comparison logic to prevent false positive unsaved changes detection

### Fixed
- Agent color backgrounds now display correctly for subagent messages with proper color badge rendering
- Tools comparison bug that was causing incorrect unsaved changes detection resolved
- All save buttons now properly disable when there are no pending changes to save
- Native confirm dialog inconsistencies replaced with themed custom dialogs

### Technical
- Created useUnsavedChanges hook with automatic tab state synchronization
- Enhanced TabContext.removeTab method with force parameter for unsaved changes bypass
- Updated all form validation logic to use detailed change comparison instead of shallow checks
- Consistent unsaved changes UX pattern implemented across 5+ major editor components

## [0.3.18] - 2025-08-12

### Added
- Comprehensive StreamMessage UI refactoring with improved message layout and visual hierarchy
- Agent color system for subagent identification with background colors (general-purpose gets grey, project agents use defined colors)
- Compact token display with directional arrow icons (ArrowUpFromLine for output, ArrowDownToLine for input)
- Enhanced message headers with message numbers, timestamps, and compact token statistics
- AgentAvatar component and useAgentMetadata hook for proper agent color mapping
- MessageRoleIcon component for consistent role identification

### Changed
- Moved message numbers and timestamps to same line, right-aligned with proper icons (MessageSquare, Clock)
- Redesigned token display with compact arrow icons and removed spaces for maximum compactness
- Updated SummaryWidget to use neutral card styling instead of blue coloring
- Improved agent type detection and color classification system
- Enhanced visual hierarchy with better spacing and consistent theme compatibility

### Fixed
- Agent color backgrounds now properly apply for subagents with metadata-based color mapping
- Message layout improvements for better readability and information density
- Theme-compatible styling throughout message components

## [0.3.17] - 2025-08-12

### Fixed
- User Memory (global ~/.claude/CLAUDE.md) now displays content correctly in View/preview mode
- Resolved layout conflict where competing flex containers prevented MDEditor height calculations
- Changed ClaudeMdTab editor container from "flex-1" to "h-full" to fix preview mode rendering
- Removed deprecated data-color-mode props from MDEditor components for cleaner theme handling

## [0.3.16] - 2025-08-12

### Fixed
- Navigation regression in ClaudeFileTabWrapper and CreateAgentTabWrapper where back button incorrectly returned to project list instead of project detail view
- Enhanced navigation logic to properly check for selectedProject state and restore complete project detail context
- Navigation from "Claudio → Memories → Edit file" now correctly returns to "Claudio → Memories" instead of project list
- Improved handleBack() and handleAgentCreated() methods to preserve active sub-tab state during navigation

## [0.3.15] - 2025-08-12

### Added
- Complete "Add Memory" functionality with project-scoped directory selection and validation
- File deletion functionality with confirmation dialogs across memory management interfaces
- Enhanced FilePicker component with directoriesOnly, canSelectDirectory, and isDirectoryDisabled props
- Settings file watcher functionality with real-time change detection via notify library
- Comprehensive tri-state toggle button controls for consistent UI interactions

### Changed
- ClaudeFileEditor UI completely redesigned with mode toggle controls (View/Edit/Live) and proper action buttons
- ClaudeMdTab redesigned to match ClaudeFileEditor with TabPageLayout integration and consistent controls
- Memory management interfaces now provide consistent visual indicators and validation feedback
- FilePicker now supports directory-only selection with proper validation callbacks
- Removed legacy MarkdownEditor component and cleaned up unused imports throughout the application

### Fixed
- Memory file validation now properly prevents selecting directories with existing CLAUDE.md files
- Consistent delete confirmation dialogs with proper loading states and error handling
- Enhanced directory selection validation with visual disabled states for unavailable options

### Technical
- Added notify dependency (6.1.1) for file system watching capabilities  
- Implemented delete_file and start_settings_watcher backend commands
- Enhanced API layer with proper file deletion and settings watching support
- Removed deprecated view types and cleaned up routing logic in App.tsx

## [0.3.14] - 2025-08-12

### Added
- Comprehensive DebugLabel system across ~45 major frontend components
- DebugLabel component with proper positioning for development identification
- Theme-aware card hover system with `--color-card-hover` CSS variables
- `hover:bg-card-hover` utility class for consistent interactive feedback

### Changed
- Standardized hover states across all interactive cards throughout the application
- Updated all card components in agents/, settings/, mcp/, dashboard/, claude/, common/, and sessions/ folders
- Enhanced visual feedback with consistent hover:bg-card-hover transitions
- Improved development experience with component identification labels

### Technical
- Added DebugLabel imports and positioning to 51+ component files
- Implemented theme-aware hover variables for both light and dark modes
- Maintained consistent component architecture and coding standards
- All changes are purely additive with no breaking changes

## [0.3.13] - 2025-08-11

### Changed
- Updated Tauri packages to latest versions (@tauri-apps/api: 2.7.0, plugins: 2.3.x series)
- Updated Lucide React from 0.468.0 to 0.539.0 for latest icon set
- Updated PrismJS to 1.30.0 to patch security vulnerability
- Updated Zustand from 5.0.6 to 5.0.7 for latest state management improvements
- Updated 167 Rust dependencies including core Tauri libraries for security and performance

### Security
- Patched PrismJS security vulnerability through version update to 1.30.0
- Updated all Tauri dependencies to latest secure versions

### Technical
- All updates maintain compatibility with existing codebase
- Rust backend compiles successfully with updated dependencies
- No breaking changes introduced by dependency updates

## [0.3.12] - 2025-08-11

### Changed
- Renamed src-tauri → src-backend for symmetric folder naming with src-frontend
- Updated all configuration files (package.json, vite.config.ts, tsconfig.json, index.html, tailwind.config.js)
- Updated all CI/CD workflows (.github/workflows/*.yml) to use new paths
- Updated build scripts (sync-version.js, bump-version.sh) with new folder structure
- Updated documentation (CLAUDE.md) to reflect new folder organization

### Technical
- Used git mv to preserve history for both folder renames (531 files total)
- Maintained symmetric folder structure: src-frontend/ and src-backend/
- Verified all build systems (TypeScript, Rust, Vite) work correctly after refactor
- No functional changes - purely organizational improvements

## [0.3.11] - 2025-08-11

### Added
- NavigationProvider context for consistent navigation state management across all tabs
- ChatTabWrapper, ClaudeFileTabWrapper, and CreateAgentTabWrapper for proper navigation flow
- Project tab state preservation when navigating between agents, memories, and sessions
- SlashCommandsSettings component for project-specific command management

### Changed
- Unified navigation system using restoreProjectState approach for all tab transitions
- All tab content now wrapped with NavigationProvider for consistent state management
- ProjectDetail component now preserves and restores active tab state (sessions, agents, memories, tools, commands)
- Simplified navigation logic by removing complex navigation stack system
- Enhanced agent and memory editing to preserve current project tab context

### Fixed
- Navigation back button from sessions/agent editing/memory editing now correctly returns to parent project detail state
- Eliminated "Unknown tab type: project-detail" errors caused by navigation stack complexity
- Fixed navigation context loss when editing agents, memories, or viewing sessions within projects
- Active tab preservation ensures users return to correct project tab (not always sessions) after editing operations
- Proper state restoration when navigating back from CLAUDE.md file editing or agent creation/editing

### Technical
- Removed deprecated navigation stack system in favor of simpler restoreProjectState pattern
- Updated TabContext interface to support enhanced project state restoration
- Standardized all tab wrappers to use consistent navigation patterns

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
