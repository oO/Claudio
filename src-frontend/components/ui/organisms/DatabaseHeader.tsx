import React from "react";
import { Database, Terminal, RefreshCw, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ActionButtonGroup, ActionButtonGroupItem } from "@/components/ui/molecules/ActionButtonGroup";
import { TableSelector, TableInfo } from "@/components/ui/molecules/TableSelector";
import { SearchInput } from "@/components/ui/molecules/SearchInput";

export interface DatabaseHeaderProps {
  tables: TableInfo[];
  selectedTable: string;
  searchQuery: string;
  onTableSelect: (tableName: string) => void;
  onSearch: (query: string) => void;
  onSqlEditor: () => void;
  onResetDatabase: () => void;
  onNewRow: () => void;
  hasSelectedTable: boolean;
  className?: string;
}

export const DatabaseHeader: React.FC<DatabaseHeaderProps> = ({
  tables,
  selectedTable,
  searchQuery,
  onTableSelect,
  onSearch,
  onSqlEditor,
  onResetDatabase,
  onNewRow,
  hasSelectedTable,
  className
}) => {
  const headerActions: ActionButtonGroupItem[] = [
    {
      id: "sql-editor",
      icon: Terminal,
      label: "SQL Query",
      variant: "outline",
      onClick: onSqlEditor
    },
    {
      id: "reset-db",
      icon: RefreshCw,
      label: "Reset DB",
      variant: "destructive",
      onClick: onResetDatabase
    }
  ];

  return (
    <Card className={className}>
      <div className="p-6 space-y-4">
        {/* Title and Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Database Storage</h3>
          </div>
          <ActionButtonGroup
            actions={headerActions}
            size="sm"
            showLabels={true}
          />
        </div>

        {/* Table Selection and Search */}
        <div className="flex items-center gap-3">
          <TableSelector
            tables={tables}
            selectedTable={selectedTable}
            onTableSelect={onTableSelect}
            size="sm"
          />

          <SearchInput
            placeholder="Search in table..."
            value={searchQuery}
            onSearch={onSearch}
            size="sm"
            debounceMs={300}
          />

          {hasSelectedTable && (
            <ActionButtonGroup
              actions={[{
                id: "new-row",
                icon: Plus,
                label: "New Row",
                variant: "outline",
                onClick: onNewRow
              }]}
              size="sm"
              showLabels={true}
            />
          )}
        </div>
      </div>
    </Card>
  );
};