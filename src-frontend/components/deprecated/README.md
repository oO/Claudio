# Deprecated Components

This folder contains components that have been removed from active use but are kept for reference.

## Components

### TokenCounter.tsx
- **Deprecated**: Removed from SessionPromptControls 
- **Reason**: Redundant with token counter in SessionHeader
- **Date**: 2025-08-25
- **Context**: Part of cleanup to remove visual clutter from prompt interface

### SimplePromptInput.tsx
- **Deprecated**: Replaced with PromptInput (renamed from FloatingPromptInput)
- **Reason**: Missing features, poor UX (Cmd+Enter instead of Enter, no hint text)
- **Date**: 2025-08-25
- **Context**: Restored full-featured prompt input with proper keyboard shortcuts

### SessionPromptControls.tsx
- **Deprecated**: Eliminated as unnecessary wrapper component
- **Reason**: Was just a passthrough that combined SessionQueuedPrompts + SimplePromptInput
- **Date**: 2025-08-25
- **Context**: Architecture cleanup - merged functionality directly into PromptInput

### SessionQueuedPrompts.tsx  
- **Deprecated**: Functionality merged into PromptInput
- **Reason**: Single-use component, better as internal feature of PromptInput
- **Date**: 2025-08-25
- **Context**: Architecture cleanup following KISS principle

## Guidelines

- Do not import or use these components in active code
- Components are kept for reference and potential future use
- Each component should have a clear deprecation reason in its JSDoc