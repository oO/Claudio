/**
 * HooksEditor component for managing Claude Code hooks configuration
 * Refactored using Atomic Design principles
 */

import React, { useState, useEffect } from 'react';
import { Plus, FileText, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LoadingSpinner, HookTypeSelector, DebugLabel } from '@/components/ui/atoms';
import { StatusMessage, ValidationFeedback, HookMetadata } from '@/components/ui/molecules';
import { 
  HookMatcherEditor, 
  DirectCommandEditor, 
  TemplateSelector 
} from '@/components/ui/organisms';
import { cn } from '@/lib/utils';
import { HooksManager } from '@/lib/hooksManager';
import { api } from '@/lib/api';
import {
  HooksConfiguration,
  HookEvent,
  HookMatcher,
  HookCommand,
  HookTemplate,
  COMMON_TOOL_MATCHERS,
  HOOK_TEMPLATES,
} from '@/types/hooks';
import { logger } from '@/lib/logger';

interface HooksEditorProps {
  projectPath?: string;
  scope: 'project' | 'local' | 'user';
  readOnly?: boolean;
  className?: string;
  onChange?: (hasChanges: boolean, getHooks: () => HooksConfiguration) => void;
  hideActions?: boolean;
}

export interface EditableHookCommand extends HookCommand {
  id: string;
}

export interface EditableHookMatcher {
  id: string;
  matcher: string;
  hooks: EditableHookCommand[];
  expanded?: boolean;
}

const EVENT_INFO: Record<HookEvent, { label: string; description: string }> = {
  PreToolUse: {
    label: 'Pre Tool Use',
    description: 'Runs before tool calls, can block and provide feedback'
  },
  PostToolUse: {
    label: 'Post Tool Use',
    description: 'Runs after successful tool completion'
  },
  Notification: {
    label: 'Notification',
    description: 'Customizes notifications when Claude needs attention'
  },
  Stop: {
    label: 'Stop',
    description: 'Runs when Claude finishes responding'
  },
  SubagentStop: {
    label: 'Subagent Stop',
    description: 'Runs when a Claude subagent (Task) finishes'
  }
};

export const HooksEditor: React.FC<HooksEditorProps> = ({
  projectPath,
  scope,
  readOnly = false,
  className,
  onChange,
  hideActions = false
}) => {
  const [selectedEvent, setSelectedEvent] = useState<HookEvent>('PreToolUse');
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const isInitialMount = React.useRef(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hooks, setHooks] = useState<HooksConfiguration>({});
  
  // Events with matchers (tool-related)
  const matcherEvents = ['PreToolUse', 'PostToolUse'] as const;
  // Events without matchers (non-tool-related)
  const directEvents = ['Notification', 'Stop', 'SubagentStop'] as const;
  
  // Convert hooks to editable format with IDs
  const [editableHooks, setEditableHooks] = useState<{
    PreToolUse: EditableHookMatcher[];
    PostToolUse: EditableHookMatcher[];
    Notification: EditableHookCommand[];
    Stop: EditableHookCommand[];
    SubagentStop: EditableHookCommand[];
  }>(() => {
    const result = {
      PreToolUse: [],
      PostToolUse: [],
      Notification: [],
      Stop: [],
      SubagentStop: []
    } as any;
    
    // Initialize matcher events
    matcherEvents.forEach(event => {
      const matchers = hooks?.[event] as HookMatcher[] | undefined;
      if (matchers && Array.isArray(matchers)) {
        result[event] = matchers.map(matcher => ({
          ...matcher,
          id: HooksManager.generateId(),
          expanded: false,
          hooks: (matcher.hooks || []).map(hook => ({
            ...hook,
            id: HooksManager.generateId()
          }))
        }));
      }
    });
    
    // Initialize direct events
    directEvents.forEach(event => {
      const commands = hooks?.[event] as HookCommand[] | undefined;
      if (commands && Array.isArray(commands)) {
        result[event] = commands.map(hook => ({
          ...hook,
          id: HooksManager.generateId()
        }));
      }
    });
    
    return result;
  });

  // Load hooks when projectPath or scope changes
  useEffect(() => {
    // For user scope, we don't need a projectPath
    if (scope === 'user' || projectPath) {
      setIsLoading(true);
      setLoadError(null);
      
      api.getHooksConfig(scope, projectPath)
        .then((config) => {
          setHooks(config || {});
          setHasUnsavedChanges(false);
        })
        .catch((err) => {
          logger.error("Failed to load hooks configuration:", err);
          setLoadError(err instanceof Error ? err.message : "Failed to load hooks configuration");
          setHooks({});
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      // No projectPath for project/local scopes
      setHooks({});
    }
  }, [projectPath, scope]);

  // Reset initial mount flag when hooks prop changes
  useEffect(() => {
    isInitialMount.current = true;
    setHasUnsavedChanges(false); // Reset unsaved changes when hooks prop changes
    
    // Reinitialize editable hooks when hooks prop changes
    const result = {
      PreToolUse: [],
      PostToolUse: [],
      Notification: [],
      Stop: [],
      SubagentStop: []
    } as any;
    
    // Initialize matcher events
    matcherEvents.forEach(event => {
      const matchers = hooks?.[event] as HookMatcher[] | undefined;
      if (matchers && Array.isArray(matchers)) {
        result[event] = matchers.map(matcher => ({
          ...matcher,
          id: HooksManager.generateId(),
          expanded: false,
          hooks: (matcher.hooks || []).map(hook => ({
            ...hook,
            id: HooksManager.generateId()
          }))
        }));
      }
    });
    
    // Initialize direct events
    directEvents.forEach(event => {
      const commands = hooks?.[event] as HookCommand[] | undefined;
      if (commands && Array.isArray(commands)) {
        result[event] = commands.map(hook => ({
          ...hook,
          id: HooksManager.generateId()
        }));
      }
    });
    
    setEditableHooks(result);
  }, [hooks]);

  // Track changes when editable hooks change (but don't save automatically)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    setHasUnsavedChanges(true);
  }, [editableHooks]);

  // Notify parent of changes
  useEffect(() => {
    if (onChange) {
      const getHooks = () => {
        const newHooks: HooksConfiguration = {};
        
        // Handle matcher events
        matcherEvents.forEach(event => {
          const matchers = editableHooks[event];
          if (matchers.length > 0) {
            newHooks[event] = matchers.map(({ id, expanded, ...matcher }) => ({
              ...matcher,
              hooks: matcher.hooks.map(({ id, ...hook }) => hook)
            }));
          }
        });
        
        // Handle direct events
        directEvents.forEach(event => {
          const commands = editableHooks[event];
          if (commands.length > 0) {
            newHooks[event] = commands.map(({ id, ...hook }) => hook);
          }
        });
        
        return newHooks;
      };
      
      onChange(hasUnsavedChanges, getHooks);
    }
  }, [hasUnsavedChanges, editableHooks, onChange]);

  // Save function to be called explicitly
  const handleSave = async () => {
    if (scope !== 'user' && !projectPath) return;
    
    setIsSaving(true);
    
    const newHooks: HooksConfiguration = {};
    
    // Handle matcher events
    matcherEvents.forEach(event => {
      const matchers = editableHooks[event];
      if (matchers.length > 0) {
        newHooks[event] = matchers.map(({ id, expanded, ...matcher }) => ({
          ...matcher,
          hooks: matcher.hooks.map(({ id, ...hook }) => hook)
        }));
      }
    });
    
    // Handle direct events
    directEvents.forEach(event => {
      const commands = editableHooks[event];
      if (commands.length > 0) {
        newHooks[event] = commands.map(({ id, ...hook }) => hook);
      }
    });
    
    try {
      await api.updateHooksConfig(scope, newHooks, projectPath);
      setHooks(newHooks);
      setHasUnsavedChanges(false);
    } catch (error) {
      logger.error('Failed to save hooks:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to save hooks');
    } finally {
      setIsSaving(false);
    }
  };

  const addMatcher = (event: HookEvent) => {
    // Only for events with matchers
    if (!matcherEvents.includes(event as any)) return;
    
    const newMatcher: EditableHookMatcher = {
      id: HooksManager.generateId(),
      matcher: '',
      hooks: [],
      expanded: true
    };
    
    setEditableHooks(prev => ({
      ...prev,
      [event]: [...(prev[event as 'PreToolUse' | 'PostToolUse'] as EditableHookMatcher[]), newMatcher]
    }));
  };
  
  const addDirectCommand = (event: HookEvent) => {
    // Only for events without matchers
    if (!directEvents.includes(event as any)) return;
    
    const newCommand: EditableHookCommand = {
      id: HooksManager.generateId(),
      type: 'command',
      command: ''
    };
    
    setEditableHooks(prev => ({
      ...prev,
      [event]: [...(prev[event as 'Notification' | 'Stop' | 'SubagentStop'] as EditableHookCommand[]), newCommand]
    }));
  };

  const updateMatcher = (event: HookEvent, matcherId: string, updates: Partial<EditableHookMatcher>) => {
    if (!matcherEvents.includes(event as any)) return;
    
    setEditableHooks(prev => ({
      ...prev,
      [event]: (prev[event as 'PreToolUse' | 'PostToolUse'] as EditableHookMatcher[]).map(matcher =>
        matcher.id === matcherId ? { ...matcher, ...updates } : matcher
      )
    }));
  };

  const removeMatcher = (event: HookEvent, matcherId: string) => {
    if (!matcherEvents.includes(event as any)) return;
    
    setEditableHooks(prev => ({
      ...prev,
      [event]: (prev[event as 'PreToolUse' | 'PostToolUse'] as EditableHookMatcher[]).filter(matcher => matcher.id !== matcherId)
    }));
  };
  
  const updateDirectCommand = (event: HookEvent, commandId: string, updates: Partial<EditableHookCommand>) => {
    if (!directEvents.includes(event as any)) return;
    
    setEditableHooks(prev => ({
      ...prev,
      [event]: (prev[event as 'Notification' | 'Stop' | 'SubagentStop'] as EditableHookCommand[]).map(cmd =>
        cmd.id === commandId ? { ...cmd, ...updates } : cmd
      )
    }));
  };
  
  const removeDirectCommand = (event: HookEvent, commandId: string) => {
    if (!directEvents.includes(event as any)) return;
    
    setEditableHooks(prev => ({
      ...prev,
      [event]: (prev[event as 'Notification' | 'Stop' | 'SubagentStop'] as EditableHookCommand[]).filter(cmd => cmd.id !== commandId)
    }));
  };

  const applyTemplate = (template: HookTemplate) => {
    if (matcherEvents.includes(template.event as any)) {
      // For events with matchers
      const newMatcher: EditableHookMatcher = {
        id: HooksManager.generateId(),
        matcher: template.matcher || '',
        hooks: template.commands.map(cmd => ({
          id: HooksManager.generateId(),
          type: 'command' as const,
          command: cmd
        })),
        expanded: true
      };
      
      setEditableHooks(prev => ({
        ...prev,
        [template.event]: [...(prev[template.event as 'PreToolUse' | 'PostToolUse'] as EditableHookMatcher[]), newMatcher]
      }));
    } else {
      // For direct events
      const newCommands: EditableHookCommand[] = template.commands.map(cmd => ({
        id: HooksManager.generateId(),
        type: 'command' as const,
        command: cmd
      }));
      
      setEditableHooks(prev => ({
        ...prev,
        [template.event]: [...(prev[template.event as 'Notification' | 'Stop' | 'SubagentStop'] as EditableHookCommand[]), ...newCommands]
      }));
    }
    
    setSelectedEvent(template.event);
    setShowTemplateDialog(false);
  };

  const validateHooks = async () => {
    if (!hooks) {
      setValidationErrors([]);
      setValidationWarnings([]);
      return;
    }
    
    const result = await HooksManager.validateConfig(hooks);
    setValidationErrors(result.errors.map(e => e.message));
    setValidationWarnings(result.warnings.map(w => `${w.message} in command: ${(w.command || '').substring(0, 50)}...`));
  };

  useEffect(() => {
    validateHooks();
  }, [hooks]);

  const addCommand = (event: HookEvent, matcherId: string) => {
    if (!matcherEvents.includes(event as any)) return;
    
    const newCommand: EditableHookCommand = {
      id: HooksManager.generateId(),
      type: 'command',
      command: ''
    };
    
    setEditableHooks(prev => ({
      ...prev,
      [event]: (prev[event as 'PreToolUse' | 'PostToolUse'] as EditableHookMatcher[]).map(matcher =>
        matcher.id === matcherId
          ? { ...matcher, hooks: [...matcher.hooks, newCommand] }
          : matcher
      )
    }));
  };

  const updateCommand = (
    event: HookEvent,
    matcherId: string,
    commandId: string,
    updates: Partial<EditableHookCommand>
  ) => {
    if (!matcherEvents.includes(event as any)) return;
    
    setEditableHooks(prev => ({
      ...prev,
      [event]: (prev[event as 'PreToolUse' | 'PostToolUse'] as EditableHookMatcher[]).map(matcher =>
        matcher.id === matcherId
          ? {
              ...matcher,
              hooks: matcher.hooks.map(cmd =>
                cmd.id === commandId ? { ...cmd, ...updates } : cmd
              )
            }
          : matcher
      )
    }));
  };

  const removeCommand = (event: HookEvent, matcherId: string, commandId: string) => {
    if (!matcherEvents.includes(event as any)) return;
    
    setEditableHooks(prev => ({
      ...prev,
      [event]: (prev[event as 'PreToolUse' | 'PostToolUse'] as EditableHookMatcher[]).map(matcher =>
        matcher.id === matcherId
          ? { ...matcher, hooks: matcher.hooks.filter(cmd => cmd.id !== commandId) }
          : matcher
      )
    }));
  };

  const renderMatcher = (event: HookEvent, matcher: EditableHookMatcher) => (
    <HookMatcherEditor
      key={matcher.id}
      event={event}
      matcher={matcher}
      onMatcherUpdate={(updates) => updateMatcher(event, matcher.id, updates)}
      onCommandAdd={() => addCommand(event, matcher.id)}
      onCommandUpdate={(commandId, updates) => updateCommand(event, matcher.id, commandId, updates)}
      onCommandRemove={(commandId) => removeCommand(event, matcher.id, commandId)}
      onMatcherRemove={() => removeMatcher(event, matcher.id)}
      commonPatterns={COMMON_TOOL_MATCHERS}
      readOnly={readOnly}
    />
  );
  
  const renderDirectCommand = (event: HookEvent, command: EditableHookCommand) => (
    <DirectCommandEditor
      key={command.id}
      command={command}
      onCommandUpdate={(updates) => updateDirectCommand(event, command.id, updates)}
      onCommandRemove={() => removeDirectCommand(event, command.id)}
      readOnly={readOnly}
    />
  );

  return (
    <div className={cn("space-y-6 relative", className)}>
      <DebugLabel label="HooksEditor" />
      {/* Loading State */}
      {isLoading && (
        <LoadingSpinner 
          message="Loading hooks configuration..." 
          className="p-8"
        />
      )}
      
      {/* Error State */}
      {loadError && !isLoading && (
        <StatusMessage
          type="error"
          message={loadError}
        />
      )}
      
      {/* Main Content */}
      {!isLoading && (
        <>
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Hooks Configuration</h3>
              <div className="flex items-center gap-2">
                <HookTypeSelector scope={scope} />
                {!readOnly && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTemplateDialog(true)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Templates
                    </Button>
                    {!hideActions && (
                      <Button
                        variant={hasUnsavedChanges ? "default" : "outline"}
                        size="sm"
                        onClick={handleSave}
                        disabled={!hasUnsavedChanges || isSaving || !projectPath}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure shell commands to execute at various points in Claude Code's lifecycle.
              {scope === 'local' && ' These settings are not committed to version control.'}
            </p>
            {hasUnsavedChanges && !readOnly && (
              <p className="text-sm text-amber-600">
                You have unsaved changes. Click Save to persist them.
              </p>
            )}
          </div>

          {/* Validation Messages */}
          <ValidationFeedback 
            errors={validationErrors}
            warnings={validationWarnings}
          />

          {/* Event Tabs */}
          <Tabs value={selectedEvent} onValueChange={(v) => setSelectedEvent(v as HookEvent)}>
            <TabsList className="w-full">
              {(Object.keys(EVENT_INFO) as HookEvent[]).map(event => {
                const isMatcherEvent = matcherEvents.includes(event as any);
                const count = isMatcherEvent 
                  ? (editableHooks[event as 'PreToolUse' | 'PostToolUse'] as EditableHookMatcher[]).length
                  : (editableHooks[event as 'Notification' | 'Stop' | 'SubagentStop'] as EditableHookCommand[]).length;
                
                return (
                  <TabsTrigger key={event} value={event} className="flex items-center gap-2">
                    <HookMetadata
                      event={event}
                      count={count > 0 ? count : undefined}
                    />
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {(Object.keys(EVENT_INFO) as HookEvent[]).map(event => {
              const isMatcherEvent = matcherEvents.includes(event as any);
              const items = isMatcherEvent 
                ? (editableHooks[event as 'PreToolUse' | 'PostToolUse'] as EditableHookMatcher[])
                : (editableHooks[event as 'Notification' | 'Stop' | 'SubagentStop'] as EditableHookCommand[]);
              
              return (
                <TabsContent key={event} value={event} className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {EVENT_INFO[event].description}
                    </p>
                  </div>

                  {items.length === 0 ? (
                    <Card className="p-8 text-center">
                      <p className="text-muted-foreground mb-4">No hooks configured for this event</p>
                      {!readOnly && (
                        <Button onClick={() => isMatcherEvent ? addMatcher(event) : addDirectCommand(event)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Hook
                        </Button>
                      )}
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {isMatcherEvent 
                        ? (items as EditableHookMatcher[]).map(matcher => renderMatcher(event, matcher))
                        : (items as EditableHookCommand[]).map(command => renderDirectCommand(event, command))
                      }
                      
                      {!readOnly && (
                        <Button
                          variant="outline"
                          onClick={() => isMatcherEvent ? addMatcher(event) : addDirectCommand(event)}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Another {isMatcherEvent ? 'Matcher' : 'Command'}
                        </Button>
                      )}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>

          {/* Template Dialog */}
          <TemplateSelector
            open={showTemplateDialog}
            onOpenChange={setShowTemplateDialog}
            templates={HOOK_TEMPLATES}
            onTemplateSelect={applyTemplate}
          />
        </>
      )}
    </div>
  );
};