import React from "react";
import { FileText } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneLight,
  oneDark,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { useThemeUnified } from "@/hooks";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";

// Constants
const PREVIEW_LINES = 4; // Number of lines to show when collapsed
const LARGE_FILE_THRESHOLD = 20; // Files with more lines are considered "large"

/**
 * Unified widget for Read and Write tools
 */
export const FileWidget: React.FC<{
  type: "read" | "write";
  filePath: string;
  content?: string;
  result?: any;
}> = ({ type, filePath, content, result }) => {
  const { theme } = useThemeUnified();

  // Customize oneLight theme to have better contrast
  const customLightTheme = {
    ...oneLight,
    // Base text should be full black
    'code[class*="language-"]': {
      ...oneLight['code[class*="language-"]'],
      color: "#000000",
    },
    'pre[class*="language-"]': {
      ...oneLight['pre[class*="language-"]'],
      color: "#000000",
    },
    comment: {
      ...oneLight["comment"],
      color: "#6a737d", // Darker gray for better readability
    },
    prolog: {
      ...oneLight["prolog"],
      color: "#6a737d",
    },
    doctype: {
      ...oneLight["doctype"],
      color: "#6a737d",
    },
    cdata: {
      ...oneLight["cdata"],
      color: "#6a737d",
    },
  };

  // Customize oneDark theme for better contrast and readability
  const customDarkTheme = {
    ...oneDark,
    // Base text should be full white
    'code[class*="language-"]': {
      ...oneDark['code[class*="language-"]'],
      color: "#ffffff",
    },
    'pre[class*="language-"]': {
      ...oneDark['pre[class*="language-"]'],
      color: "#ffffff",
    },
    comment: {
      ...oneDark["comment"],
      color: "#8b949e", // Lighter gray for better readability on dark backgrounds
    },
    prolog: {
      ...oneDark["prolog"],
      color: "#8b949e",
    },
    doctype: {
      ...oneDark["doctype"],
      color: "#8b949e",
    },
    cdata: {
      ...oneDark["cdata"],
      color: "#8b949e",
    },
    string: {
      ...oneDark["string"],
      color: "#a5d6ff", // Brighter blue for strings
    },
    keyword: {
      ...oneDark["keyword"],
      color: "#ff7b72", // Brighter red for keywords
    },
    function: {
      ...oneDark["function"],
      color: "#d2a8ff", // Brighter purple for functions
    },
    variable: {
      ...oneDark["variable"],
      color: "#ffa657", // Brighter orange for variables
    },
  };

  // Check if the document has the dark theme class
  const isDarkTheme = document.documentElement.classList.contains("theme-dark");
  const syntaxTheme = isDarkTheme ? customDarkTheme : customLightTheme;

  // Extract file extension for syntax highlighting
  const getLanguage = (path?: string) => {
    if (!path) return "text";
    const ext = path.split(".").pop()?.toLowerCase();
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
      makefile: "makefile",
    };
    return languageMap[ext || ""] || "text";
  };

  // Parse content to separate line numbers from code (for read type)
  const parseContent = (rawContent: string) => {
    const lines = rawContent.split("\n");
    const codeLines: string[] = [];
    let minLineNumber = Infinity;

    // First, determine if the content is likely a numbered list from the 'read' tool.
    // It is if more than half the non-empty lines match the expected format.
    const nonEmptyLines = lines.filter((line) => line.trim() !== "");
    if (nonEmptyLines.length === 0) {
      return { codeContent: rawContent, startLineNumber: 1 };
    }
    const parsableLines = nonEmptyLines.filter((line) =>
      /^\s*\d+→/.test(line),
    ).length;
    const isLikelyNumbered = parsableLines / nonEmptyLines.length > 0.5;

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
      } else if (line.trim() === "") {
        // Preserve empty lines
        codeLines.push("");
      } else {
        // If a line in a numbered block does not match, it's a formatting anomaly.
        // Render it as a blank line to avoid showing the raw, un-parsed string.
        codeLines.push("");
      }
    }

    // Remove trailing empty lines
    while (codeLines.length > 0 && codeLines[codeLines.length - 1] === "") {
      codeLines.pop();
    }

    return {
      codeContent: codeLines.join("\n"),
      startLineNumber: minLineNumber === Infinity ? 1 : minLineNumber,
    };
  };

  // Get the content to display based on type
  const getDisplayContent = () => {
    if (type === "write") {
      // For write type, use the content prop directly
      return {
        codeContent: content || "",
        startLineNumber: 1,
        isError: false,
      };
    }

    // For read type, extract from result
    if (!result) {
      return { codeContent: "", startLineNumber: 1, isError: false };
    }

    let resultContent = "";
    const isError = result.is_error || false;

    if (typeof result.content === "string") {
      resultContent = result.content;
    } else if (result.content && typeof result.content === "object") {
      if (result.content.text) {
        resultContent = result.content.text;
      } else if (Array.isArray(result.content)) {
        resultContent = result.content
          .map((c: any) =>
            typeof c === "string" ? c : c.text || JSON.stringify(c),
          )
          .join("\n");
      } else {
        resultContent = JSON.stringify(result.content, null, 2);
      }
    }

    const { codeContent, startLineNumber } = parseContent(resultContent);
    return { codeContent, startLineNumber, isError };
  };

  const { codeContent, startLineNumber, isError } = getDisplayContent();
  const language = getLanguage(filePath);
  const lineCount = codeContent
    .split("\n")
    .filter((line) => line.trim()).length;
  const isLargeFile = lineCount > LARGE_FILE_THRESHOLD;

  // Get header text based on type
  const headerText = type === "read" ? "File content" : "Write file";

  // Loading state for read type
  if (type === "read" && !result) {
    return (
      <ToolWidgetTemplate>
        <ToolWidgetTemplate.Debug label="FileWidget" />
        <ToolWidgetTemplate.Header
          icon={FileText}
          title="Read file"
          isLoading={true}
          loadingText="Loading..."
        >
          <code className="text-sm font-mono bg-background px-2 py-0.5 rounded flex-1 truncate">
            {filePath}
          </code>
        </ToolWidgetTemplate.Header>
      </ToolWidgetTemplate>
    );
  }

  // No content available
  if (!codeContent && type === "read") {
    return (
      <ToolWidgetTemplate>
        <ToolWidgetTemplate.Debug label="FileWidget" />
        <ToolWidgetTemplate.Header icon={FileText} title={headerText}>
          <code className="text-sm font-mono bg-background px-2 py-0.5 rounded flex-1 truncate">
            {filePath}
          </code>
        </ToolWidgetTemplate.Header>
        <ToolWidgetTemplate.PlainOutput>
          <div className="text-center text-muted-foreground">
            No content available
          </div>
        </ToolWidgetTemplate.PlainOutput>
      </ToolWidgetTemplate>
    );
  }

  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="FileWidget" />
      <ToolWidgetTemplate.Header icon={FileText} title={headerText}>
        <code className="text-sm font-mono bg-background px-2 py-0.5 rounded flex-1 truncate">
          {filePath}
        </code>
      </ToolWidgetTemplate.Header>

      <ToolWidgetTemplate.ExpandableResult
        headerContent={
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              {isError ? "Error" : type === "read" ? "File content" : "Preview"}
            </span>
            {!isError && lineCount > 0 && (
              <span className="text-xs text-muted-foreground">
                ({lineCount} {lineCount === 1 ? "line" : "lines"})
              </span>
            )}
          </div>
        }
        isExpandable={isLargeFile && !isError}
        initiallyExpanded={!isLargeFile}
        largeContentThreshold={LARGE_FILE_THRESHOLD}
        lineCount={lineCount}
        rawContent={codeContent}
      >
        {(excerptedContent, isShowingExcerpt, isExpanded) => (
          <>
            <div className="relative overflow-x-auto bg-background">
              <SyntaxHighlighter
                language={language}
                style={syntaxTheme}
                showLineNumbers
                startingLineNumber={startLineNumber}
                wrapLongLines={false}
                customStyle={{
                  margin: 0,
                  background: "transparent",
                  lineHeight: "1.2",
                  fontSize: "0.75rem",
                  padding: "0.75rem",
                  color: isDarkTheme ? "#ffffff" : "#000000", // Force the right base color
                }}
                codeTagProps={{
                  style: {
                    fontSize: "0.75rem",
                  },
                }}
                lineNumberStyle={{
                  minWidth: "3.5rem",
                  paddingRight: "1rem",
                  textAlign: "right",
                  opacity: 0.5,
                }}
              >
                {isError
                  ? excerptedContent || "Error occurred"
                  : excerptedContent}
              </SyntaxHighlighter>
            </div>
            {isShowingExcerpt && (
              <div className="mt-3 pt-2 border-t border-border text-xs text-muted-foreground text-center">
                --- {codeContent.split("\n").length - 5} more lines,{" "}
                {codeContent.length - excerptedContent.length} more characters
                ---
              </div>
            )}
          </>
        )}
      </ToolWidgetTemplate.ExpandableResult>
    </ToolWidgetTemplate>
  );
};
