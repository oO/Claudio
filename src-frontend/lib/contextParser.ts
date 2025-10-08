export interface ContextUsage {
  model: string;
  totalTokens: number;
  maxTokens: number;
  percentage: number;
  breakdown: {
    systemPrompt: { tokens: number; percentage: number };
    systemTools: { tokens: number; percentage: number };
    reserved: { tokens: number; percentage: number };
    customAgents: { tokens: number; percentage: number };
    memoryFiles: { tokens: number; percentage: number };
    messages: { tokens: number; percentage: number };
    freeSpace: { tokens: number; percentage: number };
  };
  sections: Array<{
    title: string;
    path: string;
    items: Array<{
      name: string;
      scope?: string;
      path?: string;
      tokens: number;
    }>;
  }>;
  parseWarnings?: string[];
}

export function parseContextOutput(output: string): ContextUsage | null {
  const parseTokens = (str: string): number => {
    return str.includes('k') ? Math.round(parseFloat(str) * 1000) : parseInt(str);
  };

  const warnings: string[] = [];

  // Handle empty or invalid input
  if (!output || typeof output !== 'string') {
    return null;
  }

  // Strip ANSI color codes first
  const cleanOutput = output.replace(/\u001b\[[0-9;]*m/g, '');
  const lines = cleanOutput.split('\n');

  // Find the usage line - v2.0+ has "Context Usage" as header, then model + tokens on next line
  const contextHeaderIndex = lines.findIndex(line => line.trim() === 'Context Usage');
  let usageLine: string | undefined;

  if (contextHeaderIndex !== -1 && contextHeaderIndex + 1 < lines.length) {
    // v2.0+ format: "Context Usage" header, then next line has model and tokens
    usageLine = lines[contextHeaderIndex + 1];
  } else {
    // Old format or single-line v2.0: find line with tokens and either • or Context Usage
    usageLine = lines.find(line => line.includes('tokens') && (line.includes('•') || line.includes('Context Usage')));
  }

  if (!usageLine || !usageLine.includes('tokens')) {
    warnings.push('Could not find usage summary line');
  }

  let model = 'Unknown';
  let tokenPart = '';
  let totalTokens = 0;
  let maxTokens = 200000; // Default fallback
  let percentage = 0;

  if (usageLine && usageLine.includes('tokens')) {
    // v2.0+ multi-line format: "⛁ ⛀ ... model-name · 149k/200k tokens (75%)"
    // Extract model name (everything before the · bullet)
    const modelMatch = usageLine.match(/([a-z0-9-]+)\s+·\s+(\d+(?:\.\d+)?k?)\/(\d+(?:\.\d+)?k?)\s+tokens/);

    if (modelMatch) {
      model = modelMatch[1];
      tokenPart = usageLine;
    } else if (usageLine.includes('Context Usage')) {
      // Single-line v2.0 format
      model = 'Context Usage';
      tokenPart = usageLine;
    } else {
      // Old format: "Model • 64k/200k tokens (32%)"
      const parts = usageLine.split('•');
      if (parts.length >= 2) {
        model = parts[0].trim().replace(/[⛁⛀⛶⛵⛝]/g, '').trim();
        tokenPart = parts[1];
      } else {
        warnings.push('Could not parse model name from usage line');
        tokenPart = usageLine;
      }
    }

    const tokenMatch = tokenPart.match(/(\d+(?:\.\d+)?k?)\/(\d+(?:\.\d+)?k?)\s+tokens/);
    const percentageMatch = tokenPart.match(/\((\d+)%\)/);

    if (tokenMatch && percentageMatch) {
      const [, totalStr, maxStr] = tokenMatch;
      totalTokens = parseTokens(totalStr);
      maxTokens = parseTokens(maxStr);
      percentage = parseInt(percentageMatch[1]);
    } else {
      warnings.push('Could not parse token counts from usage line');
    }
  }

  // Parse breakdown from the detail lines
  const breakdown = {
    systemPrompt: { tokens: 0, percentage: 0 },
    systemTools: { tokens: 0, percentage: 0 },
    reserved: { tokens: 0, percentage: 0 }, // v2.0+ includes reserved space for autocompact + output
    customAgents: { tokens: 0, percentage: 0 },
    memoryFiles: { tokens: 0, percentage: 0 },
    messages: { tokens: 0, percentage: 0 },
    freeSpace: { tokens: 0, percentage: 0 }
  };

  // Parse sections
  const sections: Array<{
    title: string;
    path: string;
    items: Array<{ name: string; scope?: string; path?: string; tokens: number }>;
  }> = [];

  let currentSection: { title: string; path: string; items: any[] } | null = null;

  for (const line of lines) {
    // Parse breakdown lines
    if (line.includes('⛁ System prompt:')) {
      const match = line.match(/(\d+(?:\.\d+)?k?) tokens \((\d+(?:\.\d+)?%)\)/);
      if (match) {
        breakdown.systemPrompt.tokens = parseTokens(match[1]);
        breakdown.systemPrompt.percentage = parseFloat(match[2]);
      }
    } else if (line.includes('⛁ System tools:')) {
      const match = line.match(/(\d+(?:\.\d+)?k?) tokens \((\d+(?:\.\d+)?%)\)/);
      if (match) {
        breakdown.systemTools.tokens = parseTokens(match[1]);
        breakdown.systemTools.percentage = parseFloat(match[2]);
      }
    } else if (line.includes('⛁ Custom agents:')) {
      const match = line.match(/(\d+(?:\.\d+)?k?) tokens \((\d+(?:\.\d+)?%)\)/);
      if (match) {
        breakdown.customAgents.tokens = parseTokens(match[1]);
        breakdown.customAgents.percentage = parseFloat(match[2]);
      }
    } else if (line.includes('⛁ Memory files:')) {
      const match = line.match(/(\d+(?:\.\d+)?k?) tokens \((\d+(?:\.\d+)?%)\)/);
      if (match) {
        breakdown.memoryFiles.tokens = parseTokens(match[1]);
        breakdown.memoryFiles.percentage = parseFloat(match[2]);
      }
    } else if (line.includes('⛝') && (line.includes('Reserved:') || line.includes('Autocompact buffer:'))) {
      const match = line.match(/(\d+(?:\.\d+)?k?) tokens \((\d+(?:\.\d+)?%)\)/);
      if (match) {
        breakdown.reserved.tokens = parseTokens(match[1]);
        breakdown.reserved.percentage = parseFloat(match[2]);
      }
    } else if (line.includes('⛁ Messages:')) {
      const match = line.match(/(\d+(?:\.\d+)?k?) tokens \((\d+(?:\.\d+)?%)\)/);
      if (match) {
        breakdown.messages.tokens = parseTokens(match[1]);
        breakdown.messages.percentage = parseFloat(match[2]);
      }
    } else if (line.includes('⛶ Free space:')) {
      const match = line.match(/(\d+(?:\.\d+)?k?) \((\d+(?:\.\d+)?%)\)/);
      if (match) {
        breakdown.freeSpace.tokens = parseTokens(match[1]);
        breakdown.freeSpace.percentage = parseFloat(match[2]);
      }
    }

    // Parse section headers
    if (line.includes('Custom agents · ')) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        title: 'Custom agents',
        path: line.split('· ')[1] || '',
        items: []
      };
    } else if (line.includes('Memory files · ')) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        title: 'Memory files',
        path: line.split('· ')[1] || '',
        items: []
      };
    } else if (line.includes('SlashCommand Tool · ')) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        title: 'SlashCommand Tool',
        path: line.split('· ')[1] || '',
        items: []
      };
    }

    // Parse section items
    if (currentSection && line.includes('└')) {
      try {
        if (currentSection.title === 'Custom agents') {
          const match = line.match(/└ (.+?) \((.+?)\): (\d+) tokens/);
          if (match) {
            currentSection.items.push({
              name: match[1],
              scope: match[2],
              tokens: parseInt(match[3])
            });
          } else {
            warnings.push(`Could not parse custom agent line: ${line.trim()}`);
          }
        } else if (currentSection.title === 'Memory files') {
          const match = line.match(/└ (.+?) \((.+?)\): (\d+(?:\.\d+)?k?) tokens/);
          if (match) {
            currentSection.items.push({
              name: match[1],
              path: match[2],
              tokens: parseTokens(match[3])
            });
          } else {
            warnings.push(`Could not parse memory file line: ${line.trim()}`);
          }
        } else if (currentSection.title === 'SlashCommand Tool') {
          const match = line.match(/└ (.+?): (\d+(?:\.\d+)?k?) tokens/);
          if (match) {
            currentSection.items.push({
              name: match[1],
              tokens: parseTokens(match[2])
            });
          } else {
            warnings.push(`Could not parse slash command line: ${line.trim()}`);
          }
        }
      } catch (error) {
        warnings.push(`Error parsing item in ${currentSection.title}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
  }

  // Add last section
  if (currentSection) {
    sections.push(currentSection);
  }

  // Only return null if we have absolutely no useful data
  if (!usageLine && sections.length === 0) {
    return null;
  }

  return {
    model,
    totalTokens,
    maxTokens,
    percentage,
    breakdown,
    sections,
    parseWarnings: warnings.length > 0 ? warnings : undefined
  };
}