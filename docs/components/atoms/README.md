# Atomic Components

Atoms are the basic building blocks of the Claudio design system. They are the smallest functional units that cannot be broken down further without losing their meaning. Each atom serves a single, well-defined purpose and can be combined to create more complex components.

## Design Principles

### Single Responsibility
Each atomic component has one clear purpose and does it well. This makes them highly reusable and predictable.

### Minimal DOM Structure
Atoms use the minimum DOM elements necessary to achieve their purpose, often being just a single element with appropriate styling.

### Consistent API Design
All atoms follow consistent patterns for props, sizing, variants, and styling customization.

## Component Categories

### Action Components
- **[ActionButton](ActionButton.md)** - Primary action button with icon and loading state
- **[RadioOption](RadioOption.md)** - Single radio button option for forms

### Status & Feedback
- **[ExecutionStatusBadge](ExecutionStatusBadge.md)** - Status badges for execution states
- **[ValidationStatusBadge](ValidationStatusBadge.md)** - Form validation feedback badges
- **[TableStatusBadge](TableStatusBadge.md)** - Database table status indicators
- **[DatabaseStatusIndicator](DatabaseStatusIndicator.md)** - Database connection status
- **[OutputFormatBadge](OutputFormatBadge.md)** - Output format type indicators

### Visual Elements
- **[AgentIcon](AgentIcon.md)** - Icons for different agent types
- **[EventIcon](EventIcon.md)** - Icons for system events
- **[MessageRoleIcon](MessageRoleIcon.md)** - Icons for message roles (user, assistant, system)
- **[LoadingSpinner](LoadingSpinner.md)** - Animated loading indicators
- **[ScrollIndicator](ScrollIndicator.md)** - Visual scroll position indicator

### Data Display
- **[ColumnHeader](ColumnHeader.md)** - Table column headers with type information
- **[MessageTimestamp](MessageTimestamp.md)** - Formatted message timestamps
- **[MessageUsageStats](MessageUsageStats.md)** - Token usage statistics display

### Form Elements
- **[HookTypeSelector](HookTypeSelector.md)** - Dropdown for selecting hook types
- **[ColorSwatch](ColorSwatch.md)** - Color picker swatch element

### Code Display
- **[CodeSyntaxHighlight](CodeSyntaxHighlight.md)** - Inline code syntax highlighting
- **[SyntaxHighlighter](SyntaxHighlighter.md)** - Block code syntax highlighting

## Common Patterns

### Sizing System
Most atoms support a consistent sizing system:

```typescript
type Size = "sm" | "default" | "lg" | "xl"?;
```

### Variant System
Many atoms support semantic variants:

```typescript
type Variant = "default" | "secondary" | "destructive" | "outline";
```

### Icon Integration
Icon-based components use Lucide React icons with consistent sizing:

```typescript
import { LucideIcon } from 'lucide-react';

interface IconProps {
  icon: LucideIcon;
  size?: Size;
}
```

## Usage Examples

### Basic Atom Usage

```typescript
import { 
  ActionButton, 
  LoadingSpinner, 
  ExecutionStatusBadge 
} from '@/components/ui/atoms';
import { Save } from 'lucide-react';

function ExampleUsage() {
  return (
    <div className="space-y-4">
      {/* Action Button */}
      <ActionButton
        icon={Save}
        label="Save Changes"
        isLoading={false}
        onClick={handleSave}
      />

      {/* Loading State */}
      <LoadingSpinner 
        size="default"
        message="Processing..."
      />

      {/* Status Badge */}
      <ExecutionStatusBadge
        status="running"
        animated={true}
      />
    </div>
  );
}
```

### Composition Example

```typescript
function StatusDisplay({ execution }) {
  return (
    <div className="flex items-center gap-2">
      <AgentIcon iconName={execution.agentType} size="sm" />
      <ExecutionStatusBadge status={execution.status} />
      {execution.loading && <LoadingSpinner size="sm" />}
    </div>
  );
}
```

## Import Strategy

### Individual Imports (Recommended)
```typescript
import { ActionButton } from '@/components/ui/atoms/ActionButton';
import { LoadingSpinner } from '@/components/ui/atoms/LoadingSpinner';
```

### Grouped Imports
```typescript
import { 
  ActionButton, 
  LoadingSpinner, 
  AgentIcon,
  ExecutionStatusBadge 
} from '@/components/ui/atoms';
```

### Type Imports
```typescript
import type { 
  ActionButtonProps,
  ExecutionStatus,
  AgentIconProps 
} from '@/components/ui/atoms';
```

## Customization

### Styling Override
All atoms accept a `className` prop for custom styling:

```typescript
<ActionButton
  icon={Save}
  label="Custom Style"
  className="bg-purple-500 hover:bg-purple-600"
/>
```

### Theme Integration
Atoms use CSS custom properties that respond to theme changes:

```typescript
// Automatically adapts to light/dark theme
<ExecutionStatusBadge status="completed" />
```

## Accessibility Features

### Keyboard Navigation
- All interactive atoms support keyboard navigation
- Focus states are clearly visible
- Tab order follows logical progression

### Screen Reader Support
- Semantic HTML elements where appropriate
- ARIA labels and descriptions
- Proper role attributes

### Color & Contrast
- WCAG 2.1 AA contrast compliance
- High contrast mode support
- Color is not the only way to convey meaning

## Performance

### Bundle Size
Atoms are designed for optimal tree-shaking:
- Average size: ~0.5-2kb per component
- No external dependencies except Lucide React
- CSS-in-JS optimized for minimal runtime

### Render Performance
- Memoized where beneficial
- No unnecessary re-renders
- Optimized prop diffing

## Component List

| Component | Purpose | Size | Key Features |
|-----------|---------|------|--------------|
| [ActionButton](ActionButton.md) | Primary actions | ~1.2kb | Icon, loading, variants |
| [LoadingSpinner](LoadingSpinner.md) | Loading states | ~0.8kb | Sizes, messages, animations |
| [AgentIcon](AgentIcon.md) | Agent identification | ~1.0kb | Dynamic icons, fallbacks |
| [ExecutionStatusBadge](ExecutionStatusBadge.md) | Status display | ~1.5kb | Animated, colored states |
| [ValidationStatusBadge](ValidationStatusBadge.md) | Form validation | ~1.2kb | Error, success, warning states |
| [ColumnHeader](ColumnHeader.md) | Table headers | ~1.1kb | Type info, sort indicators |
| [MessageTimestamp](MessageTimestamp.md) | Time display | ~0.9kb | Relative time, formatting |
| [ColorSwatch](ColorSwatch.md) | Color selection | ~0.7kb | RGB, HSL support |
| [ScrollIndicator](ScrollIndicator.md) | Scroll position | ~0.8kb | Progress visualization |
| [CodeSyntaxHighlight](CodeSyntaxHighlight.md) | Inline code | ~1.3kb | Language detection |

---

*For detailed documentation on each component, click the component name above or navigate to the individual component documentation files.*