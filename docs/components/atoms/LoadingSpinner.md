# LoadingSpinner

A minimal, animated loading indicator that provides visual feedback during asynchronous operations.

## Overview

The LoadingSpinner is a simple yet essential atomic component that communicates to users that the system is processing their request. It supports multiple sizes and optional text messages.

## Props

```typescript
interface LoadingSpinnerProps {
  size?: "sm" | "default" | "lg";    // Size of the spinner
  className?: string;                // Additional CSS classes
  message?: string;                  // Optional loading message
}
```

## Usage Examples

### Basic Usage

```typescript
import { LoadingSpinner } from '@/components/ui/atoms';

function BasicSpinner() {
  return <LoadingSpinner />;
}
```

### With Message

```typescript
function MessageSpinner() {
  return (
    <LoadingSpinner 
      message="Loading data..." 
      size="default"
    />
  );
}
```

### Different Sizes

```typescript
function SizeExamples() {
  return (
    <div className="space-y-4">
      <LoadingSpinner size="sm" message="Small" />
      <LoadingSpinner size="default" message="Default" />  
      <LoadingSpinner size="lg" message="Large" />
    </div>
  );
}
```

### Inline Loading

```typescript
function InlineExample() {
  return (
    <div className="flex items-center gap-2">
      <span>Processing</span>
      <LoadingSpinner size="sm" />
    </div>
  );
}
```

### Centered Loading

```typescript
function CenteredLoading() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <LoadingSpinner 
        size="lg"
        message="Loading your data..."
        className="text-center"
      />
    </div>
  );
}
```

## Size Specifications

| Size | Spinner Dimensions | Use Case |
|------|-------------------|----------|
| `sm` | 16×16px (1rem) | Inline text, small buttons, compact spaces |
| `default` | 24×24px (1.5rem) | Standard loading states, cards, modals |
| `lg` | 32×32px (2rem) | Page-level loading, prominent feedback |

## Visual Design

### Animation
- **Type**: Continuous rotation (360° spin)
- **Duration**: 1 second per rotation
- **Easing**: Linear (no acceleration/deceleration)
- **Direction**: Clockwise

### Colors
- **Icon**: `text-muted-foreground` (adapts to theme)
- **Message**: `text-muted-foreground` with `text-sm` size
- **Theme Support**: Automatically adapts to light/dark themes

## Implementation Details

### DOM Structure
```html
<!-- Minimal structure -->
<div class="flex items-center justify-center gap-2">
  <svg class="animate-spin"><!-- Loader2 icon --></svg>
  <span class="text-sm text-muted-foreground">Message</span>
</div>
```

### CSS Classes
```typescript
const sizeClasses = {
  sm: "h-4 w-4",           // 16px
  default: "h-6 w-6",      // 24px  
  lg: "h-8 w-8"            // 32px
};
```

## Accessibility Features

### Screen Reader Support
- Spinner has implicit `role="status"`
- Loading message is automatically announced
- Uses `aria-hidden="true"` on decorative spinner when message is present

### Motion Preferences
```css
@media (prefers-reduced-motion: reduce) {
  .animate-spin {
    animation: none;
  }
}
```

### Focus Management
- LoadingSpinner is not focusable (decorative element)
- Parent container should manage focus appropriately

## Common Use Cases

### Button Loading State

```typescript
import { ActionButton } from '@/components/ui/atoms';
import { Save } from 'lucide-react';

function SaveButton() {
  const [isSaving, setIsSaving] = useState(false);

  return (
    <ActionButton
      icon={Save}
      label="Save"
      isLoading={isSaving}  // Uses internal LoadingSpinner
      onClick={handleSave}
    />
  );
}
```

### Data Fetching

```typescript
function DataDisplay() {
  const { data, isLoading, error } = useQuery('data', fetchData);

  if (isLoading) {
    return (
      <LoadingSpinner 
        message="Fetching latest data..."
        size="default"
      />
    );
  }

  if (error) return <ErrorMessage error={error} />;
  return <DataTable data={data} />;
}
```

### Page Loading

```typescript
function PageWithLoading() {
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => setIsInitialLoad(false), 2000);
  }, []);

  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner 
          size="lg"
          message="Loading Claudio..."
        />
      </div>
    );
  }

  return <MainContent />;
}
```

### Form Submission

```typescript
function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await submitForm(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <LoadingSpinner size="sm" />
            Submitting...
          </>
        ) : (
          'Submit'
        )}
      </button>
    </form>
  );
}
```

## Performance

- **Bundle size**: ~0.8kb gzipped
- **Render cost**: Minimal (single SVG animation)
- **CPU usage**: Low (CSS-based animation)
- **Memory**: Negligible footprint

## Customization

### Custom Colors

```typescript
<LoadingSpinner 
  className="text-blue-500"  // Custom color
  message="Loading..."
/>
```

### Custom Positioning

```typescript
<LoadingSpinner 
  className="absolute top-4 right-4"  // Positioned spinner
  size="sm"
/>
```

### Custom Message Styling

```typescript
function CustomMessageSpinner() {
  return (
    <div className="flex items-center gap-2">
      <LoadingSpinner size="sm" />
      <span className="text-lg font-semibold text-primary">
        Please wait...
      </span>
    </div>
  );
}
```

## Best Practices

### Do ✅
- Use appropriate sizes for the context
- Provide meaningful loading messages when space allows
- Center spinners in their containers for prominent loading states
- Use `sm` size for inline loading indicators
- Show loading spinners immediately when operations begin

### Don't ❌
- Don't use multiple large spinners on the same page
- Don't animate spinners when `prefers-reduced-motion` is set
- Don't use spinners for operations that complete in < 500ms
- Don't nest interactive elements around spinners
- Don't use LoadingSpinner without proper loading state management

## Animation Guidelines

### Duration Standards
- **Short operations** (< 2s): No message needed
- **Medium operations** (2-10s): Include helpful message
- **Long operations** (> 10s): Consider progress indicator instead

### Message Guidelines
- Keep messages concise and helpful
- Use action-oriented language ("Loading data", "Saving changes")
- Avoid technical jargon in user-facing messages
- Consider internationalization for message text

## Related Components

- **[ActionButton](ActionButton.md)** - Has built-in loading spinner support
- **[StatusMessage](../molecules/StatusMessage.md)** - For more complex status feedback
- **Progress** - For operations with known duration/progress

---

*LoadingSpinner provides essential feedback for asynchronous operations throughout Claudio, maintaining user engagement during wait times with smooth, accessible animations.*