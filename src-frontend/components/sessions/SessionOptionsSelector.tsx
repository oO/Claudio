import React, { useState } from 'react';
import { Settings, ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AnimatePresence, motion } from 'framer-motion';
import { DebugLabel } from '@/components/ui/atoms';

interface SessionOptions {
  maxTurns?: number;
  systemPrompt?: string;
  tools?: string[];
  workingDirectory?: string;
}

interface SessionOptionsSelectorProps {
  options: SessionOptions;
  onChange: (options: SessionOptions) => void;
  disabled?: boolean;
}

const AVAILABLE_TOOLS = [
  'Bash', 'Read', 'Write', 'Edit', 'LS', 'Grep', 'Glob', 
  'WebSearch', 'WebFetch', 'Task', 'MultiEdit'
];

export const SessionOptionsSelector: React.FC<SessionOptionsSelectorProps> = ({
  options,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleMaxTurnsChange = (value: string) => {
    const maxTurns = value === 'unlimited' ? undefined : parseInt(value, 10);
    onChange({ ...options, maxTurns });
  };

  const handleToolToggle = (tool: string) => {
    const currentTools = options.tools || AVAILABLE_TOOLS;
    const newTools = currentTools.includes(tool)
      ? currentTools.filter(t => t !== tool)
      : [...currentTools, tool];
    onChange({ ...options, tools: newTools });
  };

  const activeOptionsCount = [
    options.maxTurns !== undefined && options.maxTurns !== 5,
    options.systemPrompt?.trim(),
    options.tools && options.tools.length !== AVAILABLE_TOOLS.length,
    options.workingDirectory?.trim(),
  ].filter(Boolean).length;

  return (
    <div className="relative">
      <DebugLabel label="SessionOptionsSelector" />
      <Button 
        variant="outline" 
        size="sm" 
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <Wrench className="h-3 w-3" />
        <span>Options</span>
        {activeOptionsCount > 0 && (
          <Badge variant="secondary" className="h-4 px-1 text-xs">
            {activeOptionsCount}
          </Badge>
        )}
        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </Button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 space-y-3 p-3 border rounded-md bg-muted/20 overflow-hidden"
          >
        {/* Max Turns */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">Max Conversation Turns</Label>
          <Select 
            value={options.maxTurns?.toString() || 'unlimited'} 
            onValueChange={handleMaxTurnsChange}
            disabled={disabled}
          >
            <SelectTrigger className="w-full h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unlimited">Unlimited</SelectItem>
              <SelectItem value="1">1 turn</SelectItem>
              <SelectItem value="3">3 turns</SelectItem>
              <SelectItem value="5">5 turns</SelectItem>
              <SelectItem value="10">10 turns</SelectItem>
              <SelectItem value="20">20 turns</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* System Prompt */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">Custom System Prompt</Label>
          <Input
            placeholder="Optional system prompt override..."
            value={options.systemPrompt || ''}
            onChange={(e) => onChange({ ...options, systemPrompt: e.target.value })}
            disabled={disabled}
            className="h-8 text-xs"
          />
        </div>

        {/* Tools/Permissions */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Available Tools</Label>
          <div className="grid grid-cols-2 gap-1">
            {AVAILABLE_TOOLS.map(tool => {
              const isEnabled = !options.tools || options.tools.includes(tool);
              return (
                <Button
                  key={tool}
                  variant={isEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleToolToggle(tool)}
                  disabled={disabled}
                  className="h-7 text-xs justify-start"
                >
                  {tool}
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {options.tools ? `${options.tools.length} tools enabled` : 'All tools enabled'}
          </p>
        </div>

        {/* Working Directory */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">Working Directory Override</Label>
          <Input
            placeholder="Use project directory by default"
            value={options.workingDirectory || ''}
            onChange={(e) => onChange({ ...options, workingDirectory: e.target.value })}
            disabled={disabled}
            className="h-8 text-xs font-mono"
          />
        </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};