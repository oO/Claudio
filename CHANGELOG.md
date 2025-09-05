# Changelog

## [0.4.19] - 2025-09-05
- Removed entire timeline/checkpoint legacy system from Claudia donor project codebase
- Deleted SessionTimeline, TimelineNavigator, and CheckpointSettings components
- Removed checkpoint backend commands, storage, and manager modules
- Cleaned up checkpoint API methods, TypeScript interfaces, and analytics tracking
- Simplified SessionHeader by removing timeline toggle functionality
- Removed forkFromCheckpoint and useCheckpoints hook integration
- Eliminated ~1000+ lines of disconnected legacy code with data loss warnings
- Codebase now focused on core functionality with native Claude Code conversation forking via ESC-ESC

## [0.4.18] - 2025-09-04
- Moved session navigation from SessionHeader to SessionMessages with contextual overlay placement
- Added 4-button segmented pill navigation (jump to top, prev/next user message, jump to bottom/pin)
- Implemented smart button state management with intelligent disable states based on scroll position
- Added user message tracking with indices for proper prev/next navigation functionality
- Enhanced streaming-aware navigation updates that respond correctly to new message arrivals
- Improved visual design with connected pill layout, accent hover colors, and proper disabled states
- Fixed missing logger import in MessageFooter component for proper debugging support

## [0.4.17] - 2025-09-04
- Fixed critical tab context bug where remaining tabs lost state after closing other tabs
- Removed AnimatePresence mode="wait" that was unmounting inactive tabs and destroying state
- Eliminated ~300+ lines of unnecessary restoreProjectState logic across multiple components
- Simplified tab state management to use natural React component state persistence
- Tabs now work like normal browser tabs - maintaining state when inactive, only losing it when closed
- Removed over-engineered tab navigation restoration and type switching complexity

## [0.4.16] - 2025-09-04
- Enhanced SessionHeader UI with session title subtitle and todo counter
- Added shared session utility functions (getSessionTitle, formatSessionIdCompact)  
- Standardized session ID display format across all tabs and components
- Improved session metadata display with robust null/undefined handling
- Reduced debug logging noise in backend session orchestrator

## [0.4.15] - 2025-09-04
- Enhanced session title selection with intelligent message prioritization
- Session titles now prefer user messages with 8+ words for better clarity
- Added fallback to longest message found when scanning up to 5 user messages
- Eliminates useless session titles like "Hello" or "Hi there"
- Maintains all existing performance characteristics and message filtering logic
- Bridge between Virtuoso's internal scrolling and external layout changes
- Proper state synchronization when ThinkingIndicator appears/disappears
- Only auto-scroll when user was actually at bottom (preserves user intent)
- Enhanced debugging to track scroll method availability and execution

## [0.4.14] - 2025-09-04
- Fixed streaming state race condition when opening session tabs for active Claude sessions
- Added queryInitialSessionState function to immediately detect and display thinking state on tab open
- Updated useStreamingState hook to query initial state when native sessions load
- Eliminated UI delay where thinking indicators only appeared after next session event

## [0.4.13] - 2025-09-03
- Optimized project listing performance by replacing sessions array with session_count integer
- Removed expensive session file parsing from list_projects command 
- Simplified Project struct to avoid over-engineering with unnecessary session analytics
- Updated frontend to use session_count instead of sessions.length for display
- Maintained fast on-demand filesystem scanning without complex caching

## [0.4.12] - 2025-09-03
- Removed orphaned 'session' tab type - sessions now maintain project hierarchy
- Added 'project-session' tab type for sessions within project context
- Updated TabContent, TabManager, and ProjectsTab to handle new tab types
- Fixed session deduplication to work at session level (same session = focus existing tab)
- Updated project loading states - removed loading spinners, added actionable empty state
- Fixed navigation flow: Projects → Project → Session with proper hierarchy

## [0.4.11] - 2025-09-02
- Fixed filter state persistence across navigation using localStorage for session type filters
- Removed full-page loading spinner that blocked entire UI during session loading
- Implemented progressive loading where interface shows immediately while data loads in background
- Added conditional rendering to hide filter buttons when their session count is 0
- Improved session refresh with smooth updates and no blocking loading states

## [0.4.10] - 2025-09-02
- Fixed critical orphan cleanup bug that incorrectly deleted valid todo files
- Fixed filename parsing to properly extract session IDs from agent todo filenames
- Moved todo cleanup to run once globally with complete session list from all projects
- Added new backend infrastructure for todo file watching and API endpoints
- Extended session watcher to watch ~/.claude/todos/ directory with new event types
- Added get_session_todos Tauri command for fetching todo data
- Removed dead code that checked for non-existent session todo pattern

## [0.4.9] - 2025-09-02
- Condensed verbose changelog from 685 lines to 199 lines with streamlined format
- Fixed frontend logging compliance by replacing console.warn with proper logger calls
- Cleaned up project documentation and removed legacy thinking documents

## [0.4.8] - 2025-09-02
- Added ANSI escape code stripping hook for clean command output
- Fixed command widget display to show readable text instead of raw escape sequences

## [0.4.7] - 2025-09-02
- Major SessionHandleView refactor: 925 lines → 193 lines (79% reduction)
- Extracted 4 specialized hooks for separation of concerns
- Created focused UI components (SessionLoadingState, SessionErrorState, ThinkingIndicator)
- Removed 4,017 lines of deprecated legacy components

## [0.4.6] - 2025-09-01
- Fixed native session refresh and ThinkingMessage display
- Added brain icon display during streaming
- Fixed debounce race conditions and performance issues
- Added random thinking content API endpoint

## [0.4.5] - 2025-09-01
- Added universal tool status detection system
- New ExitPlanModeWidget with semantic color theming
- Enhanced tool status detection across all states
- Filtered interruption system noise messages

## [0.4.4] - 2025-09-01
- Added session list filtering with toggleable buttons
- Filter buttons show session counts with badges
- Clean filtering logic for Claudio/Native/Other sessions

## [0.4.3] - 2025-09-01
- Fixed critical session list refresh bug in file watcher
- Session list now correctly refreshes on ANY session changes

## [0.4.2] - 2025-08-31
- Replaced React Virtuoso with simple scrollable list
- Fixed live session detection and added proper badges
- Disabled delete buttons for native sessions
- Removed 1,400+ lines of dead execution code

## [0.4.0] - 2025-08-30
- Fixed message bundling with proper parentUuid relationships
- Implemented SessionContext to eliminate prop drilling
- Created standardized session type constants
- Cleaned up clipboard JSON for essential data only

## [0.3.41] - 2025-08-29
- Fixed TypeScript compilation by excluding deprecated folder

## [0.3.39] - 2025-08-29
- Removed 5,300+ lines of dead/legacy code
- Deleted 34+ unused files including legacy CCAgents system
- Significantly reduced bundle size and improved build performance

## [0.3.38] - 2025-08-29
- Added advanced streaming session architecture
- Enhanced session orchestrator with state management
- Improved SessionHandleView with better UI/UX
- Added Claude Code integration with native session hooks

## [0.3.35] - 2025-08-28
- Fixed session message display with React Virtuoso
- Added chat-style bottom-pinned scrolling
- Fixed visual gaps in session timeline

## [0.3.33] - 2025-08-26
- Added automatic session cleanup with UUID-based detection
- Enhanced session file management with intelligent watchers
- Implemented race condition elimination for UUID handling

## [0.3.32] - 2025-08-25
- Fixed resume flickering with UUID-based detection
- Added immediate UI feedback for prompt submission
- Implemented status messages with haikus

## [0.3.28] - 2025-08-17
- Added window state debouncing (500ms) to reduce file I/O
- Optimized window state saving during operations

## [0.3.24] - 2025-08-16
- Fixed MessageFooter clipboard functionality
- Added SessionProvider context to eliminate prop drilling

## [0.3.23] - 2025-08-15
- Complete message component architecture overhaul
- Implemented template-based architecture for consistency
- Enhanced type safety and component organization

## [0.3.21] - 2025-08-13
- Added unified accent color theme (#FF9500)
- Increased Node.js heap allocation to 16GB for large projects
- Enhanced session list with compact design and better performance

## [0.3.20] - 2025-08-13
- Added virtualized session list with dynamic scrolling
- Enhanced session display with react-virtual
- Added modified_at timestamp and improved formatting

## [0.3.19] - 2025-08-13
- Added comprehensive unsaved changes architecture
- Custom ConfirmationDialog replacing native dialogs
- Smart save button states across all components

## [0.3.18] - 2025-08-12
- Added agent color system for subagent identification
- Enhanced message headers with compact token display
- Improved visual hierarchy and theme compatibility

## [0.3.17] - 2025-08-12
- Fixed User Memory display in View/preview mode
- Resolved layout conflicts in MDEditor height calculations

## [0.3.16] - 2025-08-12
- Fixed navigation regression in file/agent editing
- Enhanced back button logic to preserve project context

## [0.3.15] - 2025-08-12
- Added complete "Add Memory" functionality with validation
- Enhanced FilePicker with directory selection
- Added file deletion with confirmation dialogs

## [0.3.14] - 2025-08-12
- Added comprehensive DebugLabel system (45+ components)
- Theme-aware card hover system with CSS variables

## [0.3.13] - 2025-08-11
- Updated Tauri packages and dependencies
- Patched PrismJS security vulnerability
- Updated 167 Rust dependencies for security/performance

## [0.3.12] - 2025-08-11
- Renamed src-tauri → src-backend for symmetric naming
- Updated all config files and workflows
- Maintained symmetric structure with src-frontend/

## [0.3.11] - 2025-08-11
- Added NavigationProvider for consistent state management
- Enhanced project tab state preservation
- Fixed navigation context loss in editing operations

## [0.3.10] - 2025-08-11
- Added comprehensive session deletion with age-based filtering
- Dynamic session age range detection
- Granular project deletion options with selective cleanup

## [0.3.8] - 2025-08-10
- Unified FileWidget merging ReadWidget and WriteWidget
- Consistent expand/collapse patterns across tool widgets
- Enhanced theme compatibility with CSS custom properties

## [0.3.7] - 2025-08-10
- Added debug mode system with localStorage toggle
- Renamed TaskWidget → SubAgentTaskWidget
- Fixed theme compatibility across tool widgets

## [0.3.6] - 2025-08-09
- Fixed agent card icon background transparency
- Improved visibility with better opacity settings

## [0.3.5] - 2025-08-08
- Fixed Tailwind v4 JIT compilation issues
- Resolved transparent card backgrounds with RGBA mixing
- Enhanced theme switching reliability

## [0.3.4] - 2025-08-07
- Added comprehensive project deletion dialog
- Real-time deletion preview with detailed feedback

## [0.3.3] - 2025-08-06
- Split claude.rs (2500+ lines) into 8 focused modules
- Fixed project sorting by last activity time

## [0.3.2] - 2025-01-06
- Added animated welcome message on startup
- Removed legacy About button and Analytics tab

## [0.3.1] - 2025-01-06
- Complete Atomic Design system (50+ components)
- Domain-specific component organization
- Refactored large components using design principles

## [0.2.2] - 2025-01-04
- Fixed window title dynamic version display
- Added Tauri capability configuration

## [0.2.1] - 2025-01-04
- Fixed CLAUDE.md editing and settings save errors
- Migrated from SQLite to file-based storage
- Hidden directories no longer appear in projects

## [0.2.0] - 2025-01-04
- Added native Claude Code agent support
- Comprehensive agent editor with validation
- Replaced SQLite with YAML frontmatter format

## [0.1.0] - Initial Baseline
- Initial Claudio setup from Claudia fork
- Basic agent management interface
- Tauri + React + TypeScript foundation
