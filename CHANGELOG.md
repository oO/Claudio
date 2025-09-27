# Changelog

## [0.7.1] - 2025-09-27

### Refactor
- Massive logging standards cleanup across entire codebase (82 files modified)
- Removed ALL emoji violations from logs (🧠🚀🔍📊✅❌🔄⚙️📝💡🔥✨ etc.)
- Eliminated progress narration in favor of essential error/state logging only
- Session orchestrator no longer spams debug info on every file change
- Thin API wrappers now only log errors, not redundant success messages
- Net reduction of 1700+ lines while preserving essential error handling
- Added Claude Code wrapper infrastructure for advanced session management

## [0.6.3] - 2025-09-26

### Refactor
- Enhanced commit-expert agent with explicit versioning behavior defaults
- Added user version override capability for precise version control
- Clarified PATCH increment as default unless explicitly requested otherwise

## [0.6.2] - 2025-09-26

### Refactor
- Unified tabsState architecture with cohesive panel layout system
- Moved panelMinWidth from separate global app setting into tabsState for better organization
- Renamed storage key from `tabs_session` → `tabs` → `tabsState` for consistency with windowState naming
- Centralized all panel-related state (panelBreaks, activePanelIndex, panelMinWidth) in single cohesive system
- Fixed confusing `tabs.tabs` nesting issue while maintaining all existing functionality

## [0.6.1] - 2025-09-24

### Fix
- Fixed critical async filesystem bug in save_claudio_app_setting() that was mixing sync std::fs with async functions, causing "No such file or directory" errors - now properly uses tokio::fs throughout
- Removed localStorage persistence for session filters to improve UX (filters now just component state that resets on navigation)
- Fixed window and proxy settings to use single JSON saves instead of multiple individual saves for better performance

### Refactor
- Migrated debug mode from localStorage to ClaudioAppSettings for proper settings management
- Removed all localStorage cleanup code from TabContext since session filters no longer persist
- Completed localStorage migration - only analytics consent remains in localStorage (appropriate for privacy)

## [0.5.3] - 2025-09-20

### Fix
- Fixed critical session deletion bug that was deleting current sessions instead of requested sessions
- Fixed resume session bug with proper UUID and timestamp reading from .jsonl files
- Fixed resume session status to start as Idle instead of Active for proper turn management
- Added smart Claudio cleanup that deletes wrapper sessions when their Claude session is deleted
- Added proper path handling using existing constants instead of manual path building
- Made resume operations fail-fast to prevent broken streaming with invalid session data

### Enhancement
- Added session type badges to SessionCard UI showing "archived", "claudio", or "native" status
- Moved session type badge to first position in metadata row for better UX
- Improved styling with muted colors for archived sessions and accent colors for active sessions
- Removed unnecessary framer-motion wrapper to reduce animation overhead
- Added proper error logging throughout session components
- Consolidated frontend data fetching logic for cleaner implementation

## [0.6.0] - 2025-09-20

### Feat
- Added session type badges to SessionCard component showing "archived", "claudio", or "native" status
- Moved session type badge to first position in metadata row for improved UX
- Enhanced session status visibility with proper color coding (muted for archived, accent for active)

### Refactor
- Removed framer-motion wrapper from SessionCard to eliminate unnecessary animation overhead
- Consolidated todo data fetching by combining two useEffect hooks into cleaner implementation
- Added proper error logging with logger.error() and logger.debug() replacing empty catch blocks

## [0.5.2] - 2025-09-18

### Refactor
- Simplified ProjectsTab navigation system using KISS principles
- Removed over-engineered NavigationProvider stack system for simple 3-level hierarchy (Projects → Project → Session)
- Fixed back navigation duplication bug caused by repeated tab restoration logic
- Added one-time restoration flag to prevent navigation state conflicts
- Simplified navigation hierarchy with clean back button logic

## [0.5.1] - 2025-09-18

### Fixed
- Fixed summary message duplication in SessionDetail tab by removing redundant bundling logic from MessageRouter.tsx

## [0.5.0] - 2025-09-17

### Feat
- Implemented centralized session store with reactive caching architecture
- Added comprehensive file watching system for real-time session updates
- Fixed duplicate API calls issue (reduced from 4+ calls to 1) when clicking projects
- Fixed project tab restoration bug for tabs with only initialProjectPath
- Added detailed tab-specific logging for better debugging of tab restoration
- Eliminated "thundering herd" problem by implementing proper reactive caching
- Removed excessive emoji logging spam from TauriEventManager and session components
- Fixed infinite useEffect loop caused by zustand store in dependency array

## [0.4.48] - 2025-09-14

### Fixed
- Fixed critical streaming message display bug where useSessionFileWatcher callback wasn't reloading messages from backend
- Added sessionHandle.getMessages() call in onSessionChanged callback to properly refresh message display
- Optimized session handling by simplifying message updates for NATIVE/ARCHIVED sessions
- Disabled fake message injection for read-only sessions to prevent display conflicts
- Cleaned up verbose logging in session management

## [0.4.47] - 2025-09-14

### Refactor
- Commented out noisy debug and info logs across backend and frontend to reduce console noise during development
- Cleaned up unused imports while preserving enum variant consistency
- Logs preserved as comments for future debugging needs

## [0.4.46] - 2025-09-14

### Fixed
- Fixed PromptInput showing for archived sessions bug by changing condition to only allow CLAUDIO session types
- Removed confusing READONLY session type terminology and consolidated session types to CLAUDIO/NATIVE/ARCHIVED
- Updated isReadOnly logic to correctly identify both NATIVE and ARCHIVED sessions as read-only

## [0.4.45] - 2025-09-14

### Fixed
- Two critical regression fixes for multi-view tab creation and subagent message routing
- Fixed multi-view tab creation bug where tabs only created in first panel instead of active panel
- Fixed stale closure bug in TabContext by adding activePanelIndexRef to track current active panel
- Fixed subagent messages incorrectly rendering as AssistantMessage instead of SubAgentMessage
- Fixed dual message processing pipelines where only sessionHandleApi called processMessagesWithAgentInfo()
- Made useMessageProcessing call processMessagesWithAgentInfo() so MessageRouter gets messages with agentType properties
- Fixed global subagent type persistence between streaming calls within same turn
- Removed problematic reset logic that was clearing subagent context prematurely
- Cleaned up debug logging to prevent log spam

## [0.4.44] - 2025-09-14

### Fixed
- Critical subagent message routing bug where dual message processing pipelines were inconsistent
- Fixed useMessageProcessing hook not calling processMessagesWithAgentInfo() causing messages to lack agentType properties
- Fixed messageProcessor global state persistence by making currentSubagentType persist between streaming calls
- Removed premature reset logic that cleared subagent context before sidechain messages could use it
- Restored proper SubAgentMessage component routing for messages with isSidechain: true
- Subagent messages now display correctly with Bot icon, colored badges, and proper visual distinction

## [0.4.43] - 2025-09-14

### Fixed
- Subagent message assignment regression from v0.4.39 session resume optimization
- Session resume now preserves Task tool context by searching backwards for last Task tool before resume point
- Fixed stateful currentSubagentType tracking in processMessagesWithAgentInfo to ensure subagent messages render as SubAgentMessage instead of regular AssistantMessage in UI

## [0.4.42] - 2025-09-14

### Fixed
- Tab creation bug in multi-view mode where tabs created via Topbar buttons (Projects, Agents, etc.) always went to Panel 0 instead of the currently active panel
- Fixed stale closure issue in TabContext.tsx by adding useRef for activePanelIndex to avoid stale dependencies
- Regression from v0.4.38 when useEffect dependencies were removed to break circular dependencies

## [0.4.40] - 2025-09-14

### Fixed
- Critical streaming bug in resume_claudio_session function where UUID was assigned to wrong field
- Fixed two-phase UUID tracking system for streaming sessions to properly handle resumed sessions
- Message UUID now flows correctly through message_uuid field before promotion to last_message_uuid

## [0.4.39] - 2025-09-13

### Added
- Exit Session functionality: Convert active CLAUDIO sessions to ARCHIVED state by removing wrapper files
- Resume Session functionality: Convert ARCHIVED sessions back to active CLAUDIO sessions with new wrapper
- Bidirectional session lifecycle management with LogOut/LogIn UI icons
- Clean session state management without page reloads using proper React state updates
- Session handle automatic updates with new claudio_id after resume operations

## [0.4.38] - 2025-09-13

### Enhanced
- Fixed multi-view tab section alignment with content panels using proper width classes (w-1/2, w-1/3)
- Implemented perfect visual alignment between tab sections and content grid layout
- Fixed tab selection functionality that was broken during alignment work
- Enabled panel selection by clicking empty space in sections with full clickable areas
- Added proper spacer handling for empty panels and removed redundant visual separators
- Simplified to within-section reordering only for improved reliability
- Made empty sections show welcome screen in content area with clean bg-card styling
- Fixed button positioning to be inside last panel section for consistent UI layout

## [0.4.37] - 2025-09-13

### Enhanced
- Completed comprehensive haiku repair project ensuring perfect 5-7-5 syllable compliance
- Fixed all 165 broken haikus using parallel ULTRATHINK repair agents
- Added 16 new tech haikus to complete the 500-haiku collection
- All haikus now maintain perfect syllable structure for poetic feature compliance

## [0.4.36] - 2025-09-13

### Fixed
- Claudio session thinking indicators now appear immediately when prompts are sent
- Session ID extraction for Claudio sessions (fixed claudiaId access from session_type.data.claudio_id)
- Thinking indicator support for both NATIVE and CLAUDIO session types
- Session status terminology consistency (active/idle vs thinking)

### Cleaned
- Extensive debugging log cleanup across all backend commands
- Removed emoji-decorated logs and excessive debug noise from binary detection
- Replaced info-level logs with debug-level for cleaner production output
- Cleaned up dead code paths in execution flow

### Removed
- ClaudeCodeSDKSession.tsx - unused SDK-based session component
- claudeCodeSdk.ts - unused SDK abstraction layer
- Dead thinking event code paths in execution.rs
- Unused SDK calls in sessionUtils.ts

### Enhanced
- Clean execution path from UI → backend → Claude CLI
- Proper session ID mapping between Claudio and Claude sessions
- Significantly reduced log noise for production readiness
- Added comprehensive execution flow documentation

### Added
- CLAUDIO_SESSION_EXECUTION_FLOW_ANALYSIS.md - detailed execution flow analysis
- docs/claude-code-hooks-research.md - Claude Code hook integration research

## [0.4.35] - 2025-09-10

### Added
- SystemFilter component with toggle functionality for controlling system message visibility
- SystemMessage component for displaying system messages with dynamic icons and ANSI stripping
- System message routing in MessageRouter component
- System message extraction and filtering logic in useMessageProcessing hook
- System message state management in SessionContext
- Dynamic log level icons (info, debug, warning, error, trace) for system messages
- ToolWidgetTemplate integration for consistent expand/collapse behavior

### Enhanced
- System messages are hidden by default but can be toggled via UI filter button in SessionHeader
- ANSI code stripping for clean system message content display
- Integration across SessionDetail, SessionMessages, and SessionHeader components
- Provides users control over system message visibility while maintaining clean default interface

## [0.4.34] - 2025-09-09

### Added
- AssistantMessageFilter component with Bot icon and "Agent (all|last)" toggle functionality
- Message processing logic to detect and differentiate subagent tasks vs responses
- Filtering in SessionMessages that hides subagent responses when in "last" mode
- Navigation system updated to work with stable message numbers instead of array indices
- scrollToMessage method that handles filtering conversion automatically
- Context support for assistant filter state in SessionContext
- Intelligent tool filter integration that auto-hides when assistant filter is in "last" mode

### Enhanced
- Increased Virtuoso overscan from 20 to 40 for better performance with message filtering
- Users can now toggle between seeing all assistant messages vs only the last assistant message per turn
- Subagent chatter automatically hidden since main assistant summarizes their work

## [0.4.33] - 2025-09-09

### Changed
- Remove TodoWrite/Task tool exception from tool filtering in useMessageProcessing
- TodoWrite/Task tools now hide consistently with other tools when tool visibility is toggled off
- Cleaner tool filtering behavior since Todo UI widget already shows current work progress

## [0.4.32] - 2025-01-09

### Added
- Implemented ToolFilter component in SessionHeader for controlling tool message visibility
- Added tool message extraction and filtering logic to useMessageProcessing hook
- Enhanced SessionContext with tool visibility state management
- Added intelligent filtering that always keeps TodoWrite/Task tools visible for workflow continuity
- Integrated ToolFilter with SessionMessages component for real-time message filtering

## [0.4.31] - 2025-01-08

### Fixed
- Fixed navigation components (UserMessageNavigation and InProgressTodoWidget) to always show but disable when empty instead of disappearing
- Improved UI consistency by maintaining consistent layout and clear state indication
- Removed redundant cursor styling on disabled buttons

## [0.4.30] - 2025-09-08
- Removed debug log statement from SessionDetail.tsx that was spamming console with mount messages
- Fixed ESLint exhaustive-deps warning in SessionHeader.tsx with proper dependency management
- Enhanced TodoContext to trigger fresh todo loads after events instead of just count updates

## [0.4.29] - 2025-09-08
- Implemented sophisticated 3-state cycling todo button in InProgressTodoWidget with progressive disclosure UI pattern
- Added TodoContext.loadSessionTodos() function to fetch fresh todo data on component mount, fixing stale cache issues
- Enhanced TodoContext with initial data loading instead of relying solely on events for better reliability
- Implemented 3-state button cycle: compact (TodoList icon + "Todo" text + count badge), overview (scrolling todo with progress bar), overview-list (overview + dropdown)
- Fixed React hooks order violation by moving all hooks before conditional returns for proper component lifecycle
- Added comprehensive event handling for click cycling and ESC key navigation
- Improved tab persistence system with streamlined hook architecture and better state management
- Enhanced component mount behavior to ensure fresh todo data display on initial render

## [0.4.28] - 2025-09-07
- Enhanced InProgressTodoWidget with improved two-flex layout structure for better visual hierarchy
- Added ListTodo icon and "Todo" label for clear component identification
- Improved widget container sizing (w-100) and overflow handling with min-w-0 for proper text truncation
- Enhanced visual styling with secondary-foreground colors and consistent height matching User button
- Fixed progress bar positioning and animation with smooth transitions (h-1.5 for current, h-1 for others)
- Removed unused priority indicator code and improved overall content containment
- Enhanced carousel animation system for seamless todo cycling display

## [0.4.27] - 2025-09-07
- Fixed SessionHeader export dropdown by replacing broken Popover with DropdownMenu component
- Moved action buttons (compact mode toggle, export menu) from header to control bar for better organization
- Implemented new InProgressTodoWidget with 3-second cycling carousel showing all todos with status icons
- Added animated progress bar with height indicators showing current todo completion status
- Enhanced SessionHeader with real-time TodoContext integration for live todo updates
- Applied DRY principle to dropdown menu styling across components
- Improved tab persistence and dehydration system for better state management

## [0.4.25] - 2025-09-07
- Expanded Claude thinking message resources with 500+ new haiku-style messages covering development, cybersecurity, AI, and tech history
- Enhanced thinking indicator variety with 400+ new verbs and creative expressions for Claude's processing states

## [0.4.22] - 2025-09-05
- Implemented Cmd+click to open projects and sessions in new tabs for enhanced browser-like navigation
- Fixed tab activity flash animations for all project-related tabs (projects, project, project-session)
- Added createProjectTab function to useTabState hook for proper project tab management
- Updated session watchers to trigger flash animations even when tabs aren't active
- Moved session Cmd+click logic directly to SessionCard component, eliminating prop drilling
- Enhanced ProjectList and ProjectsTab components to support modifier key detection

## [0.4.21] - 2025-09-05
- Implemented DRY user message navigation system with enhanced tab titles and activity notifications

## [0.4.20] - 2025-09-05
- Enhanced tab title display with dual-layout format showing [project name (truncated) | session ID (never truncated)]
- Added displayId field to Tab interface for better session ID visibility in tab titles
- Implemented CSS-based flash animation on tab icons for session activity notifications (3-second fade)
- Restored proper dynamic tab type transformations during navigation (projects → project → project-session)
- Fixed session list watcher to properly filter events per project, preventing cross-tab contamination
- Replaced persistent activity dots with fade-based flash notifications for cleaner UI feedback

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
