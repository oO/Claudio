import React from "react";
import { ToolPermissionsManager } from "@/components/common";
import type { PermissionRule } from "@/hooks/useSettingsState";

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
  return (
    <ToolPermissionsManager
      allowRules={allowRules}
      denyRules={denyRules}
      onAddRule={onAddRule}
      onUpdateRule={onUpdateRule}
      onRemoveRule={onRemoveRule}
      scope="global"
      title="Permission Rules"
    />
  );
};