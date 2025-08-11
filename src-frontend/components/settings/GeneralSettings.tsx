import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClaudeVersionSelector } from "@/components/claude";
import { useTheme } from "@/hooks";
import { useClaudeBinaryConfig } from "@/hooks/useClaudeBinaryConfig";
import type { ClaudeSettings } from "@/lib/api";
import { THEMES } from "@/lib/themes";

interface GeneralSettingsProps {
  settings: ClaudeSettings | null;
  onUpdateSetting: (key: string, value: any) => void;
  onBinaryPathChanged?: (changed: boolean) => void;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  settings,
  onUpdateSetting,
  onBinaryPathChanged,
}) => {
  const { theme, setTheme, customColors, setCustomColors } = useTheme();
  const {
    currentBinaryPath,
    selectedInstallation,
    binaryPathChanged,
    handleClaudeInstallationSelect,
  } = useClaudeBinaryConfig(onBinaryPathChanged);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold mb-4">General Settings</h3>
        
        <div className="space-y-4">
          {/* Theme Selector */}
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={theme}
              onValueChange={(value) => setTheme(value as any)}
            >
              <SelectTrigger id="theme" className="w-full">
                <SelectValue placeholder="Select a theme" />
              </SelectTrigger>
              <SelectContent>
                {THEMES.map(theme => (
                  <SelectItem key={theme.id} value={theme.id}>
                    {theme.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose your preferred color theme for the interface
            </p>
          </div>
          
          {/* Custom Color Editor */}
          {theme === 'custom' && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <h4 className="text-sm font-medium">Custom Theme Colors</h4>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Background Color */}
                <div className="space-y-2">
                  <Label htmlFor="color-background" className="text-xs">Background</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color-background"
                      type="text"
                      value={customColors.background}
                      onChange={(e) => setCustomColors({ background: e.target.value })}
                      placeholder="oklch(0.12 0.01 240)"
                      className="font-mono text-xs"
                    />
                    <div 
                      className="w-10 h-10 rounded border"
                      style={{ backgroundColor: customColors.background }}
                    />
                  </div>
                </div>
                
                {/* Foreground Color */}
                <div className="space-y-2">
                  <Label htmlFor="color-foreground" className="text-xs">Foreground</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color-foreground"
                      type="text"
                      value={customColors.foreground}
                      onChange={(e) => setCustomColors({ foreground: e.target.value })}
                      placeholder="oklch(0.98 0.01 240)"
                      className="font-mono text-xs"
                    />
                    <div 
                      className="w-10 h-10 rounded border"
                      style={{ backgroundColor: customColors.foreground }}
                    />
                  </div>
                </div>
                
                {/* Primary Color */}
                <div className="space-y-2">
                  <Label htmlFor="color-primary" className="text-xs">Primary</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color-primary"
                      type="text"
                      value={customColors.primary}
                      onChange={(e) => setCustomColors({ primary: e.target.value })}
                      placeholder="oklch(0.98 0.01 240)"
                      className="font-mono text-xs"
                    />
                    <div 
                      className="w-10 h-10 rounded border"
                      style={{ backgroundColor: customColors.primary }}
                    />
                  </div>
                </div>
                
                {/* Card Color */}
                <div className="space-y-2">
                  <Label htmlFor="color-card" className="text-xs">Card</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color-card"
                      type="text"
                      value={customColors.card}
                      onChange={(e) => setCustomColors({ card: e.target.value })}
                      placeholder="oklch(0.14 0.01 240)"
                      className="font-mono text-xs"
                    />
                    <div 
                      className="w-10 h-10 rounded border"
                      style={{ backgroundColor: customColors.card }}
                    />
                  </div>
                </div>
                
                {/* Accent Color */}
                <div className="space-y-2">
                  <Label htmlFor="color-accent" className="text-xs">Accent</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color-accent"
                      type="text"
                      value={customColors.accent}
                      onChange={(e) => setCustomColors({ accent: e.target.value })}
                      placeholder="oklch(0.16 0.01 240)"
                      className="font-mono text-xs"
                    />
                    <div 
                      className="w-10 h-10 rounded border"
                      style={{ backgroundColor: customColors.accent }}
                    />
                  </div>
                </div>
                
                {/* Destructive Color */}
                <div className="space-y-2">
                  <Label htmlFor="color-destructive" className="text-xs">Destructive</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color-destructive"
                      type="text"
                      value={customColors.destructive}
                      onChange={(e) => setCustomColors({ destructive: e.target.value })}
                      placeholder="oklch(0.6 0.2 25)"
                      className="font-mono text-xs"
                    />
                    <div 
                      className="w-10 h-10 rounded border"
                      style={{ backgroundColor: customColors.destructive }}
                    />
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Use CSS color values (hex, rgb, oklch, etc.). Changes apply immediately.
              </p>
            </div>
          )}
          
          {/* Include Co-authored By */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="coauthored">Include "Co-authored by Claude"</Label>
              <p className="text-xs text-muted-foreground">
                Add Claude attribution to git commits and pull requests
              </p>
            </div>
            <Switch
              id="coauthored"
              checked={settings?.includeCoAuthoredBy !== false}
              onCheckedChange={(checked) => onUpdateSetting("includeCoAuthoredBy", checked)}
            />
          </div>
          
          {/* Verbose Output */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="verbose">Verbose Output</Label>
              <p className="text-xs text-muted-foreground">
                Show full bash and command outputs
              </p>
            </div>
            <Switch
              id="verbose"
              checked={settings?.verbose === true}
              onCheckedChange={(checked) => onUpdateSetting("verbose", checked)}
            />
          </div>
          
          {/* Cleanup Period */}
          <div className="space-y-2">
            <Label htmlFor="cleanup">Chat Transcript Retention (days)</Label>
            <Input
              id="cleanup"
              type="number"
              min="1"
              placeholder="30"
              value={settings?.cleanupPeriodDays || ""}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : undefined;
                onUpdateSetting("cleanupPeriodDays", value);
              }}
            />
            <p className="text-xs text-muted-foreground">
              How long to retain chat transcripts locally (default: 30 days)
            </p>
          </div>
          
          {/* Claude Binary Path Selector */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Claude Code Installation</Label>
              <p className="text-xs text-muted-foreground mb-4">
                Select which Claude Code installation to use.
              </p>
            </div>
            <ClaudeVersionSelector
              selectedPath={currentBinaryPath}
              onSelect={handleClaudeInstallationSelect}
            />
            {binaryPathChanged && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠️ Claude binary path has been changed. Remember to save your settings.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};