import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Settings, Save, RotateCcw } from "lucide-react";
import { api, type ClaudioSession, type ClaudioClaudeSettings } from "@/lib/api";
import { logger } from "@/lib/logger";

interface ClaudoSessionSettingsProps {
  /** Project path for the session */
  projectPath: string;
  /** Claudio session ID */
  sessionId: string;
  /** Whether this is a new session being created */
  isNewSession?: boolean;
  /** Callback when settings are saved */
  onSettingsSaved?: (session: ClaudioSession) => void;
}

const CLAUDE_MODELS = [
  { value: 'sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'haiku', label: 'Claude 3.5 Haiku' },
  { value: 'opus', label: 'Claude 3 Opus' },
];

const DEFAULT_TOOLS = [
  'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Task'
];

/**
 * Component for managing session-level Claude CLI settings
 * Provides UI for configuring model, tools, prompts, and other CLI flags
 */
export function ClaudoSessionSettings({ 
  projectPath, 
  sessionId, 
  isNewSession = false,
  onSettingsSaved 
}: ClaudoSessionSettingsProps) {
  const [settings, setSettings] = useState<ClaudioClaudeSettings>({
    model: undefined,
    max_turns: undefined,
    system_prompt: undefined,
    append_system_prompt: undefined,
    tools: undefined,
    working_directory: undefined,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<ClaudioSession | null>(null);

  // Load existing metadata if not a new session
  useEffect(() => {
    if (!isNewSession) {
      loadSessionMetadata();
    }
  }, [sessionId, projectPath, isNewSession]);

  const loadSessionMetadata = async () => {
    try {
      setLoading(true);
      const data = await api.getSessionMetadata(sessionId, projectPath);
      setSession(data);
      setSettings(data.settings);
      logger.info('Loaded session metadata:', data);
    } catch (error) {
      logger.error('Failed to load session metadata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      let result: ClaudioSession;
      
      if (isNewSession || !session) {
        // Create new session metadata
        result = await api.createSessionMetadata(sessionId, projectPath, settings);
        logger.info('Created new session metadata');
      } else {
        // Update existing session
        const updatedSession = {
          ...session,
          settings: settings,
        };
        result = await api.updateSessionMetadata(sessionId, projectPath, updatedSession);
        logger.info('Updated session metadata');
      }
      
      setSession(result);
      onSettingsSaved?.(result);
      
    } catch (error) {
      logger.error('Failed to save session settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (session) {
      setSettings(session.settings);
    } else {
      setSettings({
        model: undefined,
        max_turns: undefined,
        system_prompt: undefined,
        append_system_prompt: undefined,
        tools: undefined,
        working_directory: undefined,
      });
    }
  };

  const toggleTool = (tool: string) => {
    const currentTools = settings.tools || [];
    if (currentTools.includes(tool)) {
      setSettings({
        ...settings,
        tools: currentTools.filter(t => t !== tool)
      });
    } else {
      setSettings({
        ...settings,
        tools: [...currentTools, tool]
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading session settings...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Session Settings
        </CardTitle>
        <CardDescription>
          Configure Claude CLI settings for this session. These settings will be used when starting new conversations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Model Selection */}
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Select value={settings.model || ""} onValueChange={(value) => 
            setSettings({ ...settings, model: value || undefined })
          }>
            <SelectTrigger>
              <SelectValue placeholder="Use default model" />
            </SelectTrigger>
            <SelectContent>
              {CLAUDE_MODELS.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Max Turns */}
        <div className="space-y-2">
          <Label htmlFor="max_turns">Max Turns</Label>
          <Input
            id="max_turns"
            type="number"
            placeholder="Unlimited"
            value={settings.max_turns || ""}
            onChange={(e) => setSettings({
              ...settings,
              max_turns: e.target.value ? parseInt(e.target.value) : undefined
            })}
          />
          <p className="text-sm text-muted-foreground">
            Maximum number of conversation turns before stopping
          </p>
        </div>

        {/* Working Directory */}
        <div className="space-y-2">
          <Label htmlFor="working_directory">Working Directory</Label>
          <Input
            id="working_directory"
            placeholder="Use project directory"
            value={settings.working_directory || ""}
            onChange={(e) => setSettings({
              ...settings,
              working_directory: e.target.value || undefined
            })}
          />
          <p className="text-sm text-muted-foreground">
            Override the working directory for Claude CLI execution
          </p>
        </div>

        {/* System Prompt */}
        <div className="space-y-2">
          <Label htmlFor="system_prompt">System Prompt</Label>
          <Textarea
            id="system_prompt"
            placeholder="System prompt or path to file"
            value={settings.system_prompt || ""}
            onChange={(e) => setSettings({
              ...settings,
              system_prompt: e.target.value || undefined
            })}
            rows={3}
          />
          <p className="text-sm text-muted-foreground">
            Override the default system prompt or specify a file path
          </p>
        </div>

        {/* Append System Prompt */}
        <div className="space-y-2">
          <Label htmlFor="append_system_prompt">Append System Prompt</Label>
          <Textarea
            id="append_system_prompt"
            placeholder="Additional system prompt content"
            value={settings.append_system_prompt || ""}
            onChange={(e) => setSettings({
              ...settings,
              append_system_prompt: e.target.value || undefined
            })}
            rows={3}
          />
          <p className="text-sm text-muted-foreground">
            Additional content to append to the system prompt (can reference output-style files)
          </p>
        </div>

        {/* Tools */}
        <div className="space-y-3">
          <Label>Tools</Label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_TOOLS.map((tool) => {
              const isSelected = settings.tools?.includes(tool) ?? false;
              return (
                <Badge
                  key={tool}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTool(tool)}
                >
                  {tool}
                </Badge>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground">
            Click to toggle tools. Empty selection allows all tools.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
        
        {session && (
          <div className="text-sm text-muted-foreground pt-2 border-t">
            <p>Session ID: {session.claudio_id.slice(0, 8)}...</p>
            <p>Status: <span className="capitalize">{session.status.toLowerCase()}</span></p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}