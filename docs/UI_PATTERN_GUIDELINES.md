# UI Pattern Guidelines - Claudio Application

## Overview

This document defines the standardized UI patterns and components for the Claudio application. These guidelines ensure consistency across the entire application through our Atomic Design system.

## Core Principles

1. **Atomic Design Structure**: Components are organized into atoms, molecules, and organisms
2. **Consistency**: All similar UI elements use the same atomic components
3. **Accessibility**: All components support keyboard navigation and screen readers  
4. **Performance**: Minimal DOM structure and efficient rendering
5. **Maintainability**: Clear component APIs and composable patterns

## Button Patterns

### Primary Pattern: ActionButton Atom

**Use `ActionButton` for all interactive buttons across the application.**

```typescript
import { ActionButton } from "@/components/ui/atoms/ActionButton";

// Standard usage
<ActionButton
  icon={Save}
  label="Save Settings"
  variant="default"
  size="sm"
  onClick={handleSave}
/>

// Icon-only button
<ActionButton
  icon={Settings}
  label="Settings"
  variant="ghost"
  size="icon"
  showLabel={false}
  onClick={onSettings}
/>

// Loading state
<ActionButton
  icon={Save}
  label={saving ? "Saving..." : "Save"}
  isLoading={saving}
  disabled={saving}
  onClick={handleSave}
/>
```

### Button Variants
- `default`: Primary actions (blue background)
- `destructive`: Destructive actions (red background) 
- `outline`: Secondary actions (bordered)
- `secondary`: Subtle actions (gray background)
- `ghost`: Minimal actions (transparent)
- `link`: Text-only actions

### Button Sizes
- `sm`: Small buttons (h-8, text-xs) - for compact layouts
- `default`: Standard buttons (h-9, text-sm) - most common
- `lg`: Large buttons (h-10, text-base) - for emphasis
- `icon`: Square icon buttons (h-9, w-9) - for icon-only actions

## Loading State Patterns

### Primary Pattern: LoadingSpinner Atom

**Use `LoadingSpinner` for all loading states instead of manual Loader2 icons.**

```typescript
import { LoadingSpinner } from "@/components/ui/atoms/LoadingSpinner";

// Simple spinner
<LoadingSpinner />

// With message
<LoadingSpinner message="Loading projects..." />

// Different sizes
<LoadingSpinner size="sm" />   // 16px
<LoadingSpinner size="default" />  // 24px  
<LoadingSpinner size="lg" />   // 32px

// Centered in container
<div className="flex items-center justify-center h-full">
  <LoadingSpinner message="Initializing..." />
</div>
```

## Navigation Patterns

### Topbar Navigation

The Topbar uses consistent ActionButton components:

```typescript
<ActionButton
  icon={Folder}
  label="Projects"
  variant="ghost"
  size="sm"
  onClick={onProjectsClick}
/>
```

### Tab Management

Tabs use standardized styling with:
- Consistent icon mapping for tab types
- LoadingSpinner for running states
- Semantic color usage (`text-destructive` for errors)

## Status Indicator Patterns

### Status Colors (Semantic)
- `text-primary`: Active/selected states
- `text-destructive`: Error states  
- `text-muted-foreground`: Disabled/secondary text
- `bg-primary`: Primary backgrounds
- `bg-destructive`: Error backgrounds
- `bg-muted`: Secondary backgrounds

### Status Icons
- Use LoadingSpinner for "running" states
- Use AlertCircle for "error" states  
- Use CheckCircle for "success" states
- Use Circle for "idle" states

## Modal and Dialog Patterns

### ConfirmationDialog Usage

```typescript
import { ConfirmationDialog } from "@/components/ui/organisms/ConfirmationDialog";

<ConfirmationDialog
  isOpen={showDeleteDialog}
  title="Delete Project"
  description="Are you sure you want to delete this project?"
  confirmText="Delete"
  cancelText="Cancel"
  variant="destructive"
  onConfirm={handleDelete}
  onCancel={() => setShowDeleteDialog(false)}
  isLoading={deleting}
/>
```

## Form and Input Patterns

### Consistent Form Layout

```typescript
// Form sections use Card components
<Card className="p-6 space-y-6">
  <div className="space-y-4">
    {/* Form fields */}
  </div>
  
  {/* Actions */}
  <div className="flex justify-end gap-2">
    <ActionButton
      icon={Save}
      label="Save"
      onClick={handleSave}
      isLoading={saving}
    />
  </div>
</Card>
```

## Spacing and Layout Patterns

### Consistent Spacing
- `space-x-1`: 4px - tight spacing (navigation buttons)
- `space-x-2`: 8px - standard spacing (button groups)  
- `space-y-4`: 16px - form field spacing
- `space-y-6`: 24px - section spacing
- `p-4`: 16px - standard padding
- `p-6`: 24px - card padding

### Layout Patterns
- Use `flex items-center` for horizontal alignment
- Use `flex items-center justify-center` for centering
- Use `space-x-*` and `space-y-*` for consistent gaps
- Use `max-w-*` for content width constraints

## Animation Patterns

### Framer Motion Usage
- Entry animations: `initial={{ opacity: 0, y: -20 }}`
- Loading states: Use LoadingSpinner's built-in animation
- Hover states: `hover:bg-accent hover:text-accent-foreground`

## Component Organization

### Atomic Structure
```
ui/
├── atoms/           # Basic building blocks
│   ├── ActionButton.tsx
│   ├── LoadingSpinner.tsx  
│   └── ...
├── molecules/       # Component combinations
│   ├── SearchInput.tsx
│   └── ...
├── organisms/       # Complex components
│   ├── ConfirmationDialog.tsx
│   └── ...
└── [base-ui]/       # Base shadcn components
```

## Migration Checklist

When updating existing components:

- [ ] Replace `Button` with `ActionButton` where appropriate
- [ ] Replace `Loader2` with `LoadingSpinner`  
- [ ] Use semantic color classes (`text-destructive` vs `text-red-500`)
- [ ] Ensure consistent spacing patterns
- [ ] Apply proper sizing (`sm`, `default`, `lg`) 
- [ ] Add proper accessibility attributes
- [ ] Follow icon + label patterns

## Examples of Harmonized Components

### Before/After Comparisons

#### Button Usage
```typescript
// Before
<Button variant="ghost" size="sm" onClick={onClick} className="text-xs">
  <Settings className="mr-2 h-3 w-3" />
  Settings
</Button>

// After  
<ActionButton
  icon={Settings}
  label="Settings"
  variant="ghost"
  size="sm"
  onClick={onClick}
/>
```

#### Loading States
```typescript
// Before
{loading && (
  <div className="flex items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
)}

// After
{loading && (
  <div className="flex items-center justify-center">
    <LoadingSpinner message="Loading..." />
  </div>
)}
```

## Future Development Guidelines

1. **Always use atomic components** instead of custom implementations
2. **Follow established patterns** for new features
3. **Maintain semantic color usage** for consistent theming
4. **Document new patterns** when extending the system
5. **Test accessibility** for all new components

This harmonization ensures a consistent, maintainable, and accessible user interface throughout the Claudio application.