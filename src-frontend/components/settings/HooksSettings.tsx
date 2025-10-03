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
  const heightCalculationRef = useRef<HTMLDivElement>(null); // For height calculation
  const [containerHeight, setContainerHeight] = useState(400);
  const [editingFile, setEditingFile] = useState<string | null>(null);

  // Calculate container height based on actual position - same as ProjectSessionTab
  useEffect(() => {
    const calculateHeight = () => {
      if (!heightCalculationRef.current) {
        // Retry if ref not ready yet
        setTimeout(calculateHeight, 50);
        return;
      }

      const rect = heightCalculationRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const availableHeight = viewportHeight - rect.top - 150; // 150px padding from bottom

      setContainerHeight(Math.max(200, availableHeight)); // Minimum 200px
    };

    calculateHeight();
    window.addEventListener("resize", calculateHeight);

    // Recalculate when component mounts
    const timeout1 = setTimeout(calculateHeight, 10);
    const timeout2 = setTimeout(calculateHeight, 100);
    const timeout3 = setTimeout(calculateHeight, 300);

    return () => {
      window.removeEventListener("resize", calculateHeight);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
    };
  }, []);

  return (
    <div className="space-y-4 relative">
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
      <div ref={heightCalculationRef}>
        {editingFile ? (
          <HooksCommandEditor
            filePath={editingFile}
            onBack={() => setEditingFile(null)}
            containerHeight={containerHeight}
          />
        ) : (
          <HooksManager
            key={activeTab}
            scope="user"
            className="border-0"
            hideActions={true}
            onChange={onHooksChange}
            containerHeight={containerHeight}
            onEditFile={setEditingFile}
          />
        )}
      </div>
    </div>
  );
};