import React from "react";
import { TriLevelPermissionsManager } from "@/components/common";
import type { PermissionRule } from "@/hooks/useSettingsState";
import type { TriLevelRule } from "@/hooks/useTriLevelSettings";
import { DebugLabel } from "@/components/ui/atoms";

interface PermissionsSettingsProps {
  allowRules: PermissionRule[];
  denyRules: PermissionRule[];
  onAddRule: (type: "allow" | "deny") => void;
  onUpdateRule: (type: "allow" | "deny", id: string, value: string) => void;
  onRemoveRule: (type: "allow" | "deny", id: string) => void;
}

export const PermissionsSettings: React.FC<PermissionsSettingsProps> = ({
  allowRules,
  denyRules,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
}) => {
  // Convert PermissionRule[] to TriLevelRule[] for user-only context
  const convertToTriLevelRules = (): TriLevelRule[] => {
    const convertRules = (rules: PermissionRule[], type: "allow" | "deny"): TriLevelRule[] => 
      rules.map(rule => ({
        id: rule.id,
        value: rule.value,
        type,
        levels: { user: true, team: false, local: false }
      }));

    return [
      ...convertRules(allowRules, "allow"),
      ...convertRules(denyRules, "deny")
    ];
  };

  const handleAddRule = (type: "allow" | "deny", value: string) => {
    onAddRule(type);
  };

  const handleToggleLevel = async (ruleId: string, level: "user" | "team" | "local") => {
    // In user-only mode, level toggles are disabled
    // But this function is still required by the interface
  };

  const handleUpdateRule = (ruleId: string, value: string) => {
    // Find which type this rule belongs to
    const allowRule = allowRules.find(r => r.id === ruleId);
    const denyRule = denyRules.find(r => r.id === ruleId);
    
    if (allowRule) {
      onUpdateRule("allow", ruleId, value);
    } else if (denyRule) {
      onUpdateRule("deny", ruleId, value);
    }
  };

  const handleDeleteRule = (ruleId: string) => {
    // Find which type this rule belongs to
    const allowRule = allowRules.find(r => r.id === ruleId);
    const denyRule = denyRules.find(r => r.id === ruleId);
    
    if (allowRule) {
      onRemoveRule("allow", ruleId);
    } else if (denyRule) {
      onRemoveRule("deny", ruleId);
    }
  };

  return (
    <div className="relative">
      <DebugLabel label="PermissionsSettings" />
      <TriLevelPermissionsManager
        rules={convertToTriLevelRules()}
        onAddRule={handleAddRule}
        onToggleLevel={handleToggleLevel}
        onUpdateRule={handleUpdateRule}
        onDeleteRule={handleDeleteRule}
        userOnly={true}
        loading={false}
      />
    </div>
  );
};