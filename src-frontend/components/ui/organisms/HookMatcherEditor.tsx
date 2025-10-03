import React from "react";
import { ChevronRight, ChevronDown, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ActionButton } from "@/components/ui/atoms";
import { 
  CodeEditorToolbar, 
  HookConfigForm, 
  ValidationFeedback 
} from "@/components/ui/molecules";
import { CodeSyntaxHighlight } from "@/components/ui/atoms";
import { cn } from "@/lib/utils";
import { HookEvent } from "@/types/hooks";
import { HooksManager } from "@/lib/hooksManager";

// Import types from main component
import type { EditableHookCommand, EditableHookMatcher } from '../../settings/HooksManager';

export interface HookMatcherEditorProps {
  event: HookEvent;
  matcher: EditableHookMatcher;
  onMatcherUpdate: (updates: Partial<EditableHookMatcher>) => void;
  onCommandAdd: () => void;
  onCommandUpdate: (commandId: string, updates: Partial<EditableHookCommand>) => void;
  onCommandRemove: (commandId: string) => void;
  onMatcherRemove: () => void;
  commonPatterns: string[];
  readOnly?: boolean;
  className?: string;
}

export const HookMatcherEditor: React.FC<HookMatcherEditorProps> = ({
  event,
  matcher,
  onMatcherUpdate,
  onCommandAdd,
  onCommandUpdate,
  onCommandRemove,
  onMatcherRemove,
  commonPatterns,
  readOnly = false,
  className
}) => {
  const toggleExpanded = () => {
    onMatcherUpdate({ expanded: !matcher.expanded });
  };

  return (
    <Card className={cn("p-4 space-y-4", className)}>
      <div className="flex items-start gap-4">
        <ActionButton
          variant="ghost"
          size="sm"
          onClick={toggleExpanded}
          icon={matcher.expanded ? ChevronDown : ChevronRight}
          label={matcher.expanded ? "Collapse matcher" : "Expand matcher"}
          showLabel={false}
          className="p-0 h-6 w-6"
        />
        
        <div className="flex-1 space-y-2">
          <HookConfigForm
            matcherId={matcher.id}
            matcher={matcher.matcher}
            onMatcherChange={(value) => onMatcherUpdate({ matcher: value })}
            commonPatterns={commonPatterns}
            readOnly={readOnly}
          />
          
          <div className="flex justify-end">
            {!readOnly && (
              <ActionButton
                variant="ghost"
                size="sm"
                onClick={onMatcherRemove}
                icon={Plus}
                label="Remove matcher"
                showLabel={false}
                className="text-destructive hover:text-destructive rotate-45"
              />
            )}
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {matcher.expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 pl-10"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Commands</Label>
                {!readOnly && (
                  <ActionButton
                    variant="outline"
                    size="sm"
                    onClick={onCommandAdd}
                    icon={Plus}
                    label="Add Command"
                    className="h-8"
                  />
                )}
              </div>
              
              {matcher.hooks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No commands added yet</p>
              ) : (
                <div className="space-y-4">
                  {matcher.hooks.map((hook) => {
                    const warnings = HooksManager.checkDangerousPatterns(hook.command || '');
                    
                    return (
                      <div key={hook.id} className="space-y-2">
                        <div className="space-y-2">
                          <CodeSyntaxHighlight
                            value={hook.command || ''}
                            onChange={(value) => onCommandUpdate(hook.id, { command: value })}
                            placeholder="Enter shell command..."
                            disabled={readOnly}
                            language="shell"
                          />
                          
                          <CodeEditorToolbar
                            timeout={hook.timeout}
                            onTimeoutChange={(timeout) => onCommandUpdate(hook.id, { timeout })}
                            onDelete={() => onCommandRemove(hook.id)}
                            readOnly={readOnly}
                          />
                        </div>
                        
                        {warnings.length > 0 && (
                          <ValidationFeedback warnings={warnings} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};