import React, { useState, useEffect, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { LoadingSpinner, DebugLabel } from "@/components/ui/atoms";
import { StatusMessage } from "@/components/ui/molecules";
import {
  DatabaseHeader,
  DataTable,
  SqlEditor,
  RowEditor,
  ConfirmationDialog,
  ColumnInfo,
  TableData,
  QueryResult
} from "@/components/ui/organisms";
import { TableInfo } from "@/components/ui/molecules";
import { logger } from '@/lib/logger';

interface StorageTableInfo extends TableInfo {
  columns: ColumnInfo[];
}

/**
 * StorageTab component - A beautiful SQLite database viewer/editor
 * Refactored using Atomic Design principles
 */
export const StorageTab: React.FC = () => {
  const [tables, setTables] = useState<StorageTableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(null);
  const [newRow, setNewRow] = useState<boolean>(false);
  const [deletingRow, setDeletingRow] = useState<Record<string, any> | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSqlEditor, setShowSqlEditor] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  /**
   * Load all tables on mount
   */
  useEffect(() => {
    loadTables();
  }, []);

  /**
   * Load table data when selected table changes
   */
  useEffect(() => {
    if (selectedTable) {
      loadTableData(1);
    }
  }, [selectedTable]);

  /**
   * Load all tables from the database
   */
  const loadTables = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.storageListTables();
      const tableInfos = result.map((name: string) => ({ name, rowCount: 0, row_count: 0, columns: [] }));
      setTables(tableInfos);
      if (result.length > 0 && !selectedTable) {
        setSelectedTable(result[0]);
      }
    } catch (err) {
      logger.error("Failed to load tables:", err);
      setError("Failed to load tables");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load data for the selected table
   */
  const loadTableData = async (page: number, search?: string) => {
    if (!selectedTable) return;

    try {
      setLoading(true);
      setError(null);
      const result = await api.storageReadTable(selectedTable);
      setTableData({
        table_name: selectedTable,
        columns: [],
        rows: result,
        total_rows: result.length,
        page: 1,
        page_size: 50,
        total_pages: Math.ceil(result.length / 50)
      });
      setCurrentPage(page);
    } catch (err) {
      logger.error("Failed to load table data:", err);
      setError("Failed to load table data");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle search
   */
  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      loadTableData(1, value);
    },
    [selectedTable]
  );

  /**
   * Get primary key values for a row
   */
  const getPrimaryKeyValues = (row: Record<string, any>): Record<string, any> => {
    if (!tableData) return {};
    
    const pkColumns = tableData.columns.filter(col => col.pk);
    const pkValues: Record<string, any> = {};
    
    pkColumns.forEach(col => {
      pkValues[col.name] = row[col.name];
    });
    
    return pkValues;
  };

  /**
   * Handle row update
   */
  const handleUpdateRow = async (updates: Record<string, any>) => {
    if (!editingRow || !selectedTable) return;

    try {
      setLoading(true);
      const pkValues = getPrimaryKeyValues(editingRow);
      await api.storageUpdateRow(selectedTable, Object.values(pkValues)[0] as number, updates);
      await loadTableData(currentPage);
      setEditingRow(null);
      setToast({
        message: "Row updated successfully",
        type: "success",
      });
    } catch (err) {
      logger.error("Failed to update row:", err);
      setError("Failed to update row");
      setToast({
        message: "Failed to update row",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle row deletion
   */
  const handleDeleteRow = async () => {
    if (!deletingRow || !selectedTable) return;

    try {
      setLoading(true);
      const pkValues = getPrimaryKeyValues(deletingRow);
      await api.storageDeleteRow(selectedTable, Object.values(pkValues)[0] as number);
      await loadTableData(currentPage);
      setDeletingRow(null);
      setToast({
        message: "Row deleted successfully",
        type: "success",
      });
    } catch (err) {
      logger.error("Failed to delete row:", err);
      setError("Failed to delete row");
      setToast({
        message: "Failed to delete row",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle new row insertion
   */
  const handleInsertRow = async (values: Record<string, any>) => {
    if (!selectedTable) return;

    try {
      setLoading(true);
      await api.storageInsertRow(selectedTable, values);
      await loadTableData(currentPage);
      setNewRow(false);
      setToast({
        message: "Row inserted successfully",
        type: "success",
      });
    } catch (err) {
      logger.error("Failed to insert row:", err);
      setError("Failed to insert row");
      setToast({
        message: "Failed to insert row",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle SQL query execution
   */
  const handleExecuteSql = async (query: string): Promise<QueryResult> => {
    const result = await api.storageExecuteSql(query);
    
    // Refresh tables and data if it was a non-SELECT query
    if (result.rows_affected !== undefined) {
      await loadTables();
      if (selectedTable) {
        await loadTableData(currentPage);
      }
    }
    
    return result;
  };

  /**
   * Handle database reset
   */
  const handleResetDatabase = async () => {
    try {
      setLoading(true);
      await api.storageResetDatabase();
      await loadTables();
      setSelectedTable("");
      setTableData(null);
      setShowResetConfirm(false);
      setToast({
        message: "Database Reset Complete: The database has been restored to its default state with empty tables (agents, agent_runs, app_settings).",
        type: "success",
      });
    } catch (err) {
      logger.error("Failed to reset database:", err);
      setError("Failed to reset database");
      setToast({
        message: "Reset Failed: Failed to reset the database. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      <DebugLabel label="StorageTab" />
      {/* Database Header */}
      <DatabaseHeader
        tables={tables}
        selectedTable={selectedTable}
        searchQuery={searchQuery}
        onTableSelect={setSelectedTable}
        onSearch={handleSearch}
        onSqlEditor={() => setShowSqlEditor(true)}
        onResetDatabase={() => setShowResetConfirm(true)}
        onNewRow={() => setNewRow(true)}
        hasSelectedTable={!!tableData}
      />

      {/* Data Table */}
      {tableData && (
        <DataTable
          data={tableData}
          onEditRow={setEditingRow}
          onDeleteRow={setDeletingRow}
          onPageChange={loadTableData}
        />
      )}

      {/* Loading State */}
      {loading && (
        <LoadingSpinner size="lg" message="Loading..." className="py-12" />
      )}

      {/* Error State */}
      {error && (
        <StatusMessage
          type="error"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Row Editor - Edit Mode */}
      {editingRow && tableData && (
        <RowEditor
          isOpen={!!editingRow}
          mode="edit"
          tableName={selectedTable}
          columns={tableData.columns}
          initialData={editingRow}
          onSave={handleUpdateRow}
          onClose={() => setEditingRow(null)}
          isLoading={loading}
        />
      )}

      {/* Row Editor - Create Mode */}
      {newRow && tableData && (
        <RowEditor
          isOpen={newRow}
          mode="create"
          tableName={selectedTable}
          columns={tableData.columns}
          onSave={handleInsertRow}
          onClose={() => setNewRow(false)}
          isLoading={loading}
        />
      )}

      {/* Delete Confirmation */}
      {deletingRow && (
        <ConfirmationDialog
          isOpen={!!deletingRow}
          title="Delete Row"
          description="Are you sure you want to delete this row? This action cannot be undone."
          confirmText="Delete"
          variant="destructive"
          onConfirm={handleDeleteRow}
          onCancel={() => setDeletingRow(null)}
          isLoading={loading}
        >
          <div className="rounded-md bg-muted p-4">
            <pre className="text-xs font-mono overflow-x-auto max-h-[200px] overflow-y-auto">
              {JSON.stringify(
                Object.fromEntries(
                  Object.entries(deletingRow).map(([key, value]) => [
                    key,
                    typeof value === "string" && value.length > 100
                      ? value.substring(0, 100) + "..."
                      : value
                  ])
                ),
                null,
                2
              )}
            </pre>
          </div>
        </ConfirmationDialog>
      )}

      {/* Reset Database Confirmation */}
      <ConfirmationDialog
        isOpen={showResetConfirm}
        title="Reset Database"
        description="This will delete all data and recreate the database with its default structure (empty tables for agents, agent_runs, and app_settings). The database will be restored to the same state as when you first installed the app. This action cannot be undone."
        confirmText="Reset Database"
        variant="destructive"
        onConfirm={handleResetDatabase}
        onCancel={() => setShowResetConfirm(false)}
        isLoading={loading}
      >
        <div className="flex items-center gap-3 p-4 rounded-md bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm font-medium">
            All your agents, runs, and settings will be permanently deleted!
          </span>
        </div>
      </ConfirmationDialog>

      {/* SQL Query Editor */}
      <SqlEditor
        isOpen={showSqlEditor}
        onClose={() => setShowSqlEditor(false)}
        onExecute={handleExecuteSql}
        isLoading={loading}
      />

      {/* Toast Notification */}
      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>
    </div>
  );
};