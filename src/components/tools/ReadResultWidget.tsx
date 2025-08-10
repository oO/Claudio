import React, { useState } from "react";
import { FileText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "@/hooks";
import { DebugLabel } from "@/components/ui/atoms";

// Constants
const PREVIEW_LINES = 4; // Number of lines to show when collapsed
const LARGE_FILE_THRESHOLD = 20; // Files with more lines are considered "large"

/**
 * Widget for Read tool result - shows file content with line numbers
 */
export const ReadResultWidget: React.FC<{ content: string; filePath?: string }> = ({ content, filePath }) => {
  const [isExpanded, setIsExpanded] = useState(false);
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

  // Parse content to separate line numbers from code
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

  const language = getLanguage(filePath);
  const { codeContent, startLineNumber } = parseContent(content);
  const lineCount = content.split('\n').filter(line => line.trim()).length;
  const isLargeFile = lineCount > LARGE_FILE_THRESHOLD;
  
  // When collapsed, only show first N lines to help renderer performance
  const displayContent = (!isLargeFile || isExpanded) 
    ? codeContent 
    : codeContent.split('\n').slice(0, PREVIEW_LINES).join('\n');

  return (
    <div className="rounded-lg overflow-hidden border bg-card w-full relative">
      <DebugLabel label="ReadResultWidget" />
      <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground">
            File content
          </span>
          {isLargeFile && (
            <span className="text-xs text-muted-foreground">
              ({lineCount} lines)
            </span>
          )}
        </div>
        {isLargeFile && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
            {isExpanded ? "Collapse" : "Expand"}
          </button>
        )}
      </div>
      
      {/* Content area */}
      <div className="relative">
        <div className={cn(
          "transition-all duration-200",
          !isExpanded && isLargeFile && "max-h-32"
        )}>
          <div className={cn(
            "relative overflow-x-auto bg-background",
            !isExpanded && isLargeFile && "max-h-28"
          )}>
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
              {displayContent}
            </SyntaxHighlighter>
          </div>
        </div>
        
        {/* Gradient fade for collapsed view */}
        {!isExpanded && isLargeFile && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        )}
      </div>
      
    </div>
  );
};