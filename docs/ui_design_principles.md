# UI Design Principles

## Atomic Design Hierarchy

Components are organized in a strict hierarchy following Atomic Design methodology:

- **Atoms**: Basic building blocks (buttons, icons, badges, spinners)
- **Molecules**: Simple groups of atoms (search inputs, toolbars, form controls)
- **Organisms**: Complex sections (data tables, editors, modals, headers)

## Architecture

### File Structure
```
src/components/ui/
├── atoms/           # Single-purpose elements
├── molecules/       # Composed UI patterns  
├── organisms/       # Feature-rich components
└── index.ts         # Centralized exports
```

### Import Strategy
```typescript
// Centralized imports for optimal tree-shaking
import { ActionButton, LoadingSpinner } from '@/components/ui/atoms';
import { SearchInput, ActionButtonGroup } from '@/components/ui/molecules';
import { DataTable, SqlEditor } from '@/components/ui/organisms';
```

## Core Principles

1. **Single Responsibility** - Each component does one thing well
2. **Minimal DOM** - Eliminate unnecessary wrapper elements
3. **Composition Over Configuration** - Build complex UIs from simple pieces
4. **Predictable APIs** - Consistent prop patterns across components
5. **Performance First** - Tree-shakeable, optimized for bundle size

## UI Consistency Patterns

### Button System
- **Variants**: `default`, `outline`, `destructive`, `ghost`
- **Sizes**: `sm`, `default`, `lg`, `icon`
- **States**: Loading, disabled, consistent hover animations
- **Icons**: Uniform sizing (3x3, 4x4, 5x5) and positioning

### Form Controls
- **Sizing**: `sm`, `default`, `lg` across all input types
- **Validation**: Unified error/success/disabled states
- **Accessibility**: Required indicators, proper labeling
- **Interaction**: Debounced search (300ms), clear functionality

### Layout Patterns
- **Spacing**: Standard 6-unit padding, 2-unit gaps in action groups
- **Cards**: Consistent border radius, shadows, content hierarchy
- **Loading States**: Three size variants with optional descriptive text

## Component Development

### API Design
```typescript
// Good: Minimal, predictable props
interface ActionButtonProps {
  icon: LucideIcon;
  label: string;
  isLoading?: boolean;
  showLabel?: boolean;
  onClick?: () => void;
}

// Avoid: Too many variants, unclear purpose
interface OverComplexProps {
  type?: 'primary' | 'secondary' | 'tertiary' | 'quaternary';
  mode?: 'normal' | 'compact' | 'expanded' | 'minimal';
  // ... excessive options
}
```

### Development Flow
1. **Start with atoms** - Build smallest reusable unit
2. **Compose upward** - Combine atoms → molecules → organisms
3. **Type everything** - Complete TypeScript interfaces with JSDoc
4. **Export centrally** - Use index files for tree-shaking

## TypeScript Integration

- **Strong typing**: All prop interfaces exported
- **Variant types**: Consistent size and variant definitions
- **IntelliSense**: Full autocompletion support
- **Compile-time safety**: Prevents prop misuse

## Performance Benefits

- **Bundle optimization**: ~42kb gzipped, 100% tree-shakeable
- **Reduced complexity**: Large components split into focused pieces
- **Minimal re-renders**: Proper React patterns and dependencies
- **Optimized imports**: Components load only what they need

## Real-World Example

StorageTab refactoring demonstrated these principles:
- **Before**: 955-line monolithic component
- **After**: 15 focused components averaging ~60 lines each
- **Result**: Better maintainability, reusability, and consistent UI patterns

```typescript
// Clean composition using organisms
export const StorageTab: React.FC = () => (
  <div className="space-y-6">
    <DatabaseHeader
      tables={tables}
      selectedTable={selectedTable}
      onTableSelect={setSelectedTable}
    />
    <DataTable
      data={tableData}
      onEditRow={setEditingRow}
      onDeleteRow={setDeletingRow}
    />
  </div>
);
```

## Accessibility Standards

- **WCAG 2.1 AA compliance** throughout component library
- **Keyboard navigation** support for all interactive elements
- **Screen reader optimization** with proper ARIA labels
- **Focus management** for complex interactions
- **High contrast mode** compatibility

This atomic design system provides a scalable foundation for building consistent, maintainable UI components in Claudio while ensuring optimal performance and developer experience.