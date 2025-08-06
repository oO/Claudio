import React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { StatusMessage } from "../molecules/StatusMessage";
import { cn } from "@/lib/utils";
import {
  EditResultWidget,
  MultiEditResultWidget,
  LSResultWidget,
  ReadResultWidget,
  SystemReminderWidget,
  CommandOutputWidget
} from "@/components/tools/ToolWidgets";

interface ToolResultProps {
  content: any;
  toolUseId?: string;
  isError?: boolean;
  streamMessages?: any[];
  onLinkDetected?: (url: string) => void;
}

/**
 * Organism component for rendering tool results with consistent formatting
 * Leverages StatusMessage molecule and specialized result widgets
 */
export const ToolResultRenderer: React.FC<ToolResultProps> = ({
  content,
  toolUseId,
  isError,
  streamMessages,
  onLinkDetected
}) => {
  // Extract the actual content string
  const extractContentText = (content: any): string => {
    if (typeof content === 'string') {
      return content;
    }
    if (content && typeof content === 'object') {
      if (content.text) {
        return content.text;
      }
      if (Array.isArray(content)) {
        return content
          .map((c: any) => (typeof c === 'string' ? c : c.text || JSON.stringify(c)))
          .join('\n');
      }
      return JSON.stringify(content, null, 2);
    }
    return '';
  };

  const contentText = extractContentText(content.content || content);

  // Handle empty results
  if (!contentText || contentText.trim() === '') {
    return (
      <StatusMessage
        type="info"
        message="Tool did not return any output"
        className="ml-6"
      />
    );
  }

  // Handle system reminders
  const reminderMatch = contentText.match(/<system-reminder>(.*?)<\/system-reminder>/s);
  if (reminderMatch) {
    const reminderMessage = reminderMatch[1].trim();
    const beforeReminder = contentText.substring(0, reminderMatch.index || 0).trim();
    const afterReminder = contentText.substring((reminderMatch.index || 0) + reminderMatch[0].length).trim();
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">Tool Result</span>
        </div>
        
        {beforeReminder && (
          <div className="ml-6 p-2 bg-background rounded-md border">
            <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
              {beforeReminder}
            </pre>
          </div>
        )}
        
        <div className="ml-6">
          <SystemReminderWidget message={reminderMessage} />
        </div>
        
        {afterReminder && (
          <div className="ml-6 p-2 bg-background rounded-md border">
            <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
              {afterReminder}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Handle Edit tool results
  const isEditResult = contentText.includes("has been updated. Here's the result of running `cat -n`");
  if (isEditResult) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">Edit Result</span>
        </div>
        <EditResultWidget content={contentText} />
      </div>
    );
  }

  // Handle MultiEdit tool results
  const isMultiEditResult = contentText.includes("has been updated with multiple edits") || 
                           contentText.includes("MultiEdit completed successfully") ||
                           contentText.includes("Applied multiple edits to");
  if (isMultiEditResult) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">MultiEdit Result</span>
        </div>
        <MultiEditResultWidget content={contentText} />
      </div>
    );
  }

  // Handle LS tool results
  const isLSResult = (() => {
    if (!toolUseId || typeof contentText !== 'string') return false;
    
    // Check if this result came from an LS tool by looking for the tool call
    let isFromLSTool = false;
    
    if (streamMessages) {
      for (let i = streamMessages.length - 1; i >= 0; i--) {
        const prevMsg = streamMessages[i];
        if (prevMsg.type === 'assistant' && prevMsg.message?.content && Array.isArray(prevMsg.message.content)) {
          const toolUse = prevMsg.message.content.find((c: any) => 
            c.type === 'tool_use' && 
            c.id === toolUseId &&
            c.name?.toLowerCase() === 'ls'
          );
          if (toolUse) {
            isFromLSTool = true;
            break;
          }
        }
      }
    }
    
    if (!isFromLSTool) return false;
    
    // Additional validation: check for tree structure pattern
    const lines = contentText.split('\n');
    const hasTreeStructure = lines.some(line => /^\s*-\s+/.test(line));
    const hasNoteAtEnd = lines.some(line => line.trim().startsWith('NOTE: do any of the files'));
    
    return hasTreeStructure || hasNoteAtEnd;
  })();

  if (isLSResult) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">Directory Contents</span>
        </div>
        <LSResultWidget content={contentText} />
      </div>
    );
  }

  // Handle Read tool results
  const isReadResult = toolUseId && typeof contentText === 'string' && /^\s*\d+→/.test(contentText);
  if (isReadResult) {
    // Try to find the corresponding Read tool call to get the file path
    let filePath: string | undefined;
    
    if (streamMessages) {
      for (let i = streamMessages.length - 1; i >= 0; i--) {
        const prevMsg = streamMessages[i];
        if (prevMsg.type === 'assistant' && prevMsg.message?.content && Array.isArray(prevMsg.message.content)) {
          const toolUse = prevMsg.message.content.find((c: any) => 
            c.type === 'tool_use' && 
            c.id === toolUseId &&
            c.name?.toLowerCase() === 'read'
          );
          if (toolUse?.input?.file_path) {
            filePath = toolUse.input.file_path;
            break;
          }
        }
      }
    }
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">Read Result</span>
        </div>
        <ReadResultWidget content={contentText} filePath={filePath} />
      </div>
    );
  }

  // Handle command output
  if (onLinkDetected) {
    const stdoutMatch = contentText.match(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/);
    if (stdoutMatch) {
      const output = stdoutMatch[1];
      return <CommandOutputWidget output={output} onLinkDetected={onLinkDetected} />;
    }
  }

  // Default tool result display
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {isError ? (
          <AlertCircle className="h-4 w-4 text-destructive" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        )}
        <span className="text-sm font-medium">Tool Result</span>
      </div>
      <div className="ml-6 p-2 bg-background rounded-md border">
        <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
          {contentText}
        </pre>
      </div>
    </div>
  );
};