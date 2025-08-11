# Component Debug Labels - Implementation Notes

## Debug Label Positioning Pattern

All components in the projects and sessions folders use the `DebugLabel` component for debugging purposes. To ensure proper positioning, the following pattern must be followed:

### Required Pattern
```jsx
// Component container MUST have position: relative for proper debug label positioning
return (
  <div className={cn("existing-classes relative", className)}>
    <DebugLabel label="ComponentName" />
    {/* rest of component content */}
  </div>
);
```

### Why This Pattern Is Required

1. **DebugLabel CSS**: Uses `position: absolute; top: 0.5rem; right: 0;`
2. **Without relative container**: All debug labels position relative to the same ancestor, causing them to stack/overlap
3. **With relative container**: Each debug label positions relative to its own component boundary
4. **Tool widgets work correctly**: They already had positioned containers

### Implementation Status

✅ **Projects Components** - All have `relative` positioning:
- ProjectDetail.tsx
- ProjectSessionTab.tsx 
- ProjectMemoriesTab.tsx
- ProjectAgentsTab.tsx
- ProjectToolsTab.tsx
- ProjectList.tsx
- ProjectAgentsDropdown.tsx
- ProjectSettings.tsx
- ProjectDeleteDialog.tsx (conditional rendering)

✅ **Sessions Components** - All 23 components have `relative` positioning:
- All session components in `/src/components/sessions/`

### Guidelines for New Components

When adding a new component with DebugLabel:

1. **Import**: `import { DebugLabel } from "@/components/ui/atoms";`
2. **Container**: Ensure the container element has `relative` in its className
3. **Placement**: Place `<DebugLabel label="ComponentName" />` as first child in return
4. **Conditional modals**: Only show DebugLabel when the modal/dialog is open: `{open && <DebugLabel label="ComponentName" />}`

### CSS Reference

```css
.debug-label {
    position: absolute;
    top: 0.5rem;
    right: 0;
    z-index: 10;
    /* styling... */
}
```

The debug label appears in the top-right corner of each component's content area, providing clear visual identification of which component is rendering what content.

## Debugging Tips

- Debug labels only show when debug mode is enabled via `useDebug()` hook
- Each label shows the exact component name responsible for the visible content
- Labels position relative to their component's boundary, not globally
- Modal/conditional components should only show labels when actually visible