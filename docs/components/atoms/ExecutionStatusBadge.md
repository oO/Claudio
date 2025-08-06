# ExecutionStatusBadge

A semantic status badge that displays the current state of code execution with appropriate icons, colors, and animations.

## Overview

ExecutionStatusBadge provides visual feedback about the state of running processes, scripts, or operations in Claudio. It uses color coding, icons, and optional animations to communicate status at a glance.

## Props

```typescript
interface ExecutionStatusBadgeProps {
  status: ExecutionStatus;       // Required: Current execution state
  animated?: boolean;            // Optional: Enable animations (default: true)
  size?: "sm" | "default" | "lg"; // Optional: Badge size
  className?: string;            // Optional: Additional CSS classes
}

type ExecutionStatus = 
  | "running"    // Process is currently executing
  | "completed"  // Process finished successfully  
  | "failed"     // Process encountered an error
  | "cancelled"  // Process was stopped by user
  | "idle";      // Process is waiting/not started
```

## Usage Examples

### Basic Usage

```typescript
import { ExecutionStatusBadge } from '@/components/ui/atoms';

function StatusDisplay({ execution }) {
  return (
    <ExecutionStatusBadge 
      status={execution.status}
    />
  );
}
```

### Different Status States

```typescript
function StatusExamples() {
  return (
    <div className="flex gap-2 flex-wrap">
      <ExecutionStatusBadge status="idle" />
      <ExecutionStatusBadge status="running" />
      <ExecutionStatusBadge status="completed" />
      <ExecutionStatusBadge status="failed" />
      <ExecutionStatusBadge status="cancelled" />
    </div>
  );
}
```

### Size Variations

```typescript
function SizeExamples() {
  return (
    <div className="space-y-2">
      <ExecutionStatusBadge status="running" size="sm" />
      <ExecutionStatusBadge status="running" size="default" />
      <ExecutionStatusBadge status="running" size="lg" />
    </div>
  );
}
```

### Disabled Animation

```typescript
function StaticBadge() {
  return (
    <ExecutionStatusBadge 
      status="running"
      animated={false}  // No spinning animation
    />
  );
}
```

## Status Configuration

Each status has a predefined configuration for consistent visual communication:

### Running
- **Icon**: PlayCircle (animated spin)
- **Color**: Green (`text-green-600`)
- **Background**: Green with transparency (`bg-green-500/10`)
- **Border**: Green with transparency (`border-green-500/50`)
- **Label**: "Running"

### Completed
- **Icon**: CheckCircle
- **Color**: Blue (`text-blue-600`)
- **Background**: Blue with transparency (`bg-blue-500/10`)
- **Border**: Blue with transparency (`border-blue-500/50`)
- **Label**: "Completed"

### Failed
- **Icon**: XCircle
- **Color**: Destructive red (`text-destructive`)
- **Background**: Destructive with transparency (`bg-destructive/10`)
- **Border**: Destructive with transparency (`border-destructive/50`)
- **Label**: "Failed"

### Cancelled
- **Icon**: AlertCircle
- **Color**: Yellow (`text-yellow-600`)
- **Background**: Yellow with transparency (`bg-yellow-500/10`)
- **Border**: Yellow with transparency (`border-yellow-500/50`)
- **Label**: "Cancelled"

### Idle
- **Icon**: Clock
- **Color**: Muted (`text-muted-foreground`)
- **Background**: Transparent
- **Border**: Outline variant
- **Label**: "Idle"

## Size Specifications

| Size | Padding | Text Size | Icon Size |
|------|---------|-----------|-----------|
| `sm` | `px-2 py-1` | `text-xs` | `h-3 w-3` |
| `default` | `px-2.5 py-1.5` | `text-xs` | `h-3.5 w-3.5` |
| `lg` | `px-3 py-2` | `text-sm` | `h-4 w-4` |

## Real-World Examples

### Agent Execution Monitor

```typescript
function AgentExecutionCard({ agent }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{agent.name}</CardTitle>
          <CardDescription>{agent.description}</CardDescription>
        </div>
        <ExecutionStatusBadge 
          status={agent.executionStatus}
          size="default"
        />
      </CardHeader>
      <CardContent>
        {agent.executionStatus === "running" && (
          <div className="mt-4">
            <LoadingSpinner size="sm" message="Processing..." />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Script Runner Interface

```typescript
function ScriptRunner({ script }) {
  const [status, setStatus] = useState<ExecutionStatus>("idle");

  const runScript = async () => {
    setStatus("running");
    
    try {
      await executeScript(script);
      setStatus("completed");
    } catch (error) {
      setStatus("failed");
    }
  };

  const stopScript = () => {
    setStatus("cancelled");
    // Stop execution logic
  };

  return (
    <div className="flex items-center gap-3">
      <span className="font-medium">{script.name}</span>
      
      <ExecutionStatusBadge 
        status={status}
        size="sm"
      />

      <div className="flex gap-2">
        <ActionButton
          icon={Play}
          label="Run"
          onClick={runScript}
          disabled={status === "running"}
          size="sm"
        />
        
        <ActionButton
          icon={Square}
          label="Stop"
          onClick={stopScript}
          disabled={status !== "running"}
          variant="outline"
          size="sm"
        />
      </div>
    </div>
  );
}
```

### Batch Operation Status

```typescript
function BatchOperationStatus({ operations }) {
  const getOverallStatus = (ops) => {
    const statuses = ops.map(op => op.status);
    
    if (statuses.includes("failed")) return "failed";
    if (statuses.includes("running")) return "running";
    if (statuses.includes("cancelled")) return "cancelled";
    if (statuses.every(s => s === "completed")) return "completed";
    
    return "idle";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3>Batch Operation</h3>
        <ExecutionStatusBadge 
          status={getOverallStatus(operations)}
        />
      </div>

      <div className="space-y-2">
        {operations.map((op, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <span>{op.name}</span>
            <ExecutionStatusBadge 
              status={op.status}
              size="sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Animation Behavior

### Running State Animation
When `status="running"` and `animated={true}` (default):
- Icon rotates continuously with `animate-spin` class
- Smooth 1-second rotation cycle
- Automatically respects `prefers-reduced-motion`

### Animation Control
```typescript
// Disable animations globally for reduced motion
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

<ExecutionStatusBadge 
  status="running"
  animated={!prefersReducedMotion}
/>
```

## Accessibility Features

### Screen Reader Support
- Status is communicated through both icon and text label
- Color changes are not the only way status is conveyed
- Proper contrast ratios for all status colors

### Keyboard Navigation
- Badge is not focusable (informational element)
- Status changes are announced to screen readers
- Works well within interactive containers

### Motion Sensitivity
- Respects `prefers-reduced-motion` system setting
- Animation can be disabled via `animated={false}` prop
- Static icons remain meaningful without animation

## Theme Support

### Light Theme
```css
.status-running { 
  color: rgb(22 163 74);      /* green-600 */
  background: rgb(34 197 94 / 0.1);  /* green-500/10 */
  border-color: rgb(34 197 94 / 0.5); /* green-500/50 */
}
```

### Dark Theme
```css
.dark .status-running {
  color: rgb(74 222 128);     /* green-400 */
  background: rgb(34 197 94 / 0.1);  /* green-500/10 */
  border-color: rgb(34 197 94 / 0.5); /* green-500/50 */
}
```

## Performance

- **Bundle size**: ~1.5kb gzipped
- **Render cost**: Low (single badge element)
- **Animation cost**: CSS-based, GPU accelerated
- **Memory usage**: Minimal

## Best Practices

### Do ✅
- Use consistent status values across your application
- Provide immediate status feedback when operations begin
- Use animations for long-running operations
- Group related status badges with consistent sizing
- Update status in real-time as operations progress

### Don't ❌
- Don't use custom status values outside the defined enum
- Don't animate badges for operations under 1 second
- Don't rely solely on color to convey status information
- Don't use large badges in dense interfaces
- Don't forget to handle error states appropriately

## Integration Examples

### With Data Fetching
```typescript
function DataStatus() {
  const { data, isLoading, error, isSuccess } = useQuery('data', fetchData);
  
  const getStatus = (): ExecutionStatus => {
    if (isLoading) return "running";
    if (error) return "failed";
    if (isSuccess) return "completed";
    return "idle";
  };

  return (
    <div className="flex items-center gap-2">
      <span>Data Sync</span>
      <ExecutionStatusBadge status={getStatus()} />
    </div>
  );
}
```

### With Form Submission
```typescript
function FormWithStatus() {
  const [submitStatus, setSubmitStatus] = useState<ExecutionStatus>("idle");

  const handleSubmit = async (formData) => {
    setSubmitStatus("running");
    
    try {
      await submitForm(formData);
      setSubmitStatus("completed");
      
      // Reset after success feedback
      setTimeout(() => setSubmitStatus("idle"), 3000);
    } catch (error) {
      setSubmitStatus("failed");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center justify-between mb-4">
        <h2>Contact Form</h2>
        <ExecutionStatusBadge status={submitStatus} size="sm" />
      </div>
      
      {/* Form fields */}
      
      <ActionButton
        icon={Send}
        label="Submit"
        type="submit"
        disabled={submitStatus === "running"}
      />
    </form>
  );
}
```

## Related Components

- **[ActionButton](ActionButton.md)** - Often used together for operation controls
- **[LoadingSpinner](LoadingSpinner.md)** - Complementary loading feedback
- **[StatusMessage](../molecules/StatusMessage.md)** - For detailed status information
- **Badge** - Base shadcn/ui badge component

---

*ExecutionStatusBadge provides essential visual feedback for operation states throughout Claudio, helping users understand the current status of their actions and system processes.*