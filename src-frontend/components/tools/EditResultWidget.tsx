import React from "react";
import { GitBranch, ChevronRight } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { getClaudeSyntaxTheme } from "@/lib/claudeSyntaxTheme";
import { useThemeUnified } from "@/hooks";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";

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
 * Widget for Edit tool result - shows a diff view
 */
export const EditResultWidget: React.FC<{ content: string }> = ({ content }) => {
  const { theme } = useThemeUnified();
  const syntaxTheme = getClaudeSyntaxTheme(theme);
  
  // Parse the content to extract file path and code snippet
  const lines = content.split('\n');
  let filePath = '';
  const codeLines: { lineNumber: string; code: string }[] = [];
  let inCodeBlock = false;
  
  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (line.includes('The file') && line.includes('has been updated')) {
      const match = line.match(/The file (.+) has been updated/);
      if (match) {
        filePath = match[1];
      }
    } else if (/^\s*\d+/.test(line)) {
      inCodeBlock = true;
      const lineMatch = line.match(/^\s*(\d+)\t?(.*)$/);
      if (lineMatch) {
        const [, lineNum, codePart] = lineMatch;
        codeLines.push({
          lineNumber: lineNum,
          code: codePart,
        });
      }
    } else if (inCodeBlock) {
      // Allow non-numbered lines inside a code block (for empty lines)
      codeLines.push({ lineNumber: '', code: line });
    }
  }

  const codeContent = codeLines.map(l => l.code).join('\n');
  const firstNumberedLine = codeLines.find(l => l.lineNumber !== '');
  const startLineNumber = firstNumberedLine ? parseInt(firstNumberedLine.lineNumber) : 1;
  const language = getLanguage(filePath);

  const lineCount = codeContent.split('\n').filter(line => line.trim()).length;

  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="EditResultWidget" />
      
      <ToolWidgetTemplate.Header
        icon={GitBranch}
        title="Edit Result"
        isLoading={false}
      >
        {filePath && (
          <>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-mono text-muted-foreground">{filePath}</span>
          </>
        )}
      </ToolWidgetTemplate.Header>
      
      <ToolWidgetTemplate.ExpandableResult
        largeContentThreshold={20}
        lineCount={lineCount}
        rawContent={content}
        headerContent={
          <span className="text-xs font-mono text-muted-foreground">
            Updated content
          </span>
        }
      >
        {(excerptedContent, isShowingExcerpt, isExpanded) => (
          <>
            <div className="overflow-x-auto">
              <SyntaxHighlighter
                language={language}
                style={syntaxTheme}
                showLineNumbers
                startingLineNumber={startLineNumber}
                wrapLongLines={false}
                customStyle={{
                  margin: 0,
                  background: 'transparent',
                  lineHeight: '1.6',
                  fontSize: '0.75rem'
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
                {codeContent}
              </SyntaxHighlighter>
            </div>
          </>
        )}
      </ToolWidgetTemplate.ExpandableResult>
    </ToolWidgetTemplate>
  );
};
