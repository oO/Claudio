import React from "react";
import { Card } from "@/components/ui/card";
import { CodeEditorToolbar, ValidationFeedback } from "@/components/ui/molecules";
import { CodeSyntaxHighlight } from "@/components/ui/atoms";
import { cn } from "@/lib/utils";
import { HooksManager } from "@/lib/hooksManager";
import type { EditableHookCommand } from '../../settings/HooksManager';

export interface DirectCommandEditorProps {
  command: EditableHookCommand;
  onCommandUpdate: (updates: Partial<EditableHookCommand>) => void;
  onCommandRemove: () => void;
  readOnly?: boolean;
  className?: string;
}

export const DirectCommandEditor: React.FC<DirectCommandEditorProps> = ({
  command,
  onCommandUpdate,
  onCommandRemove,
  readOnly = false,
  className
}) => {
  const warnings = HooksManager.checkDangerousPatterns(command.command || '');

  return (
    <Card className={cn("p-4 space-y-2", className)}>
      <div className="space-y-2">
        <CodeSyntaxHighlight
          value={command.command || ''}
          onChange={(value) => onCommandUpdate({ command: value })}
          placeholder="Enter shell command..."
          disabled={readOnly}
          language="shell"
        />
        
        <CodeEditorToolbar
          timeout={command.timeout}
          onTimeoutChange={(timeout) => onCommandUpdate({ timeout })}
          onDelete={onCommandRemove}
          readOnly={readOnly}
        />
      </div>
      
      {warnings.length > 0 && (
        <ValidationFeedback warnings={warnings} />
      )}
    </Card>
  );
};