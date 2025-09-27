import { useCallback } from 'react';
import type { Session } from '@/lib/types/sessions';
import { DebugLabel } from '@/components/ui/atoms';
import type { ClaudeStreamMessage } from "@/lib/outputCache";
import { logger } from '@/lib/logger';

interface SessionActionsProps {
  messages: ClaudeStreamMessage[];
  rawJsonlOutput: string[];
  projectPath: string;
  effectiveSession: Session | null;
  onError: (error: string) => void;
  onLoading: (loading: boolean) => void;
}

export const SessionActions: React.FC<SessionActionsProps> = ({
  messages,
  rawJsonlOutput,
  projectPath,
  effectiveSession,
  onError,
  onLoading,
}) => {
  // Copy session as JSONL
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _copyAsJsonl = useCallback(async () => {
    try {
      const jsonl = rawJsonlOutput.join('\n');
      await navigator.clipboard.writeText(jsonl);
    } catch (err) {
      logger.error('Failed to copy JSONL:', err);
      onError('Failed to copy JSONL to clipboard');
    }
  }, [rawJsonlOutput, onError]);

  // Copy session as Markdown
  const _copyAsMarkdown = useCallback(async () => {
    try {
      let markdown = `# Claude Code Session\n\n`;
      markdown += `**Project:** ${projectPath}\n`;
      markdown += `**Date:** ${new Date().toISOString()}\n\n`;
      markdown += `---\n\n`;

      for (const msg of messages) {
        if (msg.type === "system" && msg.subtype === "init") {
          markdown += `## System Initialization\n\n`;
          markdown += `- Session ID: \`${msg.session_id || 'N/A'}\`\n`;
          markdown += `- Model: \`${msg.model || 'default'}\`\n`;
          if (msg.cwd) markdown += `- Working Directory: \`${msg.cwd}\`\n`;
          if (msg.tools?.length) markdown += `- Tools: ${msg.tools.join(', ')}\n`;
          markdown += `\n`;
        } else if (msg.type === "assistant" && msg.message) {
          markdown += `## Assistant\n\n`;
          for (const content of msg.message.content || []) {
            if (content.type === "text") {
              const textContent = typeof content.text === 'string' 
                ? content.text 
                : (content.text?.text || JSON.stringify(content.text || content));
              markdown += `${textContent}\n\n`;
            } else if (content.type === "tool_use") {
              markdown += `### Tool: ${content.name}\n\n`;
              markdown += `\`\`\`json\n${JSON.stringify(content.input, null, 2)}\n\`\`\`\n\n`;
            }
          }
          if (msg.message.usage) {
            markdown += `*Tokens: ${msg.message.usage.input_tokens} in, ${msg.message.usage.output_tokens} out*\n\n`;
          }
        } else if (msg.type === "user" && msg.message) {
          markdown += `## User\n\n`;
          for (const content of msg.message.content || []) {
            if (content.type === "text") {
              const textContent = typeof content.text === 'string' 
                ? content.text 
                : (content.text?.text || JSON.stringify(content.text));
              markdown += `${textContent}\n\n`;
            } else if (content.type === "tool_result") {
              markdown += `### Tool Result\n\n`;
              let contentText = '';
              if (typeof content.content === 'string') {
                contentText = content.content;
              } else if (content.content && typeof content.content === 'object') {
                if (content.content.text) {
                  contentText = content.content.text;
                } else if (Array.isArray(content.content)) {
                  contentText = content.content
                    .map((c: any) => (typeof c === 'string' ? c : c.text || JSON.stringify(c)))
                    .join('\n');
                } else {
                  contentText = JSON.stringify(content.content, null, 2);
                }
              }
              markdown += `\`\`\`\n${contentText}\n\`\`\`\n\n`;
            }
          }
        } else if (msg.type === "result") {
          markdown += `## Execution Result\n\n`;
          if (msg.result) {
            markdown += `${msg.result}\n\n`;
          }
          if (msg.error) {
            markdown += `**Error:** ${msg.error}\n\n`;
          }
        }
      }

      await navigator.clipboard.writeText(markdown);
    } catch (err) {
      logger.error('Failed to copy markdown:', err);
      onError('Failed to copy markdown to clipboard');
    }
  }, [messages, projectPath, onError]);


  // Export session data
  const _exportSession = useCallback(async (format: 'json' | 'markdown' = 'json') => {
    try {
      let content: string;
      let filename: string;
      
      if (format === 'markdown') {
        // Generate markdown content
        content = await new Promise<string>((resolve) => {
          let markdown = `# Claude Code Session\n\n`;
          markdown += `**Project:** ${projectPath}\n`;
          markdown += `**Date:** ${new Date().toISOString()}\n\n`;
          markdown += `---\n\n`;
          
          for (const msg of messages) {
            // Same markdown generation logic as copyAsMarkdown
            if (msg.type === "system" && msg.subtype === "init") {
              markdown += `## System Initialization\n\n`;
              markdown += `- Session ID: \`${msg.session_id || 'N/A'}\`\n`;
              markdown += `- Model: \`${msg.model || 'default'}\`\n`;
              if (msg.cwd) markdown += `- Working Directory: \`${msg.cwd}\`\n`;
              if (msg.tools?.length) markdown += `- Tools: ${msg.tools.join(', ')}\n`;
              markdown += `\n`;
            } else if (msg.type === "assistant" && msg.message) {
              markdown += `## Assistant\n\n`;
              for (const content of msg.message.content || []) {
                if (content.type === "text") {
                  const textContent = typeof content.text === 'string' 
                    ? content.text 
                    : (content.text?.text || JSON.stringify(content.text || content));
                  markdown += `${textContent}\n\n`;
                } else if (content.type === "tool_use") {
                  markdown += `### Tool: ${content.name}\n\n`;
                  markdown += `\`\`\`json\n${JSON.stringify(content.input, null, 2)}\n\`\`\`\n\n`;
                }
              }
              if (msg.message.usage) {
                markdown += `*Tokens: ${msg.message.usage.input_tokens} in, ${msg.message.usage.output_tokens} out*\n\n`;
              }
            }
            // Add other message types as needed...
          }
          
          resolve(markdown);
        });
        filename = `claude-session-${Date.now()}.md`;
      } else {
        // JSON format
        content = JSON.stringify({
          session: effectiveSession,
          projectPath,
          exportDate: new Date().toISOString(),
          messages,
          rawJsonlOutput
        }, null, 2);
        filename = `claude-session-${Date.now()}.json`;
      }
      
      // Create a blob and download
      const blob = new Blob([content], { 
        type: format === 'markdown' ? 'text/markdown' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      
    } catch (err) {
      logger.error('Failed to export session:', err);
      onError('Failed to export session');
    }
  }, [messages, rawJsonlOutput, projectPath, effectiveSession, onError]);

  // This component doesn't render anything, it just provides action methods
  return (
    <div className="relative">
      <DebugLabel label="SessionActions" />
    </div>
  );
};

// Custom hook to use session actions
export function useSessionActions(props: SessionActionsProps) {
  const { messages, rawJsonlOutput, projectPath, effectiveSession, onError, onLoading } = props;

  const copyAsJsonl = useCallback(async () => {
    try {
      const jsonl = rawJsonlOutput.join('\n');
      await navigator.clipboard.writeText(jsonl);
    } catch (err) {
      logger.error('Failed to copy JSONL:', err);
      onError('Failed to copy JSONL to clipboard');
    }
  }, [rawJsonlOutput, onError]);

  const copyAsMarkdown = useCallback(async () => {
    try {
      let markdown = `# Claude Code Session\n\n`;
      markdown += `**Project:** ${projectPath}\n`;
      markdown += `**Date:** ${new Date().toISOString()}\n\n`;
      markdown += `---\n\n`;

      for (const msg of messages) {
        if (msg.type === "system" && msg.subtype === "init") {
          markdown += `## System Initialization\n\n`;
          markdown += `- Session ID: \`${msg.session_id || 'N/A'}\`\n`;
          markdown += `- Model: \`${msg.model || 'default'}\`\n`;
          if (msg.cwd) markdown += `- Working Directory: \`${msg.cwd}\`\n`;
          if (msg.tools?.length) markdown += `- Tools: ${msg.tools.join(', ')}\n`;
          markdown += `\n`;
        } else if (msg.type === "assistant" && msg.message) {
          markdown += `## Assistant\n\n`;
          for (const content of msg.message.content || []) {
            if (content.type === "text") {
              const textContent = typeof content.text === 'string' 
                ? content.text 
                : (content.text?.text || JSON.stringify(content.text || content));
              markdown += `${textContent}\n\n`;
            } else if (content.type === "tool_use") {
              markdown += `### Tool: ${content.name}\n\n`;
              markdown += `\`\`\`json\n${JSON.stringify(content.input, null, 2)}\n\`\`\`\n\n`;
            }
          }
          if (msg.message.usage) {
            markdown += `*Tokens: ${msg.message.usage.input_tokens} in, ${msg.message.usage.output_tokens} out*\n\n`;
          }
        } else if (msg.type === "user" && msg.message) {
          markdown += `## User\n\n`;
          for (const content of msg.message.content || []) {
            if (content.type === "text") {
              const textContent = typeof content.text === 'string' 
                ? content.text 
                : (content.text?.text || JSON.stringify(content.text));
              markdown += `${textContent}\n\n`;
            } else if (content.type === "tool_result") {
              markdown += `### Tool Result\n\n`;
              let contentText = '';
              if (typeof content.content === 'string') {
                contentText = content.content;
              } else if (content.content && typeof content.content === 'object') {
                if (content.content.text) {
                  contentText = content.content.text;
                } else if (Array.isArray(content.content)) {
                  contentText = content.content
                    .map((c: any) => (typeof c === 'string' ? c : c.text || JSON.stringify(c)))
                    .join('\n');
                } else {
                  contentText = JSON.stringify(content.content, null, 2);
                }
              }
              markdown += `\`\`\`\n${contentText}\n\`\`\`\n\n`;
            }
          }
        } else if (msg.type === "result") {
          markdown += `## Execution Result\n\n`;
          if (msg.result) {
            markdown += `${msg.result}\n\n`;
          }
          if (msg.error) {
            markdown += `**Error:** ${msg.error}\n\n`;
          }
        }
      }

      await navigator.clipboard.writeText(markdown);
    } catch (err) {
      logger.error('Failed to copy markdown:', err);
      onError('Failed to copy markdown to clipboard');
    }
  }, [messages, projectPath, onError]);


  const exportSession = useCallback(async (format: 'json' | 'markdown' = 'json') => {
    try {
      let content: string;
      let filename: string;
      
      if (format === 'markdown') {
        content = await Promise.resolve().then(() => {
          let markdown = `# Claude Code Session\n\n`;
          markdown += `**Project:** ${projectPath}\n`;
          markdown += `**Date:** ${new Date().toISOString()}\n\n`;
          markdown += `---\n\n`;
          
          // Add message content (simplified for brevity)
          for (const msg of messages) {
            if (msg.type === "assistant" && msg.message) {
              markdown += `## Assistant\n\n`;
              for (const content of msg.message.content || []) {
                if (content.type === "text") {
                  const textContent = typeof content.text === 'string' 
                    ? content.text 
                    : JSON.stringify(content.text);
                  markdown += `${textContent}\n\n`;
                }
              }
            }
          }
          
          return markdown;
        });
        filename = `claude-session-${Date.now()}.md`;
      } else {
        content = JSON.stringify({
          session: effectiveSession,
          projectPath,
          exportDate: new Date().toISOString(),
          messages,
          rawJsonlOutput
        }, null, 2);
        filename = `claude-session-${Date.now()}.json`;
      }
      
      // Create download
      const blob = new Blob([content], { 
        type: format === 'markdown' ? 'text/markdown' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      
    } catch (err) {
      logger.error('Failed to export session:', err);
      onError('Failed to export session');
    }
  }, [messages, rawJsonlOutput, projectPath, effectiveSession, onError]);

  return {
    copyAsJsonl,
    copyAsMarkdown,
    exportSession,
  };
}