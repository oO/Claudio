import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SlashCommandsManager } from '@/components/common';
import { DebugLabel } from '@/components/ui/atoms';

interface SlashCommandsSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
}

export const SlashCommandsSettings: React.FC<SlashCommandsSettingsProps> = ({
  open,
  onOpenChange,
  projectPath,
}) => {
  return (
    <div className="relative">
      {open && <DebugLabel label="SlashCommandsSettings" />}
      <Dialog open={open} onOpenChange={onOpenChange}>
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
    </div>
  );
};

export default SlashCommandsSettings;