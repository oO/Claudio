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
 * Custom multi-edit content component that handles expand/collapse logic
 */
const MultiEditContent: React.FC<{
  edits: Array<{ old_string: string; new_string: string }>;
  language: string;
  syntaxTheme: any;
  isExpanded?: boolean;
  isLargeContent?: boolean;
}> = ({ edits, language, syntaxTheme, isExpanded = true, isLargeContent = false }) => {
  return (
    <div className={cn(
      "space-y-3 p-3 overflow-y-auto overflow-x-auto",
      isLargeContent && !isExpanded ? "max-h-[200px]" : "max-h-[440px]"
    )}>
      {edits.map((edit, index) => {
        // For collapsed view, limit the number of edits shown
        if (isLargeContent && !isExpanded && index > 2) {
          if (index === 3) {
            return (
              <div key={index} className="py-2 bg-muted border-y border-border text-center text-muted-foreground text-xs">
                ... {edits.length - 3} more edits ...
              </div>
            );
          }
          return null;
        }

        const diffResult = Diff.diffLines(edit.old_string || '', edit.new_string || '', { 
          newlineIsToken: true,
          ignoreWhitespace: false 
        });
        
        return (
          <div key={index} className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Edit {index + 1}</div>
            <div className="rounded-lg border bg-card overflow-hidden text-xs font-mono">
              <div className="max-h-[300px] overflow-y-auto overflow-x-auto">
                {diffResult.map((part, partIndex) => {
                  const partClass = part.added 
                    ? 'bg-green-500/20' 
                    : part.removed 
                    ? 'bg-red-500/30'
                    : '';
                  
                  if (!part.added && !part.removed && part.count && part.count > 8) {
                    return (
                      <div key={partIndex} className="px-4 py-1 bg-muted border-y border-border text-center text-muted-foreground text-xs">
                        ... {part.count} unchanged lines ...
                      </div>
                    );
                  }
                  
                  const value = part.value.endsWith('\n') ? part.value.slice(0, -1) : part.value;

                  return (
                    <div key={partIndex} className={cn(partClass, "flex")}>
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
        );
      })}
    </div>
  );
};

/**
 * Widget for displaying MultiEdit tool usage
 */
export const MultiEditWidget: React.FC<{
  file_path: string;
  edits: Array<{ old_string: string; new_string: string }>;
  result?: any;
}> = ({ file_path, edits, result: _result }) => {
  const language = getLanguage(file_path);
  const { theme } = useTheme();
  const syntaxTheme = getClaudeSyntaxTheme(theme);
  
  // Calculate total lines across all edits to determine if large
  const totalLines = edits.reduce((count, edit) => {
    const diffResult = Diff.diffLines(edit.old_string || '', edit.new_string || '', { 
      newlineIsToken: true,
      ignoreWhitespace: false 
    });
    return count + diffResult.reduce((lineCount, part) => {
      return lineCount + (part.value.split('\n').length - 1);
    }, 0);
  }, 0);

  // Generate raw content for excerpting (all diffs combined)
  const rawContent = edits.map((edit, index) => {
    const diffResult = Diff.diffLines(edit.old_string || '', edit.new_string || '', { 
      newlineIsToken: true,
      ignoreWhitespace: false 
    });
    const diffText = diffResult.map(part => {
      const prefix = part.added ? '+' : part.removed ? '-' : ' ';
      return part.value.split('\n').map(line => prefix + line).join('\n');
    }).join('');
    return `Edit ${index + 1}:\n${diffText}`;
  }).join('\n\n');
  
  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="MultiEditWidget" />
      
      <ToolWidgetTemplate.Header
        icon={FileEdit}
        title="Applying Multiple Edits to:"
      >
        <code className="text-sm font-mono bg-background px-2 py-0.5 rounded flex-1 truncate">
          {file_path}
        </code>
      </ToolWidgetTemplate.Header>
      
      <ToolWidgetTemplate.ExpandableResult
        largeContentThreshold={15}
        lineCount={totalLines}
        rawContent={rawContent}
        headerContent={
          <span className="text-xs font-mono text-muted-foreground">
            {edits.length} edit{edits.length !== 1 ? 's' : ''}
          </span>
        }
      >
        {(excerptedContent, isShowingExcerpt) => (
          <>
            <MultiEditContent
              edits={edits}
              language={language}
              syntaxTheme={syntaxTheme}
            />
          </>
        )}
      </ToolWidgetTemplate.ExpandableResult>
    </ToolWidgetTemplate>
  );
};
