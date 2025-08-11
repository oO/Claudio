import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HooksEditor } from "@/components/settings";

interface HooksDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const HooksDialog: React.FC<HooksDialogProps> = ({
  isOpen,
  onOpenChange,
  projectPath,
  activeTab,
  onTabChange,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Configure Hooks</DialogTitle>
          <DialogDescription>
            Configure hooks that run before, during, and after tool executions. Changes are saved immediately.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="project">Project Settings</TabsTrigger>
            <TabsTrigger value="local">Local Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="project" className="flex-1 overflow-auto">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Project hooks are stored in <code className="bg-muted px-1 py-0.5 rounded">.claude/settings.json</code> and 
                are committed to version control.
              </p>
              <HooksEditor
                projectPath={projectPath}
                scope="project"
                className="border-0"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="local" className="flex-1 overflow-auto">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Local hooks are stored in <code className="bg-muted px-1 py-0.5 rounded">.claude/settings.local.json</code> and 
                are not committed to version control.
              </p>
              <HooksEditor
                projectPath={projectPath}
                scope="local"
                className="border-0"
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};