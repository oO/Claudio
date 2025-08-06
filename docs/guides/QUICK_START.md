# Quick Start Guide

Get up and running with Claudio's Atomic Design System in minutes. This guide covers installation, basic usage, and common patterns to help you build interfaces quickly and consistently.

## Installation

The component library is already integrated into Claudio. All components are available through centralized imports:

```typescript
// Import atoms, molecules, and organisms
import { ActionButton, LoadingSpinner } from '@/components/ui/atoms';
import { SearchInput, ActionButtonGroup } from '@/components/ui/molecules';
import { DataTable, SqlEditor } from '@/components/ui/organisms';

// Import types
import type { 
  ActionButtonProps, 
  SearchInputProps, 
  DataTableProps 
} from '@/components/ui/atoms';
```

## Basic Usage

### 1. Start with Atoms

Atoms are the basic building blocks. Use them for simple interface elements:

```typescript
import { ActionButton, LoadingSpinner, ExecutionStatusBadge } from '@/components/ui/atoms';
import { Save, Upload } from 'lucide-react';

function QuickExample() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('idle');

  const handleSave = async () => {
    setIsLoading(true);
    setStatus('running');
    
    try {
      await saveData();
      setStatus('completed');
    } catch (error) {
      setStatus('failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <ActionButton
        icon={Save}
        label="Save Changes"
        onClick={handleSave}
        isLoading={isLoading}
      />

      <ExecutionStatusBadge 
        status={status}
        animated={true}
      />

      {isLoading && (
        <LoadingSpinner 
          message="Saving your changes..." 
        />
      )}
    </div>
  );
}
```

### 2. Compose with Molecules

Molecules combine atoms for more complex interactions:

```typescript
import { SearchInput, ActionButtonGroup } from '@/components/ui/molecules';
import { Plus, RefreshCw, Filter } from 'lucide-react';

function DataBrowser() {
  const [searchTerm, setSearchTerm] = useState('');

  const toolbarActions = [
    { id: 'add', label: 'Add Item', icon: Plus, onClick: handleAdd },
    { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: handleRefresh },
    { id: 'filter', label: 'Filter', icon: Filter, onClick: handleFilter }
  ];

  return (
    <div className="space-y-4">
      {/* Search and Actions */}
      <div className="flex gap-4">
        <SearchInput
          placeholder="Search items..."
          onSearch={setSearchTerm}
          className="flex-1"
        />
        <ActionButtonGroup actions={toolbarActions} />
      </div>

      {/* Results would go here */}
      <div className="text-muted-foreground">
        {searchTerm ? `Searching for "${searchTerm}"...` : 'Enter a search term'}
      </div>
    </div>
  );
}
```

### 3. Build with Organisms

Organisms provide complete functionality:

```typescript
import { DataTable } from '@/components/ui/organisms';
import { ActionButtonGroup } from '@/components/ui/molecules';

function CompleteInterface() {
  const [tableData, setTableData] = useState(mockData);
  const [selectedRows, setSelectedRows] = useState([]);

  const bulkActions = [
    { 
      id: 'delete', 
      label: 'Delete Selected', 
      icon: Trash2, 
      onClick: handleBulkDelete,
      variant: 'destructive'
    },
    { 
      id: 'export', 
      label: 'Export Selected', 
      icon: Download, 
      onClick: handleBulkExport 
    }
  ];

  return (
    <div className="space-y-6">
      {/* Bulk Actions */}
      {selectedRows.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedRows.length} items selected
          </span>
          <ActionButtonGroup 
            actions={bulkActions}
            size="sm"
          />
        </div>
      )}

      {/* Data Table */}
      <DataTable
        data={tableData}
        onEditRow={handleEditRow}
        onDeleteRow={handleDeleteRow}
        onPageChange={handlePageChange}
        selectedRows={selectedRows}
        onSelectionChange={setSelectedRows}
      />
    </div>
  );
}
```

## Common Patterns

### Loading States

```typescript
function LoadingStateExample() {
  const { data, isLoading, error } = useQuery('data', fetchData);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <LoadingSpinner 
          size="lg"
          message="Loading your data..."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center space-y-4">
        <ExecutionStatusBadge status="failed" />
        <p className="text-muted-foreground">
          Failed to load data: {error.message}
        </p>
        <ActionButton
          icon={RefreshCw}
          label="Try Again"
          onClick={() => refetch()}
        />
      </div>
    );
  }

  return <DataDisplay data={data} />;
}
```

### Form Handling

```typescript
import { ValidationFeedback } from '@/components/ui/molecules';
import { HookTypeSelector } from '@/components/ui/atoms';

function QuickForm() {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Quick validation
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.type) newErrors.type = 'Type is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Submit logic
    try {
      await submitForm(formData);
    } catch (error) {
      setErrors({ submit: error.message });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={formData.name || ''}
          onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
        />
        {errors.name && (
          <ValidationFeedback type="error" message={errors.name} />
        )}
      </div>

      <div>
        <Label htmlFor="type">Type</Label>
        <HookTypeSelector
          value={formData.type}
          onValueChange={type => setFormData(prev => ({ ...prev, type }))}
        />
        {errors.type && (
          <ValidationFeedback type="error" message={errors.type} />
        )}
      </div>

      {errors.submit && (
        <ValidationFeedback type="error" message={errors.submit} />
      )}

      <ActionButton
        type="submit"
        icon={Save}
        label="Save"
      />
    </form>
  );
}
```

### Status Feedback

```typescript
function StatusFeedbackExample() {
  const [operations, setOperations] = useState([]);

  const startOperation = async (name) => {
    const id = Date.now().toString();
    const operation = { id, name, status: 'running', progress: 0 };
    
    setOperations(prev => [...prev, operation]);

    try {
      // Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setOperations(prev => prev.map(op => 
          op.id === id ? { ...op, progress: i } : op
        ));
      }

      setOperations(prev => prev.map(op => 
        op.id === id ? { ...op, status: 'completed' } : op
      ));
    } catch (error) {
      setOperations(prev => prev.map(op => 
        op.id === id ? { ...op, status: 'failed' } : op
      ));
    }
  };

  return (
    <div className="space-y-4">
      <ActionButton
        icon={Play}
        label="Start Operation"
        onClick={() => startOperation('Data Processing')}
      />

      <div className="space-y-2">
        {operations.map(operation => (
          <div key={operation.id} className="flex items-center gap-3 p-3 border rounded">
            <ExecutionStatusBadge 
              status={operation.status}
              size="sm"
            />
            
            <span className="flex-1 font-medium">
              {operation.name}
            </span>

            {operation.status === 'running' && (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                <span className="text-sm text-muted-foreground">
                  {operation.progress}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Component Import Patterns

### Tree-Shaking Optimized

```typescript
// ✅ Good: Import only what you need
import { ActionButton } from '@/components/ui/atoms/ActionButton';
import { SearchInput } from '@/components/ui/molecules/SearchInput';

// ✅ Also good: Grouped imports from index
import { ActionButton, LoadingSpinner } from '@/components/ui/atoms';
import { SearchInput, ValidationFeedback } from '@/components/ui/molecules';

// ❌ Avoid: Importing entire library
import * as UI from '@/components/ui';
```

### Type Imports

```typescript
// Import types separately for better tree-shaking
import type { 
  ActionButtonProps,
  ExecutionStatus,
  SearchInputProps 
} from '@/components/ui/atoms';

// Use in your component props
interface MyComponentProps {
  buttonProps: ActionButtonProps;
  status: ExecutionStatus;
  onSearch: SearchInputProps['onSearch'];
}
```

## Styling and Customization

### Using CSS Classes

```typescript
// All components accept className prop
<ActionButton
  icon={Save}
  label="Custom Styled Button"
  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
/>

<SearchInput
  onSearch={handleSearch}
  className="max-w-md border-2 border-primary"
  placeholder="Enhanced search..."
/>
```

### Theme Integration

```typescript
// Components automatically adapt to light/dark theme
function ThemedInterface() {
  return (
    <div className="space-y-4">
      {/* These will adapt to current theme */}
      <ExecutionStatusBadge status="running" />
      <LoadingSpinner message="Processing..." />
      
      {/* Custom theme integration */}
      <div className="bg-background border border-border rounded p-4">
        <ActionButton
          icon={Settings}
          label="Settings"
          className="text-foreground hover:bg-accent"
        />
      </div>
    </div>
  );
}
```

## Performance Tips

### Memoization

```typescript
// Memoize expensive calculations
const processedData = useMemo(() => 
  transformData(rawData), 
  [rawData]
);

// Memoize callbacks to prevent unnecessary re-renders
const handleSearch = useCallback((query: string) => {
  // Search logic
}, [dependencies]);

// Use with SearchInput
<SearchInput onSearch={handleSearch} />
```

### Lazy Loading

```typescript
// Lazy load heavy organisms
const SqlEditor = lazy(() => import('@/components/ui/organisms/SqlEditor'));

function DatabaseInterface() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading editor..." />}>
      <SqlEditor />
    </Suspense>
  );
}
```

## Common Gotchas

### Event Handling

```typescript
// ✅ Good: Use useCallback for event handlers
const handleClick = useCallback(() => {
  console.log('Clicked');
}, []);

<ActionButton onClick={handleClick} />

// ❌ Bad: Inline functions cause unnecessary re-renders
<ActionButton onClick={() => console.log('Clicked')} />
```

### State Updates

```typescript
// ✅ Good: Functional state updates
const [items, setItems] = useState([]);

const addItem = (item) => {
  setItems(prev => [...prev, item]);
};

// ❌ Bad: Direct state mutation
const addItem = (item) => {
  items.push(item);
  setItems(items);
};
```

### Accessibility

```typescript
// ✅ Good: Always provide accessible labels
<ActionButton
  icon={Settings}
  label="Open Settings"  // Always provide label
  showLabel={false}      // Can hide visually, but still accessible
/>

// ❌ Bad: No accessible label
<ActionButton icon={Settings} />  // Missing required label prop
```

## Next Steps

Now that you have the basics:

1. **Explore Components**: Browse the [component documentation](../components/) for detailed APIs
2. **Study Patterns**: Check out [design patterns](../patterns/) for complex scenarios
3. **Advanced Topics**: Read about [component creation](COMPONENT_CREATION.md) and [theming](THEMING.md)
4. **Accessibility**: Review our [accessibility guide](ACCESSIBILITY.md) for inclusive design

## Quick Reference

### Most Used Components

| Component | Import | Use Case |
|-----------|--------|----------|
| ActionButton | `@/components/ui/atoms` | Primary actions, form buttons |
| LoadingSpinner | `@/components/ui/atoms` | Loading states, async feedback |
| SearchInput | `@/components/ui/molecules` | Search interfaces |
| ValidationFeedback | `@/components/ui/molecules` | Form validation |
| DataTable | `@/components/ui/organisms` | Data display with actions |
| ExecutionStatusBadge | `@/components/ui/atoms` | Status indicators |

### Common Props

- **className**: Available on all components for custom styling
- **size**: Many components support `"sm" | "default" | "lg"` sizing
- **variant**: Style variants like `"default" | "secondary" | "destructive"`
- **disabled**: Disable interactive components
- **isLoading**: Show loading state (ActionButton, etc.)

---

*This quick start guide gets you building with Claudio's design system immediately. For deeper understanding, explore the detailed component documentation and pattern guides.*