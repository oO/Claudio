# Claude Code Terminal Wrapper - Research Report

## Executive Summary

This report presents comprehensive research on creating a Rust-based terminal wrapper for Claude Code to enable remote control and automation of interactive Claude Code sessions from within Claudio. The goal is to embed and control entire Claude Code sessions, not just one-shot commands.

## 1. Claude Code Interactive Session Analysis

### Current Architecture
- **Terminal-based coding assistant** with natural language interface
- **Interactive mode** supporting continuous sessions with context awareness
- **Session management** through native Claude Code session files
- **Project-aware** with full codebase understanding
- **Tool integration** via Model Context Protocol (MCP)

### Key Capabilities
- Direct file editing and command execution
- Git workflow automation
- Multi-turn conversations with context retention
- Slash commands for enhanced control
- Native integration with development workflows

### Limitations for Remote Control
- **No programmatic API** for session control
- **Terminal-only interface** without SDK for interactive sessions
- **Single-session model** designed for direct human interaction
- **No built-in multiplexing** or remote control features

## 2. Rust Terminal Emulation Ecosystem

### Core Libraries

#### PTY (Pseudo-Terminal) Management
- **`pty-process`**: Async wrapper around tokio::process::Command with PTY allocation
- **`expectrl`**: Rust equivalent to Python's pexpect for interactive program control
- **`rexpect`**: Direct Rust port of pexpect functionality

#### Terminal Manipulation
- **`crossterm`**: Cross-platform terminal manipulation library
- **`ratatui`**: Modern TUI framework (successor to tui-rs)
- **`termion`**: Pure Rust, bindgen-free library for low-level terminal manipulation

#### Advanced Terminal Emulators
- **WezTerm**: GPU-accelerated terminal emulator with multiplexing
- **Alacritty**: High-performance, OpenGL-based terminal emulator

### Architecture Patterns
1. **PTY spawning**: Create pseudo-terminal for subprocess
2. **Event-driven I/O**: Async handling of terminal input/output
3. **Terminal state management**: Raw mode, escape sequences, cursor control
4. **GPU acceleration**: OpenGL rendering for performance

## 3. Interactive CLI Wrapping Techniques

### Approach 1: PTY-Based Process Control
**Implementation**: Use `expectrl` or `pty-process` to spawn Claude Code in a PTY
- ✅ Full terminal emulation
- ✅ Interactive session support
- ✅ Pattern matching for response parsing
- ❌ Complex terminal state management
- ❌ Escape sequence handling required

### Approach 2: Stdin/Stdout Piping
**Implementation**: Direct process spawning with stream capture
- ✅ Simple implementation
- ✅ Direct I/O control
- ❌ No TTY detection by Claude Code
- ❌ Limited interactivity support
- ❌ Potential buffering issues

### Approach 3: Terminal Multiplexer Approach
**Implementation**: Embed within tmux/screen-like multiplexer
- ✅ Session persistence
- ✅ Multiple session management
- ❌ Additional complexity
- ❌ External dependency

## 4. Recommended Architecture

### Primary Solution: PTY-Based Wrapper with `expectrl`

```rust
// Core components identified:
// 1. ClaudeCodeWrapper - Main session management
// 2. TerminalEmulator - UI and display handling  
// 3. SessionManager - Multi-session orchestration
```

#### Key Features
- **Session Spawning**: Launch Claude Code instances in controlled PTY
- **Pattern Matching**: Use regex patterns to detect prompts and responses
- **Bidirectional Communication**: Forward user input, capture Claude output
- **Session Persistence**: Maintain multiple concurrent Claude sessions
- **Event-Driven Architecture**: Async handling of all I/O operations

#### Implementation Strategy
1. **Phase 1**: Basic PTY spawning and I/O forwarding
2. **Phase 2**: Response parsing and state management
3. **Phase 3**: Multi-session support and UI integration
4. **Phase 4**: Advanced features (logging, replay, automation)

### Alternative Solutions

#### Solution B: Custom Terminal Emulator
Build minimal terminal emulator specifically for Claude Code
- **Pros**: Complete control, optimized for Claude Code
- **Cons**: Significant development overhead, terminal compatibility

#### Solution C: WebSocket Proxy
Create WebSocket bridge between Claudio and Claude Code
- **Pros**: Clean separation, web-friendly interface
- **Cons**: Requires Claude Code modifications, protocol complexity

## 5. Technical Challenges & Solutions

### Challenge 1: Terminal State Synchronization
**Problem**: Maintaining accurate terminal state between wrapper and Claude
**Solution**: Use `crossterm` for terminal manipulation, implement state tracking

### Challenge 2: Response Parsing
**Problem**: Distinguishing Claude responses from intermediate output
**Solution**: Pattern matching with `expectrl`, implement timeout-based parsing

### Challenge 3: Session Management
**Problem**: Managing multiple concurrent Claude sessions
**Solution**: UUID-based session tracking, async task per session

### Challenge 4: Error Handling
**Problem**: Graceful handling of Claude crashes or hangs
**Solution**: Timeout mechanisms, process health monitoring, automatic restart

## 6. Implementation Roadmap

### Phase 1: Core Wrapper (Week 1-2)
- [x] Project structure setup
- [ ] Basic PTY spawning with `expectrl`
- [ ] Simple command forwarding
- [ ] Basic response capture

### Phase 2: Session Management (Week 3-4)
- [ ] Multi-session support
- [ ] Session persistence
- [ ] State synchronization
- [ ] Error recovery

### Phase 3: Integration (Week 5-6)
- [ ] Tauri command integration
- [ ] Frontend UI components
- [ ] Real-time session streaming
- [ ] Session analytics

### Phase 4: Advanced Features (Week 7-8)
- [ ] Session recording/replay
- [ ] Automation scripting
- [ ] Performance optimization
- [ ] Comprehensive testing

## 7. Risk Assessment

### High Risk
- **Claude Code behavior changes**: Updates might break parsing patterns
- **Terminal compatibility**: Edge cases in terminal emulation
- **Performance overhead**: PTY wrapper adding latency

### Medium Risk
- **Session management complexity**: Concurrent session handling
- **Error recovery**: Graceful handling of failures
- **Cross-platform compatibility**: Windows/Linux/macOS differences

### Low Risk
- **Basic I/O forwarding**: Well-established patterns
- **Rust ecosystem maturity**: Reliable libraries available
- **Integration points**: Clear interfaces with existing Claudio

## 8. Success Metrics

- **Functional**: Successfully spawn and control Claude Code sessions
- **Performance**: <100ms latency for command forwarding
- **Reliability**: 99%+ session stability without crashes
- **Usability**: Seamless integration with Claudio UI
- **Scalability**: Support 10+ concurrent sessions

## 9. Conclusion

The PTY-based approach using `expectrl` provides the best balance of functionality, complexity, and maintainability for wrapping Claude Code interactive sessions. The Rust ecosystem offers mature libraries for terminal emulation and process control, making this a viable technical solution.

The proposed architecture allows for incremental development, starting with basic session control and expanding to advanced features like multi-session management and automation capabilities.

Next steps involve implementing the Phase 1 core wrapper functionality and validating the approach with real Claude Code sessions.