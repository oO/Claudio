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
}

export function parseContextOutput(output: string): ContextUsage | null {
  const parseTokens = (str: string): number => {
    return str.includes('k') ? Math.round(parseFloat(str) * 1000) : parseInt(str);
  };

  // Handle empty or invalid input
  if (!output || typeof output !== 'string') {
    return null;
  }

  // Strip ANSI color codes first
  const cleanOutput = output.replace(/\u001b\[[0-9;]*m/g, '');
  const lines = cleanOutput.split('\n');

  // Get usage line - handle both old format (with •) and new format (without •)
  const usageLine = lines.find(line => line.includes('tokens') && (line.includes('•') || line.includes('Context Usage')));
  if (!usageLine) {
    return null;
  }

  let model = '';
  let tokenPart = '';

  // Try new format first (v2.0+): "Context Usage 64k/200k tokens (32%)"
  if (usageLine.includes('Context Usage')) {
    model = 'Context Usage'; // or extract model from elsewhere if available
    tokenPart = usageLine;
  } else {
    // Old format: "Model • 64k/200k tokens (32%)"
    const parts = usageLine.split('•');
    if (parts.length < 2) {
      return null;
    }
    model = parts[0].trim().replace(/[⛁⛀⛶⛵]/g, '').trim();
    tokenPart = parts[1];
  }

  const tokenMatch = tokenPart.match(/(\d+(?:\.\d+)?k?)\/(\d+(?:\.\d+)?k?)/);
  const percentageMatch = tokenPart.match(/\((\d+)%\)/);

  if (!tokenMatch || !percentageMatch) {
    return null;
  }

  const [, totalStr, maxStr] = tokenMatch;
  const percentage = parseInt(percentageMatch[1]);

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
    } else if (line.includes('⛝ Reserved:')) {
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
      if (currentSection.title === 'Custom agents') {
        const match = line.match(/└ (.+?) \((.+?)\): (\d+) tokens/);
        if (match) {
          currentSection.items.push({
            name: match[1],
            scope: match[2],
            tokens: parseInt(match[3])
          });
        }
      } else if (currentSection.title === 'Memory files') {
        const match = line.match(/└ (.+?) \((.+?)\): (\d+(?:\.\d+)?k?) tokens/);
        if (match) {
          currentSection.items.push({
            name: match[1],
            path: match[2],
            tokens: parseTokens(match[3])
          });
        }
      } else if (currentSection.title === 'SlashCommand Tool') {
        const match = line.match(/└ (.+?): (\d+) tokens/);
        if (match) {
          currentSection.items.push({
            name: match[1],
            tokens: parseInt(match[2])
          });
        }
      }
    }
  }

  // Add last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return {
    model,
    totalTokens: parseTokens(totalStr),
    maxTokens: parseTokens(maxStr),
    percentage,
    breakdown,
    sections
  };
}