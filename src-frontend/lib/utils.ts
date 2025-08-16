import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple class values into a single string using clsx and tailwind-merge.
 * This utility function helps manage dynamic class names and prevents Tailwind CSS conflicts.
 * 
 * @param inputs - Array of class values that can be strings, objects, arrays, etc.
 * @returns A merged string of class names with Tailwind conflicts resolved
 * 
 * @example
 * cn("px-2 py-1", condition && "bg-blue-500", { "text-white": isActive })
 * // Returns: "px-2 py-1 bg-blue-500 text-white" (when condition and isActive are true)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Prettifies a project name by converting directory names to human-readable titles.
 * Handles various naming conventions like kebab-case, snake_case, and camelCase.
 * 
 * @param path - The project path or directory name to prettify
 * @returns A human-readable title
 * 
 * @example
 * prettifyProjectName("/Users/olivier/Projects/claudio") // "Claudio"
 * prettifyProjectName("figma-mcp-write-server") // "Figma MCP Write Server"  
 * prettifyProjectName("py_mcp_client") // "Py MCP Client"
 * prettifyProjectName("myAwesomeProject") // "My Awesome Project"
 */
export function prettifyProjectName(path: string): string {
  // Extract the last part of the path (directory name)
  const projectName = path.split("/").filter(Boolean).pop() || path;
  
  // Common acronyms to preserve in uppercase
  const acronyms = new Set([
    'api', 'url', 'http', 'https', 'json', 'xml', 'html', 'css', 'js', 'ts',
    'mcp', 'cli', 'sdk', 'ui', 'ux', 'ai', 'ml', 'id', 'db', 'sql', 'nosql',
    'rest', 'graphql', 'jwt', 'oauth', 'ssl', 'tls', 'tcp', 'udp', 'ip',
    'aws', 'gcp', 'cdn', 'dns', 'vpn', 'ssh', 'ftp', 'smtp', 'imap', 'pop',
    'crud', 'mvp', 'poc', 'qa', 'ci', 'cd', 'dev', 'prod', 'env'
  ]);
  
  // Convert various naming conventions to space-separated words
  const words = projectName
    // Handle kebab-case and underscores
    .replace(/[-_]/g, " ")
    // Handle camelCase by inserting spaces before uppercase letters
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // Handle sequences of uppercase letters (like "MCP" -> "MCP")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    // Split on spaces and filter out empty strings
    .split(/\s+/)
    .filter(Boolean);
  
  // Capitalize each word appropriately
  return words
    .map(word => {
      const lowerWord = word.toLowerCase();
      
      // Check if it's a known acronym
      if (acronyms.has(lowerWord)) {
        return word.toUpperCase();
      }
      
      // Keep original all-caps words as they are (for custom acronyms)
      if (word.length > 1 && word === word.toUpperCase()) {
        return word;
      }
      
      // Capitalize first letter of other words
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

 