import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckpointSettings } from './CheckpointSettings';
import { SlashCommandsManager } from '@/components/common';
import type { Session } from '@/lib/api';

interface SessionSettingsProps {
  // Fork dialog state
  showForkDialog: boolean;
  forkCheckpointId: string | null;
  forkSessionName: string;
  onForkDialogChange: (show: boolean) => void;
  onForkSessionNameChange: (name: string) => void;
  onConfirmFork: () => Promise<void>;
  
  // Settings dialog state
  showSettings: boolean;
  onSettingsChange: (show: boolean) => void;
  
  // Slash commands dialog state
  showSlashCommandsSettings: boolean;
  onSlashCommandsSettingsChange: (show: boolean) => void;
  
  // Session data
  effectiveSession: Session | null;
  projectPath: string;
  isLoading: boolean;
}

export const SessionSettings: React.FC<SessionSettingsProps> = ({
  showForkDialog,
  forkCheckpointId: _forkCheckpointId,
  forkSessionName,
  onForkDialogChange,
  onForkSessionNameChange,
  onConfirmFork,
  showSettings,
  onSettingsChange,
  showSlashCommandsSettings,
  onSlashCommandsSettingsChange,
  effectiveSession,
  projectPath,
  isLoading,
}) => {
  return (
    <>
      {/* Fork Dialog */}
      <Dialog open={showForkDialog} onOpenChange={onForkDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fork Session</DialogTitle>
            <DialogDescription>
              Create a new session branch from the selected checkpoint.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fork-name">New Session Name</Label>
              <Input
                id="fork-name"
                placeholder="e.g., Alternative approach"
                value={forkSessionName}
                onChange={(e) => onForkSessionNameChange(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !isLoading) {
                    onConfirmFork();
                  }
                }}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onForkDialogChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirmFork}
              disabled={isLoading || !forkSessionName.trim()}
            >
              Create Fork
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      {showSettings && effectiveSession && (
        <Dialog open={showSettings} onOpenChange={onSettingsChange}>
          <DialogContent className="max-w-2xl">
            <CheckpointSettings
              sessionId={effectiveSession.id}
              projectId={effectiveSession.project_id}
              projectPath={projectPath}
              onClose={() => onSettingsChange(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Slash Commands Settings Dialog */}
      {showSlashCommandsSettings && (
        <Dialog open={showSlashCommandsSettings} onOpenChange={onSlashCommandsSettingsChange}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Slash Commands</DialogTitle>
              <DialogDescription>
                Manage project-specific slash commands for {projectPath}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              <SlashCommandsManager projectPath={projectPath} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default SessionSettings;