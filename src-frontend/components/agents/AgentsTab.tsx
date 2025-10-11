import React from 'react';
import { TabPageLayout } from '@/components/common';
import { AgentsManager, CreateAgent } from '@/components/agents';
import { Card, CardContent } from '@/components/ui/card';
import { useTabState } from '@/hooks/useTabState';
import { useScreenTracking } from '@/hooks/useAnalytics';
import { Tab } from '@/contexts/TabContext';
import { DebugLabel } from '@/components/ui/atoms';
import { agentsApi } from '@/lib/api';
import { logger } from '@/lib/logger';

interface AgentsTabProps {
  tab: Tab;
  isActive: boolean;
}

export const AgentsTab: React.FC<AgentsTabProps> = ({ tab, isActive }) => {
  const { updateTab } = useTabState();

  // Position tracking for agent list
  const [agentListPosition, setAgentListPosition] = React.useState({ start: 1, end: 0, total: 0 });

  // Track screen when tab becomes active
  useScreenTracking(isActive ? tab.type : undefined, isActive ? tab.id : undefined);

  // Check if we're in edit mode
  if (tab.agentData) {
    return (
      <div className="relative h-full">
        <DebugLabel label="AgentsTab" />
        <CreateAgent
        agent={tab.agentData}
        onAgentCreated={() => {
          // Clear agent data and return to agents list
          updateTab(tab.id, {
            agentData: undefined,
            title: 'Personal Agents'
          });
        }}
        onBack={() => {
          // Clear agent data and return to agents list
          updateTab(tab.id, {
            agentData: undefined,
            title: 'Personal Agents'
          });
        }}
      />
      </div>
    );
  }
  
  return (
    <>
      <DebugLabel label="AgentsTab" />
      <TabPageLayout
        title="Personal Agents"
        subtitle="Manage your personal Claude Code agents"
        contentPadding={false}
      >
        <div className="h-full flex flex-col">
          <div className="py-6 flex-1 min-h-0 flex flex-col">
            <Card className="relative flex flex-col h-full animate-fade-in">
              <CardContent className="p-0 py-3 flex flex-col h-full min-h-0">
                <div className="flex flex-col h-full gap-4">
                  {/* Position label */}
                  {agentListPosition.total > 0 && (
                    <div className="px-6 flex items-center justify-end">
                      <div className="bg-muted px-3 py-1 rounded-lg text-xs text-muted-foreground">
                        {agentListPosition.start === agentListPosition.end
                          ? `${agentListPosition.start} of ${agentListPosition.total}`
                          : `${agentListPosition.start}-${agentListPosition.end} of ${agentListPosition.total}`}
                      </div>
                    </div>
                  )}

                  <AgentsManager
                    className="flex-1 min-h-0"
                    onPositionChange={(start, end, total) =>
                      setAgentListPosition({ start, end, total })
                    }
                    onEditAgent={(agent) => {
                    // Edit in the same tab by updating tab data
                    updateTab(tab.id, {
                      agentData: agent,
                      title: `Edit ${agent.name}`
                    });
                  }}
                  onExportAgent={async (agent) => {
                    // Export functionality is handled by AgentsManager
                    // Agent export will be handled
                  }}
                  onDeleteAgent={async (agent) => {
                    if (!agent.id) {
                      logger.error("Cannot delete agent without ID");
                      return;
                    }
                    try {
                      await agentsApi.deleteAgent(agent.id);
                      logger.info("Agent deleted:", agent.name);
                      // Force refresh by updating tab timestamp
                      updateTab(tab.id, { lastActivityAt: Date.now() });
                    } catch (error) {
                      logger.error("Failed to delete agent:", error);
                    }
                  }}
                  onCreateAgent={() => {
                    // Create agent in the same tab
                    updateTab(tab.id, {
                      agentData: null, // null means create new agent
                      title: 'Create Agent'
                    });
                  }}
                  onImportAgent={() => {
                    // AgentsManager handles import internally
                  }}
                />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </TabPageLayout>
    </>
  );
};