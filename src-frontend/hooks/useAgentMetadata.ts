import { useState, useEffect } from 'react';
import { agentsApi } from '@/lib/api/agents';
import type { AgentMetadata } from '@/lib/types/agents';
import { logger } from '@/lib/logger';

/**
 * Hook to load agent metadata from .md files
 * Caches loaded metadata to avoid repeated API calls
 */
export function useAgentMetadata(agentType: string | undefined) {
  const [metadata, setMetadata] = useState<AgentMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache for loaded agent metadata
  const [cache] = useState<Map<string, AgentMetadata>>(new Map());
  
  useEffect(() => {
    if (!agentType || agentType === "main") {
      // For main agent, return default metadata
      setMetadata({
        name: "CloCo",
        description: "Your primary Claude Code assistant",
        subagent_type: "main",
        icon: "🤖",
        color: "#6366f1"
      });
      return;
    }
    
    // Check cache first
    if (cache.has(agentType)) {
      setMetadata(cache.get(agentType)!);
      return;
    }
    
    // Load agent metadata
    const loadMetadata = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Try to load agent file metadata
        // This would need a new API endpoint to parse .md files
        const agents = await agentsApi.listAgents();
        const agent = agents.find(a => a.name === agentType);
        
        if (agent) {
          const metadata: AgentMetadata = {
            name: agent.name,
            description: agent.description,
            subagent_type: agentType,
            icon: agent.icon || "⚡",
            color: agent.color || "#8b5cf6",
            tools: agent.tools ? agent.tools.split(',').map(t => t.trim()) : []
          };
          
          cache.set(agentType, metadata);
          setMetadata(metadata);
        } else {
          // Fallback metadata for unknown agents
          const fallback: AgentMetadata = {
            name: agentType,
            subagent_type: agentType,
            icon: "⚡",
            color: "#8b5cf6"
          };
          cache.set(agentType, fallback);
          setMetadata(fallback);
        }
      } catch (err) {
        logger.error(`Failed to load metadata for agent ${agentType}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load agent metadata');
        
        // Set fallback on error
        const fallback: AgentMetadata = {
          name: agentType,
          subagent_type: agentType,
          icon: "⚡",
          color: "#8b5cf6"
        };
        setMetadata(fallback);
      } finally {
        setLoading(false);
      }
    };
    
    loadMetadata();
  }, [agentType, cache]);
  
  return { metadata, loading, error };
}

export default useAgentMetadata;