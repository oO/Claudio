import React from "react";
import { motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { EnvironmentVariable } from "@/hooks/useSettingsState";
import { DebugLabel } from "@/components/ui/atoms";

interface EnvironmentSettingsProps {
  envVars: EnvironmentVariable[];
  onAddEnvVar: () => void;
  onUpdateEnvVar: (id: string, field: "key" | "value", value: string) => void;
  onRemoveEnvVar: (id: string) => void;
}

export const EnvironmentSettings: React.FC<EnvironmentSettingsProps> = ({
  envVars,
  onAddEnvVar,
  onUpdateEnvVar,
  onRemoveEnvVar,
}) => {
  return (
    <div className="space-y-6 relative">
      <DebugLabel label="EnvironmentSettings" />
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-accent">Environment Variables</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Environment variables applied to every Claude Code session
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onAddEnvVar}
          className="gap-2"
        >
          <Plus className="h-3 w-3" />
          Add Variable
        </Button>
      </div>
      
      <div className="space-y-3">
        {envVars.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No environment variables configured.
          </p>
        ) : (
          envVars.map((envVar) => (
            <motion.div
              key={envVar.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              <Input
                placeholder="KEY"
                value={envVar.key}
                onChange={(e) => onUpdateEnvVar(envVar.id, "key", e.target.value)}
                className="flex-1 font-mono text-sm"
              />
              <span className="text-muted-foreground">=</span>
              <Input
                placeholder="value"
                value={envVar.value}
                onChange={(e) => onUpdateEnvVar(envVar.id, "value", e.target.value)}
                className="flex-1 font-mono text-sm"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveEnvVar(envVar.id)}
                className="h-8 w-8 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </motion.div>
          ))
        )}
      </div>
      
      <div className="pt-2 space-y-2">
        <p className="text-xs text-muted-foreground">
          <strong>Common variables:</strong>
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 ml-4">
          <li>• <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">CLAUDE_CODE_ENABLE_TELEMETRY</code> - Enable/disable telemetry (0 or 1)</li>
          <li>• <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">ANTHROPIC_MODEL</code> - Custom model name</li>
          <li>• <code className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">DISABLE_COST_WARNINGS</code> - Disable cost warnings (1)</li>
        </ul>
      </div>
    </div>
  );
};