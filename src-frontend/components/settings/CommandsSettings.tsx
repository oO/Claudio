import React from "react";
import { SlashCommandsManager } from "@/components/common";
import { DebugLabel } from "@/components/ui/atoms";

export const CommandsSettings: React.FC = () => {
  return (
    <div className="relative flex flex-col h-full">
      <DebugLabel label="CommandsSettings" />

      {/* Fixed header */}
      <div className="p-6 pb-4">
        <h3 className="text-lg font-semibold text-accent">Slash Commands</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Create custom commands to streamline your workflow
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 px-6 pb-6">
        <SlashCommandsManager />
      </div>
    </div>
  );
};