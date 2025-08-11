import React, { useState } from "react";
import { FileEdit, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { getClaudeSyntaxTheme } from "@/lib/claudeSyntaxTheme";
import { useTheme } from "@/hooks";
import { DebugLabel } from "@/components/ui/atoms";
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
 * Widget for Edit tool - shows the edit operation
 */
export const EditWidget: React.FC<{ 
  file_path: string; 
  old_string: string; 
  new_string: string;
  result?: any;
}> = ({ file_path, old_string, new_string, result: _result }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
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
  const isLargeEdit = totalLines > 20; // Show collapsed view for more than 20 lines

  return (
    <div className="space-y-1 relative">
      <DebugLabel label="EditWidget" />
      {/* Command section - outside the expand box */}
      <div className="flex items-center gap-2 rounded-lg bg-muted/50">
        <FileEdit className="h-4 w-4 text-primary" />
        <span className="text-sm">Applying Edit to:</span>
        <code className="text-sm font-mono bg-background px-2 py-0.5 rounded flex-1 truncate">
          {file_path}
        </code>
      </div>

      {/* Results section - expandable box */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              Diff preview
            </span>
            {totalLines > 0 && (
              <span className="text-xs text-muted-foreground">
                ({totalLines} {totalLines === 1 ? 'line' : 'lines'})
              </span>
            )}
          </div>
          
          {isLargeEdit && (
            <button
              onClick={async () => {
                if (!isExpanded) {
                  setIsExpanding(true);
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
          <div className={cn(
            "overflow-y-auto overflow-x-auto bg-background text-xs font-mono",
            isLargeEdit && !isExpanded ? "max-h-[200px]" : "max-h-[440px]"
          )}>
            {diffResult.map((part, index) => {
              // For collapsed view, limit the number of parts shown
              if (isLargeEdit && !isExpanded && index > 10) {
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
        </div>
      </div>
    </div>
  );
};