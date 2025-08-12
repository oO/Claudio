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
}) => {
  const [newAllowRule, setNewAllowRule] = React.useState("");
  const [newDenyRule, setNewDenyRule] = React.useState("");

  const allowRules = rules.filter(rule => rule.type === "allow");
  const denyRules = rules.filter(rule => rule.type === "deny");


  const handleAddRule = (type: "allow" | "deny") => {
    const value = type === "allow" ? newAllowRule : newDenyRule;
    if (value.trim()) {
      onAddRule(type, value.trim());
      if (type === "allow") {
        setNewAllowRule("");
      } else {
        setNewDenyRule("");
      }
    }
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
          "h-7 px-2 text-xs gap-1 transition-all",
          active && {
            "bg-blue-500 hover:bg-blue-600": color === "blue",
            "bg-green-500 hover:bg-green-600": color === "green", 
            "bg-orange-500 hover:bg-orange-600": color === "orange"
          }
        )}
      >
        <Icon className="h-3 w-3" />
        {label}
      </Button>
    );
  };

  const RuleItem: React.FC<{ rule: TriLevelRule; type: "allow" | "deny" }> = ({ rule, type }) => {
    const isAllow = type === "allow";
    const colorClass = isAllow ? "text-green-500" : "text-red-500";
    const hasAnyLevel = rule.levels.user || rule.levels.team || rule.levels.local;
    
    return (
      <motion.div
        key={rule.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border bg-card transition-all",
          !hasAnyLevel && "opacity-50 bg-muted/50"
        )}
      >
        {/* Rule Input */}
        <div className="flex-1">
          <Input
            placeholder={`e.g., Bash(${isAllow ? 'git diff:*' : 'rm:*'})`}
            value={rule.value}
            onChange={(e) => onUpdateRule(rule.id, e.target.value)}
            className="text-sm"
            disabled={loading}
          />
        </div>

        {/* Level Toggle Buttons */}
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

        {/* Delete Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDeleteRule(rule.id)}
          disabled={loading}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6 relative">
      <DebugLabel label="TriLevelPermissionsManager" />
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <div>
          <h3 className="text-base font-semibold mb-2">Multi-Level Tool Permissions</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Manage permissions across user, team, and local project levels. Rules can exist at multiple levels simultaneously.
          </p>
        </div>
      </div>

      {/* Level Legend */}
      <div className="flex flex-wrap gap-4 p-3 bg-muted/30 rounded-md text-xs">
        <div className="flex items-center gap-2">
          <User className="h-3 w-3 text-blue-500" />
          <span><strong>USER</strong>: ~/.claude/settings.json (global)</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-3 w-3 text-green-500" />
          <span><strong>TEAM</strong>: .claude/settings.json (shared)</span>
        </div>
        <div className="flex items-center gap-2">
          <Smartphone className="h-3 w-3 text-orange-500" />
          <span><strong>LOCAL</strong>: .claude/settings.local.json (personal)</span>
        </div>
      </div>
      
      {/* Allow Rules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-green-500">Allow Rules</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Add allow rule..."
              value={newAllowRule}
              onChange={(e) => setNewAllowRule(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddRule("allow")}
              className="h-8 text-xs w-48"
              disabled={loading}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddRule("allow")}
              disabled={loading || !newAllowRule.trim()}
              className="gap-2 hover:border-green-500/50 hover:text-green-500 h-8"
            >
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          {allowRules.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No allow rules configured. Claude will ask for approval for all tools.
            </p>
          ) : (
            allowRules.map((rule) => (
              <RuleItem key={rule.id} rule={rule} type="allow" />
            ))
          )}
        </div>
      </div>
      
      {/* Deny Rules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-red-500">Deny Rules</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Add deny rule..."
              value={newDenyRule}
              onChange={(e) => setNewDenyRule(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddRule("deny")}
              className="h-8 text-xs w-48"
              disabled={loading}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddRule("deny")}
              disabled={loading || !newDenyRule.trim()}
              className="gap-2 hover:border-red-500/50 hover:text-red-500 h-8"
            >
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          {denyRules.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No deny rules configured.
            </p>
          ) : (
            denyRules.map((rule) => (
              <RuleItem key={rule.id} rule={rule} type="deny" />
            ))
          )}
        </div>
      </div>
      
      {/* Examples */}
      <div className="pt-2 space-y-2">
        <p className="text-xs text-muted-foreground">
          <strong>Examples:</strong>
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 ml-4">
          <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash</code> - Allow all bash commands</li>
          <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash(npm run build)</code> - Allow exact command</li>
          <li>• <code className="px-1 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">Bash(git diff:*)</code> - Allow git diff with any args</li>
          <li>• <code className="px-1 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400">Bash(rm:*)</code> - Deny all rm commands</li>
        </ul>
      </div>
    </div>
  );
};