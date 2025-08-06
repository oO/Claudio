# Molecular Components

Molecules are composed of atoms and represent the first level of UI composition in our Atomic Design system. They combine multiple atomic components to create meaningful, reusable interface patterns.

## Design Principles

### Composition Over Configuration
Molecules combine atoms in well-defined patterns rather than creating monolithic components with countless configuration options.

### Single Purpose
Each molecule solves one specific UI problem and does it well, making them highly reusable across different contexts.

### Predictable APIs
Molecules follow consistent patterns for props, event handling, and composition, making them intuitive to use.

## Component Categories

### Search & Navigation
- **[SearchInput](SearchInput.md)** - Debounced search input with clear functionality
- **[PaginationControls](PaginationControls.md)** - Complete pagination interface
- **[DropdownSelector](DropdownSelector.md)** - Enhanced dropdown with search and filtering

### Action Patterns
- **[ActionButtonGroup](ActionButtonGroup.md)** - Grouped action buttons with consistent spacing
- **[StreamControls](StreamControls.md)** - Stream management controls (play, pause, stop)
- **[OutputControlsToolbar](OutputControlsToolbar.md)** - Output format and display controls

### Form Components
- **[HookConfigForm](HookConfigForm.md)** - Configuration form for webhook hooks
- **[ValidationFeedback](ValidationFeedback.md)** - Form validation feedback display
- **[CodeEditorToolbar](CodeEditorToolbar.md)** - Code editor action toolbar

### Data Selection
- **[TableSelector](TableSelector.md)** - Database table selection interface
- **[StatusMessage](StatusMessage.md)** - Status display with icon and message

### Content Display
- **[MessageHeader](MessageHeader.md)** - Chat message header with metadata
- **[MarkdownRenderer](MarkdownRenderer.md)** - Markdown content renderer
- **[ExecutionMetadata](ExecutionMetadata.md)** - Execution information display
- **[HookMetadata](HookMetadata.md)** - Hook configuration metadata

## Composition Patterns

### Atom Combination
Molecules combine 2-5 atoms to create cohesive functionality:

```typescript
// SearchInput combines Input + Button + Icons
function SearchInput() {
  return (
    <div className="relative">
      <SearchIcon />        {/* Atom */}
      <Input />            {/* Atom */}
      <ClearButton />      {/* Atom */}
    </div>
  );
}
```

### Event Handling
Molecules encapsulate complex interaction patterns:

```typescript
// ActionButtonGroup manages multiple button states
interface ActionButtonGroupProps {
  actions: ActionItem[];
  onAction: (actionId: string) => void;
  disabled?: string[];  // Centralized state management
}
```

### State Management
Molecules handle their own internal state while exposing controlled interfaces:

```typescript
// SearchInput manages debouncing internally
function SearchInput({ onSearch, debounceMs = 300 }) {
  const [localValue, setLocalValue] = useState("");
  const debouncedCallback = useDebouncedCallback(onSearch, debounceMs);
  
  // Internal state + external interface
}
```

## Usage Examples

### Basic Molecule Composition

```typescript
import { 
  SearchInput, 
  ActionButtonGroup, 
  PaginationControls 
} from '@/components/ui/molecules';

function DataBrowser() {
  const actions = [
    { id: 'add', label: 'Add Item', icon: Plus, onClick: handleAdd },
    { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: handleRefresh }
  ];

  return (
    <div className="space-y-4">
      {/* Search + Actions */}
      <div className="flex gap-4">
        <SearchInput onSearch={handleSearch} />
        <ActionButtonGroup actions={actions} />
      </div>

      {/* Data Display */}
      <DataDisplay data={filteredData} />

      {/* Pagination */}
      <PaginationControls
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
```

### Form Composition

```typescript
import { 
  HookConfigForm, 
  ValidationFeedback, 
  ActionButtonGroup 
} from '@/components/ui/molecules';

function WebhookEditor() {
  const [config, setConfig] = useState(initialConfig);
  const [validation, setValidation] = useState(null);

  const formActions = [
    { id: 'save', label: 'Save', icon: Save, onClick: handleSave },
    { id: 'test', label: 'Test', icon: TestTube, onClick: handleTest }
  ];

  return (
    <div className="space-y-6">
      <HookConfigForm
        config={config}
        onChange={setConfig}
        onValidationChange={setValidation}
      />

      <ValidationFeedback validation={validation} />

      <ActionButtonGroup 
        actions={formActions}
        disabled={validation?.hasErrors ? ['save'] : []}
      />
    </div>
  );
}
```

### Content Management

```typescript
import { 
  MessageHeader, 
  MarkdownRenderer, 
  ExecutionMetadata 
} from '@/components/ui/molecules';

function MessageDisplay({ message }) {
  return (
    <article className="space-y-3">
      <MessageHeader
        role={message.role}
        timestamp={message.timestamp}
        usage={message.usage}
      />

      <MarkdownRenderer content={message.content} />

      {message.execution && (
        <ExecutionMetadata
          duration={message.execution.duration}
          status={message.execution.status}
          metadata={message.execution.metadata}
        />
      )}
    </article>
  );
}
```

## Advanced Patterns

### Controlled vs Uncontrolled
Most molecules support both controlled and uncontrolled usage:

```typescript
// Controlled usage
<SearchInput 
  value={searchTerm}          // Controlled
  onSearch={setSearchTerm}
/>

// Uncontrolled usage  
<SearchInput 
  onSearch={handleSearch}     // Internal state management
  defaultValue=""
/>
```

### Compound Component Pattern
Some molecules use compound components for flexibility:

```typescript
// Flexible composition
<MessageHeader>
  <MessageHeader.Role role="assistant" />
  <MessageHeader.Timestamp timestamp={Date.now()} />
  <MessageHeader.Actions>
    <ActionButton icon={Copy} label="Copy" />
  </MessageHeader.Actions>
</MessageHeader>
```

### Render Props
Complex molecules may use render props for customization:

```typescript
<PaginationControls
  // ... props
  renderPageInfo={({ current, total }) => (
    <span className="custom-style">
      Page {current} of {total}
    </span>
  )}
/>
```

## Performance Considerations

### Memoization
Molecules use React.memo strategically:

```typescript
// Memoized for expensive computations
export const SearchInput = React.memo<SearchInputProps>(({ onSearch, ...props }) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison logic for optimization
});
```

### Debouncing
User input molecules implement debouncing:

```typescript
// SearchInput debounces search queries
const debouncedSearch = useDebouncedCallback(onSearch, debounceMs);
```

### Bundle Optimization
Molecules are designed for optimal tree-shaking:

```typescript
// Individual exports for tree-shaking
export { SearchInput } from './SearchInput';
export { ActionButtonGroup } from './ActionButtonGroup';
export type { SearchInputProps, ActionButtonGroupProps } from './types';
```

## Component Specifications

| Component | Atoms Used | Bundle Size | Primary Use Case |
|-----------|-----------|-------------|------------------|
| [SearchInput](SearchInput.md) | Input, Button, Icons | ~2.1kb | Search interfaces |
| [ActionButtonGroup](ActionButtonGroup.md) | ActionButton × N | ~1.8kb | Grouped actions |
| [PaginationControls](PaginationControls.md) | Button, Text | ~2.3kb | Data pagination |
| [MessageHeader](MessageHeader.md) | Icon, Text, Badge | ~1.9kb | Message metadata |
| [ValidationFeedback](ValidationFeedback.md) | Icon, Text | ~1.4kb | Form validation |
| [HookConfigForm](HookConfigForm.md) | Input, Select, Label | ~3.2kb | Configuration forms |
| [MarkdownRenderer](MarkdownRenderer.md) | Text, Code | ~4.1kb | Content display |
| [TableSelector](TableSelector.md) | Select, Badge | ~2.0kb | Database selection |

## Best Practices

### Composition Guidelines

#### Do ✅
- Combine 2-5 atoms for optimal complexity
- Keep molecule APIs simple and predictable
- Handle internal state management appropriately
- Provide both controlled and uncontrolled variants when useful
- Use consistent spacing and sizing patterns

#### Don't ❌
- Don't create molecules with 10+ configuration props
- Don't duplicate functionality available in atoms
- Don't couple molecules to specific business logic
- Don't create molecules that only wrap a single atom
- Don't ignore accessibility in composite components

### API Design

```typescript
// Good: Clear, focused interface
interface SearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
  size?: Size;
}

// Avoid: Too many configuration options
interface OverconfiguredProps {
  variant?: 'primary' | 'secondary' | 'tertiary';
  theme?: 'light' | 'dark' | 'auto';
  animation?: 'none' | 'fade' | 'slide' | 'bounce';
  // ... 20 more options
}
```

### State Management

```typescript
// Good: Internal state with external control
function SearchInput({ value, onSearch, defaultValue = "" }) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const controlledValue = value !== undefined ? value : internalValue;
  
  // Handle both controlled and uncontrolled patterns
}
```

## Accessibility Features

### Keyboard Navigation
All molecules support proper keyboard navigation:
- Tab order follows logical flow
- Arrow keys for navigation within components
- Enter/Space for activation
- Escape for cancellation

### Screen Reader Support
- Proper ARIA roles and properties
- Descriptive labels and announcements
- Status updates communicated appropriately
- Context provided for complex interactions

### Focus Management
- Focus indicators meet WCAG standards
- Focus trapping in modal-like molecules
- Logical focus restoration
- Skip links where appropriate

## Testing Patterns

### Unit Testing
```typescript
import { render, screen, userEvent } from '@testing-library/react';
import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  it('debounces search input', async () => {
    const onSearch = jest.fn();
    render(<SearchInput onSearch={onSearch} debounceMs={300} />);
    
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'test query');
    
    // Should not call immediately
    expect(onSearch).not.toHaveBeenCalled();
    
    // Should call after debounce
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('test query'));
  });
});
```

### Integration Testing
```typescript
describe('ActionButtonGroup', () => {
  it('handles action selection correctly', async () => {
    const onAction = jest.fn();
    const actions = [
      { id: 'save', label: 'Save', icon: Save },
      { id: 'delete', label: 'Delete', icon: Trash }
    ];
    
    render(<ActionButtonGroup actions={actions} onAction={onAction} />);
    
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onAction).toHaveBeenCalledWith('save');
  });
});
```

## Migration & Versioning

### Breaking Changes
When updating molecule APIs:

1. **Deprecation warnings** in previous version
2. **Migration guides** with code examples  
3. **Backward compatibility** for at least one major version
4. **Automated codemods** where possible

### Version Compatibility
```typescript
// v1.x (deprecated but supported)
<SearchInput onSearch={handleSearch} immediate={true} />

// v2.x (current)
<SearchInput onSearch={handleSearch} debounceMs={0} />
```

## Related Documentation

- **[Atoms Documentation](../atoms/)** - Building blocks used in molecules
- **[Organisms Documentation](../organisms/)** - Next composition level
- **[Form Patterns](../../patterns/FORMS.md)** - Form-specific molecule usage
- **[Component Creation Guide](../../guides/COMPONENT_CREATION.md)** - Creating new molecules

---

*Molecular components provide the perfect balance between reusability and functionality, composing atoms into meaningful interface patterns that power Claudio's user experience.*