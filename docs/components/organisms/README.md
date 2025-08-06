# Organism Components

Organisms are complex, feature-rich components that combine multiple molecules and atoms to create complete interface sections. They represent the highest level of composition in our Atomic Design system and often correspond to distinct areas of functionality within Claudio.

## Design Principles

### Feature Completeness
Organisms provide complete functionality for specific use cases, often including their own state management, data fetching, and interaction patterns.

### Composition Architecture
Organisms compose multiple molecules and atoms in sophisticated ways, creating rich interactive experiences while maintaining clean APIs.

### Domain Specificity
Unlike atoms and molecules which are generic, organisms often embody domain-specific knowledge about Claudio's functionality.

## Component Categories

### Data Management
- **[DataTable](DataTable.md)** - Complete data table with pagination, actions, and tooltips
- **[DatabaseHeader](DatabaseHeader.md)** - Database connection and status management
- **[SqlEditor](SqlEditor.md)** - Full-featured SQL editor with execution and results
- **[RowEditor](RowEditor.md)** - Form-based database row editing interface

### Content Display
- **[MessageContent](MessageContent.md)** - Complete message rendering with role-specific formatting
- **[OutputViewer](OutputViewer.md)** - Multi-format output display with controls
- **[ToolCallRenderer](ToolCallRenderer.md)** - Tool call visualization and interaction
- **[ToolResultRenderer](ToolResultRenderer.md)** - Tool execution results display

### Interactive Interfaces
- **[ExecutionControlPanel](ExecutionControlPanel.md)** - Agent execution monitoring and control
- **[HookMatcherEditor](HookMatcherEditor.md)** - Visual webhook pattern editor
- **[DirectCommandEditor](DirectCommandEditor.md)** - Command-line interface editor
- **[TemplateSelector](TemplateSelector.md)** - Template browsing and selection interface

### Modal & Dialog Systems
- **[ConfirmationDialog](ConfirmationDialog.md)** - Confirmation dialogs with context
- **[ColorPickerDialog](ColorPickerDialog.md)** - Full-featured color selection modal
- **[ToolPickerDialog](ToolPickerDialog.md)** - Tool selection and configuration modal
- **[FullscreenOutputModal](FullscreenOutputModal.md)** - Full-screen output viewing

## Composition Patterns

### Multi-Layer Architecture
Organisms combine all levels of atomic design:

```typescript
// DataTable organism structure
function DataTable() {
  return (
    <Card>                        {/* Layout container */}
      <table>
        <thead>
          <ColumnHeader />        {/* Atom */}
        </thead>
        <tbody>
          {/* Row data with actions */}
        </tbody>
      </table>
      <PaginationControls />      {/* Molecule */}
    </Card>
  );
}
```

### State Management
Organisms manage complex internal state:

```typescript
interface DataTableState {
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  selectedRows: Set<string>;
  editingRow: RowData | null;
}
```

### Event Orchestration
Organisms coordinate events between child components:

```typescript
function SqlEditor() {
  // Coordinates between editor, results, and controls
  const handleExecute = async (query: string) => {
    setIsExecuting(true);
    const results = await executeQuery(query);
    setQueryResults(results);
    setIsExecuting(false);
  };

  return (
    <>
      <CodeEditor onExecute={handleExecute} />
      <ExecutionControls isExecuting={isExecuting} />
      <ResultsDisplay results={queryResults} />
    </>
  );
}
```

## Usage Examples

### Database Management Interface

```typescript
import { 
  DatabaseHeader,
  DataTable,
  SqlEditor,
  RowEditor 
} from '@/components/ui/organisms';

function DatabaseManager() {
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [editingRow, setEditingRow] = useState(null);

  return (
    <div className="h-full flex flex-col">
      <DatabaseHeader 
        onTableSelect={setSelectedTable}
        onConnectionChange={handleConnectionChange}
      />

      {selectedTable && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <DataTable
              data={tableData}
              onEditRow={setEditingRow}
              onDeleteRow={handleDeleteRow}
              onPageChange={handlePageChange}
            />
            
            <SqlEditor
              defaultQuery={`SELECT * FROM ${selectedTable}`}
              onQueryResults={setTableData}
            />
          </div>

          {editingRow && (
            <RowEditor
              row={editingRow}
              onSave={handleSaveRow}
              onCancel={() => setEditingRow(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
```

### Agent Chat Interface

```typescript
import { 
  MessageContent,
  ToolCallRenderer,
  ToolResultRenderer,
  OutputViewer 
} from '@/components/ui/organisms';

function ChatInterface({ messages }) {
  return (
    <div className="space-y-6">
      {messages.map(message => (
        <div key={message.id} className="space-y-4">
          <MessageContent
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
          />

          {message.toolCalls?.map(toolCall => (
            <ToolCallRenderer
              key={toolCall.id}
              toolCall={toolCall}
              onRerun={handleRerunTool}
            />
          ))}

          {message.toolResults?.map(result => (
            <ToolResultRenderer
              key={result.id}
              result={result}
              onViewFullscreen={handleViewFullscreen}
            />
          ))}

          {message.outputs && (
            <OutputViewer
              outputs={message.outputs}
              format="auto"
              allowFullscreen={true}
            />
          )}
        </div>
      ))}
    </div>
  );
}
```

### Workflow Configuration

```typescript
import { 
  HookMatcherEditor,
  TemplateSelector,
  ExecutionControlPanel,
  ConfirmationDialog 
} from '@/components/ui/organisms';

function WorkflowEditor({ workflow }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="space-y-8">
      <TemplateSelector
        selectedTemplate={workflow.template}
        onTemplateSelect={handleTemplateSelect}
        category="workflow"
      />

      <HookMatcherEditor
        patterns={workflow.hookPatterns}
        onChange={handlePatternsChange}
        testData={testHookData}
      />

      <ExecutionControlPanel
        status={workflow.status}
        onStart={handleStartWorkflow}
        onStop={handleStopWorkflow}
        onPause={handlePauseWorkflow}
        metrics={workflow.metrics}
      />

      <div className="flex justify-between">
        <ActionButton
          icon={Save}
          label="Save Workflow"
          onClick={handleSave}
          isLoading={isSaving}
        />

        <ActionButton
          icon={Trash2}
          label="Delete Workflow"
          variant="destructive"
          onClick={() => setShowDeleteConfirm(true)}
        />
      </div>

      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Workflow"
        description="Are you sure you want to delete this workflow? This action cannot be undone."
        onConfirm={handleDeleteWorkflow}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
```

## Advanced Patterns

### Compound Component Architecture

```typescript
// Complex organisms may use compound components
<SqlEditor>
  <SqlEditor.Toolbar>
    <SqlEditor.RunButton />
    <SqlEditor.FormatButton />
    <SqlEditor.SaveButton />
  </SqlEditor.Toolbar>
  
  <SqlEditor.Editor
    language="sql"
    theme="dark"
    onChange={handleQueryChange}
  />
  
  <SqlEditor.Results>
    <SqlEditor.ResultsHeader />
    <SqlEditor.ResultsTable />
    <SqlEditor.ResultsFooter />
  </SqlEditor.Results>
</SqlEditor>
```

### Provider Pattern

```typescript
// Some organisms provide context to descendants
<DataTableProvider
  data={tableData}
  onSort={handleSort}
  onFilter={handleFilter}
>
  <DataTableToolbar />
  <DataTable />
  <DataTablePagination />
</DataTableProvider>
```

### Render Props Pattern

```typescript
<OutputViewer
  data={outputData}
  renderHeader={({ format, itemCount }) => (
    <CustomHeader format={format} count={itemCount} />
  )}
  renderItem={({ item, index }) => (
    <CustomOutputItem item={item} index={index} />
  )}
  renderEmpty={() => (
    <EmptyState message="No output available" />
  )}
/>
```

## Performance Considerations

### Code Splitting
Large organisms should be code-split:

```typescript
// Lazy load heavy organisms
const SqlEditor = lazy(() => import('./SqlEditor'));
const OutputViewer = lazy(() => import('./OutputViewer'));

function DatabaseInterface() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading editor..." />}>
      <SqlEditor />
    </Suspense>
  );
}
```

### Memoization Strategies

```typescript
// Memo organisms with expensive renders
export const DataTable = React.memo<DataTableProps>(({ data, ...props }) => {
  // Expensive data processing
  const processedData = useMemo(() => 
    processTableData(data), 
    [data]
  );

  return <ComplexTable data={processedData} {...props} />;
}, arePropsEqual);
```

### Virtual Scrolling
For large datasets:

```typescript
// Use virtual scrolling for performance
function LargeDataTable({ data }) {
  return (
    <VirtualizedTable
      height={400}
      rowCount={data.length}
      rowHeight={32}
      renderRow={({ index, style }) => (
        <div style={style}>
          <TableRow data={data[index]} />
        </div>
      )}
    />
  );
}
```

## Component Specifications

| Component | Complexity | Bundle Size | Primary Domain |
|-----------|------------|-------------|----------------|
| [DataTable](DataTable.md) | High | ~8.2kb | Database management |
| [SqlEditor](SqlEditor.md) | Very High | ~15.4kb | SQL development |
| [MessageContent](MessageContent.md) | Medium | ~4.7kb | Chat/messaging |
| [OutputViewer](OutputViewer.md) | High | ~6.9kb | Data visualization |
| [ExecutionControlPanel](ExecutionControlPanel.md) | Medium | ~3.8kb | Process control |
| [HookMatcherEditor](HookMatcherEditor.md) | High | ~7.1kb | Configuration |
| [ConfirmationDialog](ConfirmationDialog.md) | Low | ~2.3kb | User confirmation |
| [ColorPickerDialog](ColorPickerDialog.md) | Medium | ~4.5kb | Color selection |

## State Management Patterns

### Internal State
```typescript
// Simple internal state for UI behavior
function DataTable() {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  
  // Component manages its own interaction state
}
```

### External State Integration
```typescript
// Integration with external state managers
function SqlEditor({ query, onQueryChange, results, onExecute }) {
  // Controlled by parent state
  return (
    <CodeEditor
      value={query}
      onChange={onQueryChange}
      onExecute={onExecute}
    />
  );
}
```

### Context-Based State
```typescript
// Context for complex state sharing
const SqlEditorContext = createContext();

function SqlEditorProvider({ children }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);

  return (
    <SqlEditorContext.Provider value={{
      query, setQuery,
      results, setResults,
      isExecuting, setIsExecuting
    }}>
      {children}
    </SqlEditorContext.Provider>
  );
}
```

## Accessibility Standards

### Complex Navigation
- Logical tab order through complex interfaces
- Arrow key navigation within data structures
- Escape key handling for modal dismissal

### Screen Reader Support
- Proper heading structure (h1, h2, h3)
- ARIA landmarks for major sections
- Live regions for dynamic content updates
- Descriptive labels for complex interactions

### Keyboard Shortcuts
Many organisms support keyboard shortcuts:

```typescript
// SqlEditor keyboard shortcuts
useKeyboardShortcuts([
  { key: 'Ctrl+Enter', action: executeQuery },
  { key: 'Ctrl+S', action: saveQuery },
  { key: 'Ctrl+/', action: toggleComment },
  { key: 'F5', action: refreshResults }
]);
```

## Testing Strategies

### Integration Testing
```typescript
describe('DataTable', () => {
  it('handles complete data workflow', async () => {
    const mockData = createMockTableData();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    render(
      <DataTable 
        data={mockData}
        onEditRow={onEdit}
        onDeleteRow={onDelete}
      />
    );

    // Test sorting
    await userEvent.click(screen.getByText('Name'));
    expect(screen.getByText('Sort by Name')).toBeInTheDocument();

    // Test row actions
    await userEvent.click(screen.getByLabelText('Edit row 1'));
    expect(onEdit).toHaveBeenCalledWith(mockData.rows[0]);

    // Test pagination
    await userEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
  });
});
```

### Component Testing
```typescript
describe('SqlEditor', () => {
  it('executes queries and displays results', async () => {
    const mockExecute = jest.fn().mockResolvedValue(mockResults);
    
    render(
      <SqlEditor 
        onExecute={mockExecute}
        defaultQuery="SELECT * FROM users"
      />
    );

    const executeButton = screen.getByRole('button', { name: /execute/i });
    await userEvent.click(executeButton);

    expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM users');
    
    await waitFor(() => {
      expect(screen.getByText('Results')).toBeInTheDocument();
      expect(screen.getByText('3 rows returned')).toBeInTheDocument();
    });
  });
});
```

### Visual Testing
```typescript
// Storybook stories for visual testing
export default {
  title: 'Organisms/DataTable',
  component: DataTable,
  parameters: {
    viewport: {
      viewports: INITIAL_VIEWPORTS
    }
  }
};

export const Default = {
  args: {
    data: mockTableData,
    onEditRow: action('onEditRow'),
    onDeleteRow: action('onDeleteRow')
  }
};

export const Loading = {
  args: {
    ...Default.args,
    data: { ...mockTableData, rows: [], isLoading: true }
  }
};

export const Empty = {
  args: {
    ...Default.args,
    data: { ...mockTableData, rows: [] }
  }
};
```

## Best Practices

### Design Guidelines

#### Do ✅
- Compose from existing molecules and atoms
- Provide complete functionality for specific use cases
- Handle loading and error states appropriately
- Implement proper keyboard navigation
- Use semantic HTML structure
- Optimize for performance with large datasets

#### Don't ❌
- Don't create organisms that are too generic (use molecules instead)
- Don't bypass the atomic design hierarchy
- Don't ignore accessibility in complex interfaces
- Don't create organisms with unclear boundaries
- Don't duplicate functionality available in smaller components

### API Design
```typescript
// Good: Clear, domain-specific interface
interface SqlEditorProps {
  query?: string;
  onQueryChange?: (query: string) => void;
  onExecute?: (query: string) => Promise<QueryResult>;
  readOnly?: boolean;
  schema?: DatabaseSchema;
}

// Avoid: Too many generic configuration options
interface BadOrganism {
  config?: any;
  options?: Record<string, any>;
  customRenderer?: (data: any) => ReactNode;
  // ... unclear purpose
}
```

## Related Documentation

- **[Molecules Documentation](../molecules/)** - Components used within organisms
- **[Atoms Documentation](../atoms/)** - Base building blocks
- **[Design Patterns](../../patterns/)** - Common usage patterns
- **[Performance Guide](../../guides/PERFORMANCE.md)** - Optimization strategies

---

*Organism components represent the pinnacle of our Atomic Design system, providing complete, feature-rich interfaces that make Claudio powerful and intuitive to use.*