import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface Example {
  id: string;
  content: string;
  commentary: string;
}

interface ExampleEditorProps {
  /**
   * Current description that may contain XML examples
   */
  description: string;
  /**
   * Callback when description changes (with examples parsed out)
   */
  onDescriptionChange: (description: string) => void;
  /**
   * Callback when examples change
   */
  onExamplesChange: (examples: Example[]) => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Parses XML examples from description text
 */
export const parseExamplesFromDescription = (description: string): { cleanDescription: string; examples: Example[] } => {
  const examples: Example[] = [];
  let cleanDescription = description;

  // Find all example blocks
  const exampleRegex = /<example>([\s\S]*?)<\/example>/g;
  let match;
  let exampleIndex = 0;

  while ((match = exampleRegex.exec(description)) !== null) {
    const fullExampleContent = match[1].trim();
    
    // Extract commentary if present
    const commentaryMatch = fullExampleContent.match(/<commentary>([\s\S]*?)<\/commentary>/);
    const commentary = commentaryMatch ? commentaryMatch[1].trim() : '';
    
    // Get example content without commentary tags
    const content = fullExampleContent.replace(/<commentary>[\s\S]*?<\/commentary>/, '').trim();

    examples.push({
      id: `example-${exampleIndex++}`,
      content,
      commentary
    });
  }

  // Remove all example blocks from description
  cleanDescription = cleanDescription.replace(exampleRegex, '').trim();
  
  // Clean up any "Examples:" prefix that might be left
  cleanDescription = cleanDescription.replace(/\s*Examples:\s*$/, '').trim();

  return { cleanDescription, examples };
};

/**
 * Serializes examples back to XML format and combines with description
 */
export const serializeExamplesToDescription = (cleanDescription: string, examples: Example[]): string => {
  if (examples.length === 0) {
    return cleanDescription;
  }

  let result = cleanDescription;
  
  if (result && !result.endsWith('.') && !result.endsWith(':')) {
    result += '.';
  }
  
  if (result) {
    result += ' Examples: ';
  } else {
    result = 'Examples: ';
  }

  examples.forEach(example => {
    result += '<example>';
    result += example.content;
    
    if (example.commentary) {
      result += ` <commentary>${example.commentary}</commentary>`;
    }
    
    result += '</example> ';
  });

  return result.trim();
};

export const ExampleEditor: React.FC<ExampleEditorProps> = ({
  description,
  onDescriptionChange,
  onExamplesChange,
  className
}) => {
  const [cleanDescription, setCleanDescription] = useState('');
  const [examples, setExamples] = useState<Example[]>([]);

  // Parse initial description on mount
  useEffect(() => {
    const { cleanDescription: parsed, examples: parsedExamples } = parseExamplesFromDescription(description);
    setCleanDescription(parsed);
    setExamples(parsedExamples);
    onExamplesChange(parsedExamples);
  }, [description, onExamplesChange]);

  // Update parent when clean description changes
  const handleDescriptionChange = (newDescription: string) => {
    setCleanDescription(newDescription);
    const fullDescription = serializeExamplesToDescription(newDescription, examples);
    onDescriptionChange(fullDescription);
  };

  // Update parent when examples change
  const handleExamplesChange = (newExamples: Example[]) => {
    setExamples(newExamples);
    const fullDescription = serializeExamplesToDescription(cleanDescription, newExamples);
    onDescriptionChange(fullDescription);
    onExamplesChange(newExamples);
  };

  const addExample = () => {
    const newExample: Example = {
      id: `example-${Date.now()}`,
      content: '',
      commentary: ''
    };
    handleExamplesChange([...examples, newExample]);
  };

  const deleteExample = (id: string) => {
    handleExamplesChange(examples.filter(ex => ex.id !== id));
  };

  const updateExample = (id: string, updates: Partial<Example>) => {
    handleExamplesChange(examples.map(ex => 
      ex.id === id ? { ...ex, ...updates } : ex
    ));
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Clean Description */}
      <div className="space-y-2">
        <Label htmlFor="clean-description">Description</Label>
        <textarea
          id="clean-description"
          value={cleanDescription}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="Brief description of when to use this agent"
          className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:border-transparent resize-none overflow-hidden"
          style={{ 
            minHeight: '42px',
            height: 'auto'
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = target.scrollHeight + 'px';
          }}
        />
      </div>

      {/* Examples Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Usage Examples</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addExample}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Example
          </Button>
        </div>

        <AnimatePresence>
          {examples.map((example, index) => (
            <motion.div
              key={example.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 border border-border rounded-lg space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Example {index + 1}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteExample(example.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Example Content */}
              <div className="space-y-2">
                <Label htmlFor={`content-${example.id}`} className="text-xs">
                  Example Content
                </Label>
                <textarea
                  id={`content-${example.id}`}
                  value={example.content}
                  onChange={(e) => updateExample(example.id, { content: e.target.value })}
                  placeholder="Context: User has made changes... user: 'I've added a new feature...' assistant: 'I'll use the git-commit-expert agent...'"
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  rows={4}
                />
              </div>

              {/* Commentary */}
              <div className="space-y-2">
                <Label htmlFor={`commentary-${example.id}`} className="text-xs">
                  Commentary
                </Label>
                <textarea
                  id={`commentary-${example.id}`}
                  value={example.commentary}
                  onChange={(e) => updateExample(example.id, { commentary: e.target.value })}
                  placeholder="Explanation of why this agent is used for this scenario..."
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  rows={2}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {examples.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No examples yet</p>
            <p className="text-xs">Add examples to help Claude Code understand when to use this agent</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExampleEditor;