import React, { useState } from "react";
import { FileText, ChevronRight, Loader2 } from "lucide-react";
import { DebugLabel } from "@/components/ui/atoms";
import { cn } from "@/lib/utils";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "@/hooks";

// Constants
const PREVIEW_LINES = 4; // Number of lines to show when collapsed
const LARGE_FILE_THRESHOLD = 20; // Files with more lines are considered "large"

/**
 * Unified widget for Read and Write tools
 */
export const FileWidget: React.FC<{ 
  type: 'read' | 'write';
  filePath: string; 
  content?: string;
  result?: any;
}> = ({ type, filePath, content, result }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const { theme } = useTheme();

  // Customize oneLight theme to have better contrast
  const customLightTheme = {
    ...oneLight,
    // Base text should be full black
    'code[class*="language-"]': {
      ...oneLight['code[class*="language-"]'],
      color: '#000000'
    },
    'pre[class*="language-"]': {
      ...oneLight['pre[class*="language-"]'],
      color: '#000000'
    },
    'comment': {
      ...oneLight['comment'],
      color: '#6a737d' // Darker gray for better readability
    },
    'prolog': {
      ...oneLight['prolog'], 
      color: '#6a737d'
    },
    'doctype': {
      ...oneLight['doctype'],
      color: '#6a737d' 
    },
    'cdata': {
      ...oneLight['cdata'],
      color: '#6a737d'
    }
  };
  
  // Customize oneDark theme for better contrast and readability
  const customDarkTheme = {
    ...oneDark,
    // Base text should be full white
    'code[class*="language-"]': {
      ...oneDark['code[class*="language-"]'],
      color: '#ffffff'
    },
    'pre[class*="language-"]': {
      ...oneDark['pre[class*="language-"]'],
      color: '#ffffff'
    },
    'comment': {
      ...oneDark['comment'],
      color: '#8b949e' // Lighter gray for better readability on dark backgrounds
    },
    'prolog': {
      ...oneDark['prolog'],
      color: '#8b949e'
    },
    'doctype': {
      ...oneDark['doctype'],
      color: '#8b949e'
    },
    'cdata': {
      ...oneDark['cdata'],
      color: '#8b949e'
    },
    'string': {
      ...oneDark['string'],
      color: '#a5d6ff' // Brighter blue for strings
    },
    'keyword': {
      ...oneDark['keyword'],
      color: '#ff7b72' // Brighter red for keywords
    },
    'function': {
      ...oneDark['function'],
      color: '#d2a8ff' // Brighter purple for functions
    },
    'variable': {
      ...oneDark['variable'],
      color: '#ffa657' // Brighter orange for variables
    }
  };
  
  // Check if the document has the dark theme class
  const isDarkTheme = document.documentElement.classList.contains('theme-dark');
  const syntaxTheme = isDarkTheme ? customDarkTheme : customLightTheme;

  // Extract file extension for syntax highlighting
  const getLanguage = (path?: string) => {
    if (!path) return "text";
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: "typescript",
      tsx: "tsx",
      js: "javascript",
      jsx: "jsx",
      py: "python",
      rs: "rust",
      go: "go",
      java: "java",
      cpp: "cpp",
      c: "c",
      cs: "csharp",
      php: "php",
      rb: "ruby",
      swift: "swift",
      kt: "kotlin",
      scala: "scala",
      sh: "bash",
      bash: "bash",
      zsh: "bash",
      yaml: "yaml",
      yml: "yaml",
      json: "json",
      xml: "xml",
      html: "html",
      css: "css",
      scss: "scss",
      sass: "sass",
      less: "less",
      sql: "sql",
      md: "markdown",
      toml: "ini",
      ini: "ini",
      dockerfile: "dockerfile",
      makefile: "makefile"
    };
    return languageMap[ext || ""] || "text";
  };

  // Parse content to separate line numbers from code (for read type)
  const parseContent = (rawContent: string) => {
    const lines = rawContent.split('\n');
    const codeLines: string[] = [];
    let minLineNumber = Infinity;

    // First, determine if the content is likely a numbered list from the 'read' tool.
    // It is if more than half the non-empty lines match the expected format.
    const nonEmptyLines = lines.filter(line => line.trim() !== '');
    if (nonEmptyLines.length === 0) {
      return { codeContent: rawContent, startLineNumber: 1 };
    }
    const parsableLines = nonEmptyLines.filter(line => /^\s*\d+→/.test(line)).length;
    const isLikelyNumbered = (parsableLines / nonEmptyLines.length) > 0.5;

    if (!isLikelyNumbered) {
      return { codeContent: rawContent, startLineNumber: 1 };
    }
    
    // If it's a numbered list, parse it strictly.
    for (const line of lines) {
      // Remove leading whitespace before parsing
      const trimmedLine = line.trimStart();
      const match = trimmedLine.match(/^(\d+)→(.*)$/);
      if (match) {
        const lineNum = parseInt(match[1], 10);
        if (minLineNumber === Infinity) {
          minLineNumber = lineNum;
        }
        // Preserve the code content exactly as it appears after the arrow
        codeLines.push(match[2]);
      } else if (line.trim() === '') {
        // Preserve empty lines
        codeLines.push('');
      } else {
        // If a line in a numbered block does not match, it's a formatting anomaly.
        // Render it as a blank line to avoid showing the raw, un-parsed string.
        codeLines.push('');
      }
    }
    
    // Remove trailing empty lines
    while (codeLines.length > 0 && codeLines[codeLines.length - 1] === '') {
      codeLines.pop();
    }
    
    return {
      codeContent: codeLines.join('\n'),
      startLineNumber: minLineNumber === Infinity ? 1 : minLineNumber
    };
  };

  // Get the content to display based on type
  const getDisplayContent = () => {
    if (type === 'write') {
      // For write type, use the content prop directly
      return {
        codeContent: content || '',
        startLineNumber: 1,
        isError: false
      };
    }
    
    // For read type, extract from result
    if (!result) {
      return { codeContent: '', startLineNumber: 1, isError: false };
    }

    let resultContent = '';
    const isError = result.is_error || false;
    
    if (typeof result.content === 'string') {
      resultContent = result.content;
    } else if (result.content && typeof result.content === 'object') {
      if (result.content.text) {
        resultContent = result.content.text;
      } else if (Array.isArray(result.content)) {
        resultContent = result.content
          .map((c: any) => (typeof c === 'string' ? c : c.text || JSON.stringify(c)))
          .join('\n');
      } else {
        resultContent = JSON.stringify(result.content, null, 2);
      }
    }

    const { codeContent, startLineNumber } = parseContent(resultContent);
    return { codeContent, startLineNumber, isError };
  };

  const { codeContent, startLineNumber, isError } = getDisplayContent();
  const language = getLanguage(filePath);
  const lineCount = codeContent.split('\n').filter(line => line.trim()).length;
  const isLargeFile = lineCount > LARGE_FILE_THRESHOLD;
  
  // When collapsed, only show first N lines to help renderer performance
  const displayContent = (!isLargeFile || isExpanded) 
    ? codeContent 
    : codeContent.split('\n').slice(0, PREVIEW_LINES).join('\n');

  // Get header text based on type
  const headerText = type === 'read' ? 'File content:' : 'Writing to file:';
  const debugLabel = 'FileWidget';

  // Loading state for read type
  if (type === 'read' && !result) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted/50 relative">
        <DebugLabel label={debugLabel} />
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-sm">Reading file:</span>
        <code className="text-sm font-mono bg-background px-2 py-0.5 rounded flex-1 truncate">
          {filePath}
        </code>
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // No content available
  if (!codeContent && type === 'read') {
    return (
      <div className="space-y-1 relative">
        <DebugLabel label={debugLabel} />
        <div className="flex items-center gap-2 rounded-lg bg-muted/50">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-sm">{headerText}</span>
          <code className="text-sm font-mono bg-background px-2 py-0.5 rounded flex-1 truncate">
            {filePath}
          </code>
        </div>
        <div className="text-center py-4 text-sm text-muted-foreground">
          No content available
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 relative">
      <DebugLabel label={debugLabel} />
      {/* Command section - outside the expand box */}
      <div className="flex items-center gap-2 rounded-lg bg-muted/50">
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-sm">{headerText}</span>
        <code className="text-sm font-mono bg-background px-2 py-0.5 rounded flex-1 truncate">
          {filePath}
        </code>
      </div>
      
      {/* Results section - expandable box */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              {isError ? "Error" : (type === 'read' ? "File content" : "Preview")}
            </span>
            {!isError && lineCount > 0 && (
              <span className="text-xs text-muted-foreground">
                ({lineCount} {lineCount === 1 ? 'line' : 'lines'})
              </span>
            )}
          </div>
          
          {isLargeFile && !isError && (
            <button
              onClick={async () => {
                if (!isExpanded) {
                  setIsExpanding(true);
                  // Small delay to allow UI to update before heavy rendering
                  await new Promise(resolve => setTimeout(resolve, 50));
                  setIsExpanded(true);
                  setIsExpanding(false);
                } else {
                  setIsExpanded(false);
                }
              }}
              disabled={isExpanding}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {isExpanding ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
                  {isExpanded ? "Collapse" : "Expand"}
                </>
              )}
            </button>
          )}
        </div>
        
        {/* Content area */}
        <div className="relative">
          <div className="relative overflow-x-auto bg-background">
            <SyntaxHighlighter
              language={language}
              style={syntaxTheme}
              showLineNumbers
              startingLineNumber={startLineNumber}
              wrapLongLines={false}
              customStyle={{
                margin: 0,
                background: 'transparent',
                lineHeight: '1.2',
                fontSize: '0.75rem',
                padding: '0.75rem',
                color: isDarkTheme ? '#ffffff' : '#000000' // Force the right base color
              }}
              codeTagProps={{
                style: {
                  fontSize: '0.75rem'
                }
              }}
              lineNumberStyle={{
                minWidth: "3.5rem",
                paddingRight: "1rem",
                textAlign: "right",
                opacity: 0.5,
              }}
            >
              {isError ? (codeContent || "Error occurred") : displayContent}
            </SyntaxHighlighter>
            {isLargeFile && !isExpanded && !isError && (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center bg-muted/20 border-t">
                ... {lineCount - PREVIEW_LINES} more lines ...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};