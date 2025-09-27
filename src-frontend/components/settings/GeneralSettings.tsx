import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClaudeVersionSelector } from "@/components/claude";
import { useThemeUnified } from "@/hooks";
import { useClaudeBinaryConfig } from "@/hooks/useClaudeBinaryConfig";
import { useTabContext } from "@/contexts/TabContext";
import type { ClaudeSettings } from "@/lib/api";
import { THEMES } from "@/lib/themes";
import { DebugLabel } from "@/components/ui/atoms";
import { logger } from "@/lib/logger";

/**
 * Panel Min Width Setting Component - uses TabContext
 */
const PanelMinWidthSetting: React.FC = () => {
  const { panelMinWidth, setPanelMinWidth } = useTabContext();
  const [inputValue, setInputValue] = useState<string>(panelMinWidth.toString());

  // Update input value when context value changes
  useEffect(() => {
    setInputValue(panelMinWidth.toString());
  }, [panelMinWidth]);

  const handleSave = (value: number) => {
    const parsedValue = value || 500;
    setPanelMinWidth(parsedValue); // TabContext handles clamping
    setInputValue(parsedValue.toString());
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="panelMinWidth">Panel Minimum Width (pixels)</Label>
      <p className="text-xs text-muted-foreground">
        Minimum width for each panel when splitting tabs (300-800 pixels)
      </p>
      <Input
        id="panelMinWidth"
        type="text"
        placeholder="500"
        value={inputValue}
        onChange={(e) => {
          // Only allow digits
          const value = e.target.value.replace(/[^0-9]/g, '');
          setInputValue(value);
        }}
        onBlur={(e) => {
          const value = parseInt(e.target.value) || 500;
          handleSave(value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const value = parseInt(e.currentTarget.value) || 500;
            handleSave(value);
            e.currentTarget.blur();
          }
        }}
        className="w-24"
      />
    </div>
  );
};

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
  const { theme, setTheme, customColors, setCustomColors } = useThemeUnified();
  const {
    currentBinaryPath,
    selectedInstallation,
    binaryPathChanged,
    handleClaudeInstallationSelect,
  } = useClaudeBinaryConfig(onBinaryPathChanged);

  return (
    <div className="space-y-6 relative">
      <DebugLabel label="GeneralSettings" />
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
          
          {/* Panel Minimum Width */}
          <PanelMinWidthSetting />
          
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
          </div>
        </div>
      </div>
    </div>
  );
};