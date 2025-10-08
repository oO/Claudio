import React from "react";
import { ToolPermissionsManager } from "@/components/common";
import type { PermissionRule } from "@/hooks/useSettingsState";
import type { TriLevelRule } from "@/hooks/useTriLevelSettings";
import { DebugLabel } from "@/components/ui/atoms";

interface PermissionsSettingsProps {
  allowRules: PermissionRule[];
  askRules: PermissionRule[];
  denyRules: PermissionRule[];
  onAddRule: (type: "allow" | "ask" | "deny") => void;
  onUpdateRule: (type: "allow" | "ask" | "deny", id: string, value: string) => void;
  onRemoveRule: (type: "allow" | "ask" | "deny", id: string) => void;
}

export const PermissionsSettings: React.FC<PermissionsSettingsProps> = ({
  allowRules,
  askRules,
  denyRules,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
}) => {
  // Convert PermissionRule[] to TriLevelRule[] for user-only context
  const convertToTriLevelRules = (): TriLevelRule[] => {
    const convertRules = (rules: PermissionRule[], type: "allow" | "ask" | "deny"): TriLevelRule[] =>
      rules.map(rule => ({
        id: rule.id,
        value: rule.value,
        type,
        levels: { user: true, team: false, local: false }
      }));

    return [
      ...convertRules(allowRules, "allow"),
      ...convertRules(askRules, "ask"),
      ...convertRules(denyRules, "deny")
    ];
  };

  const handleAddRule = (type: "allow" | "ask" | "deny", value: string) => {
    onAddRule(type);
  };

  const handleToggleLevel = async (ruleId: string, level: "user" | "team" | "local") => {
    // In user-only mode, level toggles are disabled
    // But this function is still required by the interface
  };

  const handleUpdateRule = (ruleId: string, value: string) => {
    // Find which type this rule belongs to
    const allowRule = allowRules.find(r => r.id === ruleId);
    const askRule = askRules.find(r => r.id === ruleId);
    const denyRule = denyRules.find(r => r.id === ruleId);

    if (allowRule) {
      onUpdateRule("allow", ruleId, value);
    } else if (askRule) {
      onUpdateRule("ask", ruleId, value);
    } else if (denyRule) {
      onUpdateRule("deny", ruleId, value);
    }
  };

  const handleDeleteRule = (ruleId: string) => {
    // Find which type this rule belongs to
    const allowRule = allowRules.find(r => r.id === ruleId);
    const askRule = askRules.find(r => r.id === ruleId);
    const denyRule = denyRules.find(r => r.id === ruleId);

    if (allowRule) {
      onRemoveRule("allow", ruleId);
    } else if (askRule) {
      onRemoveRule("ask", ruleId);
    } else if (denyRule) {
      onRemoveRule("deny", ruleId);
    }
  };

  return (
    <div className="relative flex flex-col h-full">
      <DebugLabel label="PermissionsSettings" />

      {/* Fixed header */}
      <div className="p-6 pb-4">
        <h3 className="text-lg font-semibold text-accent">Tool Permissions</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure which tools Claude can use without asking for permission
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
        <ToolPermissionsManager
          rules={convertToTriLevelRules()}
          onAddRule={handleAddRule}
          onToggleLevel={handleToggleLevel}
          onUpdateRule={handleUpdateRule}
          onDeleteRule={handleDeleteRule}
          userOnly={true}
          loading={false}
        />
      </div>
    </div>
  );
};