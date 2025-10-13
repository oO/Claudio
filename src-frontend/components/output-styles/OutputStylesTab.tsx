import React from 'react';
import { TabPageLayout } from '@/components/common';
import { OutputStylesManager, CreateOutputStyle } from '@/components/output-styles';
import { Card, CardContent } from '@/components/ui/card';
import { useTabState } from '@/hooks/useTabState';
import { useScreenTracking } from '@/hooks/useAnalytics';
import { Tab } from '@/contexts/TabContext';
import { DebugLabel } from '@/components/ui/atoms';
import { outputStylesApi, type OutputStyle } from '@/lib/api';
import { logger } from '@/lib/logger';

interface OutputStylesTabProps {
  tab: Tab;
  isActive: boolean;
}

export const OutputStylesTab: React.FC<OutputStylesTabProps> = ({ tab, isActive }) => {
  const { updateTab } = useTabState();

  // Position tracking for style list
  const [styleListPosition, setStyleListPosition] = React.useState({ start: 1, end: 0, total: 0 });

  // Track screen when tab becomes active
  useScreenTracking(isActive ? tab.type : undefined, isActive ? tab.id : undefined);

  // Check if we're in edit mode
  if (tab.outputStyleData) {
    return (
      <div className="relative h-full">
        <DebugLabel label="OutputStylesTab" />
        <CreateOutputStyle
          style={tab.outputStyleData}
          onStyleCreated={() => {
            // Clear style data and return to styles list
            updateTab(tab.id, {
              outputStyleData: undefined,
              title: 'Output Styles'
            });
          }}
          onBack={() => {
            // Clear style data and return to styles list
            updateTab(tab.id, {
              outputStyleData: undefined,
              title: 'Output Styles'
            });
          }}
        />
      </div>
    );
  }

  return (
    <>
      <DebugLabel label="OutputStylesTab" />
      <TabPageLayout
        title="Output Styles"
        subtitle="Manage Claude Code output styles"
        contentPadding={false}
      >
        <div className="h-full flex flex-col">
          <div className="py-6 flex-1 min-h-0 flex flex-col">
            <Card className="relative flex flex-col h-full animate-fade-in">
              <CardContent className="p-0 py-3 flex flex-col h-full min-h-0">
                <div className="flex flex-col h-full gap-4">
                  {/* Position label */}
                  {styleListPosition.total > 0 && (
                    <div className="px-6 flex items-center justify-end">
                      <div className="bg-muted px-3 py-1 rounded-lg text-xs text-muted-foreground">
                        {styleListPosition.start === styleListPosition.end
                          ? `${styleListPosition.start} of ${styleListPosition.total}`
                          : `${styleListPosition.start}-${styleListPosition.end} of ${styleListPosition.total}`}
                      </div>
                    </div>
                  )}

                  <OutputStylesManager
                    className="flex-1 min-h-0"
                    onPositionChange={(start, end, total) =>
                      setStyleListPosition({ start, end, total })
                    }
                    onEditStyle={(style) => {
                      // Edit in the same tab by updating tab data
                      updateTab(tab.id, {
                        outputStyleData: style,
                        title: `Edit ${style.name}`
                      });
                    }}
                    onDeleteStyle={async (style) => {
                      try {
                        await outputStylesApi.deleteOutputStyle(style.name);
                        logger.info("Output style deleted:", style.name);
                        // Force refresh by updating tab timestamp
                        updateTab(tab.id, { lastActivityAt: Date.now() });
                      } catch (error) {
                        logger.error("Failed to delete output style:", error);
                      }
                    }}
                    onCreateStyle={() => {
                      // Create style in the same tab
                      updateTab(tab.id, {
                        outputStyleData: null, // null means create new style
                        title: 'Create Output Style'
                      });
                    }}
                    onImportStyle={() => {
                      // OutputStylesManager handles import internally
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
