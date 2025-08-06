import React from "react";
import { motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold mb-2">Permission Rules</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Control which tools Claude Code can use without manual approval
        </p>
      </div>
      
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
                className="flex items-center gap-2"
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
                className="flex items-center gap-2"
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