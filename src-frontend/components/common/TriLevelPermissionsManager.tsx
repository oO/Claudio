import React from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Shield, User, Users, Smartphone } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DebugLabel } from "@/components/ui/atoms";
import { cn } from "@/lib/utils";
import type { TriLevelRule } from "@/hooks/useTriLevelSettings";

interface TriLevelPermissionsManagerProps {
  rules: TriLevelRule[];
  onAddRule: (type: "allow" | "deny", value: string) => void;
  onToggleLevel: (ruleId: string, level: "user" | "team" | "local") => Promise<void>;
  onUpdateRule: (ruleId: string, value: string) => void;
  onDeleteRule: (ruleId: string) => void;
  loading?: boolean;
  /**
   * When true, hides level toggle buttons and shows only user-level rules
   * Used in global settings where there's no project context
   */
  userOnly?: boolean;
}

/**
 * Component for managing permission rules across all 3 Claude Code settings levels
 */
export const TriLevelPermissionsManager: React.FC<TriLevelPermissionsManagerProps> = ({
  rules,
  onAddRule,
  onToggleLevel,
  onUpdateRule,
  onDeleteRule,
  loading = false,
  userOnly = false,
}) => {
  const allowRules = rules
    .filter(rule => rule.type === "allow" && (userOnly ? rule.levels.user : true))
    .sort((a, b) => a.value.localeCompare(b.value));
  const denyRules = rules
    .filter(rule => rule.type === "deny" && (userOnly ? rule.levels.user : true))
    .sort((a, b) => a.value.localeCompare(b.value));

  // Track newly created rules to auto-enable appropriate level
  const [lastCreatedRuleId, setLastCreatedRuleId] = React.useState<string | null>(null);

  // Auto-enable appropriate level for newly created empty rules
  React.useEffect(() => {
    if (lastCreatedRuleId) {
      const rule = rules.find(r => r.id === lastCreatedRuleId);
      if (rule && rule.value === "" && !rule.levels.local && !rule.levels.user && !rule.levels.team) {
        const levelToEnable = userOnly ? "user" : "local";
        onToggleLevel(rule.id, levelToEnable);
        setLastCreatedRuleId(null);
      }
    }
  }, [rules, lastCreatedRuleId, onToggleLevel, userOnly]);

  const handleAddRule = (type: "allow" | "deny") => {
    // Create the rule with empty value
    onAddRule(type, "");
    
    // Find the newly created rule (it will have empty value and current timestamp in ID)
    setTimeout(() => {
      const newRule = rules.find(r => r.type === type && r.value === "" && !r.levels.user && !r.levels.team && !r.levels.local);
      if (newRule) {
        setLastCreatedRuleId(newRule.id);
      }
    }, 10);
  };

  const LevelToggleButton: React.FC<{
    level: "user" | "team" | "local";
    active: boolean;
    onClick: () => void;
    disabled?: boolean;
  }> = ({ level, active, onClick, disabled }) => {
    const config = {
      user: { icon: User, label: "USER", color: "blue" },
      team: { icon: Users, label: "TEAM", color: "green" },
      local: { icon: Smartphone, label: "LOCAL", color: "orange" }
    };
    
    const { icon: Icon, label, color } = config[level];
    
    return (
      <Button
        variant={active ? "default" : "outline"}
        size="sm"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "h-7 w-7 p-0 transition-all",
          active && {
            "bg-blue-500 hover:bg-blue-600": color === "blue",
            "bg-green-500 hover:bg-green-600": color === "green", 
            "bg-orange-500 hover:bg-orange-600": color === "orange"
          }
        )}
      >
        <Icon className={cn(
          "h-3 w-3 transition-colors",
          active ? "text-white" : {
            "text-blue-500": color === "blue",
            "text-green-500": color === "green", 
            "text-orange-500": color === "orange"
          }
        )} />
      </Button>
    );
  };

  const RuleItem: React.FC<{ rule: TriLevelRule; type: "allow" | "deny" }> = ({ rule, type }) => {
    const isAllow = type === "allow";
    const hasAnyLevel = rule.levels.user || rule.levels.team || rule.levels.local;
    
    return (
      <motion.div
        key={rule.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "flex items-center gap-3 py-2 px-3 transition-all border-b border-border/50 last:border-b-0",
          !hasAnyLevel && "opacity-50"
        )}
      >
        {/* Rule Input */}
        <div className="flex-1">
          <Input
            placeholder={`e.g., Bash(${isAllow ? 'git diff:*' : 'rm:*'})`}
            value={rule.value}
            onChange={(e) => onUpdateRule(rule.id, e.target.value)}
            className="text-sm h-8 font-mono bg-input"
            disabled={loading}
          />
        </div>

        {/* Level Toggle Buttons */}
        {!userOnly && (
          <div className="flex gap-1">
            <LevelToggleButton
              level="user"
              active={rule.levels.user}
              onClick={() => onToggleLevel(rule.id, "user")}
              disabled={loading}
            />
            <LevelToggleButton
              level="team" 
              active={rule.levels.team}
              onClick={() => onToggleLevel(rule.id, "team")}
              disabled={loading}
            />
            <LevelToggleButton
              level="local"
              active={rule.levels.local}
              onClick={() => onToggleLevel(rule.id, "local")}
              disabled={loading}
            />
          </div>
        )}

        {/* Delete Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDeleteRule(rule.id)}
          disabled={loading}
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6 relative">
      <DebugLabel label="TriLevelPermissionsManager" />
      
      {/* Allow Rules Section */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-green-500">Allow Rules</h3>
        
        <div className="rounded-lg border bg-card">
          {allowRules.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              No allow rules configured. Claude will ask for approval for all tools.
            </div>
          ) : (
            allowRules.map((rule) => (
              <RuleItem key={rule.id} rule={rule} type="allow" />
            ))
          )}
          <div className="p-3 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddRule("allow")}
              disabled={loading}
              className="gap-2 hover:border-green-500/50 hover:text-green-500 h-8 w-full"
            >
              <Plus className="h-3 w-3" />
              Add Allow Rule
            </Button>
          </div>
        </div>
      </div>
      
      {/* Deny Rules Section */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-red-500">Deny Rules</h3>
        
        <div className="rounded-lg border bg-card">
          {denyRules.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              No deny rules configured.
            </div>
          ) : (
            denyRules.map((rule) => (
              <RuleItem key={rule.id} rule={rule} type="deny" />
            ))
          )}
          <div className="p-3 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddRule("deny")}
              disabled={loading}
              className="gap-2 hover:border-red-500/50 hover:text-red-500 h-8 w-full"
            >
              <Plus className="h-3 w-3" />
              Add Deny Rule
            </Button>
          </div>
        </div>
      </div>
      
      {/* Examples & Legend Section */}
      <div className="space-y-4 p-4 bg-muted/30 rounded-md">
        {/* Level Legend - only show when not userOnly */}
        {!userOnly && (
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2">Level Icons:</p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 text-blue-500" />
                <span><strong>USER</strong>: ~/.claude/settings.json</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 text-green-500" />
                <span><strong>TEAM</strong>: .claude/settings.json</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="h-3 w-3 text-orange-500" />
                <span><strong>LOCAL</strong>: .claude/settings.local.json</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Examples */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-2">Examples:</p>
          <ul className="text-xs text-muted-foreground space-y-1 ml-2">
            <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash</code> - Allow all bash commands</li>
            <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash(npm run build)</code> - Allow exact command</li>
            <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash(git diff:*)</code> - Allow git diff with any args</li>
            <li>• <code className="px-1 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400">Bash(rm:*)</code> - Deny all rm commands</li>
          </ul>
        </div>
      </div>
    </div>
  );
};