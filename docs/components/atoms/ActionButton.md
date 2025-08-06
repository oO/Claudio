# ActionButton

A versatile action button component that combines an icon with a text label, supporting loading states and various interactive patterns.

## Overview

The ActionButton is one of the most frequently used atomic components in Claudio. It provides a consistent interface for user actions while maintaining excellent accessibility and visual feedback.

## Props

```typescript
interface ActionButtonProps extends Omit<ButtonProps, 'children'> {
  icon: LucideIcon;           // Required: Icon to display
  label: string;              // Required: Accessible label text
  isLoading?: boolean;        // Optional: Show loading state
  showLabel?: boolean;        // Optional: Show/hide label text (default: true)
}
```

### Extended Props
Since ActionButton extends the shadcn/ui Button component, it inherits all standard button props:
- `variant`: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
- `size`: "default" | "sm" | "lg" | "icon"
- `disabled`: boolean
- `onClick`: () => void
- `type`: "button" | "submit" | "reset"

## Usage Examples

### Basic Usage

```typescript
import { ActionButton } from '@/components/ui/atoms';
import { Save } from 'lucide-react';

function SaveButton() {
  return (
    <ActionButton
      icon={Save}
      label="Save Changes"
      onClick={handleSave}
    />
  );
}
```

### Loading State

```typescript
import { ActionButton } from '@/components/ui/atoms';
import { Upload } from 'lucide-react';

function UploadButton() {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    setIsUploading(true);
    try {
      await uploadFile();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ActionButton
      icon={Upload}
      label="Upload File"
      isLoading={isUploading}
      onClick={handleUpload}
      disabled={!file}
    />
  );
}
```

### Icon-Only Button

```typescript
import { ActionButton } from '@/components/ui/atoms';
import { Settings } from 'lucide-react';

function SettingsButton() {
  return (
    <ActionButton
      icon={Settings}
      label="Open Settings"  // Still required for accessibility
      showLabel={false}     // Hide visual label
      size="icon"
      variant="ghost"
    />
  );
}
```

### Destructive Action

```typescript
import { ActionButton } from '@/components/ui/atoms';
import { Trash2 } from 'lucide-react';

function DeleteButton({ onDelete, disabled }) {
  return (
    <ActionButton
      icon={Trash2}
      label="Delete Item"
      variant="destructive"
      onClick={onDelete}
      disabled={disabled}
    />
  );
}
```

### Custom Styling

```typescript
import { ActionButton } from '@/components/ui/atoms';
import { Star } from 'lucide-react';

function CustomButton() {
  return (
    <ActionButton
      icon={Star}
      label="Favorite"
      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
      size="lg"
    />
  );
}
```

## Visual States

### Default State
```typescript
<ActionButton icon={Save} label="Save" />
```

### Loading State
When `isLoading={true}`, the icon rotates with a spin animation and the button becomes disabled.

### Disabled State
```typescript
<ActionButton icon={Save} label="Save" disabled />
```

### Focus State
Includes visible focus ring for keyboard navigation accessibility.

## Responsive Behavior

The ActionButton adapts to different screen sizes:

```typescript
// Responsive label visibility
<ActionButton
  icon={Menu}
  label="Menu"
  showLabel={!isMobile}  // Hide label on mobile
  className="md:px-4 px-2"
/>
```

## Accessibility Features

### Keyboard Support
- **Space/Enter**: Activates the button
- **Tab**: Moves focus to the button
- **Escape**: Removes focus (when focused)

### Screen Reader Support
- Button has proper `role="button"`
- Label is always accessible via `aria-label` even when `showLabel={false}`
- Loading state announced via `aria-busy="true"`
- Disabled state properly communicated

### Visual Accessibility
- High contrast support
- Focus indicators meet WCAG 2.1 AA standards
- Minimum 44px touch target on mobile devices

## Implementation Details

### Icon Handling
```typescript
// Icon receives consistent sizing and animation
<Icon className={cn(
  "h-3 w-3",                    // Consistent 12px size
  isLoading && "animate-spin"   // Smooth loading animation
)} />
```

### Layout Strategy
```typescript
// Minimal DOM structure with flexbox
<Button className={cn(
  "gap-2",                      // 8px gap between icon and text
  !showLabel && "px-2"         // Reduced padding for icon-only
)}>
  <Icon />
  {showLabel && label}
</Button>
```

## Performance Characteristics

- **Bundle size**: ~1.2kb gzipped
- **Render cost**: Minimal (single component)
- **Re-render triggers**: Props changes only
- **Memory usage**: Negligible

## Design Tokens

### Spacing
- Icon-text gap: `0.5rem` (8px)
- Icon-only padding: `0.5rem` (8px)
- Default padding: inherited from Button component

### Typography
- Font weight: `font-medium` (500)
- Font size: inherited from Button size variant

### Animation
- Loading spin: `animate-spin` (1s linear infinite)
- Hover transition: `transition-colors` (150ms)

## Common Patterns

### Action Groups
```typescript
import { ActionButtonGroup } from '@/components/ui/molecules';

// Better to use ActionButtonGroup for multiple actions
const actions = [
  { id: 'save', icon: Save, label: 'Save', onClick: handleSave },
  { id: 'export', icon: Download, label: 'Export', onClick: handleExport }
];

<ActionButtonGroup actions={actions} />
```

### Form Submit
```typescript
function FormExample() {
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <ActionButton
        icon={Send}
        label="Submit Form"
        type="submit"
        isLoading={isSubmitting}
      />
    </form>
  );
}
```

### Async Actions
```typescript
function AsyncActionExample() {
  const { mutate, isLoading } = useMutation(apiCall);

  return (
    <ActionButton
      icon={RefreshCw}
      label="Refresh Data"
      isLoading={isLoading}
      onClick={() => mutate()}
    />
  );
}
```

## Best Practices

### Do ✅
- Always provide a descriptive `label` for accessibility
- Use appropriate icons that match the action
- Handle loading states for async operations
- Use semantic variants (`destructive` for delete actions)
- Group related actions using ActionButtonGroup

### Don't ❌
- Don't use ActionButton for navigation (use links instead)
- Don't omit the `label` prop (required for accessibility)
- Don't use generic icons like "circle" or "square"
- Don't create custom loading states (use `isLoading` prop)
- Don't nest ActionButtons inside other interactive elements

## Related Components

- **[ActionButtonGroup](../molecules/ActionButtonGroup.md)** - For grouping multiple actions
- **[LoadingSpinner](LoadingSpinner.md)** - Standalone loading indicator
- **Button** - Base shadcn/ui button component

---

*ActionButton is a foundational component used throughout Claudio for consistent action patterns. Its combination of icon, label, and loading state makes it perfect for most interactive use cases.*