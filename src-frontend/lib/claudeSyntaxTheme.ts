/**
 * Claude-themed syntax highlighting using CSS classes
 * Migrated from JavaScript theme objects to CSS for better maintainability
 */

/**
 * Get CSS classes for syntax highlighting
 * Use this instead of inline style objects
 * 
 * @example
 * // Old way (deprecated):
 * style={getClaudeSyntaxTheme(theme)}
 * 
 * // New way:
 * className="syntax-highlight"
 */
export const getSyntaxHighlightClasses = () => {
  return {
    base: 'syntax-highlight',
    comment: 'syntax-comment',
    punctuation: 'syntax-punctuation', 
    property: 'syntax-property',
    tag: 'syntax-tag',
    string: 'syntax-string',
    function: 'syntax-function',
    keyword: 'syntax-keyword',
    variable: 'syntax-variable',
    operator: 'syntax-operator',
    number: 'syntax-number',
    boolean: 'syntax-boolean',
    regex: 'syntax-regex'
  };
};

/**
 * Legacy function for backwards compatibility
 * @deprecated Use CSS classes instead
 * @returns Empty object (all styling handled by CSS)
 */
export const getClaudeSyntaxTheme = (theme?: any): any => {
  // Return empty object - CSS classes handle all styling now
  // This maintains compatibility while components are updated
  return {};
};

// Export default to maintain backwards compatibility
export default getClaudeSyntaxTheme;