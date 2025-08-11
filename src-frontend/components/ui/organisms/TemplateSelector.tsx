import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HookMetadata } from "@/components/ui/molecules";
import { cn } from "@/lib/utils";
import { HookTemplate, HookEvent } from "@/types/hooks";

export interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: HookTemplate[];
  onTemplateSelect: (template: HookTemplate) => void;
  className?: string;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  open,
  onOpenChange,
  templates,
  onTemplateSelect,
  className
}) => {
  // Group templates by event type
  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.event]) {
      acc[template.event] = [];
    }
    acc[template.event].push(template);
    return acc;
  }, {} as Record<HookEvent, HookTemplate[]>);

  const matcherEvents = ['PreToolUse', 'PostToolUse'] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-2xl max-h-[80vh] overflow-y-auto", className)}>
        <DialogHeader>
          <DialogTitle>Hook Templates</DialogTitle>
          <DialogDescription>
            Choose a pre-configured hook template to get started quickly
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {Object.entries(groupedTemplates).map(([event, eventTemplates]) => (
            <div key={event} className="space-y-3">
              <HookMetadata 
                event={event as HookEvent} 
                count={eventTemplates.length}
                className="text-sm font-medium border-b pb-2"
              />
              
              <div className="space-y-2 pl-6">
                {eventTemplates.map(template => (
                  <Card
                    key={template.id}
                    className="p-4 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => onTemplateSelect(template)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{template.name}</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {template.commands.length} command{template.commands.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        {template.description}
                      </p>
                      
                      {matcherEvents.includes(template.event as any) && template.matcher && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Pattern:</span>
                          <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                            {template.matcher}
                          </code>
                        </div>
                      )}
                      
                      {template.commands.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Commands:</span>
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {template.commands.slice(0, 3).map((cmd, i) => (
                              <code key={i} className="block text-xs font-mono bg-muted px-2 py-1 rounded truncate">
                                {cmd}
                              </code>
                            ))}
                            {template.commands.length > 3 && (
                              <p className="text-xs text-muted-foreground">
                                ... and {template.commands.length - 3} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
          
          {Object.keys(groupedTemplates).length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No templates available</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};