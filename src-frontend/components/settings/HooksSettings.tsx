import React, { useRef, useState, useEffect } from "react";
import { HooksManager } from "@/components/settings/HooksManager";
import { HooksCommandEditor } from "@/components/settings/HooksCommandEditor";
import { DebugLabel } from "@/components/ui/atoms";

interface HooksSettingsProps {
  onHooksChange: (hasChanges: boolean, getHooks: (() => any) | null) => void;
  activeTab: string;
}

export const HooksSettings: React.FC<HooksSettingsProps> = ({
  onHooksChange,
  activeTab,
}) => {
  const [editingFile, setEditingFile] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 relative h-full">
      <DebugLabel label="HooksSettings" />

      {/* Header - fixed content */}
      <div>
        <h3 className="text-lg font-semibold text-accent mb-2">User Hooks</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure hooks that apply to all Claude Code sessions for your user account.
          These are stored in <code className="mx-1 px-2 py-1 bg-muted rounded text-xs">~/.claude/settings.json</code>
        </p>
      </div>

      {/* Conditional content - either hooks list or file editor */}
      <div className="flex-1 min-h-0">
        {editingFile ? (
          <HooksCommandEditor
            filePath={editingFile}
            onBack={() => setEditingFile(null)}
          />
        ) : (
          <HooksManager
            key={activeTab}
            scope="user"
            className="border-0"
            hideActions={true}
            onChange={onHooksChange}
            onEditFile={setEditingFile}
          />
        )}
      </div>
    </div>
  );
};