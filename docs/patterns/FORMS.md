# Form Patterns

This guide covers form design patterns using Claudio's Atomic Design components, focusing on composition strategies, validation patterns, and accessibility best practices.

## Overview

Forms in Claudio are built using a combination of atoms, molecules, and organisms to create intuitive, accessible, and maintainable form interfaces. Our form patterns emphasize progressive enhancement, clear validation feedback, and optimal user experience.

## Form Architecture

### Component Hierarchy

```typescript
// Complete form structure using atomic design
<form>                              // HTML form element
  <FormSection>                     // Organism: Logical grouping
    <FormField>                     // Molecule: Label + Input + Validation
      <Label />                     // Atom: Field label
      <Input />                     // Atom: Input element  
      <ValidationFeedback />        // Molecule: Error/success display
    </FormField>
  </FormSection>
  
  <FormActions>                     // Molecule: Action button group
    <ActionButton />                // Atom: Submit/cancel buttons
  </FormActions>
</form>
```

### Basic Form Pattern

```typescript
import { 
  ActionButton,
  ValidationStatusBadge 
} from '@/components/ui/atoms';

import { 
  ValidationFeedback,
  ActionButtonGroup 
} from '@/components/ui/molecules';

function BasicForm() {
  const [formData, setFormData] = useState({});
  const [validation, setValidation] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const actions = [
    { 
      id: 'submit', 
      label: 'Save Changes', 
      icon: Save, 
      onClick: handleSubmit 
    },
    { 
      id: 'cancel', 
      label: 'Cancel', 
      icon: X, 
      onClick: handleCancel,
      variant: 'outline' 
    }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Project Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className={validation.name?.error ? 'border-destructive' : ''}
          />
          {validation.name && (
            <ValidationFeedback 
              type={validation.name.type}
              message={validation.name.message}
            />
          )}
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Optional project description..."
          />
        </div>
      </div>

      <ActionButtonGroup 
        actions={actions}
        disabled={isSubmitting ? ['submit'] : []}
      />
    </form>
  );
}
```

## Validation Patterns

### Real-Time Validation

```typescript
import { ValidationFeedback } from '@/components/ui/molecules';
import { ValidationStatusBadge } from '@/components/ui/atoms';

function ValidatedInput({ 
  label, 
  value, 
  onChange, 
  validator, 
  required = false 
}) {
  const [validation, setValidation] = useState(null);
  const [touched, setTouched] = useState(false);

  const validateField = useCallback(
    debounce(async (value) => {
      if (!touched) return;
      
      try {
        await validator(value);
        setValidation({ type: 'success', message: 'Valid' });
      } catch (error) {
        setValidation({ type: 'error', message: error.message });
      }
    }, 300),
    [validator, touched]
  );

  useEffect(() => {
    validateField(value);
  }, [value, validateField]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={label}>{label}</Label>
        {required && <span className="text-destructive">*</span>}
        {touched && validation && (
          <ValidationStatusBadge 
            status={validation.type}
            size="sm"
          />
        )}
      </div>
      
      <Input
        id={label}
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setTouched(true);
        }}
        onBlur={() => setTouched(true)}
        className={cn(
          touched && validation?.type === 'error' && 'border-destructive',
          touched && validation?.type === 'success' && 'border-green-500'
        )}
      />
      
      {touched && validation && (
        <ValidationFeedback 
          type={validation.type}
          message={validation.message}
        />
      )}
    </div>
  );
}
```

### Form-Level Validation

```typescript
import { HookConfigForm } from '@/components/ui/organisms';

function WebhookConfigurationForm() {
  const [config, setConfig] = useState(defaultConfig);
  const [formValidation, setFormValidation] = useState({});
  
  const validateForm = (data) => {
    const errors = {};
    
    // URL validation
    if (!data.url || !isValidURL(data.url)) {
      errors.url = { type: 'error', message: 'Valid URL is required' };
    }
    
    // Method validation
    if (!data.method) {
      errors.method = { type: 'error', message: 'HTTP method is required' };
    }
    
    // Headers validation
    if (data.headers) {
      try {
        JSON.parse(data.headers);
      } catch {
        errors.headers = { type: 'error', message: 'Invalid JSON format' };
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };

  const handleConfigChange = (newConfig) => {
    setConfig(newConfig);
    
    // Validate on change
    const validation = validateForm(newConfig);
    setFormValidation(validation.errors);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validation = validateForm(config);
    if (!validation.isValid) {
      setFormValidation(validation.errors);
      return;
    }

    try {
      await saveWebhookConfig(config);
      // Success handling
    } catch (error) {
      // Error handling
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <HookConfigForm
        config={config}
        onChange={handleConfigChange}
        validation={formValidation}
      />
      
      <div className="flex justify-end gap-2">
        <ActionButton
          type="submit"
          icon={Save}
          label="Save Configuration"
          disabled={Object.keys(formValidation).length > 0}
        />
      </div>
    </form>
  );
}
```

## Complex Form Patterns

### Multi-Step Forms

```typescript
import { ActionButtonGroup } from '@/components/ui/molecules';
import { ExecutionStatusBadge } from '@/components/ui/atoms';

function MultiStepForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [completedSteps, setCompletedSteps] = useState(new Set());

  const steps = [
    { id: 'basic', label: 'Basic Info', component: BasicInfoStep },
    { id: 'config', label: 'Configuration', component: ConfigStep },
    { id: 'review', label: 'Review', component: ReviewStep }
  ];

  const getStepStatus = (stepIndex) => {
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'running';
    return 'idle';
  };

  const navigationActions = [
    {
      id: 'back',
      label: 'Back',
      icon: ChevronLeft,
      onClick: () => setCurrentStep(prev => Math.max(0, prev - 1)),
      variant: 'outline'
    },
    {
      id: 'next',
      label: currentStep === steps.length - 1 ? 'Submit' : 'Next',
      icon: currentStep === steps.length - 1 ? Check : ChevronRight,
      onClick: handleNext
    }
  ];

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <div className="flex items-center justify-center space-x-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center space-x-2">
            <ExecutionStatusBadge 
              status={getStepStatus(index)}
              size="sm"
            />
            <span className={cn(
              "text-sm font-medium",
              index === currentStep && "text-primary",
              index < currentStep && "text-muted-foreground"
            )}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* Current Step Content */}
      <div className="min-h-[400px]">
        {React.createElement(steps[currentStep].component, {
          data: formData,
          onChange: setFormData,
          onValidation: handleStepValidation
        })}
      </div>

      {/* Navigation */}
      <ActionButtonGroup 
        actions={navigationActions}
        disabled={[
          currentStep === 0 ? 'back' : null,
          !isCurrentStepValid ? 'next' : null
        ].filter(Boolean)}
      />
    </div>
  );
}
```

### Dynamic Form Fields

```typescript
import { ActionButton } from '@/components/ui/atoms';
import { ValidationFeedback } from '@/components/ui/molecules';

function DynamicFieldsForm() {
  const [fields, setFields] = useState([{ id: 1, key: '', value: '' }]);

  const addField = () => {
    const newId = Math.max(...fields.map(f => f.id)) + 1;
    setFields(prev => [...prev, { id: newId, key: '', value: '' }]);
  };

  const removeField = (id) => {
    setFields(prev => prev.filter(field => field.id !== id));
  };

  const updateField = (id, updates) => {
    setFields(prev => prev.map(field => 
      field.id === id ? { ...field, ...updates } : field
    ));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Custom Headers</Label>
        <ActionButton
          icon={Plus}
          label="Add Header"
          size="sm"
          variant="outline"
          onClick={addField}
        />
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-3">
            <div className="flex-1 grid grid-cols-2 gap-3">
              <Input
                placeholder="Header name"
                value={field.key}
                onChange={e => updateField(field.id, { key: e.target.value })}
              />
              <Input
                placeholder="Header value"
                value={field.value}
                onChange={e => updateField(field.id, { value: e.target.value })}
              />
            </div>
            
            {fields.length > 1 && (
              <ActionButton
                icon={Trash2}
                label="Remove"
                size="sm"
                variant="ghost"
                showLabel={false}
                onClick={() => removeField(field.id)}
                className="mt-0"
              />
            )}
          </div>
        ))}
      </div>

      {fields.some(f => !f.key || !f.value) && (
        <ValidationFeedback
          type="warning"
          message="Some header fields are incomplete"
        />
      )}
    </div>
  );
}
```

## Form Layout Patterns

### Two-Column Layout

```typescript
function TwoColumnForm() {
  return (
    <form className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Project Name</Label>
            <Input id="name" placeholder="Enter project name..." />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Project description..." />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="category">Category</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="web">Web Development</SelectItem>
                <SelectItem value="mobile">Mobile App</SelectItem>
                <SelectItem value="data">Data Analysis</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="priority">Priority</Label>
            <RadioGroup defaultValue="medium">
              <RadioOption value="low" label="Low Priority" />
              <RadioOption value="medium" label="Medium Priority" />
              <RadioOption value="high" label="High Priority" />
            </RadioGroup>
          </div>
        </div>
      </div>

      <Separator />

      <ActionButtonGroup
        actions={[
          { id: 'save', label: 'Save Project', icon: Save },
          { id: 'cancel', label: 'Cancel', icon: X, variant: 'outline' }
        ]}
      />
    </form>
  );
}
```

### Sectioned Forms

```typescript
function SectionedForm() {
  return (
    <form className="max-w-2xl space-y-8">
      {/* Basic Information Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Basic Information</h3>
          <ExecutionStatusBadge status="completed" size="sm" />
        </div>
        
        <div className="grid gap-4 pl-4 border-l-2 border-muted">
          <div>
            <Label htmlFor="agent-name">Agent Name</Label>
            <Input id="agent-name" placeholder="My Custom Agent" />
          </div>
          
          <div>
            <Label htmlFor="agent-description">Description</Label>
            <Textarea 
              id="agent-description" 
              placeholder="What does this agent do?"
            />
          </div>
        </div>
      </section>

      {/* Configuration Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Configuration</h3>
          <ExecutionStatusBadge status="idle" size="sm" />
        </div>
        
        <div className="grid gap-4 pl-4 border-l-2 border-muted">
          <HookConfigForm
            config={config}
            onChange={handleConfigChange}
          />
        </div>
      </section>

      {/* Advanced Settings Section */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 p-0">
            <ChevronRight className="h-4 w-4" />
            <h3 className="text-lg font-semibold">Advanced Settings</h3>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="space-y-4 mt-4">
          <div className="grid gap-4 pl-4 border-l-2 border-muted">
            {/* Advanced fields */}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </form>
  );
}
```

## Accessibility Patterns

### Form Accessibility

```typescript
function AccessibleForm() {
  return (
    <form 
      onSubmit={handleSubmit}
      role="form"
      aria-labelledby="form-title"
      aria-describedby="form-description"
      className="space-y-6"
    >
      <div>
        <h2 id="form-title" className="text-xl font-semibold">
          Create New Project
        </h2>
        <p id="form-description" className="text-muted-foreground">
          Fill in the details below to create a new project.
        </p>
      </div>

      <fieldset className="space-y-4">
        <legend className="sr-only">Project Basic Information</legend>
        
        <div>
          <Label htmlFor="project-name">
            Project Name
            <span className="text-destructive ml-1" aria-label="required">*</span>
          </Label>
          <Input
            id="project-name"
            name="projectName"
            required
            aria-describedby="project-name-error"
            aria-invalid={errors.projectName ? 'true' : 'false'}
          />
          {errors.projectName && (
            <ValidationFeedback
              id="project-name-error"
              type="error"
              message={errors.projectName}
              role="alert"
              aria-live="polite"
            />
          )}
        </div>
      </fieldset>

      <div 
        role="group" 
        aria-labelledby="form-actions"
        className="flex gap-2 justify-end"
      >
        <span id="form-actions" className="sr-only">Form Actions</span>
        <ActionButton
          type="button"
          icon={X}
          label="Cancel"
          variant="outline"
          onClick={handleCancel}
        />
        <ActionButton
          type="submit"
          icon={Save}
          label="Create Project"
          isLoading={isSubmitting}
          aria-describedby={isSubmitting ? "submit-status" : undefined}
        />
        {isSubmitting && (
          <span id="submit-status" className="sr-only" aria-live="polite">
            Creating project, please wait...
          </span>
        )}
      </div>
    </form>
  );
}
```

### Error Handling

```typescript
function FormWithErrorHandling() {
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await submitForm(formData);
      // Success - redirect or show success message
    } catch (error) {
      setSubmitError(error.message);
      // Focus the error message for screen readers
      setTimeout(() => {
        document.getElementById('submit-error')?.focus();
      }, 100);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form fields */}
      
      {submitError && (
        <div
          id="submit-error"
          tabIndex={-1}
          role="alert"
          className="p-4 border border-destructive rounded-md bg-destructive/10"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="font-medium text-destructive">
              Submission Error
            </span>
          </div>
          <p className="mt-2 text-sm text-destructive">
            {submitError}
          </p>
        </div>
      )}

      <ActionButtonGroup
        actions={[
          {
            id: 'submit',
            type: 'submit',
            label: isSubmitting ? 'Creating...' : 'Create Project',
            icon: Save,
            isLoading: isSubmitting
          }
        ]}
      />
    </form>
  );
}
```

## Performance Optimization

### Form Field Memoization

```typescript
const MemoizedFormField = React.memo(function FormField({
  label,
  value,
  onChange,
  error,
  ...props
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={label}>{label}</Label>
      <Input
        id={label}
        value={value}
        onChange={onChange}
        className={error ? 'border-destructive' : ''}
        {...props}
      />
      {error && <ValidationFeedback type="error" message={error} />}
    </div>
  );
});
```

### Debounced Validation

```typescript
import { useDebouncedCallback } from 'use-debounce';

function OptimizedForm() {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  const debouncedValidation = useDebouncedCallback(
    async (data) => {
      const validationErrors = await validateForm(data);
      setErrors(validationErrors);
    },
    500
  );

  const handleFieldChange = (field, value) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    debouncedValidation(newData);
  };

  return (
    <form className="space-y-4">
      {Object.entries(formFields).map(([key, config]) => (
        <MemoizedFormField
          key={key}
          label={config.label}
          value={formData[key] || ''}
          onChange={(e) => handleFieldChange(key, e.target.value)}
          error={errors[key]}
        />
      ))}
    </form>
  );
}
```

## Best Practices

### Form Design

#### Do ✅
- Use logical tab order and keyboard navigation
- Provide clear, immediate validation feedback
- Group related fields using fieldsets and legends
- Use appropriate input types (email, tel, url)
- Indicate required fields clearly
- Provide helpful placeholder text and labels

#### Don't ❌
- Don't rely solely on color to indicate validation states
- Don't show validation errors before user interaction
- Don't use placeholder text as the only label
- Don't create forms that are too complex or long
- Don't forget to handle loading and error states

### Validation Strategy

```typescript
// Good: Progressive validation
const validation = {
  // Client-side validation for immediate feedback
  client: (value) => value.length >= 3,
  
  // Server-side validation for business rules
  server: async (value) => {
    const response = await checkUniqueness(value);
    return response.isUnique;
  }
};

// Bad: Only server-side validation
const validation = async (value) => {
  // User waits for server response for every keystroke
  return await serverValidate(value);
};
```

### Accessibility Checklist

- [ ] Proper form labels and fieldsets
- [ ] Keyboard navigation support
- [ ] Screen reader compatibility
- [ ] Error states announced to assistive technology
- [ ] Focus management during form submission
- [ ] High contrast mode support
- [ ] Required field indicators

---

*Form patterns in Claudio emphasize user experience, accessibility, and maintainability through consistent use of atomic design components and proven interaction patterns.*