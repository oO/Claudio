import React from "react";
import { FileEdit } from "lucide-react";
import { cn } from "@/lib/utils";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { getClaudeSyntaxTheme } from "@/lib/claudeSyntaxTheme";
import { useTheme } from "@/hooks";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";
import * as Diff from 'diff';

const getLanguage = (path: string) => {
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

/**
 * Custom diff content component that handles expand/collapse logic
 */
const DiffContent: React.FC<{
  diffResult: any[];
  language: string;
  syntaxTheme: any;
  isExpanded?: boolean;
  isLargeContent?: boolean;
}> = ({ diffResult, language, syntaxTheme, isExpanded = true, isLargeContent = false }) => {
  return (
    <div className={cn(
      "overflow-y-auto overflow-x-auto bg-background text-xs font-mono",
      isLargeContent && !isExpanded ? "max-h-[200px]" : "max-h-[440px]"
    )}>
      {diffResult.map((part, index) => {
        // For collapsed view, limit the number of parts shown
        if (isLargeContent && !isExpanded && index > 10) {
          if (index === 11) {
            return (
              <div key={index} className="px-4 py-2 bg-muted border-y border-border text-center text-muted-foreground text-xs">
                ... {diffResult.length - 11} more changes ...
              </div>
            );
          }
          return null;
        }
        
        const partClass = part.added 
          ? 'bg-green-500/20' 
          : part.removed 
          ? 'bg-red-500/30'
          : '';
        
        if (!part.added && !part.removed && part.count && part.count > 8) {
          return (
            <div key={index} className="px-4 py-1 bg-muted border-y border-border text-center text-muted-foreground text-xs">
              ... {part.count} unchanged lines ...
            </div>
          );
        }
        
        const value = part.value.endsWith('\n') ? part.value.slice(0, -1) : part.value;

        return (
          <div key={index} className={cn(partClass, "flex")}>
            <div className="w-8 select-none text-center flex-shrink-0">
              {part.added ? <span className="text-success">+</span> : part.removed ? <span className="text-destructive">-</span> : null}
            </div>
            <div className="flex-1">
              <SyntaxHighlighter
                language={language}
                style={syntaxTheme}
                PreTag="div"
                wrapLongLines={false}
                customStyle={{
                  margin: 0,
                  padding: 0,
                  background: 'transparent',
                }}
                codeTagProps={{
                  style: {
                    fontSize: '0.75rem',
                    lineHeight: '1.6',
                  }
                }}
              >
                {value}
              </SyntaxHighlighter>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Widget for Edit tool - shows the edit operation
 */
export const EditWidget: React.FC<{ 
  file_path: string; 
  old_string: string; 
  new_string: string;
  result?: any;
}> = ({ file_path, old_string, new_string, result: _result }) => {
  const { theme } = useTheme();
  const syntaxTheme = getClaudeSyntaxTheme(theme);

  const diffResult = Diff.diffLines(old_string || '', new_string || '', { 
    newlineIsToken: true,
    ignoreWhitespace: false 
  });
  const language = getLanguage(file_path);
  
  // Count total lines to determine if large
  const totalLines = diffResult.reduce((count, part) => {
    return count + (part.value.split('\n').length - 1);
  }, 0);

  // Generate raw content for excerpting (diff format)
  const rawContent = diffResult.map(part => {
    const prefix = part.added ? '+' : part.removed ? '-' : ' ';
    return part.value.split('\n').map(line => prefix + line).join('\n');
  }).join('');

  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="EditWidget" />
      
      <ToolWidgetTemplate.Header
        icon={FileEdit}
        title="Applying Edit to:"
      >
        <code className="text-sm font-mono bg-background px-2 py-0.5 rounded flex-1 truncate">
          {file_path}
        </code>
      </ToolWidgetTemplate.Header>
      
      <ToolWidgetTemplate.ExpandableResult
        largeContentThreshold={20}
        lineCount={totalLines}
        rawContent={rawContent}
        headerContent={
          <span className="text-xs font-mono text-muted-foreground">
            Diff preview
          </span>
        }
      >
        {(excerptedContent, isShowingExcerpt) => {
          // When showing excerpt, truncate the diff array directly
          let displayDiffResult = diffResult;
          
          if (isShowingExcerpt) {
            // Count total lines in diff and truncate diff array to ~5 lines worth
            let lineCount = 0;
            const targetLines = 5;
            displayDiffResult = [];
            
            for (const part of diffResult) {
              const partLines = part.value.split('\n').length - 1; // -1 because split adds empty string at end
              
              if (lineCount + partLines <= targetLines) {
                // Include this entire part
                displayDiffResult.push(part);
                lineCount += partLines;
              } else {
                // Truncate this part to fit remaining lines
                const remainingLines = targetLines - lineCount;
                if (remainingLines > 0) {
                  const lines = part.value.split('\n');
                  const truncatedValue = lines.slice(0, remainingLines).join('\n') + '\n';
                  displayDiffResult.push({
                    ...part,
                    value: truncatedValue
                  });
                }
                break; // Stop processing after truncation
              }
            }
          }
          
          return (
            <>
              <DiffContent
                diffResult={displayDiffResult}
                language={language}
                syntaxTheme={syntaxTheme}
              />
            </>
          );
        }}
      </ToolWidgetTemplate.ExpandableResult>
    </ToolWidgetTemplate>
  );
};
