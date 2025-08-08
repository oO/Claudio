import React from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Shield } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { PermissionRule } from "@/hooks/useSettingsState";

interface ToolPermissionsManagerProps {
  /**
   * Allow rules array
   */
  allowRules: PermissionRule[];
  /**
   * Deny rules array  
   */
  denyRules: PermissionRule[];
  /**
   * Callback to add a new rule
   */
  onAddRule: (type: "allow" | "deny") => void;
  /**
   * Callback to update a rule value
   */
  onUpdateRule: (type: "allow" | "deny", id: string, value: string) => void;
  /**
   * Callback to remove a rule
   */
  onRemoveRule: (type: "allow" | "deny", id: string) => void;
  /**
   * Scope of permissions (global or local)
   */
  scope?: "global" | "local";
  /**
   * Optional title override
   */
  title?: string;
  /**
   * Optional description override
   */
  description?: string;
}

/**
 * Shared component for managing tool permissions
 * Works for both global settings and project-specific local settings
 */
export const ToolPermissionsManager: React.FC<ToolPermissionsManagerProps> = ({
  allowRules,
  denyRules,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  scope = "global",
  title,
  description,
}) => {
  const isLocal = scope === "local";
  
  const defaultTitle = isLocal ? "Local Tool Permissions" : "Tool Permissions";
  const defaultDescription = isLocal 
    ? "Control which tools Claude Code can use without approval in this project. These settings are machine-specific and stored locally."
    : "Control which tools Claude Code can use without manual approval globally.";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <div>
          <h3 className="text-base font-semibold mb-2">{title || defaultTitle}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {description || defaultDescription}
          </p>
        </div>
      </div>
      
      {isLocal && (
        <div className="p-3 bg-blue-500/10 rounded-md border border-blue-500/20">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            <strong>Local permissions</strong> override global settings for this project and are not committed to version control.
          </p>
        </div>
      )}
      
      {/* Allow Rules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-green-500">Allow Rules</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddRule("allow")}
            className="gap-2 hover:border-green-500/50 hover:text-green-500"
          >
            <Plus className="h-3 w-3" />
            Add Rule
          </Button>
        </div>
        <div className="space-y-2">
          {allowRules.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No allow rules configured. Claude will ask for approval for all tools.
            </p>
          ) : (
            allowRules.map((rule) => (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-3 rounded-lg border bg-card"
              >
                <Input
                  placeholder="e.g., Bash(npm run test:*)"
                  value={rule.value}
                  onChange={(e) => onUpdateRule("allow", rule.id, e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveRule("allow", rule.id)}
                  className="h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.div>
            ))
          )}
        </div>
      </div>
      
      {/* Deny Rules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-red-500">Deny Rules</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddRule("deny")}
            className="gap-2 hover:border-red-500/50 hover:text-red-500"
          >
            <Plus className="h-3 w-3" />
            Add Rule
          </Button>
        </div>
        <div className="space-y-2">
          {denyRules.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No deny rules configured.
            </p>
          ) : (
            denyRules.map((rule) => (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-3 rounded-lg border bg-card"
              >
                <Input
                  placeholder="e.g., Bash(curl:*)"
                  value={rule.value}
                  onChange={(e) => onUpdateRule("deny", rule.id, e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveRule("deny", rule.id)}
                  className="h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.div>
            ))
          )}
        </div>
      </div>
      
      <div className="pt-2 space-y-2">
        <p className="text-xs text-muted-foreground">
          <strong>Examples:</strong>
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 ml-4">
          <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash</code> - Allow all bash commands</li>
          <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash(npm run build)</code> - Allow exact command</li>
          <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash(npm run test:*)</code> - Allow commands with prefix</li>
          <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Read(~/.zshrc)</code> - Allow reading specific file</li>
          <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Edit(docs/**)</code> - Allow editing files in docs directory</li>
        </ul>
      </div>
    </div>
  );
};