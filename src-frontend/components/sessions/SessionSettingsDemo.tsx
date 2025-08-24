import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileCode, Settings2, Plus } from "lucide-react";
import { ClaudoSessionSettings } from './ClaudoSessionSettings';
import { DebugLabel } from "@/components/ui/atoms";
import { logger } from "@/lib/logger";
import type { ClaudioSession } from "@/lib/api";

/**
 * Demo component showcasing the new ~/.claudio/ session management system
 * This demonstrates creating and managing session-specific Claude CLI settings
 */
export function SessionSettingsDemo() {
  const [showSettings, setShowSettings] = useState(false);
  const [demoSession, setDemoSession] = useState<ClaudioSession | null>(null);

  const handleSettingsSaved = (session: ClaudioSession) => {
    setDemoSession(session);
    logger.info('Demo session settings saved:', session);
    setShowSettings(false);
  };

  return (
    <div className="space-y-6 relative">
      <DebugLabel label="SessionSettingsDemo" />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            ~/.claudio/ Session Management
          </CardTitle>
          <CardDescription>
            New persistent session management with session-level Claude CLI settings.
            Each session can have its own model, tools, prompts, and configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Features</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Session-specific model selection (Sonnet, Haiku, Opus)</li>
                <li>• Custom system prompts and output-style integration</li>
                <li>• Tool permissions per session</li>
                <li>• Working directory overrides</li>
                <li>• Conversation continuation tracking</li>
                <li>• Persistent metadata storage</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Architecture</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <code>~/.claudio/projects/&lt;project&gt;/</code></li>
                <li>• <code>&lt;session-id&gt;.json</code> metadata files</li>
                <li>• Claude CLI session ID tracking</li>
                <li>• JSON schema for settings</li>
                <li>• Tauri backend CRUD operations</li>
                <li>• TypeScript API integration</li>
              </ul>
            </div>
          </div>
          
          <div className="flex items-center gap-2 pt-4">
            <Button
              onClick={() => setShowSettings(true)}
              variant="default"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Demo Session
            </Button>
            
            {demoSession && (
              <Badge variant="secondary" className="ml-2">
                Session: {demoSession.claudio_id.slice(0, 8)}...
              </Badge>
            )}
          </div>
          
          {demoSession && (
            <div className="mt-4 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Last Session Configuration</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Model:</span>{' '}
                  {demoSession.settings.model || 'Default'}
                </div>
                <div>
                  <span className="text-muted-foreground">Max Turns:</span>{' '}
                  {demoSession.settings.max_turns || 'Unlimited'}
                </div>
                <div>
                  <span className="text-muted-foreground">Tools:</span>{' '}
                  {demoSession.settings.tools?.length || 'All'} allowed
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <span className="capitalize">{demoSession.status.toLowerCase()}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showSettings && (
        <ClaudoSessionSettings
          projectPath="/demo/project/path"
          sessionId={`demo-${Date.now()}`}
          isNewSession={true}
          onSettingsSaved={handleSettingsSaved}
        />
      )}
    </div>
  );
}