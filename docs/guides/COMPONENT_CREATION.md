# Component Creation Guide

Learn how to create new components within Claudio's Atomic Design System. This guide covers architecture patterns, API design principles, and implementation best practices.

## Overview

Creating components in Claudio follows strict atomic design principles. Each component should serve a single purpose, compose well with others, and maintain consistency across the system.

## Architecture Principles

### Single Responsibility
Each component should have one clear purpose:

```typescript
// ✅ Good: Single responsibility
function ActionButton({ icon, label, onClick, isLoading }) {
  // Handles one specific type of button interaction
}

// ❌ Bad: Multiple responsibilities
function SuperButton({ 
  mode, // 'action', 'nav', 'submit', 'modal'
  type, // 'primary', 'secondary', 'ghost'
  size, // 'xs', 'sm', 'md', 'lg', 'xl'
  // ... 20 more configuration options
}) {
  // Trying to be everything to everyone
}
```

### Composition over Configuration
Build complex components by composing simpler ones:

```typescript
// ✅ Good: Composition
function MessageHeader({ role, timestamp, actions }) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <MessageRoleIcon role={role} />        {/* Atom */}
        <MessageTimestamp timestamp={timestamp} />  {/* Atom */}
      </div>
      {actions && (
        <ActionButtonGroup actions={actions} />    {/* Molecule */}
      )}
    </header>
  );
}

// ❌ Bad: Monolithic configuration
function ConfigurableHeader({
  showIcon, iconType, iconSize, iconColor,
  showTimestamp, timestampFormat, timestampColor,
  showActions, actionTypes, actionSizes,
  // ... endless configuration
}) {
  // Complex internal logic to handle all variants
}
```

## Component Categories

### When to Create Atoms

Create atoms for:
- **Basic UI elements** that can't be broken down further
- **Frequently reused** visual elements
- **Single-purpose** interactive elements

```typescript
// Good atom candidates
- Badge components (status, validation)
- Icon components (agent, role, status)  
- Input elements (specialized selectors)
- Visual indicators (loading, progress)
```

### When to Create Molecules

Create molecules for:
- **2-5 atoms** working together
- **Common interaction patterns**
- **Reusable form elements**
- **Composed UI patterns**

```typescript
// Good molecule candidates
- Search input (icon + input + clear button)
- Form field (label + input + validation)
- Button group (multiple action buttons)
- Status display (icon + badge + message)
```

### When to Create Organisms

Create organisms for:
- **Complete feature sections**
- **Complex data interactions**
- **Modal/dialog systems**
- **Multi-step workflows**

```typescript
// Good organism candidates
- Data tables with actions and pagination
- Full-featured editors (SQL, code)
- Configuration panels
- Chat message displays
```

## Implementation Process

### Step 1: Design the API

Start with the component's public interface:

```typescript
// Define clear, minimal props
interface NewComponentProps {
  // Required props first
  data: ComponentData;
  onChange: (data: ComponentData) => void;
  
  // Optional props with sensible defaults
  size?: "sm" | "default" | "lg";
  variant?: "default" | "secondary";
  disabled?: boolean;
  className?: string;
  
  // Avoid too many optional props
  // If you need more than 5-7 props, consider composition
}
```

### Step 2: Create the File Structure

```bash
# For atoms
src/components/ui/atoms/
├── NewAtomComponent.tsx
└── index.ts  # Add export

# For molecules  
src/components/ui/molecules/
├── NewMoleculeComponent.tsx
└── index.ts  # Add export

# For organisms
src/components/ui/organisms/
├── NewOrganismComponent.tsx
└── index.ts  # Add export
```

### Step 3: Implement the Component

```typescript
// NewAtomComponent.tsx
import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NewComponentProps {
  icon: LucideIcon;
  label: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export const NewComponent: React.FC<NewComponentProps> = ({
  icon: Icon,
  label,
  size = "default",
  className
}) => {
  const sizeClasses = {
    sm: "h-4 w-4 text-xs",
    default: "h-5 w-5 text-sm", 
    lg: "h-6 w-6 text-base"
  };

  return (
    <div className={cn(
      "flex items-center gap-2",
      sizeClasses[size],
      className
    )}>
      <Icon className={sizeClasses[size]} />
      <span>{label}</span>
    </div>
  );
};
```

### Step 4: Add to Index Exports

```typescript
// atoms/index.ts
export { NewComponent } from "./NewComponent";
export type { NewComponentProps } from "./NewComponent";
```

### Step 5: Create Documentation

```markdown
# NewComponent.md

Brief description of the component's purpose and use cases.

## Props
[TypeScript interface with descriptions]

## Usage Examples  
[Basic usage, advanced patterns, real-world examples]

## Accessibility Features
[Keyboard support, screen reader support, focus management]
```

## API Design Guidelines

### Props Naming

```typescript
// ✅ Good: Clear, consistent naming
interface ComponentProps {
  isLoading: boolean;        // Boolean prefix with "is/has/can"
  onItemClick: (item) => void;  // Event handlers with "on" prefix
  itemCount: number;         // Descriptive names
  selectedItems: Item[];     // Plural for arrays
  className?: string;        // Always optional
}

// ❌ Bad: Unclear, inconsistent naming
interface ComponentProps {
  loading: boolean;          // Unclear type
  click: (item) => void;     // Unclear purpose
  count: number;             // Too generic
  items: Item;               // Wrong type implication
  class: string;             // JavaScript reserved word
}
```

### Size and Variant Systems

Use consistent sizing and variant patterns:

```typescript
// Standard size system
type Size = "sm" | "default" | "lg";

// Standard variant system  
type Variant = "default" | "secondary" | "destructive" | "outline" | "ghost";

// Example implementation
interface ComponentProps {
  size?: Size;
  variant?: Variant;
}

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  default: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base"
};
```

### Event Handlers

Design event handlers for maximum flexibility:

```typescript
// ✅ Good: Provide relevant data and event
interface TableProps {
  onRowClick: (row: RowData, index: number, event: MouseEvent) => void;
  onRowEdit: (row: RowData) => void;
  onSelectionChange: (selectedRows: RowData[]) => void;
}

// ❌ Bad: Minimal or unclear data
interface TableProps {
  onClick: (event: MouseEvent) => void;  // What was clicked?
  onEdit: () => void;                    // Edit what?
  onSelect: (selected: boolean) => void;  // What was selected?
}
```

## Implementation Patterns

### State Management

```typescript
// Internal state for UI behavior
function SearchInput({ onSearch, debounceMs = 300 }) {
  const [localValue, setLocalValue] = useState("");
  
  // Debounced search
  const debouncedSearch = useDebouncedCallback(onSearch, debounceMs);
  
  const handleChange = (e) => {
    const value = e.target.value;
    setLocalValue(value);
    debouncedSearch(value);
  };

  return (
    <input 
      value={localValue}
      onChange={handleChange}
      // ... other props
    />
  );
}
```

### Controlled vs Uncontrolled

Support both patterns when appropriate:

```typescript
function FlexibleInput({ 
  value,           // Controlled
  defaultValue,    // Uncontrolled
  onChange 
}) {
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const handleChange = (e) => {
    const newValue = e.target.value;
    
    if (!isControlled) {
      setInternalValue(newValue);
    }
    
    onChange?.(newValue);
  };

  return (
    <input 
      value={currentValue}
      onChange={handleChange}
    />
  );
}
```

### Forwarding Refs

```typescript
import React, { forwardRef } from "react";

export const InputComponent = forwardRef<
  HTMLInputElement,
  InputComponentProps
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn("base-input-classes", className)}
      {...props}
    />
  );
});

InputComponent.displayName = "InputComponent";
```

## Styling Guidelines

### CSS Class Structure

```typescript
// Use consistent class naming
function ComponentExample({ size, variant, disabled, className }) {
  return (
    <div className={cn(
      // Base styles first
      "inline-flex items-center justify-center rounded-md font-medium transition-colors",
      
      // Size variants
      size === "sm" && "h-8 px-3 text-xs",
      size === "default" && "h-10 px-4 text-sm", 
      size === "lg" && "h-12 px-6 text-base",
      
      // Style variants
      variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90",
      variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      
      // State modifiers
      disabled && "pointer-events-none opacity-50",
      
      // Custom overrides last
      className
    )}
  >
    {/* Component content */}
  </div>
  );
}
```

### Responsive Design

```typescript
// Use responsive classes appropriately
function ResponsiveComponent() {
  return (
    <div className={cn(
      // Mobile first approach
      "flex flex-col gap-2",
      
      // Tablet and up
      "md:flex-row md:items-center md:gap-4",
      
      // Desktop and up  
      "lg:gap-6"
    )}>
      {/* Content */}
    </div>
  );
}
```

## Accessibility Implementation

### Semantic HTML

```typescript
// Use appropriate semantic elements
function SemanticComponent({ items, onItemSelect }) {
  return (
    <nav role="navigation" aria-label="Main navigation">
      <ul className="flex space-x-4">
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              onClick={() => onItemSelect(item)}
              className="nav-button"
              aria-current={item.isActive ? "page" : undefined}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

### ARIA Attributes

```typescript
function AccessibleComponent({ 
  isExpanded, 
  onToggle, 
  children,
  labelledBy 
}) {
  const contentId = useId();
  
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        aria-labelledby={labelledBy}
      >
        Toggle Content
      </button>
      
      <div
        id={contentId}
        role="region"
        aria-hidden={!isExpanded}
        className={isExpanded ? "block" : "hidden"}
      >
        {children}
      </div>
    </div>
  );
}
```

### Keyboard Navigation

```typescript
function KeyboardComponent({ items, onSelect }) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => Math.max(0, prev - 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => Math.min(items.length - 1, prev + 1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onSelect(items[focusedIndex]);
        break;
      case 'Escape':
        // Handle escape
        break;
    }
  };

  return (
    <div 
      role="listbox"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          role="option"
          aria-selected={index === focusedIndex}
          className={index === focusedIndex ? "focused" : ""}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
```

## Performance Optimization

### Memoization

```typescript
// Memoize components with expensive renders
export const ExpensiveComponent = React.memo<ExpensiveComponentProps>(
  ({ data, onProcess }) => {
    const processedData = useMemo(() => {
      return expensiveDataProcessing(data);
    }, [data]);

    return (
      <div>
        {processedData.map(item => (
          <ComplexItem key={item.id} item={item} />
        ))}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for optimization
    return prevProps.data === nextProps.data;
  }
);
```

### Lazy Loading

```typescript
// Lazy load heavy components
const HeavyEditor = lazy(() => import('./HeavyEditor'));

function ComponentWithLazyLoading({ showEditor }) {
  if (!showEditor) return null;
  
  return (
    <Suspense fallback={<LoadingSpinner message="Loading editor..." />}>
      <HeavyEditor />
    </Suspense>
  );
}
```

## Testing Strategy

### Unit Tests

```typescript
// Component.test.tsx
import { render, screen, userEvent } from '@testing-library/react';
import { NewComponent } from './NewComponent';

describe('NewComponent', () => {
  const defaultProps = {
    icon: TestIcon,
    label: 'Test Label'
  };

  it('renders with correct label', () => {
    render(<NewComponent {...defaultProps} />);
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const onClick = jest.fn();
    render(<NewComponent {...defaultProps} onClick={onClick} />);
    
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies size classes correctly', () => {
    render(<NewComponent {...defaultProps} size="lg" />);
    const element = screen.getByText('Test Label');
    expect(element).toHaveClass('h-6', 'w-6', 'text-base');
  });

  it('supports custom className', () => {
    render(<NewComponent {...defaultProps} className="custom-class" />);
    const element = screen.getByText('Test Label');
    expect(element).toHaveClass('custom-class');
  });
});
```

### Storybook Stories

```typescript
// Component.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { NewComponent } from './NewComponent';
import { TestIcon } from 'lucide-react';

const meta: Meta<typeof NewComponent> = {
  title: 'Atoms/NewComponent',
  component: NewComponent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: TestIcon,
    label: 'Default Component',
  },
};

export const Small: Story = {
  args: {
    ...Default.args,
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    ...Default.args, 
    size: 'lg',
  },
};
```

## Common Patterns

### Compound Components

```typescript
// Main component
function DataPanel({ children, className }) {
  return (
    <div className={cn("border rounded-lg", className)}>
      {children}
    </div>
  );
}

// Sub-components
DataPanel.Header = function DataPanelHeader({ children, className }) {
  return (
    <header className={cn("border-b p-4 font-semibold", className)}>
      {children}
    </header>
  );
};

DataPanel.Content = function DataPanelContent({ children, className }) {
  return (
    <div className={cn("p-4", className)}>
      {children}
    </div>
  );
};

// Usage
<DataPanel>
  <DataPanel.Header>Panel Title</DataPanel.Header>
  <DataPanel.Content>Panel content...</DataPanel.Content>
</DataPanel>
```

### Render Props

```typescript
function DataLoader({ 
  data, 
  isLoading, 
  error, 
  renderLoading, 
  renderError, 
  renderData 
}) {
  if (isLoading) {
    return renderLoading ? renderLoading() : <LoadingSpinner />;
  }
  
  if (error) {
    return renderError ? renderError(error) : <ErrorMessage error={error} />;
  }
  
  return renderData ? renderData(data) : <pre>{JSON.stringify(data, null, 2)}</pre>;
}
```

## Validation Checklist

Before submitting a new component:

- [ ] **Single Responsibility**: Component has one clear purpose
- [ ] **API Design**: Props are minimal, clear, and consistent
- [ ] **TypeScript**: Complete type definitions with JSDoc
- [ ] **Accessibility**: Keyboard navigation, screen reader support, focus management
- [ ] **Responsive**: Works on mobile, tablet, and desktop
- [ ] **Theme Support**: Adapts to light/dark themes
- [ ] **Documentation**: Complete documentation with examples
- [ ] **Tests**: Unit tests cover functionality and edge cases
- [ ] **Storybook**: Stories for all variants and states
- [ ] **Performance**: Memoized if necessary, no unnecessary re-renders

## Common Mistakes

### Don't Create Generic Wrappers

```typescript
// ❌ Bad: Generic wrapper with no added value
function MyButton({ children, ...props }) {
  return <Button {...props}>{children}</Button>;
}

// ✅ Good: Add specific value and purpose
function SaveButton({ onSave, isLoading, ...props }) {
  return (
    <ActionButton
      icon={Save}
      label="Save Changes"
      onClick={onSave}
      isLoading={isLoading}
      {...props}
    />
  );
}
```

### Don't Overcomplicate APIs

```typescript
// ❌ Bad: Too many options
interface BadComponentProps {
  mode?: 'a' | 'b' | 'c' | 'd';
  type?: 'x' | 'y' | 'z';
  variant?: '1' | '2' | '3' | '4';
  style?: 'modern' | 'classic' | 'minimal';
  // ... 10 more configuration props
}

// ✅ Good: Focused, clear purpose
interface GoodComponentProps {
  data: ComponentData;
  onSelect: (item: ComponentData) => void;
  size?: Size;
  className?: string;
}
```

### Don't Ignore Accessibility

```typescript
// ❌ Bad: No accessibility consideration
function BadComponent({ onClick }) {
  return <div onClick={onClick}>Click me</div>;
}

// ✅ Good: Proper accessibility
function GoodComponent({ onClick, label }) {
  return (
    <button 
      onClick={onClick}
      aria-label={label}
      className="focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {label}
    </button>
  );
}
```

---

*Follow these guidelines to create components that integrate seamlessly with Claudio's Atomic Design System while maintaining consistency, accessibility, and performance.*